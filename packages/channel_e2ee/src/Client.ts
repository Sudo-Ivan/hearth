// SPDX-License-Identifier: AGPL-3.0-or-later

import {parseMessageEnvelope} from '@hearth/channel_e2ee/src/Envelope';
import {E2eeDecryptError, E2eeEnvelopeError, E2eeKeyUnwrapError} from '@hearth/channel_e2ee/src/Errors';
import {
	deriveContentKeyId,
	exportIdentityPublicKey,
	generateContentKey,
	importIdentityPublicKey,
	unwrapContentKey,
	wrapContentKeyForRecipient,
} from '@hearth/channel_e2ee/src/Keys';
import {decryptMessageContent, encryptMessageContent} from '@hearth/channel_e2ee/src/Messages';
import {getRandomBytes, getSubtle} from '@hearth/channel_e2ee/src/Subtle';
import {uint8ArrayToBase64} from 'uint8array-extras';

const DEVICE_ID_BYTES = 16;
const SEEDED_PLAINTEXT_CAP = 2000;
const MAX_DISTRIBUTION_ATTEMPTS = 2;

// The device identity record persisted by the host app. publicKey and
// privateKey are WebCrypto keys: the private key is generated non-extractable
// and the pair is stored in IndexedDB via structured clone, so key material
// never exists outside the crypto module.
export interface E2eeDeviceIdentity {
	userId: string;
	deviceId: string;
	publicKey: CryptoKey;
	privateKey: CryptoKey;
	publishedIdentityKey: string | null;
}

// Host-provided persistence for the device identity. Implementations are
// expected to back this with IndexedDB.
export interface E2eeDeviceKeyStore {
	loadDeviceIdentity(userId: string): Promise<E2eeDeviceIdentity | null>;
	saveDeviceIdentity(identity: E2eeDeviceIdentity): Promise<void>;
}

// Minimal transport seam so the client stays free of fetch and app transport
// details. Paths include any query string.
export interface E2eeTransport {
	get<T>(path: string): Promise<T>;
	post<T>(path: string, body: unknown): Promise<T>;
	put<T>(path: string, body: unknown): Promise<T>;
}

export interface E2eeMemberDeviceKey {
	user_id: string;
	device_id: string;
	identity_key: string;
	signed_prekey: string | null;
	signature: string | null;
}

export interface E2eeWrappedKeyEntry {
	epoch: number;
	sender_user_id: string;
	device_id: string;
	wrapped_key: string;
}

export interface E2eeChannelKeyBundle {
	epoch: number;
	devices: Array<E2eeMemberDeviceKey>;
	wrapped_keys: Array<E2eeWrappedKeyEntry>;
}

interface E2eePublishKeysResponse {
	devices: Array<{device_id: string; identity_key: string}>;
}

interface E2eeDistributeKeysResponse {
	epoch: number;
}

function channelAad(channelId: string): string {
	return `channel:${channelId}`;
}

function channelKeysPath(channelId: string, memberUserIds: ReadonlyArray<string>): string {
	if (memberUserIds.length === 0) {
		return `/channels/${channelId}/e2ee/keys`;
	}
	const query = memberUserIds.map((id) => `user_ids=${encodeURIComponent(id)}`).join('&');
	return `/channels/${channelId}/e2ee/keys?${query}`;
}

