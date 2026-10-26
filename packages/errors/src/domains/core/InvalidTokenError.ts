// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@hearth/constants/src/ApiErrorCodes';
import {HearthError} from '@hearth/errors/src/HearthError';

export class InvalidTokenError extends HearthError {
	constructor() {
		super({code: APIErrorCodes.INVALID_TOKEN, status: 401});
	}
}
