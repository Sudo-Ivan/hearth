// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@hearth/constants/src/ApiErrorCodes';
import {ConflictError} from '@hearth/errors/src/domains/core/ConflictError';

export class PaymentDisputeWarningTooLateError extends ConflictError {
	constructor() {
		super({code: APIErrorCodes.PAYMENT_DISPUTE_WARNING_TOO_LATE});
	}
}
