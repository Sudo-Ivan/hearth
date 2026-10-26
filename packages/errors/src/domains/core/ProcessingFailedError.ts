// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@hearth/constants/src/ApiErrorCodes';
import {InternalServerError} from '@hearth/errors/src/domains/core/InternalServerError';

export class ProcessingFailedError extends InternalServerError {
	constructor(detail?: string) {
		super({
			code: APIErrorCodes.PROCESSING_FAILED,
			messageVariables: detail ? {detail} : undefined,
		});
	}
}
