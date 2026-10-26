// SPDX-License-Identifier: AGPL-3.0-or-later

import {
	ChannelE2eeClient,
	type E2eeChannelKeyBundle,
	type E2eeDeviceIdentity,
	type E2eeDeviceKeyStore,
	type E2eeTransport,
} from '@hearth/channel_e2ee/src/Client';
import {E2eeKeyUnwrapError} from '@hearth/channel_e2ee/src/Errors';
import {exportIdentityPublicKey, generateIdentityKeyPair} from '@hearth/channel_e2ee/src/Keys';
import {describe, expect, it} from 'vitest';

class MemoryKeyStore implements E2eeDeviceKeyStore {
	readonly records = new Map<string, E2eeDeviceIdentity>();

	async loadDeviceIdentity(userId: string): Promise<E2eeDeviceIdentity | null> {
		return this.records.get(userId) ?? null;
	}

	async saveDeviceIdentity(identity: E2eeDeviceIdentity): Promise<void> {
		this.records.set(identity.userId, identity);
	}
}

interface RecordedCall {
	method: 'GET' | 'POST' | 'PUT';
	path: string;
	body?: unknown;
}

// In-memory stand-in for the hearth API e2ee endpoints. Tracks published
// device keys and stored wrapped keys per channel.
class FakeTransport implements E2eeTransport {
	readonly calls: Array<RecordedCall> = [];
	readonly devicesByUser = new Map<string, Array<{device_id: string; identity_key: string}>>();
	readonly wrappedByChannel = new Map<
		string,
		Map<string, Array<{epoch: number; device_id: string; wrapped_key: string}>>
	>();
	readonly epochByChannel = new Map<string, number>();
	requestUserId = '';
	failNextPut = false;

	private unwrapCallersKeys(channelId: string, userId: string) {
		return (this.wrappedByChannel.get(channelId)?.get(userId) ?? []).map((entry) => ({
			epoch: entry.epoch,
			sender_user_id: 'sender',
			device_id: entry.device_id,
			wrapped_key: entry.wrapped_key,
		}));
	}

	async get<T>(path: string): Promise<T> {
		this.calls.push({method: 'GET', path});
		const match = path.match(/^\/channels\/([^/?]+)\/e2ee\/keys(?:\?(.*))?$/);
		if (!match) throw new Error(`unexpected GET ${path}`);
		const channelId = match[1]!;
		const userIds = new URLSearchParams(match[2] ?? '').getAll('user_ids');
		const devices: Array<{
			user_id: string;
			device_id: string;
			identity_key: string;
			signed_prekey: string | null;
			signature: string | null;
		}> = [];
		for (const userId of userIds) {
			for (const device of this.devicesByUser.get(userId) ?? []) {
				devices.push({user_id: userId, ...device, signed_prekey: null, signature: null});
			}
		}
		const bundle: E2eeChannelKeyBundle = {
			epoch: this.epochByChannel.get(channelId) ?? 0,
			devices,
			wrapped_keys: this.unwrapCallersKeys(channelId, this.requestUserId),
		};
		return bundle as T;
	}

	async post<T>(path: string, body: unknown): Promise<T> {
		this.calls.push({method: 'POST', path, body});
		if (path !== '/users/@me/e2ee/keys') throw new Error(`unexpected POST ${path}`);
		const {devices} = body as {devices: Array<{device_id: string; identity_key: string}>};
		this.devicesByUser.set(this.requestUserId, devices);
		return {devices} as T;
	}

	async put<T>(path: string, body: unknown): Promise<T> {
		this.calls.push({method: 'PUT', path, body});
		if (this.failNextPut) {
			this.failNextPut = false;
			throw new Error('epoch conflict');
		}
		const match = path.match(/^\/channels\/([^/?]+)\/e2ee\/keys$/);
		if (!match) throw new Error(`unexpected PUT ${path}`);
		const channelId = match[1]!;
		const {epoch, keys} = body as {
			epoch: number;
			keys: Array<{user_id: string; device_id: string; wrapped_key: string}>;
		};
		const currentEpoch = this.epochByChannel.get(channelId) ?? 0;
		const storedEpoch = Math.max(epoch, currentEpoch);
		this.epochByChannel.set(channelId, storedEpoch);
		let channelWraps = this.wrappedByChannel.get(channelId);
		if (!channelWraps) {
			channelWraps = new Map();
			this.wrappedByChannel.set(channelId, channelWraps);
		}
		for (const key of keys) {
			let list = channelWraps.get(key.user_id);
			if (!list) {
				list = [];
				channelWraps.set(key.user_id, list);
			}
			list.push({epoch: storedEpoch, device_id: key.device_id, wrapped_key: key.wrapped_key});
		}
		return {epoch: storedEpoch} as T;
	}
}

async function registerUserDevice(
	transport: FakeTransport,
	userId: string,
): Promise<{deviceId: string; privateKey: CryptoKey}> {
	const pair = await generateIdentityKeyPair();
	const deviceId = `device-${userId}`;
	transport.devicesByUser.set(userId, [
		{device_id: deviceId, identity_key: await exportIdentityPublicKey(pair.publicKey)},
	]);
	return {deviceId, privateKey: pair.privateKey};
}

function makeClient(transport: FakeTransport, userId = 'user-a') {
	const keyStore = new MemoryKeyStore();
	transport.requestUserId = userId;
	return {client: new ChannelE2eeClient({transport, keyStore}), keyStore, userId};
}

