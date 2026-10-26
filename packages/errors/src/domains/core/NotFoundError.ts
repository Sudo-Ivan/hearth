// SPDX-License-Identifier: AGPL-3.0-or-later

import {statusError} from '@hearth/errors/src/HearthError';

export class NotFoundError extends statusError(404) {}
