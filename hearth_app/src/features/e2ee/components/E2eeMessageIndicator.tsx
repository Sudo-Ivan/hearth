// SPDX-License-Identifier: AGPL-3.0-or-later

import styles from '@app/features/e2ee/components/E2eeMessageIndicator.module.css';
import {msg} from '@lingui/core/macro';
import {useLingui} from '@lingui/react/macro';
import {LockIcon} from '@phosphor-icons/react';

const ENCRYPTED_MESSAGE_DESCRIPTOR = msg({
	message: 'Encrypted message',
	comment: 'Placeholder shown in place of a message that is end to end encrypted.',
});

const CANNOT_DECRYPT_DESCRIPTOR = msg({
	message: 'Encrypted message (cannot decrypt on this device)',
	comment:
		'Placeholder shown in place of an end to end encrypted message when this device cannot unwrap the content key.',
});

const END_TO_END_ENCRYPTED_DESCRIPTOR = msg({
	message: 'End to end encrypted',
	comment: 'Tooltip on the lock icon attached to an end to end encrypted message.',
});

// Inline lock marker rendered next to decrypted message content.
export const E2eeLockIndicator = () => {
	const {i18n} = useLingui();
	return (
		<LockIcon
			size={12}
			weight="fill"
			className={styles.e2eeLockIndicator}
			aria-label={i18n._(END_TO_END_ENCRYPTED_DESCRIPTOR)}
			data-flx="e2ee.e2ee-message-indicator.e2ee-lock-indicator"
		/>
	);
};

interface E2eeMessagePlaceholderProps {
	undecryptable: boolean;
}

// Body shown in place of message content while an envelope is resolving or
// when this device holds no matching wrapped key.
export const E2eeMessagePlaceholder = ({undecryptable}: E2eeMessagePlaceholderProps) => {
	const {i18n} = useLingui();
	return (
		<span className={styles.e2eePlaceholder} data-flx="e2ee.e2ee-message-indicator.e2ee-placeholder">
			<LockIcon
				size={14}
				weight="fill"
				className={styles.e2eePlaceholderIcon}
				data-flx="e2ee.e2ee-message-indicator.e2ee-placeholder-icon"
			/>
			{i18n._(undecryptable ? CANNOT_DECRYPT_DESCRIPTOR : ENCRYPTED_MESSAGE_DESCRIPTOR)}
		</span>
	);
};
