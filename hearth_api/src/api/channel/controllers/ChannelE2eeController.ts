// SPDX-License-Identifier: AGPL-3.0-or-later

import {createChannelID, createUserID} from '@app/api/BrandedTypes';
import {viewerFromCtx} from '@app/api/experiment/ChannelThreadsGate';
import {DefaultUserOnly, LoginRequired} from '@app/api/middleware/AuthMiddleware';
import {RateLimitMiddleware} from '@app/api/middleware/RateLimitMiddleware';
import {OpenAPI} from '@app/api/middleware/ResponseTypeMiddleware';
import {RateLimitConfigs} from '@app/api/RateLimitConfig';
import type {HonoApp} from '@app/api/types/HonoEnv';
import {Validator} from '@app/api/Validator';
import {Permissions} from '@hearth/constants/src/ChannelConstants';
import {
	E2eeChannelKeysQuery,
	E2eeChannelKeysResponse,
	E2eeDistributeKeysRequest,
	E2eeDistributeKeysResponse,
	E2eePublishKeysRequest,
	E2eePublishKeysResponse,
} from '@hearth/schema/src/domains/channel/E2eeSchemas';
import {ChannelIdParam} from '@hearth/schema/src/domains/common/CommonParamSchemas';

export function ChannelE2eeController(app: HonoApp) {
	app.post(
		'/users/@me/e2ee/keys',
		RateLimitMiddleware(RateLimitConfigs.USER_E2EE_KEYS_PUBLISH),
		LoginRequired,
		DefaultUserOnly,
		Validator('json', E2eePublishKeysRequest),
		OpenAPI({
			operationId: 'publish_e2ee_device_keys',
			summary: 'Publish e2ee device keys',
			responseSchema: E2eePublishKeysResponse,
			requestSchema: E2eePublishKeysRequest,
			statusCode: 200,
			security: ['bearerToken', 'sessionToken'],
			tags: ['Users', 'E2EE'],
			description:
				'Publishes X25519 identity public keys (and optional signed prekeys) for the current user devices. Only public key material is uploaded; private keys never leave the client.',
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const {devices} = ctx.req.valid('json');
			const rows = await ctx.get('channelService').e2ee.publishDevices(
				user.id,
				devices.map((device) => ({
					device_id: device.device_id,
					identity_key: device.identity_key,
					signed_prekey: device.signed_prekey ?? null,
					signature: device.signature ?? null,
				})),
			);
			return ctx.json({
				devices: rows.map((row) => ({
					device_id: row.device_id,
					identity_key: row.identity_key,
					signed_prekey: row.signed_prekey,
					signature: row.signature,
				})),
			});
		},
	);
	app.get(
		'/channels/:channel_id/e2ee/keys',
		RateLimitMiddleware(RateLimitConfigs.CHANNEL_E2EE_KEYS_GET),
		LoginRequired,
		Validator('param', ChannelIdParam),
		Validator('query', E2eeChannelKeysQuery),
		OpenAPI({
			operationId: 'get_channel_e2ee_keys',
			summary: 'Fetch channel e2ee key material',
			responseSchema: E2eeChannelKeysResponse,
			statusCode: 200,
			security: ['bearerToken', 'sessionToken'],
			tags: ['Channels', 'E2EE'],
			description:
				'Returns the current channel key epoch, the published device identity keys for the requested member user IDs, and the wrapped content keys addressed to the caller. Requires access to the channel.',
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const channelId = createChannelID(ctx.req.valid('param').channel_id);
			const viewer = viewerFromCtx(ctx);
			const channelService = ctx.get('channelService');
			await channelService.channelData.auth.getChannelAuthenticated({
				userId: user.id,
				viewer,
				channelId,
			});
			const {user_ids} = ctx.req.valid('query');
			const requestedIds: Array<bigint> = [];
			if (user_ids !== undefined) {
				if (Array.isArray(user_ids)) {
					requestedIds.push(...user_ids);
				} else {
					requestedIds.push(user_ids);
				}
			}
			const memberUserIds = requestedIds.map((id) => createUserID(id));
			return ctx.json(
				await channelService.e2ee.getChannelKeyBundle({
					channelId,
					requesterId: user.id,
					memberUserIds,
				}),
			);
		},
	);
	app.put(
		'/channels/:channel_id/e2ee/keys',
		RateLimitMiddleware(RateLimitConfigs.CHANNEL_E2EE_KEYS_PUT),
		LoginRequired,
		DefaultUserOnly,
		Validator('param', ChannelIdParam),
		Validator('json', E2eeDistributeKeysRequest),
		OpenAPI({
			operationId: 'distribute_channel_e2ee_keys',
			summary: 'Distribute wrapped channel keys',
			responseSchema: E2eeDistributeKeysResponse,
			requestSchema: E2eeDistributeKeysRequest,
			statusCode: 200,
			security: ['bearerToken', 'sessionToken'],
			tags: ['Channels', 'E2EE'],
			description:
				'Stores sender-produced wrapped copies of the channel content key, one per recipient device. The epoch must be at least the current channel epoch; a higher epoch mints a new key generation. Requires send permission in the channel.',
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const channelId = createChannelID(ctx.req.valid('param').channel_id);
			const viewer = viewerFromCtx(ctx);
			const channelService = ctx.get('channelService');
			const auth = await channelService.channelData.auth.getChannelAuthenticated({
				userId: user.id,
				viewer,
				channelId,
			});
			if (auth.guild) {
				await auth.checkPermission(Permissions.SEND_MESSAGES);
			}
			const {epoch, keys} = ctx.req.valid('json');
			const result = await channelService.e2ee.distributeWrappedKeys({
				channelId,
				senderId: user.id,
				epoch,
				keys: keys.map((key) => ({
					user_id: createUserID(key.user_id),
					device_id: key.device_id,
					wrapped_key: key.wrapped_key,
				})),
			});
			return ctx.json({epoch: result.epoch});
		},
	);
}