// Orchestrates the channel e2ee flow: device identity lifecycle, content key
// distribution and message envelope encryption. All state is in memory except
// the device identity, which lives in the injected key store.
//
// Content keys unwrapped from other senders are non-extractable, so their
// key_id cannot be derived locally. Incoming envelopes are matched by epoch
// and decrypted by trying each unwrapped key for that epoch. Sending always
// uses a self-generated (extractable) content key, wrapped once per epoch for
// every member device, so the envelope key_id stays derivable for the sender.
export class ChannelE2eeClient {
	private readonly transport: E2eeTransport;
	private readonly keyStore: E2eeDeviceKeyStore;
	private readonly identityByUser = new Map<string, E2eeDeviceIdentity>();
	private readonly pendingIdentities = new Map<string, Promise<E2eeDeviceIdentity>>();
	private readonly keysByChannelEpoch = new Map<string, Map<number, Array<CryptoKey>>>();
	private readonly seenWrappedKeys = new Map<string, Set<string>>();
	private readonly outgoingByChannel = new Map<string, {epoch: number; keyId: string; contentKey: CryptoKey}>();
	private readonly plaintextByContent = new Map<string, string>();
	private readonly pendingDecrypts = new Map<string, Promise<string>>();

	constructor(deps: {transport: E2eeTransport; keyStore: E2eeDeviceKeyStore}) {
		this.transport = deps.transport;
		this.keyStore = deps.keyStore;
	}

	private async createDeviceIdentity(userId: string): Promise<E2eeDeviceIdentity> {
		const subtle = getSubtle();
		const pair = (await subtle.generateKey({name: 'X25519'}, false, ['deriveBits'])) as unknown as {
			publicKey: CryptoKey;
			privateKey: CryptoKey;
		};
		const identity: E2eeDeviceIdentity = {
			userId,
			deviceId: uint8ArrayToBase64(getRandomBytes(DEVICE_ID_BYTES), {urlSafe: true}),
			publicKey: pair.publicKey,
			privateKey: pair.privateKey,
			publishedIdentityKey: null,
		};
		await this.keyStore.saveDeviceIdentity(identity);
		return identity;
	}

	// Loads the device identity for this user, generating and persisting a new
	// non-extractable X25519 pair on first use. Does not publish.
	async loadOrCreateIdentity(userId: string): Promise<E2eeDeviceIdentity> {
		const cached = this.identityByUser.get(userId);
		if (cached) return cached;
		const pending = this.pendingIdentities.get(userId);
		if (pending) return pending;
		const task = (async () => {
			const stored = await this.keyStore.loadDeviceIdentity(userId);
			const identity = stored ?? (await this.createDeviceIdentity(userId));
			this.identityByUser.set(userId, identity);
			return identity;
		})();
		this.pendingIdentities.set(userId, task);
		try {
			return await task;
		} finally {
			this.pendingIdentities.delete(userId);
		}
	}

	// Publishes the device identity public key. Runs once per device: a stored
	// identity whose publishedIdentityKey matches the current public key is a
	// no-op. Failed publishes clear the flag so the next call retries.
	async ensurePublishedIdentity(userId: string): Promise<E2eeDeviceIdentity> {
		const identity = await this.loadOrCreateIdentity(userId);
		const publicKeyBase64 = await exportIdentityPublicKey(identity.publicKey);
		if (identity.publishedIdentityKey === publicKeyBase64) {
			return identity;
		}
		await this.transport.post<E2eePublishKeysResponse>('/users/@me/e2ee/keys', {
			devices: [{device_id: identity.deviceId, identity_key: publicKeyBase64}],
		});
		identity.publishedIdentityKey = publicKeyBase64;
		await this.keyStore.saveDeviceIdentity(identity);
		return identity;
	}

	async getChannelKeyBundle(channelId: string, memberUserIds: ReadonlyArray<string>): Promise<E2eeChannelKeyBundle> {
		return this.transport.get<E2eeChannelKeyBundle>(channelKeysPath(channelId, memberUserIds));
	}

	private storeContentKey(channelId: string, epoch: number, contentKey: CryptoKey): void {
		let byEpoch = this.keysByChannelEpoch.get(channelId);
		if (!byEpoch) {
			byEpoch = new Map();
			this.keysByChannelEpoch.set(channelId, byEpoch);
		}
		let keys = byEpoch.get(epoch);
		if (!keys) {
			keys = [];
			byEpoch.set(epoch, keys);
		}
		keys.push(contentKey);
	}

