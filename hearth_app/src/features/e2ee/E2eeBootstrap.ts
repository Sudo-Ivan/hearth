// SPDX-License-Identifier: AGPL-3.0-or-later

import ChannelE2ee from '@app/features/e2ee/state/ChannelE2ee';

// Called once per session after gateway READY. Loads or generates the device
// identity for the signed-in user and publishes its public key so other
// channel members can wrap content keys for this device.
export function startE2eeSession(userId: string): void {
	void ChannelE2ee.bootstrapDevice(userId);
}
