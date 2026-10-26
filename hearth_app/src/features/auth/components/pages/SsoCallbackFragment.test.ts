// SPDX-License-Identifier: AGPL-3.0-or-later

import {
	parseSsoCallbackFragment,
	ssoMfaChallengeFromAllowedMethods,
} from '@app/features/auth/components/pages/SsoCallbackFragment';
import {describe, expect, it} from 'vitest';

describe('parseSsoCallbackFragment', () => {
	it('returns null when the hash is empty', () => {
		expect(parseSsoCallbackFragment('')).toBeNull();
		expect(parseSsoCallbackFragment('#')).toBeNull();
	});

	it('returns null when the fragment holds no SSO credential parameters', () => {
		expect(parseSsoCallbackFragment('#foo=bar')).toBeNull();
		expect(parseSsoCallbackFragment('#token=abc')).toBeNull();
		expect(parseSsoCallbackFragment('#user_id=123')).toBeNull();
	});

	it('parses a session token fragment', () => {
		expect(parseSsoCallbackFragment('#token=session-token&user_id=42')).toEqual({
			type: 'token',
			token: 'session-token',
			userId: '42',
			redirectTo: null,
		});
	});

	it('parses a session token fragment with a redirect target', () => {
		expect(parseSsoCallbackFragment('#token=session-token&user_id=42&redirect_to=%2Fchannels%2F%40me')).toEqual({
			type: 'token',
			token: 'session-token',
			userId: '42',
			redirectTo: '/channels/@me',
		});
	});

	it('parses a session token fragment without a leading hash', () => {
		expect(parseSsoCallbackFragment('token=session-token&user_id=42')).toEqual({
			type: 'token',
			token: 'session-token',
			userId: '42',
			redirectTo: null,
		});
	});

	it('parses an MFA challenge fragment', () => {
		expect(parseSsoCallbackFragment('#mfa_ticket=ticket-1&allowed_methods=totp%2Cwebauthn&redirect_to=%2Fapp')).toEqual(
			{
				type: 'mfa',
				challenge: {
					ticket: 'ticket-1',
					totp: true,
					webauthn: true,
					backupCodes: false,
				},
				redirectTo: '/app',
			},
		);
	});

	it('treats a missing allowed_methods list as no allowed methods', () => {
		expect(parseSsoCallbackFragment('#mfa_ticket=ticket-1')).toEqual({
			type: 'mfa',
			challenge: {
				ticket: 'ticket-1',
				totp: false,
				webauthn: false,
				backupCodes: false,
			},
			redirectTo: null,
		});
	});
});

describe('ssoMfaChallengeFromAllowedMethods', () => {
	it('maps each allowed method onto the MFA challenge', () => {
		expect(ssoMfaChallengeFromAllowedMethods('ticket-1', 'totp,webauthn,backup_codes')).toEqual({
			ticket: 'ticket-1',
			totp: true,
			webauthn: true,
			backupCodes: true,
		});
	});

	it('maps a single allowed method', () => {
		expect(ssoMfaChallengeFromAllowedMethods('ticket-1', 'backup_codes')).toEqual({
			ticket: 'ticket-1',
			totp: false,
			webauthn: false,
			backupCodes: true,
		});
	});

	it('ignores blank entries and unknown methods', () => {
		expect(ssoMfaChallengeFromAllowedMethods('ticket-1', 'totp,, ,unknown')).toEqual({
			ticket: 'ticket-1',
			totp: true,
			webauthn: false,
			backupCodes: false,
		});
	});

	it('treats a null list as no allowed methods', () => {
		expect(ssoMfaChallengeFromAllowedMethods('ticket-1', null)).toEqual({
			ticket: 'ticket-1',
			totp: false,
			webauthn: false,
			backupCodes: false,
		});
	});
});
