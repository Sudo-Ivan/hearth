// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@hearth/constants/src/ApiErrorCodes';
import {BadRequestError} from '@hearth/errors/src/domains/core/BadRequestError';

export class InvalidDiscriminatorError extends BadRequestError {
	constructor() {
		super({
			code: APIErrorCodes.DISCRIMINATOR_REQUIRED,
		});
	}
}