	// Unwraps every wrapped key addressed to this device and caches the
	// content keys by epoch. Wraps for other devices, duplicates and wraps
	// that fail to unwrap are skipped.
	private async ingestWrappedKeys(
		channelId: string,
		identity: E2eeDeviceIdentity,
		wrappedKeys: ReadonlyArray<E2eeWrappedKeyEntry>,
	): Promise<void> {
		let seen = this.seenWrappedKeys.get(channelId);
		if (!seen) {
			seen = new Set();
			this.seenWrappedKeys.set(channelId, seen);
		}
		for (const entry of wrappedKeys) {
			if (entry.device_id !== identity.deviceId || seen.has(entry.wrapped_key)) continue;
			seen.add(entry.wrapped_key);
			try {
				const contentKey = await unwrapContentKey({
					wrappedKey: entry.wrapped_key,
					recipientPrivateKey: identity.privateKey,
				});
				this.storeContentKey(channelId, entry.epoch, contentKey);
			} catch {}
		}
	}

	private async distributeContentKey(params: {
		channelId: string;
		bundle: E2eeChannelKeyBundle;
	}): Promise<{keyId: string; contentKey: CryptoKey}> {
		const contentKey = await generateContentKey();
		const keys: Array<{user_id: string; device_id: string; wrapped_key: string}> = [];
		for (const device of params.bundle.devices) {
			const recipientPublicKey = await importIdentityPublicKey(device.identity_key);
			const wrappedKey = await wrapContentKeyForRecipient({contentKey, recipientPublicKey});
			keys.push({user_id: device.user_id, device_id: device.device_id, wrapped_key: wrappedKey});
		}
		if (keys.length === 0) {
			throw new E2eeKeyUnwrapError('e2ee channel has no member device keys to distribute to');
		}
		const response = await this.transport.put<E2eeDistributeKeysResponse>(`/channels/${params.channelId}/e2ee/keys`, {
			epoch: params.bundle.epoch,
			keys,
		});
		const keyId = await deriveContentKeyId(contentKey);
		this.storeContentKey(params.channelId, response.epoch, contentKey);
		return {keyId, contentKey};
	}

	// Returns the content key for the channel's current epoch, reusing the
	// key this device already distributed when possible and wrapping a fresh
	// key for every member device otherwise. One retry covers a concurrent
	// epoch bump.
	async ensureOutgoingContentKey(params: {
		userId: string;
		channelId: string;
		memberUserIds: ReadonlyArray<string>;
	}): Promise<{epoch: number; keyId: string; contentKey: CryptoKey}> {
		await this.ensurePublishedIdentity(params.userId);
		let lastError: unknown;
		for (let attempt = 0; attempt < MAX_DISTRIBUTION_ATTEMPTS; attempt++) {
			const memberUserIds = Array.from(new Set([...params.memberUserIds, params.userId]));
			const bundle = await this.getChannelKeyBundle(params.channelId, memberUserIds);
			const outgoing = this.outgoingByChannel.get(params.channelId);
			if (outgoing && outgoing.epoch === bundle.epoch) {
				return {epoch: outgoing.epoch, keyId: outgoing.keyId, contentKey: outgoing.contentKey};
			}
			try {
				const stored = await this.distributeContentKey({channelId: params.channelId, bundle});
				this.outgoingByChannel.set(params.channelId, {
					epoch: bundle.epoch,
					keyId: stored.keyId,
					contentKey: stored.contentKey,
				});
				return {epoch: bundle.epoch, keyId: stored.keyId, contentKey: stored.contentKey};
			} catch (error) {
				lastError = error;
			}
		}
		throw lastError instanceof Error ? lastError : new E2eeKeyUnwrapError('e2ee content key distribution failed');
	}

