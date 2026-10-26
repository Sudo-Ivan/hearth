// SPDX-License-Identifier: AGPL-3.0-or-later

import {createChannelID, createGuildID, createUserID, type GuildID} from '@app/api/BrandedTypes';
import {Config} from '@app/api/Config';
import type {ChannelRepository} from '@app/api/channel/ChannelRepository';
import {ChannelE2eeService} from '@app/api/channel/services/ChannelE2eeService';
import {setCassandraQueryExecutorForTesting} from '@app/api/database/CassandraQueryExecution';
import type {Channel} from '@app/api/models/Channel';
import {InMemoryCassandraQueryExecutor} from '@app/api/test/InMemoryCassandraQueryExecutor';
import {FeatureTemporarilyDisabledError} from '@hearth/errors/src/domains/core/FeatureTemporarilyDisabledError';
import {InputValidationError} from '@hearth/errors/src/domains/core/InputValidationError';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

function makeService(listGuildChannels?: (guildId: GuildID) => Promise<Array<Pick<Channel, 'id'>>>) {
	const channelRepository = {
		channelData: {
			listGuildChannels: listGuildChannels ?? (async () => []),
		},
	} as unknown as ChannelRepository;
	return new ChannelE2eeService(channelRepository);
}

const USER_A = createUserID(1001n);
const USER_B = createUserID(1002n);
const CHANNEL_ID = createChannelID(5555n);

describe('ChannelE2eeService device keys', () => {
	beforeEach(() => {
		setCassandraQueryExecutorForTesting(new InMemoryCassandraQueryExecutor());
		Config.e2ee.enabled = true;
	});
	afterEach(() => {
		setCassandraQueryExecutorForTesting(new InMemoryCassandraQueryExecutor());
		Config.e2ee.enabled = true;
	});

	it('publishes and fetches device identity keys', async () => {
		const service = makeService();
		await service.publishDevices(USER_A, [
			{device_id: 'web', identity_key: 'a2V5', signed_prekey: 'cHJla2V5', signature: 'c2ln'},
		]);
		const bundle = await service.getChannelKeyBundle({
			channelId: CHANNEL_ID,
			requesterId: USER_B,
			memberUserIds: [USER_A],
		});
		expect(bundle.epoch).toBe(0);
		expect(bundle.devices).toEqual([
			{
				user_id: USER_A.toString(),
				device_id: 'web',
				identity_key: 'a2V5',
				signed_prekey: 'cHJla2V5',
				signature: 'c2ln',
			},
		]);
		expect(bundle.wrapped_keys).toEqual([]);
	});

	it('rejects duplicate device ids in one publish', async () => {
		const service = makeService();
		await expect(
			service.publishDevices(USER_A, [
				{device_id: 'web', identity_key: 'a2V5', signed_prekey: null, signature: null},
				{device_id: 'web', identity_key: 'b3RoZXI', signed_prekey: null, signature: null},
			]),
		).rejects.toThrow(InputValidationError);
	});

	it('refuses to publish when e2ee is disabled', async () => {
		Config.e2ee.enabled = false;
		const service = makeService();
		await expect(
			service.publishDevices(USER_A, [{device_id: 'web', identity_key: 'a2V5', signed_prekey: null, signature: null}]),
		).rejects.toThrow(FeatureTemporarilyDisabledError);
	});
});

