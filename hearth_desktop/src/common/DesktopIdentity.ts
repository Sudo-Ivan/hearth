// SPDX-License-Identifier: AGPL-3.0-or-later

import {BUILD_CHANNEL, type BuildChannel} from '@electron/common/BuildChannel';

const DESKTOP_APP_NAMES: Record<BuildChannel, string> = {
	stable: 'Hearth',
	canary: 'Hearth Canary',
	development: 'Hearth Development',
};
const MACOS_BUNDLE_IDS: Record<BuildChannel, string> = {
	stable: 'app.hearth',
	canary: 'app.hearth.canary',
	development: 'app.hearth.development',
};
const LINUX_DESKTOP_ENTRY_IDS: Record<BuildChannel, string> = {
	stable: 'app.hearth.HearthDesktop',
	canary: 'app.hearth.HearthDesktopCanary',
	development: 'app.hearth.HearthDesktopDevelopment',
};
const LEGACY_LINUX_DESKTOP_ENTRY_IDS: Record<BuildChannel, string> = {
	stable: 'hearth',
	canary: 'hearth-canary',
	development: 'hearth-development',
};
const LINUX_PORTAL_SESSION_TOKENS: Record<BuildChannel, string> = {
	stable: 'hearth_global_shortcuts',
	canary: 'hearth_canary_global_shortcuts',
	development: 'hearth_development_global_shortcuts',
};
const WINDOWS_VELOPACK_IDS: Record<BuildChannel, string> = {
	stable: 'hearth_desktop',
	canary: 'hearth_desktop_canary',
	development: 'hearth_desktop_development',
};
const WINDOWS_APP_USER_MODEL_IDS: Record<BuildChannel, string> = {
	stable: 'Hearth.Hearth',
	canary: 'Hearth.Hearth.Canary',
	development: 'Hearth.Hearth.Development',
};
const WINDOWS_TOAST_ACTIVATOR_CLSIDS: Record<BuildChannel, string> = {
	stable: '{48EEF21B-F3AE-431E-8CF2-386FFB2143F2}',
	canary: '{9CEDB5C0-3552-43B0-A279-2232E0CDF74C}',
	development: '{B277AB5D-371C-4098-A76D-1DAE00AC0863}',
};

export const DESKTOP_APP_NAME = DESKTOP_APP_NAMES[BUILD_CHANNEL];
export const MACOS_BUNDLE_ID = MACOS_BUNDLE_IDS[BUILD_CHANNEL];
export const LINUX_DESKTOP_ENTRY_ID = LINUX_DESKTOP_ENTRY_IDS[BUILD_CHANNEL];
export const LINUX_PORTAL_SESSION_TOKEN = LINUX_PORTAL_SESSION_TOKENS[BUILD_CHANNEL];
export const LEGACY_LINUX_DESKTOP_ENTRY_ID = LEGACY_LINUX_DESKTOP_ENTRY_IDS[BUILD_CHANNEL];
export const LINUX_ICON_NAME = LEGACY_LINUX_DESKTOP_ENTRY_IDS[BUILD_CHANNEL];
export const WINDOWS_SHORTCUT_AUTHOR = 'Hearth Platform AB';
export const WINDOWS_VELOPACK_ID = WINDOWS_VELOPACK_IDS[BUILD_CHANNEL];
export const WINDOWS_LEGACY_SQUIRREL_ID = 'hearth_app';
export const WINDOWS_APP_USER_MODEL_ID = WINDOWS_APP_USER_MODEL_IDS[BUILD_CHANNEL];
export const WINDOWS_LEGACY_APP_USER_MODEL_IDS = [`velopack.${WINDOWS_VELOPACK_ID}`];
export const WINDOWS_TOAST_ACTIVATOR_CLSID = WINDOWS_TOAST_ACTIVATOR_CLSIDS[BUILD_CHANNEL];
