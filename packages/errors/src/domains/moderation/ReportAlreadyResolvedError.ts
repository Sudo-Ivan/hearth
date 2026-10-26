// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@hearth/constants/src/ApiErrorCodes';
import {BadRequestError} from '@hearth/errors/src/domains/core/BadRequestError';

export class ReportAlreadyResolvedError extends BadRequestError {
	constructor() {
		super({
			code: APIErrorCodes.REPORT_ALREADY_RESOLVED,
		});
	}
}
