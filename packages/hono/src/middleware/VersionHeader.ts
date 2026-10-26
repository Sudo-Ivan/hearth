// SPDX-License-Identifier: AGPL-3.0-or-later

import {Headers as HttpHeaders} from '@hearth/constants/src/Headers';
import type {MiddlewareHandler} from 'hono';

function resolveHearthVersion(): string {
	const value = process.env.BUILD_VERSION?.trim();
	return value && value.length > 0 ? value : 'dev';
}

export function applyHearthVersionHeader(response: Response, version = resolveHearthVersion()): Response {
	const headers = new Headers(response.headers);
	headers.set(HttpHeaders.X_FLUXER_VERSION, version);
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

export function hearthVersionHeader(version = resolveHearthVersion()): MiddlewareHandler {
	return async (c, next) => {
		await next();
		c.res.headers.set(HttpHeaders.X_FLUXER_VERSION, version);
	};
}
