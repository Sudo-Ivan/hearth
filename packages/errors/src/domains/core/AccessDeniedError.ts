// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@hearth/constants/src/ApiErrorCodes';
import {HearthError} from '@hearth/errors/src/HearthError';

export class AccessDeniedError extends HearthError {
	constructor() {
		super({code: APIErrorCodes.ACCESS_DENIED, status: 403});
	}
}
