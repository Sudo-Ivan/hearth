// SPDX-License-Identifier: AGPL-3.0-or-later

import {E2eeCryptoUnavailableError} from '@hearth/channel_e2ee/src/Errors';

export function getSubtle(): SubtleCrypto {
	const crypto = globalThis.crypto;
	if (crypto == null || crypto.subtle == null) {
		throw new E2eeCryptoUnavailableError();
	}
	return crypto.subtle;
}

export function getRandomBytes(length: number): Uint8Array {
	const crypto = globalThis.crypto;
	if (crypto == null || crypto.getRandomValues == null) {
		throw new E2eeCryptoUnavailableError();
	}
	const bytes = new Uint8Array(length);
	crypto.getRandomValues(bytes);
	return bytes;
}
