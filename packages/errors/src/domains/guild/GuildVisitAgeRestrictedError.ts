// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@hearth/constants/src/ApiErrorCodes';
import {ForbiddenError} from '@hearth/errors/src/domains/core/ForbiddenError';

export class GuildVisitAgeRestrictedError extends ForbiddenError {
	constructor() {
		super({code: APIErrorCodes.GUILD_VISIT_AGE_RESTRICTED});
	}
}
