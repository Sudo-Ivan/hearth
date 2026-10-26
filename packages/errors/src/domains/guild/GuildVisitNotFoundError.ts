// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@hearth/constants/src/ApiErrorCodes';
import {NotFoundError} from '@hearth/errors/src/domains/core/NotFoundError';

export class GuildVisitNotFoundError extends NotFoundError {
	constructor() {
		super({code: APIErrorCodes.GUILD_VISIT_NOT_FOUND});
	}
}
