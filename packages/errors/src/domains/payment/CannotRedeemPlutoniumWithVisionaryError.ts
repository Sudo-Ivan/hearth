// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@hearth/constants/src/ApiErrorCodes';
import {BadRequestError} from '@hearth/errors/src/domains/core/BadRequestError';

export class CannotRedeemPlutoniumWithVisionaryError extends BadRequestError {
	constructor(premiumTierName = 'Plutonium') {
		super({
			code: APIErrorCodes.CANNOT_REDEEM_PLUTONIUM_WITH_VISIONARY,
			messageVariables: {premium_tier_name: premiumTierName},
		});
	}
}
