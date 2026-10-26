// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@hearth/constants/src/ApiErrorCodes';
import {sanitizeRetryAfterSeconds} from '@hearth/errors/src/domains/core/RetryAfterSeconds';
import {ThrottledError} from '@hearth/errors/src/domains/core/ThrottledError';

export class EmailCodeResendCooldownError extends ThrottledError {
	constructor(retryAfterSeconds: number) {
		const retryAfter = sanitizeRetryAfterSeconds(retryAfterSeconds);
		super({
			code: APIErrorCodes.EMAIL_CODE_RESEND_COOLDOWN,
			retryAfterSeconds: retryAfter,
			data: {retry_after: retryAfter},
		});
	}
}
