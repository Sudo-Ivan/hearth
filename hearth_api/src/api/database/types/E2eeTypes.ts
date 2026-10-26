// SPDX-License-Identifier: AGPL-3.0-or-later

import type {ChannelID, UserID} from '@app/api/BrandedTypes';

// Public device key material published by a user. Only public keys and
// signatures live here; private keys never leave the client.
export interface UserE2eeDeviceRow {
	user_id: UserID;
	device_id: string;
	identity_key: string;
	signed_prekey: string | null;
	signature: string | null;
	created_at: Date;
	updated_at: Date;
}

export const USER_E2EE_DEVICE_COLUMNS = [
	'user_id',
	'device_id',
	'identity_key',
	'signed_prekey',
	'signature',
	'created_at',
	'updated_at',
] as const satisfies ReadonlyArray<keyof UserE2eeDeviceRow>;

// Per-channel key epoch marker. The epoch increments whenever channel
// membership shrinks so a removed member cannot read messages sent under a
// newer content key. A row exists only once a channel has distributed e2ee
// keys at least once.
export interface ChannelE2eeStateRow {
	channel_id: ChannelID;
	epoch: number;
	rotated_by: UserID | null;
	updated_at: Date;
}

export const CHANNEL_E2EE_STATE_COLUMNS = [
	'channel_id',
	'epoch',
	'rotated_by',
	'updated_at',
] as const satisfies ReadonlyArray<keyof ChannelE2eeStateRow>;

// A channel content key wrapped for one recipient device by a sender. Rows
// partition by (channel_id, user_id) so a member fetches exactly their own
// wraps across all epochs and devices.
export interface ChannelE2eeWrappedKeyRow {
	channel_id: ChannelID;
	user_id: UserID;
	epoch: number;
	device_id: string;
	sender_user_id: UserID;
	wrapped_key: string;
	created_at: Date;
}

export const CHANNEL_E2EE_WRAPPED_KEY_COLUMNS = [
	'channel_id',
	'user_id',
	'epoch',
	'device_id',
	'sender_user_id',
	'wrapped_key',
	'created_at',
] as const satisfies ReadonlyArray<keyof ChannelE2eeWrappedKeyRow>;
