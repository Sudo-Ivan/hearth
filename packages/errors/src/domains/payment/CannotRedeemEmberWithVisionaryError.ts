// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@hearth/constants/src/ApiErrorCodes';
import {BadRequestError} from '@hearth/errors/src/domains/core/BadRequestError';

export class CannotRedeemEmberWithVisionaryError extends BadRequestError {
	constructor(premiumTierName = 'Ember') {
		super({
			code: APIErrorCodes.CANNOT_REDEEM_EMBER_WITH_VISIONARY,
			messageVariables: {premium_tier_name: premiumTierName},
		});
	}
}
