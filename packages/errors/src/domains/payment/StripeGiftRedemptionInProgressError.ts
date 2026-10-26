// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@hearth/constants/src/ApiErrorCodes';
import {HearthError} from '@hearth/errors/src/HearthError';

export class StripeGiftRedemptionInProgressError extends HearthError {
	constructor() {
		super({
			code: APIErrorCodes.STRIPE_GIFT_REDEMPTION_IN_PROGRESS,
			status: 400,
		});
	}
}
