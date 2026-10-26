// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@hearth/constants/src/ApiErrorCodes';
import {HearthError} from '@hearth/errors/src/HearthError';

export class SearchIndexNotReadyError extends HearthError {
	constructor(retryAfterSeconds: number) {
		super({
			code: APIErrorCodes.SEARCH_INDEX_NOT_READY,
			status: 202,
			data: {
				documents_indexed: 0,
				retry_after: retryAfterSeconds,
			},
		});
	}
}
