// SPDX-License-Identifier: AGPL-3.0-or-later

import type {MfaChallenge} from '@app/features/auth/state/AuthFlow';

const SSO_CALLBACK_FRAGMENT_TOKEN_PARAM = 'token';
const SSO_CALLBACK_FRAGMENT_USER_ID_PARAM = 'user_id';
const SSO_CALLBACK_FRAGMENT_MFA_TICKET_PARAM = 'mfa_ticket';
const SSO_CALLBACK_FRAGMENT_ALLOWED_METHODS_PARAM = 'allowed_methods';
const SSO_CALLBACK_FRAGMENT_REDIRECT_TO_PARAM = 'redirect_to';

const SSO_MFA_METHOD_TOTP = 'totp';
const SSO_MFA_METHOD_WEBAUTHN = 'webauthn';
const SSO_MFA_METHOD_BACKUP_CODES = 'backup_codes';

// The API completes OIDC sign-in server side and lands on this page with the
// session material in the URL fragment: token and user_id on success, or
// mfa_ticket and allowed_methods when a second factor is required.
export type SsoCallbackFragment =
	| {
			readonly type: 'token';
			readonly token: string;
			readonly userId: string;
			readonly redirectTo: string | null;
	  }
	| {
			readonly type: 'mfa';
			readonly challenge: MfaChallenge;
			readonly redirectTo: string | null;
	  };

function readNonEmptyParam(params: URLSearchParams, name: string): string | null {
	const value = params.get(name);
	return value == null || value.length === 0 ? null : value;
}

export function ssoMfaChallengeFromAllowedMethods(ticket: string, allowedMethods: string | null): MfaChallenge {
	const methods = new Set(
		(allowedMethods ?? '')
			.split(',')
			.map((method) => method.trim())
			.filter((method) => method.length > 0),
	);
	return {
		ticket,
		totp: methods.has(SSO_MFA_METHOD_TOTP),
		webauthn: methods.has(SSO_MFA_METHOD_WEBAUTHN),
		backupCodes: methods.has(SSO_MFA_METHOD_BACKUP_CODES),
	};
}

export function parseSsoCallbackFragment(hash: string): SsoCallbackFragment | null {
	if (hash.length === 0) {
		return null;
	}
	const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
	const token = readNonEmptyParam(params, SSO_CALLBACK_FRAGMENT_TOKEN_PARAM);
	const userId = readNonEmptyParam(params, SSO_CALLBACK_FRAGMENT_USER_ID_PARAM);
	if (token != null && userId != null) {
		return {
			type: 'token',
			token,
			userId,
			redirectTo: readNonEmptyParam(params, SSO_CALLBACK_FRAGMENT_REDIRECT_TO_PARAM),
		};
	}
	const mfaTicket = readNonEmptyParam(params, SSO_CALLBACK_FRAGMENT_MFA_TICKET_PARAM);
	if (mfaTicket != null) {
		return {
			type: 'mfa',
			challenge: ssoMfaChallengeFromAllowedMethods(mfaTicket, params.get(SSO_CALLBACK_FRAGMENT_ALLOWED_METHODS_PARAM)),
			redirectTo: readNonEmptyParam(params, SSO_CALLBACK_FRAGMENT_REDIRECT_TO_PARAM),
		};
	}
	return null;
}
