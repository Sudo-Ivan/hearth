// SPDX-License-Identifier: AGPL-3.0-or-later

import {
	createStringType,
	Int32Type,
	SnowflakeStringType,
	SnowflakeType,
} from '@hearth/schema/src/primitives/SchemaPrimitives';
import {z} from 'zod';

const E2eeDeviceId = createStringType(1, 64).describe('Client-chosen stable identifier for the publishing device');
const E2eePublicKey = createStringType(1, 256).describe('Base64url encoded X25519 public key');

export const E2eeDeviceKeyRequest = z.object({
	device_id: E2eeDeviceId,
	identity_key: E2eePublicKey.describe('X25519 identity public key for this device'),
	signed_prekey: E2eePublicKey.nullish().describe('Optional X25519 signed prekey for this device'),
	signature: createStringType(1, 512).nullish().describe('Signature over signed_prekey produced by the identity key'),
});

export type E2eeDeviceKeyRequest = z.infer<typeof E2eeDeviceKeyRequest>;

export const E2eePublishKeysRequest = z.object({
	devices: z.array(E2eeDeviceKeyRequest).min(1).max(25).describe('Device identity keys to publish for this user'),
});

export type E2eePublishKeysRequest = z.infer<typeof E2eePublishKeysRequest>;

export const E2eeDeviceKeyResponse = z.object({
	device_id: z.string(),
	identity_key: z.string(),
	signed_prekey: z.string().nullable(),
	signature: z.string().nullable(),
});

export type E2eeDeviceKeyResponse = z.infer<typeof E2eeDeviceKeyResponse>;

export const E2eePublishKeysResponse = z.object({
	devices: z.array(E2eeDeviceKeyResponse),
});

export type E2eePublishKeysResponse = z.infer<typeof E2eePublishKeysResponse>;

export const E2eeChannelKeysQuery = z.object({
	user_ids: z
		.union([SnowflakeType, z.array(SnowflakeType).max(200)])
		.optional()
		.describe(
			'Channel member user IDs to fetch published device keys for. Repeat the parameter for multiple users. When omitted, only the caller wrapped keys and the current epoch are returned.',
		),
});

export type E2eeChannelKeysQuery = z.infer<typeof E2eeChannelKeysQuery>;

export const E2eeMemberDeviceKey = E2eeDeviceKeyResponse.extend({
	user_id: SnowflakeStringType,
});

export type E2eeMemberDeviceKey = z.infer<typeof E2eeMemberDeviceKey>;

export const E2eeWrappedKeyEntryRequest = z.object({
	user_id: SnowflakeType.describe('Recipient user this wrap is addressed to'),
	device_id: E2eeDeviceId.describe('Recipient device this wrap is addressed to'),
	wrapped_key: createStringType(1, 8192).describe(
		'Opaque JSON key wrap envelope produced by the sender for this device',
	),
});

export type E2eeWrappedKeyEntryRequest = z.infer<typeof E2eeWrappedKeyEntryRequest>;

export const E2eeDistributeKeysRequest = z.object({
	epoch: Int32Type.describe(
		'The channel key epoch these wrapped keys belong to. Must match the current channel epoch or mint a newer one. Epoch increments whenever channel membership shrinks; wrapped keys for older epochs stay valid for history.',
	),
	keys: z.array(E2eeWrappedKeyEntryRequest).min(1).max(500).describe('Per-device wrapped copies of the content key'),
});

export type E2eeDistributeKeysRequest = z.infer<typeof E2eeDistributeKeysRequest>;

export const E2eeDistributeKeysResponse = z.object({
	epoch: Int32Type.describe('The channel epoch the wrapped keys were stored under'),
});

export type E2eeDistributeKeysResponse = z.infer<typeof E2eeDistributeKeysResponse>;

export const E2eeWrappedKeyResponse = z.object({
	epoch: Int32Type.describe('The channel key epoch this wrap belongs to'),
	sender_user_id: SnowflakeStringType.describe('User that produced this wrap'),
	device_id: z.string().describe('Caller device this wrap is addressed to'),
	wrapped_key: z.string().describe('Opaque JSON key wrap envelope'),
});

export type E2eeWrappedKeyResponse = z.infer<typeof E2eeWrappedKeyResponse>;

export const E2eeChannelKeysResponse = z.object({
	epoch: Int32Type.describe(
		'Current channel key epoch. Senders must wrap keys for this epoch. The epoch increments whenever channel membership shrinks so removed members cannot read messages sent after their removal.',
	),
	devices: z.array(E2eeMemberDeviceKey).describe('Published device identity keys for the requested member user IDs'),
	wrapped_keys: z
		.array(E2eeWrappedKeyResponse)
		.describe('Wrapped content keys addressed to the caller, across all epochs'),
});

export type E2eeChannelKeysResponse = z.infer<typeof E2eeChannelKeysResponse>;
