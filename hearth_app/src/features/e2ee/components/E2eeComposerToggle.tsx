// SPDX-License-Identifier: AGPL-3.0-or-later

import {TextareaButton} from '@app/features/channel/components/textarea/TextareaButton';
import ChannelE2ee from '@app/features/e2ee/state/ChannelE2ee';
import {msg} from '@lingui/core/macro';
import {useLingui} from '@lingui/react/macro';
import {LockIcon, LockOpenIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import {useCallback} from 'react';

const ENABLE_ENCRYPTION_DESCRIPTOR = msg({
	message: 'Encrypt messages in this channel',
	comment: 'Composer button that turns on end to end encryption for the channel.',
});
const DISABLE_ENCRYPTION_DESCRIPTOR = msg({
	message: 'Disable encryption for this channel',
	comment: 'Composer button that turns off end to end encryption for the channel.',
});

interface E2eeComposerToggleProps {
	channelId: string;
}

// Per-channel composer toggle for end to end encryption. The choice is
// device local: channels are also treated as encrypted whenever flagged
// envelopes arrive, which the selected state reflects.
export const E2eeComposerToggle = observer(({channelId}: E2eeComposerToggleProps) => {
	const {i18n} = useLingui();
	const enabled = ChannelE2ee.isEncryptionEnabled(channelId);
	const active = enabled || ChannelE2ee.observedEncryptedChannelIds.has(channelId);
	const handleClick = useCallback(() => {
		ChannelE2ee.setEncryptionEnabled(channelId, !ChannelE2ee.isEncryptionEnabled(channelId));
	}, [channelId]);
	return (
		<TextareaButton
			icon={enabled ? LockIcon : LockOpenIcon}
			iconProps={active ? {weight: 'fill'} : undefined}
			label={i18n._(enabled ? DISABLE_ENCRYPTION_DESCRIPTOR : ENABLE_ENCRYPTION_DESCRIPTOR)}
			isSelected={enabled}
			onClick={handleClick}
			data-flx="e2ee.e2ee-composer-toggle.textarea-button.toggle-encryption"
		/>
	);
});
