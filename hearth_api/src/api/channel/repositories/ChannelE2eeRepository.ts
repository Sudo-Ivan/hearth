// SPDX-License-Identifier: AGPL-3.0-or-later

import type {ChannelID, UserID} from '@app/api/BrandedTypes';
import {deleteOneOrMany, fetchMany, fetchOne, upsertOne} from '@app/api/database/CassandraQueryExecution';
import type {ChannelE2eeStateRow, ChannelE2eeWrappedKeyRow, UserE2eeDeviceRow} from '@app/api/database/types/E2eeTypes';
import {ChannelE2eeStates, ChannelE2eeWrappedKeys, UserE2eeDevices} from '@app/api/Tables';
import {awaitAll} from '@app/api/utils/ConcurrencyUtils';

const FETCH_DEVICES_BY_USER = UserE2eeDevices.selectCql({
	where: UserE2eeDevices.where.eq('user_id'),
});
const FETCH_DEVICES_BY_USERS = UserE2eeDevices.selectCql({
	where: UserE2eeDevices.where.in('user_id', 'user_ids'),
});
const FETCH_DEVICE = UserE2eeDevices.selectCql({
	where: [UserE2eeDevices.where.eq('user_id'), UserE2eeDevices.where.eq('device_id')],
	limit: 1,
});
const FETCH_CHANNEL_STATE = ChannelE2eeStates.selectCql({
	where: ChannelE2eeStates.where.eq('channel_id'),
	limit: 1,
});
const FETCH_WRAPPED_KEYS_FOR_RECIPIENT = ChannelE2eeWrappedKeys.selectCql({
	where: [ChannelE2eeWrappedKeys.where.eq('channel_id'), ChannelE2eeWrappedKeys.where.eq('user_id')],
});

export interface E2eeDeviceKeyInput {
	device_id: string;
	identity_key: string;
	signed_prekey: string | null;
	signature: string | null;
}

export class ChannelE2eeRepository {
	async upsertDevices(userId: UserID, devices: Array<E2eeDeviceKeyInput>): Promise<Array<UserE2eeDeviceRow>> {
		const now = new Date();
		const rows: Array<UserE2eeDeviceRow> = [];
		for (const device of devices) {
			const existing = await fetchOne<Pick<UserE2eeDeviceRow, 'created_at'>>(FETCH_DEVICE, {
				user_id: userId,
				device_id: device.device_id,
			});
			const row: UserE2eeDeviceRow = {
				user_id: userId,
				device_id: device.device_id,
				identity_key: device.identity_key,
				signed_prekey: device.signed_prekey,
				signature: device.signature,
				created_at: existing?.created_at ?? now,
				updated_at: now,
			};
			await upsertOne(UserE2eeDevices.upsertAll(row));
			rows.push(row);
		}
		return rows;
	}

	async listDevices(userId: UserID): Promise<Array<UserE2eeDeviceRow>> {
		return fetchMany<UserE2eeDeviceRow>(FETCH_DEVICES_BY_USER, {user_id: userId});
	}

	async listDevicesForUsers(userIds: Array<UserID>): Promise<Array<UserE2eeDeviceRow>> {
		if (userIds.length === 0) return [];
		return fetchMany<UserE2eeDeviceRow>(FETCH_DEVICES_BY_USERS, {user_ids: userIds});
	}

	async deleteDevice(userId: UserID, deviceId: string): Promise<void> {
		await deleteOneOrMany(UserE2eeDevices.deleteByPk({user_id: userId, device_id: deviceId}));
	}

	async getChannelState(channelId: ChannelID): Promise<ChannelE2eeStateRow | null> {
		return (await fetchOne<ChannelE2eeStateRow>(FETCH_CHANNEL_STATE, {channel_id: channelId})) ?? null;
	}

	async upsertChannelState(row: ChannelE2eeStateRow): Promise<ChannelE2eeStateRow> {
		await upsertOne(ChannelE2eeStates.upsertAll(row));
		return row;
	}

	async listWrappedKeys(channelId: ChannelID, userId: UserID): Promise<Array<ChannelE2eeWrappedKeyRow>> {
		return fetchMany<ChannelE2eeWrappedKeyRow>(FETCH_WRAPPED_KEYS_FOR_RECIPIENT, {
			channel_id: channelId,
			user_id: userId,
		});
	}

	async upsertWrappedKeys(rows: Array<ChannelE2eeWrappedKeyRow>): Promise<void> {
		await awaitAll(
			rows.map((row) => upsertOne(ChannelE2eeWrappedKeys.upsertAll(row))),
			'Failed to store e2ee wrapped keys',
		);
	}

	async deleteChannelWrappedKeys(channelId: ChannelID, userId: UserID): Promise<void> {
		await deleteOneOrMany(
			ChannelE2eeWrappedKeys.del({
				where: [ChannelE2eeWrappedKeys.where.eq('channel_id'), ChannelE2eeWrappedKeys.where.eq('user_id')],
			}).bind({channel_id: channelId, user_id: userId}),
		);
	}
}
