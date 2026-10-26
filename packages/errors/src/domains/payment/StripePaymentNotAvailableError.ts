// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@hearth/constants/src/ApiErrorCodes';
import {HearthError} from '@hearth/errors/src/HearthError';

export class StripePaymentNotAvailableError extends HearthError {
	constructor() {
		super({
			code: APIErrorCodes.STRIPE_PAYMENT_NOT_AVAILABLE,
			status: 400,
		});
	}
}
