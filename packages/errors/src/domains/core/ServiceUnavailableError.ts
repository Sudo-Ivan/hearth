// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@hearth/constants/src/ApiErrorCodes';
import {defaultCodeStatusError} from '@hearth/errors/src/HearthError';

export class ServiceUnavailableError extends defaultCodeStatusError<string>(503, APIErrorCodes.SERVICE_UNAVAILABLE) {}
