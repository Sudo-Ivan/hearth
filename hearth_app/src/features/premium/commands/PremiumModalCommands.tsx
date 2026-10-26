// SPDX-License-Identifier: AGPL-3.0-or-later

import * as EmberPageCommands from '@app/features/premium/commands/EmberPageCommands';
import {shouldShowPremiumFeatures} from '@app/features/premium/utils/PremiumUtils';

interface OpenOptions {
	defaultGiftMode?: boolean;
}

export function open(optionsOrDefaultGiftMode: OpenOptions | boolean = {}): void {
	if (!shouldShowPremiumFeatures()) {
		return;
	}
	const options =
		typeof optionsOrDefaultGiftMode === 'boolean'
			? {defaultGiftMode: optionsOrDefaultGiftMode}
			: optionsOrDefaultGiftMode;
	const {defaultGiftMode = false} = options;
	if (defaultGiftMode) {
		EmberPageCommands.openGiftEmberModal();
	} else {
		EmberPageCommands.openEmberPage();
	}
}
