// SPDX-License-Identifier: AGPL-3.0-or-later

import {
	E2EE_MESSAGE_VERSION,
	type E2eeMessageEnvelope,
	parseMessageEnvelope,
	serializeMessageEnvelope,
} from '@hearth/channel_e2ee/src/Envelope';
import {E2eeDecryptError, E2eeEnvelopeError} from '@hearth/channel_e2ee/src/Errors';
import {deriveContentKeyId} from '@hearth/channel_e2ee/src/Keys';
import {getRandomBytes, getSubtle} from '@hearth/channel_e2ee/src/Subtle';
import {base64ToUint8Array, stringToUint8Array, uint8ArrayToBase64, uint8ArrayToString} from 'uint8array-extras';

const MESSAGE_IV_BYTES = 12;

function copyBuffer(bytes: Uint8Array): ArrayBuffer {
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function encodeAad(aad: string | undefined): ArrayBuffer | undefined {
	return aad === undefined ? undefined : copyBuffer(stringToUint8Array(aad));
}

// Encrypts a plaintext message for one channel content key. The return value
// is the JSON envelope that should be sent verbatim as message content with
// the E2EE message flag set.
export async function encryptMessageContent(params: {
	contentKey: CryptoKey;
	keyId?: string;
	epoch: number;
	plaintext: string;
	aad?: string;
}): Promise<string> {
	if (!Number.isInteger(params.epoch) || params.epoch < 0) {
		throw new E2eeEnvelopeError('e2ee message epoch must be a non-negative integer');
	}
	const subtle = getSubtle();
	const iv = getRandomBytes(MESSAGE_IV_BYTES);
	const ciphertext = new Uint8Array(
		await subtle.encrypt(
			{name: 'AES-GCM', iv: copyBuffer(iv), additionalData: encodeAad(params.aad)},
			params.contentKey,
			copyBuffer(stringToUint8Array(params.plaintext)),
		),
	);
	const envelope: E2eeMessageEnvelope = {
		v: E2EE_MESSAGE_VERSION,
		key_id: params.keyId ?? (await deriveContentKeyId(params.contentKey)),
		epoch: params.epoch,
		iv: uint8ArrayToBase64(iv, {urlSafe: true}),
		ct: uint8ArrayToBase64(ciphertext, {urlSafe: true}),
	};
	return serializeMessageEnvelope(envelope);
}

// Decrypts a message content envelope. Throws E2eeDecryptError when the
// content key does not match or the ciphertext was tampered with.
export async function decryptMessageContent(params: {
	contentKey: CryptoKey;
	content: string;
	aad?: string;
}): Promise<string> {
	const envelope = parseMessageEnvelope(params.content);
	if (envelope === null) {
		throw new E2eeEnvelopeError('message content is not a v1 e2ee envelope');
	}
	const subtle = getSubtle();
	let iv: Uint8Array;
	let ciphertext: Uint8Array;
	try {
		iv = base64ToUint8Array(envelope.iv);
		ciphertext = base64ToUint8Array(envelope.ct);
	} catch {
		throw new E2eeEnvelopeError('e2ee envelope contains invalid base64 fields');
	}
	let plaintext: Uint8Array;
	try {
		plaintext = new Uint8Array(
			await subtle.decrypt(
				{name: 'AES-GCM', iv: copyBuffer(iv), additionalData: encodeAad(params.aad)},
				params.contentKey,
				copyBuffer(ciphertext),
			),
		);
	} catch (error) {
		throw new E2eeDecryptError('e2ee message could not be decrypted with this content key', {cause: error});
	}
	return uint8ArrayToString(plaintext);
}
