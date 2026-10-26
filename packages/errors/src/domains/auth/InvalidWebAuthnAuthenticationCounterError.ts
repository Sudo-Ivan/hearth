// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@hearth/constants/src/ApiErrorCodes';
import {InternalServerError} from '@hearth/errors/src/domains/core/InternalServerError';

export class InvalidWebAuthnAuthenticationCounterError extends InternalServerError {
	constructor() {
		super({code: APIErrorCodes.INVALID_WEBAUTHN_AUTHENTICATION_COUNTER});
	}
}
