// SPDX-License-Identifier: AGPL-3.0-or-later

import {
	E2EE_WRAP_ALGORITHM,
	E2EE_WRAP_VERSION,
	type E2eeWrappedKeyEnvelope,
	parseWrappedKey,
	serializeWrappedKey,
} from '@hearth/channel_e2ee/src/Envelope';
import {E2eeEnvelopeError, E2eeKeyUnwrapError} from '@hearth/channel_e2ee/src/Errors';
import {getRandomBytes, getSubtle} from '@hearth/channel_e2ee/src/Subtle';
import {base64ToUint8Array, stringToUint8Array, uint8ArrayToBase64} from 'uint8array-extras';

const X25519_ALGORITHM = {name: 'X25519'} as const;
const X25519_PUBLIC_KEY_BYTES = 32;
const CONTENT_KEY_BYTES = 32;
const WRAP_IV_BYTES = 12;
const KEY_ID_BYTES = 12;
const KEY_WRAP_HKDF_INFO = 'hearth e2ee channel key wrap v1';

export interface E2eeIdentityKeyPair {
	publicKey: CryptoKey;
	privateKey: CryptoKey;
}

function bytesToBase64Url(bytes: Uint8Array | ArrayBuffer): string {
	return uint8ArrayToBase64(toUint8(bytes), {urlSafe: true});
}

function toUint8(bytes: Uint8Array | ArrayBuffer): Uint8Array {
	return bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
}

function base64UrlToBytes(value: string, field: string): Uint8Array {
	try {
		return base64ToUint8Array(value);
	} catch {
		throw new E2eeEnvelopeError(`e2ee field ${field} is not valid base64url`);
	}
}

export async function generateIdentityKeyPair(): Promise<E2eeIdentityKeyPair> {
	const keyPair = (await getSubtle().generateKey(X25519_ALGORITHM, true, ['deriveBits'])) as E2eeIdentityKeyPair;
	return {publicKey: keyPair.publicKey, privateKey: keyPair.privateKey};
}

export async function exportIdentityPublicKey(publicKey: CryptoKey): Promise<string> {
	const raw = await getSubtle().exportKey('raw', publicKey);
	return bytesToBase64Url(raw);
}

export async function importIdentityPublicKey(encoded: string): Promise<CryptoKey> {
	const raw = base64UrlToBytes(encoded, 'identity_key');
	if (raw.byteLength !== X25519_PUBLIC_KEY_BYTES) {
		throw new E2eeEnvelopeError('e2ee identity key must be a 32 byte X25519 public key');
	}
	return getSubtle().importKey('raw', copyBuffer(raw), X25519_ALGORITHM, false, []);
}

