// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@hearth/constants/src/ApiErrorCodes';
import {BadRequestError} from '@hearth/errors/src/domains/core/BadRequestError';
import type {HearthErrorData} from '@hearth/errors/src/HearthError';

export class CaptchaRequiredError extends BadRequestError {
	constructor(data?: HearthErrorData) {
		super({code: APIErrorCodes.CAPTCHA_REQUIRED, data});
		this.name = 'CaptchaRequiredError';
	}
}

export class InvalidCaptchaError extends BadRequestError {
	constructor(data?: HearthErrorData) {
		super({code: APIErrorCodes.INVALID_CAPTCHA, data});
		this.name = 'InvalidCaptchaError';
	}
}
