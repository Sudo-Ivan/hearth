// SPDX-License-Identifier: AGPL-3.0-or-later

import {createLogger, type Logger as HearthLogger} from '@hearth/logger/src/Logger';

export const Logger = createLogger('hearth-api');

export type Logger = HearthLogger;
