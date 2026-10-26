// SPDX-License-Identifier: AGPL-3.0-or-later

export class E2eeError extends Error {
	readonly code: string;

	constructor(code: string, message: string, options?: {cause?: unknown}) {
		super(message, options);
		this.name = 'E2eeError';
		this.code = code;
	}
}

export class E2eeCryptoUnavailableError extends E2eeError {
	constructor() {
		super('crypto_unavailable', 'WebCrypto subtle API is not available in this environment');
		this.name = 'E2eeCryptoUnavailableError';
	}
}

export class E2eeEnvelopeError extends E2eeError {
	constructor(message: string) {
		super('invalid_envelope', message);
		this.name = 'E2eeEnvelopeError';
	}
}

export class E2eeDecryptError extends E2eeError {
	constructor(message: string, options?: {cause?: unknown}) {
		super('decrypt_failed', message, options);
		this.name = 'E2eeDecryptError';
	}
}

export class E2eeKeyUnwrapError extends E2eeError {
	constructor(message: string, options?: {cause?: unknown}) {
		super('key_unwrap_failed', message, options);
		this.name = 'E2eeKeyUnwrapError';
	}
}
