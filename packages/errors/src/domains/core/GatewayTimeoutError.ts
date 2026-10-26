// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@hearth/constants/src/ApiErrorCodes';
import {defaultCodeStatusError} from '@hearth/errors/src/HearthError';

export class GatewayTimeoutError extends defaultCodeStatusError(504, APIErrorCodes.GATEWAY_TIMEOUT) {}
