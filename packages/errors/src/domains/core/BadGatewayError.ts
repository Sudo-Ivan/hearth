// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@hearth/constants/src/ApiErrorCodes';
import {defaultCodeStatusError} from '@hearth/errors/src/HearthError';

export class BadGatewayError extends defaultCodeStatusError(502, APIErrorCodes.BAD_GATEWAY) {}
