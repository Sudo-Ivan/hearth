// SPDX-License-Identifier: AGPL-3.0-or-later

import {ValidationErrorCodes} from '@hearth/constants/src/ValidationErrorCodes';
import {InputValidationError} from '@hearth/errors/src/domains/core/InputValidationError';
import type {MessageSearchRequest} from '@hearth/schema/src/domains/message/MessageRequestSchemas';

const MEMBER_ONLY_SEARCH_FILTERS = [
	'author_id',
	'exclude_author_id',
	'mentions',
	'exclude_mentions',
	'mention_everyone',
] as const satisfies ReadonlyArray<keyof MessageSearchRequest>;

export function assertVisitorSearchFilters(params: MessageSearchRequest): void {
	for (const field of MEMBER_ONLY_SEARCH_FILTERS) {
		if (params[field] !== undefined) {
			throw InputValidationError.fromCode(field, ValidationErrorCodes.SEARCH_FILTER_NEEDS_MEMBERSHIP);
		}
	}
}
