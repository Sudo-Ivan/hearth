// SPDX-License-Identifier: AGPL-3.0-or-later

import {InviteTypes} from '@hearth/constants/src/ChannelConstants';
import type {GroupDmInvite, GuildInvite, Invite} from '@hearth/schema/src/domains/invite/InviteSchemas';
export const isGuildInvite = (invite: Invite): invite is GuildInvite => invite.type === InviteTypes.GUILD;
export const isGroupDmInvite = (invite: Invite): invite is GroupDmInvite => invite.type === InviteTypes.GROUP_DM;
