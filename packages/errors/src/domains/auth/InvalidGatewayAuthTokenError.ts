// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@hearth/constants/src/ApiErrorCodes';
import {UnauthorizedError} from '@hearth/errors/src/domains/core/UnauthorizedError';

export class InvalidGatewayAuthTokenError extends UnauthorizedError {
	constructor() {
		super({code: APIErrorCodes.INVALID_AUTH_TOKEN});
	}
}
