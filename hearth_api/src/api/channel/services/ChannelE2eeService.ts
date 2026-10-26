// SPDX-License-Identifier: AGPL-3.0-or-later

import type {ChannelID, GuildID, UserID} from '@app/api/BrandedTypes';
import {Config} from '@app/api/Config';
import type {ChannelRepository} from '@app/api/channel/ChannelRepository';
import {ChannelE2eeRepository, type E2eeDeviceKeyInput} from '@app/api/channel/repositories/ChannelE2eeRepository';
import type {ChannelE2eeWrappedKeyRow, UserE2eeDeviceRow} from '@app/api/database/types/E2eeTypes';
import {Logger} from '@app/api/Logger';
import {ValidationErrorCodes} from '@hearth/constants/src/ValidationErrorCodes';
import {FeatureTemporarilyDisabledError} from '@hearth/errors/src/domains/core/FeatureTemporarilyDisabledError';
import {InputValidationError} from '@hearth/errors/src/domains/core/InputValidationError';
import type {E2eeDeviceKeyResponse, E2eeWrappedKeyResponse} from '@hearth/schema/src/domains/channel/E2eeSchemas';

export interface ChannelE2eeKeyBundle {
	epoch: number;
	devices: Array<E2eeDeviceKeyResponse & {user_id: string}>;
	wrapped_keys: Array<E2eeWrappedKeyResponse>;
}

function mapDeviceRow(row: UserE2eeDeviceRow): E2eeDeviceKeyResponse & {user_id: string} {
	return {
		user_id: row.user_id.toString(),
		device_id: row.device_id,
		identity_key: row.identity_key,
		signed_prekey: row.signed_prekey,
		signature: row.signature,
	};
}

function mapWrappedKeyRow(row: ChannelE2eeWrappedKeyRow): E2eeWrappedKeyResponse {
	return {
		epoch: row.epoch,
		sender_user_id: row.sender_user_id.toString(),
		device_id: row.device_id,
		wrapped_key: row.wrapped_key,
	};
}

// Server side of channel e2ee. The API never sees plaintext or private key
// material: it stores published identity public keys and opaque key wrap
// envelopes produced by clients. It enforces membership (done by callers via
// channel auth) and mints a new key epoch whenever membership shrinks.
export class ChannelE2eeService {
	readonly repository: ChannelE2eeRepository;

	constructor(private readonly channelRepository: ChannelRepository) {
		this.repository = new ChannelE2eeRepository();
	}

	assertEnabled(): void {
		if (!Config.e2ee.enabled) {
			throw new FeatureTemporarilyDisabledError();
		}
	}

	get enabled(): boolean {
		return Config.e2ee.enabled;
	}

	async publishDevices(userId: UserID, devices: Array<E2eeDeviceKeyInput>): Promise<Array<UserE2eeDeviceRow>> {
		this.assertEnabled();
		const seen = new Set<string>();
		for (const device of devices) {
			if (seen.has(device.device_id)) {
				throw InputValidationError.fromCode('devices', ValidationErrorCodes.INVALID_FORMAT, {
					deviceId: device.device_id,
				});
			}
			seen.add(device.device_id);
		}
		return this.repository.upsertDevices(userId, devices);
	}

	async listDeviceKeys(userIds: Array<UserID>): Promise<Array<UserE2eeDeviceRow>> {
		this.assertEnabled();
		return this.repository.listDevicesForUsers(userIds);
	}

	async getChannelEpoch(channelId: ChannelID): Promise<number> {
		const state = await this.repository.getChannelState(channelId);
		return state?.epoch ?? 0;
	}

	// Caller must have already authorized channel access for requesterId.
	async getChannelKeyBundle(params: {
		channelId: ChannelID;
		requesterId: UserID;
		memberUserIds: Array<UserID>;
	}): Promise<ChannelE2eeKeyBundle> {
		this.assertEnabled();
		const [state, devices, wrappedKeys] = await Promise.all([
			this.repository.getChannelState(params.channelId),
			this.repository.listDevicesForUsers(params.memberUserIds),
			this.repository.listWrappedKeys(params.channelId, params.requesterId),
		]);
		return {
			epoch: state?.epoch ?? 0,
			devices: devices.map(mapDeviceRow),
			wrapped_keys: wrappedKeys.map(mapWrappedKeyRow),
		};
	}

	// Stores sender produced key wraps for channel members. The epoch must be
	// at least the current epoch: a higher epoch mints a new content key
	// generation (for example after a manual rotation), a lower epoch is
	// rejected so nobody can push stale keys to removed members.
	async distributeWrappedKeys(params: {
		channelId: ChannelID;
		senderId: UserID;
		epoch: number;
		keys: Array<{user_id: UserID; device_id: string; wrapped_key: string}>;
	}): Promise<{epoch: number}> {
		this.assertEnabled();
		const state = await this.repository.getChannelState(params.channelId);
		const currentEpoch = state?.epoch ?? 0;
		if (params.epoch < currentEpoch) {
			throw InputValidationError.fromCode('epoch', ValidationErrorCodes.INVALID_FORMAT, {
				currentEpoch,
			});
		}
		const epoch = Math.max(params.epoch, currentEpoch);
		const now = new Date();
		const rows: Array<ChannelE2eeWrappedKeyRow> = params.keys.map((key) => ({
			channel_id: params.channelId,
			user_id: key.user_id,
			epoch,
			device_id: key.device_id,
			sender_user_id: params.senderId,
			wrapped_key: key.wrapped_key,
			created_at: now,
		}));
		if (epoch !== currentEpoch || state === null) {
			await this.repository.upsertChannelState({
				channel_id: params.channelId,
				epoch,
				rotated_by: params.senderId,
				updated_at: now,
			});
		}
		await this.repository.upsertWrappedKeys(rows);
		return {epoch};
	}

	// Mints a new epoch for one channel. Called when membership shrinks so the
	// next sender must distribute a fresh content key that removed members
	// cannot unwrap. Best effort: failures are logged, not fatal.
	async rotateChannelEpoch(channelId: ChannelID, rotatedBy: UserID | null): Promise<number> {
		const state = await this.repository.getChannelState(channelId);
		const epoch = (state?.epoch ?? 0) + 1;
		await this.repository.upsertChannelState({
			channel_id: channelId,
			epoch,
			rotated_by: rotatedBy,
			updated_at: new Date(),
		});
		return epoch;
	}

	async rotateOnMembershipShrink(params: {
		channelId?: ChannelID;
		guildId?: GuildID;
		actorId: UserID | null;
	}): Promise<void> {
		if (!this.enabled) return;
		try {
			if (params.channelId !== undefined) {
				const state = await this.repository.getChannelState(params.channelId);
				if (state !== null) {
					await this.rotateChannelEpoch(params.channelId, params.actorId);
				}
				return;
			}
			if (params.guildId === undefined) return;
			const channels = await this.channelRepository.channelData.listGuildChannels(params.guildId, 'complete');
			for (const channel of channels) {
				const state = await this.repository.getChannelState(channel.id);
				if (state !== null) {
					await this.rotateChannelEpoch(channel.id, params.actorId);
				}
			}
		} catch (error) {
			Logger.warn(
				{error, channelId: params.channelId?.toString(), guildId: params.guildId?.toString()},
				'Failed to rotate channel e2ee epoch after membership shrink',
			);
		}
	}
}
