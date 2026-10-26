// SPDX-License-Identifier: AGPL-3.0-or-later

import {E2eeEnvelopeError} from '@hearth/channel_e2ee/src/Errors';

export const E2EE_MESSAGE_VERSION = 1 as const;
export const E2EE_WRAP_VERSION = 1 as const;
export const E2EE_WRAP_ALGORITHM = 'X25519-HKDF-SHA256-A256GCM' as const;

// Message content for an end to end encrypted message is a JSON serialization
// of this shape. The API stores and dispatches it verbatim as opaque text when
// the message flags carry the E2EE bit.
export interface E2eeMessageEnvelope {
	v: number;
	key_id: string;
	epoch: number;
	iv: string;
	ct: string;
}

// A channel content key wrapped for one recipient device. Stored server side
// as JSON text in channel_e2ee_wrapped_keys.wrapped_key.
export interface E2eeWrappedKeyEnvelope {
	v: number;
	alg: string;
	epub: string;
	iv: string;
	ct: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireStringField(record: Record<string, unknown>, field: string): string {
	const value = record[field];
	if (typeof value !== 'string' || value.length === 0) {
		throw new E2eeEnvelopeError(`e2ee envelope field ${field} must be a non-empty string`);
	}
	return value;
}

export function serializeMessageEnvelope(envelope: E2eeMessageEnvelope): string {
	return JSON.stringify(envelope);
}

export function parseMessageEnvelope(content: string | null | undefined): E2eeMessageEnvelope | null {
	if (content == null || content.length === 0 || content.charCodeAt(0) !== 0x7b) {
		return null;
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(content);
	} catch {
		return null;
	}
	if (!isRecord(parsed) || parsed.v !== E2EE_MESSAGE_VERSION) {
		return null;
	}
	try {
		const epoch = parsed.epoch;
		if (typeof epoch !== 'number' || !Number.isInteger(epoch) || epoch < 0) {
			return null;
		}
		return {
			v: E2EE_MESSAGE_VERSION,
			key_id: requireStringField(parsed, 'key_id'),
			epoch,
			iv: requireStringField(parsed, 'iv'),
			ct: requireStringField(parsed, 'ct'),
		};
	} catch {
		return null;
	}
}

export function isE2eeMessageContent(content: string | null | undefined): boolean {
	return parseMessageEnvelope(content) !== null;
}

export function serializeWrappedKey(envelope: E2eeWrappedKeyEnvelope): string {
	return JSON.stringify(envelope);
}

export function parseWrappedKey(wrappedKey: string): E2eeWrappedKeyEnvelope {
	let parsed: unknown;
	try {
		parsed = JSON.parse(wrappedKey);
	} catch {
		throw new E2eeEnvelopeError('e2ee wrapped key is not valid JSON');
	}
	if (!isRecord(parsed) || parsed.v !== E2EE_WRAP_VERSION || parsed.alg !== E2EE_WRAP_ALGORITHM) {
		throw new E2eeEnvelopeError('e2ee wrapped key has an unsupported version or algorithm');
	}
	return {
		v: E2EE_WRAP_VERSION,
		alg: E2EE_WRAP_ALGORITHM,
		epub: requireStringField(parsed, 'epub'),
		iv: requireStringField(parsed, 'iv'),
		ct: requireStringField(parsed, 'ct'),
	};
}