describe('ChannelE2eeService wrapped key distribution', () => {
	beforeEach(() => {
		setCassandraQueryExecutorForTesting(new InMemoryCassandraQueryExecutor());
		Config.e2ee.enabled = true;
	});
	afterEach(() => {
		setCassandraQueryExecutorForTesting(new InMemoryCassandraQueryExecutor());
		Config.e2ee.enabled = true;
	});

	it('stores wrapped keys addressed to each recipient device', async () => {
		const service = makeService();
		const {epoch} = await service.distributeWrappedKeys({
			channelId: CHANNEL_ID,
			senderId: USER_A,
			epoch: 0,
			keys: [
				{user_id: USER_A, device_id: 'web', wrapped_key: '{"v":1}'},
				{user_id: USER_B, device_id: 'mobile', wrapped_key: '{"v":1}'},
			],
		});
		expect(epoch).toBe(0);
		const bundleB = await service.getChannelKeyBundle({
			channelId: CHANNEL_ID,
			requesterId: USER_B,
			memberUserIds: [],
		});
		expect(bundleB.wrapped_keys).toEqual([
			{epoch: 0, sender_user_id: USER_A.toString(), device_id: 'mobile', wrapped_key: '{"v":1}'},
		]);
		const bundleA = await service.getChannelKeyBundle({
			channelId: CHANNEL_ID,
			requesterId: USER_A,
			memberUserIds: [],
		});
		expect(bundleA.wrapped_keys).toHaveLength(1);
		expect(bundleA.wrapped_keys[0]!.device_id).toBe('web');
	});

	it('rejects distribution for a stale epoch after rotation', async () => {
		const service = makeService();
		await service.distributeWrappedKeys({
			channelId: CHANNEL_ID,
			senderId: USER_A,
			epoch: 0,
			keys: [{user_id: USER_B, device_id: 'web', wrapped_key: '{"v":1}'}],
		});
		const epoch = await service.rotateChannelEpoch(CHANNEL_ID, USER_A);
		expect(epoch).toBe(1);
		await expect(
			service.distributeWrappedKeys({
				channelId: CHANNEL_ID,
				senderId: USER_A,
				epoch: 0,
				keys: [{user_id: USER_B, device_id: 'web', wrapped_key: '{"v":1}'}],
			}),
		).rejects.toThrow(InputValidationError);
		const {epoch: accepted} = await service.distributeWrappedKeys({
			channelId: CHANNEL_ID,
			senderId: USER_A,
			epoch: 1,
			keys: [{user_id: USER_B, device_id: 'web', wrapped_key: '{"v":1,"new":true}'}],
		});
		expect(accepted).toBe(1);
	});

	it('keeps older epoch wraps readable for remaining members after rotation', async () => {
		const service = makeService();
		await service.distributeWrappedKeys({
			channelId: CHANNEL_ID,
			senderId: USER_A,
			epoch: 0,
			keys: [{user_id: USER_B, device_id: 'web', wrapped_key: '{"v":1,"epoch":0}'}],
		});
		await service.rotateChannelEpoch(CHANNEL_ID, USER_A);
		await service.distributeWrappedKeys({
			channelId: CHANNEL_ID,
			senderId: USER_A,
			epoch: 1,
			keys: [{user_id: USER_B, device_id: 'web', wrapped_key: '{"v":1,"epoch":1}'}],
		});
		const bundle = await service.getChannelKeyBundle({
			channelId: CHANNEL_ID,
			requesterId: USER_B,
			memberUserIds: [],
		});
		expect(bundle.epoch).toBe(1);
		expect(bundle.wrapped_keys.map((key) => key.epoch).sort()).toEqual([0, 1]);
	});
});

describe('ChannelE2eeService epoch rotation on membership shrink', () => {
	beforeEach(() => {
		setCassandraQueryExecutorForTesting(new InMemoryCassandraQueryExecutor());
		Config.e2ee.enabled = true;
	});
	afterEach(() => {
		setCassandraQueryExecutorForTesting(new InMemoryCassandraQueryExecutor());
		Config.e2ee.enabled = true;
	});

	it('bumps the epoch for a channel that has distributed keys', async () => {
		const service = makeService();
		await service.distributeWrappedKeys({
			channelId: CHANNEL_ID,
			senderId: USER_A,
			epoch: 0,
			keys: [{user_id: USER_B, device_id: 'web', wrapped_key: '{"v":1}'}],
		});
		await service.rotateOnMembershipShrink({channelId: CHANNEL_ID, actorId: USER_A});
		expect(await service.getChannelEpoch(CHANNEL_ID)).toBe(1);
	});

	it('does not create epoch state for channels that never used e2ee', async () => {
		const service = makeService();
		const untouched = createChannelID(9999n);
		await service.rotateOnMembershipShrink({channelId: untouched, actorId: USER_A});
		expect(await service.getChannelEpoch(untouched)).toBe(0);
	});

	it('bumps every e2ee-enabled guild channel when a member leaves', async () => {
		const e2eeChannel = createChannelID(7777n);
		const plainChannel = createChannelID(8888n);
		const guildId = createGuildID(4242n);
		const service = makeService(async (requestedGuildId) => {
			expect(requestedGuildId).toBe(guildId);
			return [{id: e2eeChannel}, {id: plainChannel}] as Array<Pick<Channel, 'id'>>;
		});
		await service.distributeWrappedKeys({
			channelId: e2eeChannel,
			senderId: USER_A,
			epoch: 0,
			keys: [{user_id: USER_B, device_id: 'web', wrapped_key: '{"v":1}'}],
		});
		await service.rotateOnMembershipShrink({guildId, actorId: USER_B});
		expect(await service.getChannelEpoch(e2eeChannel)).toBe(1);
		expect(await service.getChannelEpoch(plainChannel)).toBe(0);
	});

	it('does nothing when e2ee is disabled', async () => {
		const service = makeService();
		await service.distributeWrappedKeys({
			channelId: CHANNEL_ID,
			senderId: USER_A,
			epoch: 0,
			keys: [{user_id: USER_B, device_id: 'web', wrapped_key: '{"v":1}'}],
		});
		Config.e2ee.enabled = false;
		await service.rotateOnMembershipShrink({channelId: CHANNEL_ID, actorId: USER_A});
		expect(await service.getChannelEpoch(CHANNEL_ID)).toBe(0);
	});
});
