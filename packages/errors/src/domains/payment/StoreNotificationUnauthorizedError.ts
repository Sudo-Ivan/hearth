// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@hearth/constants/src/ApiErrorCodes';
import {HearthError} from '@hearth/errors/src/HearthError';

export class StoreNotificationUnauthorizedError extends HearthError {
	constructor() {
		super({
			code: APIErrorCodes.STORE_NOTIFICATION_UNAUTHORIZED,
			status: 401,
		});
	}
}
