// SPDX-License-Identifier: AGPL-3.0-or-later

import {Routes} from '@app/app/Routes';
import {UserSettingsModal} from '@app/features/app/components/dialogs/LoadableSettingsModals';
import * as RouterUtils from '@app/features/navigation/utils/RouterUtils';
import {GiftEmberModal} from '@app/features/premium/components/modals/GiftEmberModal';
import * as ModalCommands from '@app/features/ui/commands/ModalCommands';
import {modal} from '@app/features/ui/commands/ModalCommands';
import * as PopoutCommands from '@app/features/ui/commands/PopoutCommands';

export function openEmberPage(): void {
	ModalCommands.popAll();
	PopoutCommands.closeAll();
	RouterUtils.transitionTo(Routes.EMBER);
}

export function openGiftEmberModal(): void {
	ModalCommands.push(
		modal(() => <GiftEmberModal data-flx="premium.ember-page-commands.open-gift-ember-modal.modal" />),
	);
}

export function openGiftInventorySettings(): void {
	ModalCommands.push(
		modal(() => (
			<UserSettingsModal
				initialTab="gift_inventory"
				data-flx="premium.ember-page-commands.open-gift-inventory-settings.user-settings-modal"
			/>
		)),
	);
}
