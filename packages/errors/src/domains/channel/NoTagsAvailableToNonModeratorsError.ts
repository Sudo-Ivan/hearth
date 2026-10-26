// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@hearth/constants/src/ApiErrorCodes';
import {BadRequestError} from '@hearth/errors/src/domains/core/BadRequestError';

export class NoTagsAvailableToNonModeratorsError extends BadRequestError {
	constructor() {
		super({
			code: APIErrorCodes.NO_TAGS_AVAILABLE_TO_NON_MODERATORS,
		});
	}
}
