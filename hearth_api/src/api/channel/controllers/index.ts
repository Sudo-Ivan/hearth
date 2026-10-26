// SPDX-License-Identifier: AGPL-3.0-or-later

import {CallController} from '@app/api/channel/controllers/CallController';
import {ChannelController} from '@app/api/channel/controllers/ChannelController';
import {ChannelE2eeController} from '@app/api/channel/controllers/ChannelE2eeController';
import {ChannelFollowController} from '@app/api/channel/controllers/ChannelFollowController';
import {ForumController} from '@app/api/channel/controllers/ForumController';
import {MessageController} from '@app/api/channel/controllers/MessageController';
import {MessageInteractionController} from '@app/api/channel/controllers/MessageInteractionController';
import {StreamController} from '@app/api/channel/controllers/StreamController';
import {ThreadController} from '@app/api/channel/controllers/ThreadController';
import {ThreadMemberSettingsController} from '@app/api/channel/controllers/ThreadMemberSettingsController';
import type {HonoApp} from '@app/api/types/HonoEnv';

export function registerChannelControllers(app: HonoApp) {
	ChannelController(app);
	ChannelFollowController(app);
	MessageInteractionController(app);
	MessageController(app);
	CallController(app);
	StreamController(app);
	ThreadController(app);
	ChannelE2eeController(app);
	ForumController(app);
	ThreadMemberSettingsController(app);
}
