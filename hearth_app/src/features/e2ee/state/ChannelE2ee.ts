// SPDX-License-Identifier: AGPL-3.0-or-later

import {ResettableStates} from '@app/features/app/state/ResettableStates';
import Authentication from '@app/features/auth/state/Authentication';
import Channels from '@app/features/channel/state/Channels';
import {E2eeDeviceKeyStore} from '@app/features/e2ee/E2eeDeviceKeyStore';
import GuildMembers from '@app/features/member/state/GuildMembers';
import AppStorage from '@app/features/platform/state/PersistentStorage';
import {http} from '@app/features/platform/transport/RestTransport';
import {Logger} from '@app/features/platform/utils/AppLogger';
import {ChannelE2eeClient, type E2eeTransport, isE2eeMessageContent} from '@hearth/channel_e2ee/src/index';
import {MessageFlags} from '@hearth/constants/src/ChannelConstants';
import type {Message as WireMessage} from '@hearth/schema/src/domains/message/MessageResponseSchemas';
import {makeAutoObservable, observable} from 'mobx';

const logger = new Logger('ChannelE2ee');
const ENABLED_CHANNELS_STORAGE_KEY = 'ChannelE2ee:enabledChannels';

export interface E2eeDecryptionState {
	status: 'pending' | 'decrypted' | 'failed';
	content: string;
	text?: string;
}

// Bridges the DOM free ChannelE2eeClient onto the app's REST transport and
// IndexedDB key store.
const transport: E2eeTransport = {
	get: async <T>(path: string): Promise<T> => {
		const response = await http.get<T>(path);
		return response.body as T;
	},
	post: async <T>(path: string, body: unknown): Promise<T> => {
		const response = await http.post<T>(path, {body});
		return response.body as T;
	},
	put: async <T>(path: string, body: unknown): Promise<T> => {
		const response = await http.put<T>(path, {body});
		return response.body as T;
	},
};

class ChannelE2eeStore {
	enabledChannelIds = observable.set<string>();
	observedEncryptedChannelIds = observable.set<string>();
	decryptionStates = observable.map<string, E2eeDecryptionState>();
	private client: ChannelE2eeClient | null = null;
	private enabledChannelsLoaded = false;

	constructor() {
		makeAutoObservable<this, 'client'>(this, {client: false}, {autoBind: true});
	}

	handleReset(): void {
		this.client?.clear();
		this.decryptionStates.clear();
		this.observedEncryptedChannelIds.clear();
		this.enabledChannelIds.clear();
		this.enabledChannelsLoaded = false;
	}

	private getClient(): ChannelE2eeClient {
		if (!this.client) {
			this.client = new ChannelE2eeClient({transport, keyStore: E2eeDeviceKeyStore});
		}
		return this.client;
	}

	private loadEnabledChannels(): void {
		if (this.enabledChannelsLoaded) return;
		this.enabledChannelsLoaded = true;
		const stored = AppStorage.getJSON<unknown>(ENABLED_CHANNELS_STORAGE_KEY);
		if (Array.isArray(stored)) {
			for (const id of stored) {
				if (typeof id === 'string') this.enabledChannelIds.add(id);
			}
		}
	}

	// The composer toggle state: whether this device sends encrypted messages
	// in the channel. Persisted locally because the server does not store a
	// per-channel e2ee flag.
	isEncryptionEnabled(channelId: string): boolean {
		this.loadEnabledChannels();
		return this.enabledChannelIds.has(channelId);
	}

	// Whether the channel should be treated as encrypted: either the local
	// toggle is on, or flagged envelopes have been observed in it.
	isEncryptedChannel(channelId: string): boolean {
		return this.isEncryptionEnabled(channelId) || this.observedEncryptedChannelIds.has(channelId);
	}

	setEncryptionEnabled(channelId: string, enabled: boolean): void {
		this.loadEnabledChannels();
		if (enabled) {
			this.enabledChannelIds.add(channelId);
		} else {
			this.enabledChannelIds.delete(channelId);
		}
		AppStorage.setJSON(ENABLED_CHANNELS_STORAGE_KEY, Array.from(this.enabledChannelIds));
	}

	observeWireMessage(message: WireMessage): void {
		if (((message.flags ?? 0) & MessageFlags.E2EE) !== 0) {
			this.observedEncryptedChannelIds.add(message.channel_id);
		}
	}

	getDecryptionState(messageId: string, content: string): E2eeDecryptionState | undefined {
		const state = this.decryptionStates.get(messageId);
		if (state && state.content === content) return state;
		return undefined;
	}

	// Generates or loads the device identity and publishes the public key.
	// Best effort: failures leave e2ee unavailable but must not break READY.
	async bootstrapDevice(userId: string): Promise<void> {
		try {
			await this.getClient().ensurePublishedIdentity(userId);
		} catch (error) {
			logger.warn('Failed to bootstrap e2ee device identity', error);
		}
	}

	// Resolves the user ids whose device keys should receive key wraps for a
	// channel. Direct channels use recipients; guild channels use the members
	// currently loaded in the member cache.
	resolveMemberUserIds(channelId: string): Array<string> {
		const ids = new Set<string>();
		const currentUserId = Authentication.currentUserId;
		if (currentUserId) ids.add(currentUserId);
		const channel = Channels.getChannel(channelId);
		if (!channel || channel.isPersonalNotes()) {
			return Array.from(ids);
		}
		if (channel.isDM() || channel.isGroupDM()) {
			for (const id of channel.recipientIds) {
				ids.add(id);
			}
			return Array.from(ids);
		}
		if (channel.guildId) {
			for (const member of GuildMembers.getMembers(channel.guildId)) {
				ids.add(member.user.id);
			}
		}
		return Array.from(ids);
	}

	// Encrypts plaintext into a v1 envelope for this channel, distributing a
	// content key wrap to every member device first when needed. Throws when
	// key distribution or encryption fails; callers must not fall back to
	// plaintext.
	async encryptOutgoingMessage(channelId: string, content: string): Promise<string> {
		const userId = Authentication.currentUserId;
		if (!userId) {
			throw new Error('Cannot encrypt a message without a signed in user');
		}
		const memberUserIds = this.resolveMemberUserIds(channelId);
		return this.getClient().encryptForChannel({userId, channelId, memberUserIds, plaintext: content});
	}

	async requestDecryption(params: {channelId: string; messageId: string; content: string}): Promise<void> {
		const existing = this.decryptionStates.get(params.messageId);
		if (existing && existing.content === params.content) return;
		if (!isE2eeMessageContent(params.content)) {
			this.decryptionStates.set(params.messageId, {status: 'failed', content: params.content});
			return;
		}
		const userId = Authentication.currentUserId;
		if (!userId) {
			this.decryptionStates.set(params.messageId, {status: 'failed', content: params.content});
			return;
		}
		this.decryptionStates.set(params.messageId, {status: 'pending', content: params.content});
		try {
			const text = await this.getClient().decryptFromChannel({
				userId,
				channelId: params.channelId,
				content: params.content,
			});
			this.decryptionStates.set(params.messageId, {status: 'decrypted', content: params.content, text});
		} catch (error) {
			logger.debug(`e2ee decryption failed for message ${params.messageId}`, error);
			this.decryptionStates.set(params.messageId, {status: 'failed', content: params.content});
		}
	}
}

const channelE2ee = new ChannelE2eeStore();

ResettableStates.register(channelE2ee, () => channelE2ee.handleReset());

export default channelE2ee;
