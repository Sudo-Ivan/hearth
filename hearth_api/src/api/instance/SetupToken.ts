// SPDX-License-Identifier: AGPL-3.0-or-later

import type {UserID} from '@app/api/BrandedTypes';
import {Config} from '@app/api/Config';
import type {APIConfig} from '@app/api/config/APIConfig';
import type {InstanceConfigRepository} from '@app/api/instance/InstanceConfigRepository';
import {Logger} from '@app/api/Logger';
import {createRateLimitError} from '@app/api/utils/RateLimitUtils';
import {ValidationErrorCodes} from '@hearth/constants/src/ValidationErrorCodes';
import {InputValidationError} from '@hearth/errors/src/domains/core/InputValidationError';
import {getSameIpDecisionKey} from '@hearth/ip_utils/src/IpAddress';
import type {IRateLimitService} from '@pkgs/rate_limit/src/IRateLimitService';
import {ms} from 'itty-time';

const SETUP_TOKEN_FAILURE_MAX_ATTEMPTS = 10;
const SETUP_TOKEN_FAILURE_WINDOW_MS = ms('30 minutes');
const SETUP_TOKEN_TTL_MS = ms('1 hour');

export function isSetupTokenEnforced(config: APIConfig): boolean {
	return config.instance.selfHosted && (config.nodeEnv === 'production' || config.instance.setup.token !== null);
}

async function releaseAdminBootstrapOfMissingAccount(
	repository: InstanceConfigRepository,
	userExists: (userId: UserID) => Promise<boolean>,
): Promise<void> {
	const claimant = await repository.getUnconfirmedAdminBootstrapClaimant();
	if (claimant === null || (await userExists(claimant))) return;
	await repository.releaseAdminBootstrap();
	Logger.warn(
		{user_id: claimant.toString()},
		'The account that claimed the admin bootstrap does not exist. The claim is released and the setup token applies again',
	);
}

export async function ensureSetupToken(
	repository: InstanceConfigRepository,
	userExists: (userId: UserID) => Promise<boolean>,
): Promise<void> {
	if (!isSetupTokenEnforced(Config)) return;
	await releaseAdminBootstrapOfMissingAccount(repository, userExists);
	if (!(await repository.isSetupTokenGateOpen())) return;
	if (Config.instance.setup.token !== null) {
		Logger.info('Setup token read from FLUXER_SETUP_TOKEN');
		return;
	}
	const logSetupUrl = (token: string) => {
		const url = `${Config.endpoints.webApp.replace(/\/+$/, '')}/?setup_token=${token}`;
		Logger.warn(
			{setup_url: url},
			'Setup URL generated. This instance has not recorded an admin account yet. The link is valid for one hour; afterwards it expires and a new one must be generated (restart the api, or set FLUXER_SETUP_TOKEN)',
		);
	};
	let token = await repository.createSetupTokenIfAbsent();
	if (token !== null) {
		logSetupUrl(token);
		return;
	}
	const created = await repository.getSetupTokenCreatedAt();
	if (created !== null && Date.now() - created <= SETUP_TOKEN_TTL_MS) {
		Logger.info(
			'A setup URL from an earlier start is still unused and within its one hour lifetime. Set FLUXER_SETUP_TOKEN to replace it, or wait for it to expire and restart',
		);
		return;
	}
	Logger.warn('The stored setup token has expired. Generating a replacement');
	await repository.clearSetupToken();
	token = await repository.createSetupTokenIfAbsent();
	if (token === null) {
		Logger.error('Failed to rotate the expired setup token');
		return;
	}
	logSetupUrl(token);
}

export async function clearUsedSetupToken(repository: InstanceConfigRepository): Promise<void> {
	try {
		await repository.burnSetupToken();
	} catch (error) {
		Logger.error({error}, 'Could not clear the stored setup token after the admin bootstrap was claimed');
	}
}

export async function assertSetupToken(params: {
	rateLimit: IRateLimitService;
	config: APIConfig;
	repository: InstanceConfigRepository;
	presented: string | null | undefined;
	clientIp: string;
}): Promise<boolean> {
	const {rateLimit, config, repository, clientIp} = params;
	if (!isSetupTokenEnforced(config)) return false;
	const setupConfigured = (await repository.getAppPublicConfig()).setup.configured;
	const adminBootstrapped = setupConfigured
		? await repository.isAdminBootstrapped()
		: await repository.confirmAdminBootstrapped();
	if (adminBootstrapped) return false;
	const token = params.presented?.trim();
	if (!token) {
		if (!setupConfigured) {
			throw InputValidationError.fromCode('setup_token', ValidationErrorCodes.SETUP_TOKEN_REQUIRED);
		}
		return false;
	}
	const failureLimit = config.dev.relaxRegistrationRateLimits
		? null
		: {
				identifier: `setup-token:ip:${getSameIpDecisionKey(clientIp) ?? clientIp}`,
				maxAttempts: SETUP_TOKEN_FAILURE_MAX_ATTEMPTS,
				windowMs: SETUP_TOKEN_FAILURE_WINDOW_MS,
			};
	if (failureLimit) {
		const failureState = await rateLimit.peekLimit(failureLimit);
		if (failureState.remaining === 0) {
			throw createRateLimitError({
				...failureState,
				allowed: false,
				retryAfter: Math.ceil(failureLimit.windowMs / failureLimit.maxAttempts / 1000),
			});
		}
	}
	if (!(await repository.verifySetupToken(token))) {
		if (failureLimit) await rateLimit.checkLimit(failureLimit);
		throw InputValidationError.fromCode('setup_token', ValidationErrorCodes.SETUP_TOKEN_INVALID);
	}
	return true;
}
