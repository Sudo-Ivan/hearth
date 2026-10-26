// SPDX-License-Identifier: AGPL-3.0-or-later

import {getProtectedIndexedDB} from '@app/features/platform/state/ProtectedWebStorage';
import type {
	E2eeDeviceIdentity,
	E2eeDeviceKeyStore as E2eeDeviceKeyStoreContract,
} from '@hearth/channel_e2ee/src/index';

const DB_NAME = 'HearthE2ee';
const DB_VERSION = 1;
const STORE_NAME = 'deviceIdentities';
const browserIndexedDB = getProtectedIndexedDB();

let dbInstance: IDBDatabase | null = null;

const openDB = (): Promise<IDBDatabase> => {
	return new Promise((resolve, reject) => {
		if (dbInstance) {
			resolve(dbInstance);
			return;
		}
		if (!browserIndexedDB) {
			reject(new Error('IndexedDB unavailable'));
			return;
		}
		const request = browserIndexedDB.open(DB_NAME, DB_VERSION);
		request.onerror = () => {
			reject(new Error('Failed to open IndexedDB'));
		};
		request.onsuccess = () => {
			dbInstance = request.result;
			resolve(dbInstance);
		};
		request.onupgradeneeded = (event) => {
			const db = (event.target as IDBOpenDBRequest).result;
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME);
			}
		};
	});
};

// Persists the per-account device identity. The stored record carries
// CryptoKey objects via structured clone, so the non-extractable private key
// never leaves the crypto module in raw form.
export const E2eeDeviceKeyStore: E2eeDeviceKeyStoreContract = {
	async loadDeviceIdentity(userId: string): Promise<E2eeDeviceIdentity | null> {
		const db = await openDB();
		return new Promise((resolve, reject) => {
			const transaction = db.transaction([STORE_NAME], 'readonly');
			const store = transaction.objectStore(STORE_NAME);
			const request = store.get(userId);
			request.onsuccess = () => {
				resolve((request.result as E2eeDeviceIdentity | undefined) ?? null);
			};
			request.onerror = () => {
				reject(new Error('Failed to load e2ee device identity'));
			};
		});
	},

	async saveDeviceIdentity(identity: E2eeDeviceIdentity): Promise<void> {
		const db = await openDB();
		return new Promise((resolve, reject) => {
			const transaction = db.transaction([STORE_NAME], 'readwrite');
			const store = transaction.objectStore(STORE_NAME);
			const request = store.put(identity, identity.userId);
			request.onsuccess = () => {
				resolve();
			};
			request.onerror = () => {
				reject(new Error('Failed to save e2ee device identity'));
			};
		});
	},
};
