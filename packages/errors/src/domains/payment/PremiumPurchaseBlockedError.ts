// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@hearth/constants/src/ApiErrorCodes';
import {ForbiddenError} from '@hearth/errors/src/domains/core/ForbiddenError';
import type {HearthErrorData} from '@hearth/errors/src/HearthError';

type PremiumPurchaseBlockedReason = 'lifetime' | 'existing_subscription' | 'purchase_disabled' | 'payment_dispute_open';

type PremiumPurchaseBlockingProvider = 'stripe' | 'app_store' | 'google_play';

interface PremiumPurchaseBlockedData extends HearthErrorData {
	provider?: PremiumPurchaseBlockingProvider;
}

export class PremiumPurchaseBlockedError extends ForbiddenError {
	constructor(reason: PremiumPurchaseBlockedReason = 'purchase_disabled', data: PremiumPurchaseBlockedData = {}) {
		super({
			code: APIErrorCodes.PREMIUM_PURCHASE_BLOCKED,
			data: {
				...data,
				reason,
			},
		});
	}
}