describe('ChannelE2eeClient device identity', () => {
	it('generates a non-extractable identity and publishes it once', async () => {
		const transport = new FakeTransport();
		const {client, keyStore, userId} = makeClient(transport);
		const identity = await client.ensurePublishedIdentity(userId);
		expect(identity.privateKey.extractable).toBe(false);
		expect(identity.publishedIdentityKey).not.toBeNull();
		const publishCalls = transport.calls.filter((call) => call.method === 'POST');
		expect(publishCalls).toHaveLength(1);
		await client.ensurePublishedIdentity(userId);
		expect(transport.calls.filter((call) => call.method === 'POST')).toHaveLength(1);
		expect(keyStore.records.get(userId)?.deviceId).toBe(identity.deviceId);
	});

	it('reloads a persisted identity on a new client without republishing', async () => {
		const transport = new FakeTransport();
		const keyStore = new MemoryKeyStore();
		const userId = 'user-a';
		const first = new ChannelE2eeClient({transport, keyStore});
		await first.ensurePublishedIdentity(userId);
		const second = new ChannelE2eeClient({transport, keyStore});
		const identity = await second.ensurePublishedIdentity(userId);
		expect(transport.calls.filter((call) => call.method === 'POST')).toHaveLength(1);
		expect(identity.deviceId).toBe(keyStore.records.get(userId)!.deviceId);
	});
});

describe('ChannelE2eeClient message flow', () => {
	it('encrypts and decrypts a message between two users', async () => {
		const transport = new FakeTransport();
		const alice = makeClient(transport, 'alice');
		const bob = makeClient(transport, 'bob');
		const bobDevice = await registerUserDevice(transport, 'bob');
		transport.requestUserId = 'alice';
		await alice.client.ensurePublishedIdentity('alice');
		const envelope = await alice.client.encryptForChannel({
			userId: 'alice',
			channelId: 'chan-1',
			memberUserIds: ['bob'],
			plaintext: 'hello bob',
		});
		const put = transport.calls.find((call) => call.method === 'PUT');
		expect(put).toBeDefined();
		const distributed = transport.wrappedByChannel.get('chan-1')!;
		expect(distributed.has('alice')).toBe(true);
		expect(distributed.has('bob')).toBe(true);

		// Bob unwraps the message using a shared identity matching his published device key.
		const bobIdentity: E2eeDeviceIdentity = {
			userId: 'bob',
			deviceId: bobDevice.deviceId,
			publicKey: {} as CryptoKey,
			privateKey: bobDevice.privateKey,
			publishedIdentityKey: null,
		};
		(bob.client as never as {identityByUser: Map<string, E2eeDeviceIdentity>}).identityByUser.set('bob', bobIdentity);
		transport.requestUserId = 'bob';
		expect(await bob.client.decryptFromChannel({userId: 'bob', channelId: 'chan-1', content: envelope})).toBe(
			'hello bob',
		);
	});

	it('resolves own sent messages from the plaintext cache', async () => {
		const transport = new FakeTransport();
		const alice = makeClient(transport, 'alice');
		const envelope = await alice.client.encryptForChannel({
			userId: 'alice',
			channelId: 'chan-2',
			memberUserIds: [],
			plaintext: 'note to self',
		});
		const callsBefore = transport.calls.length;
		expect(await alice.client.decryptFromChannel({userId: 'alice', channelId: 'chan-2', content: envelope})).toBe(
			'note to self',
		);
		expect(transport.calls.length).toBe(callsBefore);
	});

	it('throws E2eeKeyUnwrapError when no wrap matches the device', async () => {
		const transport = new FakeTransport();
		const alice = makeClient(transport, 'alice');
		const eve = makeClient(transport, 'eve');
		transport.requestUserId = 'alice';
		const envelope = await alice.client.encryptForChannel({
			userId: 'alice',
			channelId: 'chan-3',
			memberUserIds: [],
			plaintext: 'for alice only',
		});
		transport.requestUserId = 'eve';
		await eve.client.ensurePublishedIdentity('eve');
		await expect(
			eve.client.decryptFromChannel({userId: 'eve', channelId: 'chan-3', content: envelope}),
		).rejects.toThrow(E2eeKeyUnwrapError);
	});

	it('retries distribution once when the epoch moves under the sender', async () => {
		const transport = new FakeTransport();
		transport.failNextPut = true;
		const alice = makeClient(transport, 'alice');
		const envelope = await alice.client.encryptForChannel({
			userId: 'alice',
			channelId: 'chan-4',
			memberUserIds: [],
			plaintext: 'retry works',
		});
		expect(transport.calls.filter((call) => call.method === 'PUT')).toHaveLength(2);
		expect(await alice.client.decryptFromChannel({userId: 'alice', channelId: 'chan-4', content: envelope})).toBe(
			'retry works',
		);
	});

	it('reuses the cached content key for the current epoch on subsequent sends', async () => {
		const transport = new FakeTransport();
		const alice = makeClient(transport, 'alice');
		await alice.client.encryptForChannel({
			userId: 'alice',
			channelId: 'chan-5',
			memberUserIds: [],
			plaintext: 'first',
		});
		const puts = transport.calls.filter((call) => call.method === 'PUT').length;
		await alice.client.encryptForChannel({
			userId: 'alice',
			channelId: 'chan-5',
			memberUserIds: [],
			plaintext: 'second',
		});
		expect(transport.calls.filter((call) => call.method === 'PUT')).toHaveLength(puts);
	});
});
