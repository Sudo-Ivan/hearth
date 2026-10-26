// SPDX-License-Identifier: AGPL-3.0-or-later

import ChannelE2ee from '@app/features/e2ee/state/ChannelE2ee';
import type {Message} from '@app/features/messaging/models/MessagingMessage';
import {MessageFlags} from '@hearth/constants/src/ChannelConstants';
import {useEffect} from 'react';

export interface ResolvedE2eeContent {
	encrypted: boolean;
	state: 'plain' | 'pending' | 'decrypted' | 'undecryptable';
	content: string;
}

// Resolves the displayable content for a message. Plain messages pass
// through unchanged. Envelope messages resolve to decrypted plaintext via
// the e2ee store, or to a placeholder state when the device holds no
// matching wrapped key.
export function useE2eeMessageContent(message: Message): ResolvedE2eeContent {
	const isE2ee = message.hasFlag(MessageFlags.E2EE);
	const entry = isE2ee ? ChannelE2ee.getDecryptionState(message.id, message.content) : undefined;
	useEffect(() => {
		if (!isE2ee || entry !== undefined) return;
		void ChannelE2ee.requestDecryption({
			channelId: message.channelId,
			messageId: message.id,
			content: message.content,
		});
	}, [isE2ee, entry, message.channelId, message.id, message.content]);
	if (!isE2ee) {
		return {encrypted: false, state: 'plain', content: message.content};
	}
	if (entry?.status === 'decrypted' && entry.text !== undefined) {
		return {encrypted: true, state: 'decrypted', content: entry.text};
	}
	if (entry?.status === 'failed') {
		return {encrypted: true, state: 'undecryptable', content: ''};
	}
	return {encrypted: true, state: 'pending', content: ''};
}
