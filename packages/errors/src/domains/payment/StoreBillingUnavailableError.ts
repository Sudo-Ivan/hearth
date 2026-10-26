// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@hearth/constants/src/ApiErrorCodes';
import {ServiceUnavailableError} from '@hearth/errors/src/domains/core/ServiceUnavailableError';

export class StoreBillingUnavailableError extends ServiceUnavailableError {
	constructor() {
		super({
			code: APIErrorCodes.STORE_BILLING_UNAVAILABLE,
		});
	}
}
