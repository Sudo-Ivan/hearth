// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@hearth/constants/src/ApiErrorCodes';
import {NotFoundError} from '@hearth/errors/src/domains/core/NotFoundError';

export class UnknownMessageError extends NotFoundError {
	constructor() {
		super({code: APIErrorCodes.UNKNOWN_MESSAGE});
	}
}
