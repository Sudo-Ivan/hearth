// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@hearth/constants/src/ApiErrorCodes';
import {NotFoundError} from '@hearth/errors/src/domains/core/NotFoundError';

export class UnknownOperatorPassWallEntryError extends NotFoundError {
	constructor() {
		super({code: APIErrorCodes.UNKNOWN_OPERATOR_PASS_WALL_ENTRY});
	}
}