function copyBuffer(bytes: Uint8Array): ArrayBuffer {
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

// The channel content key is a random AES-256-GCM key shared with every
// current channel member through per-device key wraps. One content key is
// used for one key epoch: when membership shrinks the server mints a new
// epoch and senders distribute a fresh content key.
export async function generateContentKey(): Promise<CryptoKey> {
	const raw = getRandomBytes(CONTENT_KEY_BYTES);
	return getSubtle().importKey('raw', copyBuffer(raw), {name: 'AES-GCM', length: 256}, true, ['encrypt', 'decrypt']);
}

export async function exportContentKey(contentKey: CryptoKey): Promise<Uint8Array> {
	return toUint8(await getSubtle().exportKey('raw', contentKey));
}

export async function importContentKey(raw: Uint8Array): Promise<CryptoKey> {
	if (raw.byteLength !== CONTENT_KEY_BYTES) {
		throw new E2eeEnvelopeError('e2ee content key must be 32 bytes');
	}
	return getSubtle().importKey('raw', copyBuffer(raw), {name: 'AES-GCM', length: 256}, false, ['encrypt', 'decrypt']);
}

// Stable fingerprint of a content key, embedded in every message envelope so
// recipients can pick the right unwrapped key. Never reversible to the key.
export async function deriveContentKeyId(contentKey: CryptoKey): Promise<string> {
	const raw = await exportContentKey(contentKey);
	const digest = await getSubtle().digest('SHA-256', copyBuffer(raw));
	return bytesToBase64Url(new Uint8Array(digest).slice(0, KEY_ID_BYTES));
}

async function ecdhSharedSecret(privateKey: CryptoKey, publicKey: CryptoKey): Promise<Uint8Array> {
	const bits = await getSubtle().deriveBits({name: 'X25519', public: publicKey}, privateKey, 256);
	return new Uint8Array(bits);
}

async function deriveWrapKey(sharedSecret: Uint8Array, salt: Uint8Array): Promise<CryptoKey> {
	const subtle = getSubtle();
	const hkdfKey = await subtle.importKey('raw', copyBuffer(sharedSecret), 'HKDF', false, ['deriveKey']);
	return subtle.deriveKey(
		{
			name: 'HKDF',
			hash: 'SHA-256',
			salt: copyBuffer(salt),
			info: stringToUint8Array(KEY_WRAP_HKDF_INFO),
		},
		hkdfKey,
		{name: 'AES-GCM', length: 256},
		false,
		['encrypt', 'decrypt'],
	);
}

// Wraps a channel content key for one recipient identity key using an
// ephemeral X25519 key pair. The sender generates a fresh ephemeral pair per
// wrap, so recipients only need their own identity private key plus the
// envelope to unwrap.
export async function wrapContentKeyForRecipient(params: {
	contentKey: CryptoKey;
	recipientPublicKey: CryptoKey;
}): Promise<string> {
	const subtle = getSubtle();
	const ephemeral = (await subtle.generateKey(X25519_ALGORITHM, true, ['deriveBits'])) as E2eeIdentityKeyPair;
	const sharedSecret = await ecdhSharedSecret(ephemeral.privateKey, params.recipientPublicKey);
	const ephemeralPublicRaw = toUint8(await subtle.exportKey('raw', ephemeral.publicKey));
	const wrapKey = await deriveWrapKey(sharedSecret, ephemeralPublicRaw);
	const iv = getRandomBytes(WRAP_IV_BYTES);
	const contentKeyRaw = await exportContentKey(params.contentKey);
	const ciphertext = toUint8(
		await subtle.encrypt({name: 'AES-GCM', iv: copyBuffer(iv)}, wrapKey, copyBuffer(contentKeyRaw)),
	);
	const envelope: E2eeWrappedKeyEnvelope = {
		v: E2EE_WRAP_VERSION,
		alg: E2EE_WRAP_ALGORITHM,
		epub: bytesToBase64Url(ephemeralPublicRaw),
		iv: bytesToBase64Url(iv),
		ct: bytesToBase64Url(ciphertext),
	};
	return serializeWrappedKey(envelope);
}

export async function unwrapContentKey(params: {
	wrappedKey: string;
	recipientPrivateKey: CryptoKey;
}): Promise<CryptoKey> {
	const subtle = getSubtle();
	const envelope = parseWrappedKey(params.wrappedKey);
	const ephemeralPublicRaw = base64UrlToBytes(envelope.epub, 'epub');
	if (ephemeralPublicRaw.byteLength !== X25519_PUBLIC_KEY_BYTES) {
		throw new E2eeKeyUnwrapError('e2ee wrapped key carries an invalid ephemeral public key');
	}
	const ephemeralPublicKey = await subtle.importKey('raw', copyBuffer(ephemeralPublicRaw), X25519_ALGORITHM, false, []);
	const sharedSecret = await ecdhSharedSecret(params.recipientPrivateKey, ephemeralPublicKey);
	const wrapKey = await deriveWrapKey(sharedSecret, ephemeralPublicRaw);
	const iv = base64UrlToBytes(envelope.iv, 'iv');
	const ciphertext = base64UrlToBytes(envelope.ct, 'ct');
	let contentKeyRaw: Uint8Array;
	try {
		contentKeyRaw = toUint8(
			await subtle.decrypt({name: 'AES-GCM', iv: copyBuffer(iv)}, wrapKey, copyBuffer(ciphertext)),
		);
	} catch (error) {
		throw new E2eeKeyUnwrapError('e2ee wrapped key could not be unwrapped by this identity key', {cause: error});
	}
	if (contentKeyRaw.byteLength !== CONTENT_KEY_BYTES) {
		throw new E2eeKeyUnwrapError('e2ee wrapped key did not unwrap to a 32 byte content key');
	}
	return importContentKey(contentKeyRaw);
}
