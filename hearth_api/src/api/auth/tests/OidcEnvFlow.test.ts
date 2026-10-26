// SPDX-License-Identifier: AGPL-3.0-or-later

import dns from 'node:dns';
import {createAuthHarness, createTestAccount, createUniqueEmail} from '@app/api/auth/tests/AuthTestUtils';
import {getConfig} from '@app/api/Config';
import type {OidcConfig} from '@app/api/config/APIConfig';
import {resetSsoRequestUrlPolicyForTesting} from '@app/api/instance/SsoConfigValidation';
import type {ApiTestHarness} from '@app/api/test/ApiTestHarness';
import {server} from '@app/api/test/msw/server';
import {createBuilder, createBuilderWithoutAuth} from '@app/api/test/TestRequestBuilder';
import {HttpResponse, http} from 'msw';
import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';

const ISSUER = 'https://idp.example.test';
const ISSUER_HOST = 'idp.example.test';
const RESOLVED_PUBLIC_IP = '93.184.216.34';
const DEFAULT_OIDC: OidcConfig = {
	issuer: null,
	clientId: null,
	clientSecret: null,
	scopes: 'openid profile email',
	buttonLabel: 'Single Sign-On',
	autoRegister: true,
};

const config = getConfig();

function oidcLocation(response: Response): string {
	const location = response.headers.get('location');
	expect(location).toBeTruthy();
	return location!;
}

interface SsoStatusResponse {
	enabled: boolean;
	enforced: boolean;
	button_label: string | null;
	redirect_uri: string;
}

