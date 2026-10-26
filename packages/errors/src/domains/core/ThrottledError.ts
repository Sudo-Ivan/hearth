// SPDX-License-Identifier: AGPL-3.0-or-later

import {sanitizeRetryAfterSeconds} from '@hearth/errors/src/domains/core/RetryAfterSeconds';
import {HearthError, type HearthErrorData} from '@hearth/errors/src/HearthError';

export class ThrottledError extends HearthError {
	constructor({
		code,
		message,
		retryAfterSeconds,
		data,
		headers,
		messageVariables,
	}: {
		code: string;
		message?: string;
		retryAfterSeconds: number;
		data?: HearthErrorData;
		headers?: Record<string, string>;
		messageVariables?: Record<string, unknown>;
	}) {
		super({
			code,
			message,
			status: 429,
			data,
			headers: {...headers, 'Retry-After': sanitizeRetryAfterSeconds(retryAfterSeconds).toString()},
			messageVariables,
		});
	}
}