	// Encrypts plaintext into a v1 envelope bound to the channel. The sender
	// should send the returned string verbatim as message content with the
	// E2EE message flag set.
	async encryptForChannel(params: {
		userId: string;
		channelId: string;
		memberUserIds: ReadonlyArray<string>;
		plaintext: string;
	}): Promise<string> {
		const {contentKey, epoch} = await this.ensureOutgoingContentKey({
			userId: params.userId,
			channelId: params.channelId,
			memberUserIds: params.memberUserIds,
		});
		const content = await encryptMessageContent({
			contentKey,
			epoch,
			plaintext: params.plaintext,
			aad: channelAad(params.channelId),
		});
		this.rememberPlaintext(content, params.plaintext);
		return content;
	}

	// Seeds the local plaintext cache so messages this device just encrypted
	// render without a key unwrap round trip.
	rememberPlaintext(envelopeContent: string, plaintext: string): void {
		if (this.plaintextByContent.size >= SEEDED_PLAINTEXT_CAP) {
			const oldest = this.plaintextByContent.keys().next().value;
			if (oldest !== undefined) this.plaintextByContent.delete(oldest);
		}
		this.plaintextByContent.set(envelopeContent, plaintext);
	}

	// Decrypts a v1 envelope from a channel. Throws E2eeEnvelopeError when the
	// content is not an envelope, E2eeKeyUnwrapError when no wrap for this
	// device covers the message epoch, and E2eeDecryptError when a candidate
	// key exists but the ciphertext does not verify.
	async decryptFromChannel(params: {userId: string; channelId: string; content: string}): Promise<string> {
		const cacheKey = `${params.channelId}\n${params.content}`;
		const pending = this.pendingDecrypts.get(cacheKey);
		if (pending) return pending;
		const task = this.decryptFromChannelInner(params);
		this.pendingDecrypts.set(cacheKey, task);
		try {
			return await task;
		} finally {
			this.pendingDecrypts.delete(cacheKey);
		}
	}

	private async tryDecryptWithEpochKeys(params: {
		channelId: string;
		epoch: number;
		content: string;
	}): Promise<string | null> {
		const candidates = this.keysByChannelEpoch.get(params.channelId)?.get(params.epoch) ?? [];
		for (const contentKey of candidates) {
			try {
				return await decryptMessageContent({
					contentKey,
					content: params.content,
					aad: channelAad(params.channelId),
				});
			} catch {}
		}
		return null;
	}

	private async decryptFromChannelInner(params: {userId: string; channelId: string; content: string}): Promise<string> {
		const envelope = parseMessageEnvelope(params.content);
		if (envelope === null) {
			throw new E2eeEnvelopeError('message content is not a v1 e2ee envelope');
		}
		const seeded = this.plaintextByContent.get(params.content);
		if (seeded !== undefined) {
			return seeded;
		}
		const first = await this.tryDecryptWithEpochKeys({
			channelId: params.channelId,
			epoch: envelope.epoch,
			content: params.content,
		});
		if (first !== null) {
			return first;
		}
		const identity = await this.loadOrCreateIdentity(params.userId);
		const bundle = await this.getChannelKeyBundle(params.channelId, []);
		await this.ingestWrappedKeys(params.channelId, identity, bundle.wrapped_keys);
		const second = await this.tryDecryptWithEpochKeys({
			channelId: params.channelId,
			epoch: envelope.epoch,
			content: params.content,
		});
		if (second !== null) {
			return second;
		}
		const candidates = this.keysByChannelEpoch.get(params.channelId)?.get(envelope.epoch) ?? [];
		if (candidates.length === 0) {
			throw new E2eeKeyUnwrapError('no wrapped content key for this device covers the message epoch');
		}
		throw new E2eeDecryptError('e2ee message could not be decrypted with any known content key');
	}

	// Drops all in-memory key material and caches, for example on logout.
	clear(): void {
		this.identityByUser.clear();
		this.pendingIdentities.clear();
		this.keysByChannelEpoch.clear();
		this.seenWrappedKeys.clear();
		this.outgoingByChannel.clear();
		this.plaintextByContent.clear();
		this.pendingDecrypts.clear();
	}
}
