// SPDX-License-Identifier: AGPL-3.0-or-later

import {Permissions, PermissionsDescriptions} from '@hearth/constants/src/ChannelConstants';
import {createPermissionStringType, withOpenApiType} from '@hearth/schema/src/primitives/SchemaPrimitives';

export const PermissionStringType = withOpenApiType(
	createPermissionStringType(Permissions, PermissionsDescriptions, 'Permission bitfield as string', 'Permissions'),
	'Permissions',
);
