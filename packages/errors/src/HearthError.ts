// SPDX-License-Identifier: AGPL-3.0-or-later

import type {APIErrorCode} from '@hearth/constants/src/ApiErrorCodes';
import type {ErrorResponse} from '@hearth/schema/src/domains/common/ErrorSchemas';
import {HTTPException} from 'hono/http-exception';

export type HearthErrorData = Record<string, unknown>;
export type HearthErrorStatus = HTTPException['status'];

interface HearthErrorOptions {
	code: string;
	message?: string;
	status: HearthErrorStatus;
	data?: HearthErrorData;
	headers?: Record<string, string>;
	messageVariables?: Record<string, unknown>;
	cause?: Error;
}

export class HearthError extends HTTPException {
	readonly code: string;
	override readonly message: string;
	override readonly status: HearthErrorStatus;
	readonly data?: HearthErrorData;
	readonly headers?: Record<string, string>;
	readonly messageVariables?: Record<string, unknown>;

	constructor(options: HearthErrorOptions) {
		const resolvedMessage = options.message ?? options.code;
		super(options.status, {message: resolvedMessage, cause: options.cause});
		this.code = options.code;
		this.message = resolvedMessage;
		this.status = options.status;
		this.data = options.data;
		this.headers = options.headers;
		this.messageVariables = options.messageVariables;
		this.name = 'HearthError';
	}

	override getResponse(): Response {
		return new Response(JSON.stringify(this.toJSON()), {
			status: this.status,
			headers: {
				'Content-Type': 'application/json',
				...this.headers,
			},
		});
	}

	toJSON(): ErrorResponse {
		return {
			code: this.code,
			message: this.message,
			...this.data,
		};
	}
}

type StatusErrorOptions = Omit<HearthErrorOptions, 'status' | 'code'>;
type RequiredStatusErrorOptions<TAllowMessage extends boolean> = {code: APIErrorCode} & (TAllowMessage extends true
	? StatusErrorOptions
	: Omit<StatusErrorOptions, 'message'>);

export function statusError<TAllowMessage extends boolean = true>(
	status: HearthErrorStatus,
	allowMessage: TAllowMessage = true as TAllowMessage,
) {
	return class extends HearthError {
		constructor(options: RequiredStatusErrorOptions<TAllowMessage>) {
			const {message, ...rest} = options as StatusErrorOptions & {code: APIErrorCode};
			super({...rest, status, message: allowMessage ? message : undefined});
		}
	};
}

export function defaultCodeStatusError<TCode extends string = APIErrorCode>(
	status: HearthErrorStatus,
	defaultCode: NoInfer<TCode>,
) {
	return class extends HearthError {
		constructor({code = defaultCode, ...options}: StatusErrorOptions & {code?: TCode} = {}) {
			super({...options, code, status});
		}
	};
}
