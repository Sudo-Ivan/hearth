// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@hearth/constants/src/ApiErrorCodes';
import {defaultCodeStatusError} from '@hearth/errors/src/HearthError';

export class UnauthorizedError extends defaultCodeStatusError(401, APIErrorCodes.UNAUTHORIZED) {}
