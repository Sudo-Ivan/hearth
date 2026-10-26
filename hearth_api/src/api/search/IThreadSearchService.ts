// SPDX-License-Identifier: AGPL-3.0-or-later

import type {ISearchAdapter} from '@hearth/schema/src/contracts/search/SearchAdapterTypes';
import type {SearchableThread, ThreadSearchFilters} from '@hearth/schema/src/contracts/search/SearchDocumentTypes';

export interface IThreadSearchService extends ISearchAdapter<ThreadSearchFilters, SearchableThread> {
	ready(): Promise<void>;
}
