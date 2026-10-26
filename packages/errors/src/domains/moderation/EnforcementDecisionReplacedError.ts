// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@hearth/constants/src/ApiErrorCodes';
import {ConflictError} from '@hearth/errors/src/domains/core/ConflictError';

export class EnforcementDecisionReplacedError extends ConflictError {
	constructor() {
		super({code: APIErrorCodes.ENFORCEMENT_DECISION_REPLACED});
	}
}