describe('OIDC env-configured login flow', () => {
	let harness: ApiTestHarness;
	let userInfoEmail: string;
	let userInfoSub: string;
	let lookupSpy: ReturnType<typeof vi.spyOn>;

	function installIdpHandlers(overrides?: {tokenStatus?: number}): void {
		server.use(
			http.get(`${ISSUER}/.well-known/openid-configuration`, () =>
				HttpResponse.json({
					issuer: ISSUER,
					authorization_endpoint: `${ISSUER}/authorize`,
					token_endpoint: `${ISSUER}/token`,
					userinfo_endpoint: `${ISSUER}/userinfo`,
					jwks_uri: `${ISSUER}/jwks`,
				}),
			),
			http.post(`${ISSUER}/token`, () => {
				if (overrides?.tokenStatus !== undefined) {
					return HttpResponse.json({error: 'server_error'}, {status: overrides.tokenStatus});
				}
				return HttpResponse.json({access_token: 'oidc-access-token', token_type: 'Bearer'});
			}),
			http.get(`${ISSUER}/userinfo`, () =>
				HttpResponse.json({
					sub: userInfoSub,
					email: userInfoEmail,
					email_verified: true,
					name: 'OIDC User',
					preferred_username: 'oidc.user',
				}),
			),
		);
	}

	async function startOidc(query = ''): Promise<string> {
		const {response} = await createBuilderWithoutAuth(harness).get(`/auth/oidc/start${query}`).executeRaw();
		expect(response.status).toBe(302);
		return oidcLocation(response);
	}

	beforeAll(async () => {
		harness = await createAuthHarness();
	});
	beforeEach(async () => {
		await harness.reset();
		userInfoEmail = createUniqueEmail('oidc');
		userInfoSub = `idp-sub-${Math.random().toString(36).slice(2)}`;
		Object.assign(config.auth.oidc, DEFAULT_OIDC, {
			issuer: ISSUER,
			clientId: 'itest-oidc-client',
			clientSecret: 'itest-oidc-secret',
			buttonLabel: 'Sign in with Example SSO',
		});
		installIdpHandlers();
		const realLookup = dns.promises.lookup.bind(dns.promises);
		lookupSpy = vi.spyOn(dns.promises, 'lookup').mockImplementation(((hostname: string, options?: unknown) => {
			if (hostname === ISSUER_HOST) {
				return Promise.resolve([{address: RESOLVED_PUBLIC_IP, family: 4}]);
			}
			return Reflect.apply(realLookup, dns.promises, [hostname, options]);
		}) as never);
	});
	afterEach(async () => {
		lookupSpy.mockRestore();
		Object.assign(config.auth.oidc, DEFAULT_OIDC);
		resetSsoRequestUrlPolicyForTesting();
	});
	afterAll(async () => {
		await harness?.shutdown();
	});

	it('exposes the env OIDC provider through the public SSO status', async () => {
		const status = await createBuilderWithoutAuth<SsoStatusResponse>(harness).get('/auth/sso/status').execute();
		expect(status.enabled).toBe(true);
		expect(status.enforced).toBe(false);
		expect(status.button_label).toBe('Sign in with Example SSO');
		expect(status.redirect_uri).toBe(`${config.endpoints.apiPublic}/auth/oidc/callback`);
	});

	it('redirects the browser to the discovered authorization endpoint', async () => {
		const location = await startOidc('?redirect_to=/me');
		const authorizeUrl = new URL(location);
		expect(authorizeUrl.origin).toBe(ISSUER);
		expect(authorizeUrl.pathname).toBe('/authorize');
		expect(authorizeUrl.searchParams.get('client_id')).toBe('itest-oidc-client');
		expect(authorizeUrl.searchParams.get('response_type')).toBe('code');
		expect(authorizeUrl.searchParams.get('scope')).toBe('openid profile email');
		expect(authorizeUrl.searchParams.get('redirect_uri')).toBe(`${config.endpoints.apiPublic}/auth/oidc/callback`);
		expect(authorizeUrl.searchParams.get('state')).toBeTruthy();
		expect(authorizeUrl.searchParams.get('nonce')).toBeTruthy();
		expect(authorizeUrl.searchParams.get('code_challenge_method')).toBe('S256');
		expect(authorizeUrl.searchParams.get('code_challenge')).toBeTruthy();
	});

	it('signs in a new user and redirects into the app with a session token', async () => {
		const authorizeUrl = new URL(await startOidc('?redirect_to=/me'));
		const state = authorizeUrl.searchParams.get('state')!;
		const {response} = await createBuilderWithoutAuth(harness)
			.get(`/auth/oidc/callback?code=auth-code-1&state=${state}`)
			.executeRaw();
		expect(response.status).toBe(302);
		const location = oidcLocation(response);
		expect(location.startsWith(`${config.endpoints.webApp}/auth/sso/callback#`)).toBe(true);
		const fragment = new URLSearchParams(location.split('#')[1]);
		const token = fragment.get('token')!;
		const userId = fragment.get('user_id')!;
		expect(token).toBeTruthy();
		expect(userId).toBeTruthy();
		expect(fragment.get('redirect_to')).toBe('/me');
		const me = await createBuilder<{id: string; email: string | null}>(harness, token).get('/users/@me').execute();
		expect(me.id).toBe(userId);
		expect(me.email).toBe(userInfoEmail);
	});

	it('links the provider identity to an existing account with the same email', async () => {
		const account = await createTestAccount(harness, {email: userInfoEmail});
		const authorizeUrl = new URL(await startOidc());
		const state = authorizeUrl.searchParams.get('state')!;
		const {response} = await createBuilderWithoutAuth(harness)
			.get(`/auth/oidc/callback?code=auth-code-2&state=${state}`)
			.executeRaw();
		expect(response.status).toBe(302);
		const fragment = new URLSearchParams(oidcLocation(response).split('#')[1]);
		expect(fragment.get('user_id')).toBe(account.userId);
		const me = await createBuilder<{id: string; email: string | null}>(harness, fragment.get('token')!)
			.get('/users/@me')
			.execute();
		expect(me.id).toBe(account.userId);
	});

	it('rejects a callback with an unknown or mismatched state', async () => {
		const {response} = await createBuilderWithoutAuth(harness)
			.get('/auth/oidc/callback?code=auth-code-3&state=not-a-real-state')
			.executeRaw();
		expect(response.status).toBe(302);
		const location = oidcLocation(response);
		expect(location.startsWith(`${config.endpoints.webApp}/auth/sso/callback?error=`)).toBe(true);
	});

	it('rejects a callback whose state was already consumed', async () => {
		const authorizeUrl = new URL(await startOidc());
		const state = authorizeUrl.searchParams.get('state')!;
		const first = await createBuilderWithoutAuth(harness)
			.get(`/auth/oidc/callback?code=auth-code-4&state=${state}`)
			.executeRaw();
		expect(first.response.status).toBe(302);
		const second = await createBuilderWithoutAuth(harness)
			.get(`/auth/oidc/callback?code=auth-code-4&state=${state}`)
			.executeRaw();
		expect(second.response.status).toBe(302);
		expect(oidcLocation(second.response)).toContain('?error=');
	});

	it('redirects with an error when the token exchange fails', async () => {
		installIdpHandlers({tokenStatus: 500});
		const authorizeUrl = new URL(await startOidc());
		const state = authorizeUrl.searchParams.get('state')!;
		const {response} = await createBuilderWithoutAuth(harness)
			.get(`/auth/oidc/callback?code=auth-code-5&state=${state}`)
			.executeRaw();
		expect(response.status).toBe(302);
		expect(oidcLocation(response)).toContain('?error=');
	});

	it('refuses auto-registration when FLUXER_OIDC_AUTO_REGISTER is false', async () => {
		config.auth.oidc.autoRegister = false;
		const authorizeUrl = new URL(await startOidc());
		const state = authorizeUrl.searchParams.get('state')!;
		const {response} = await createBuilderWithoutAuth(harness)
			.get(`/auth/oidc/callback?code=auth-code-6&state=${state}`)
			.executeRaw();
		expect(response.status).toBe(302);
		const location = oidcLocation(response);
		expect(location).toContain('?error=');
		expect(location).toContain('SSO_REQUIRED');
	});
});
