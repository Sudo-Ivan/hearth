// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@hearth/constants/src/ApiErrorCodes';
import {ConflictError} from '@hearth/errors/src/domains/core/ConflictError';

export class OperatorPassOfferUnavailableError extends ConflictError {
	constructor() {
		super({code: APIErrorCodes.OPERATOR_PASS_OFFER_UNAVAILABLE});
	}
}
