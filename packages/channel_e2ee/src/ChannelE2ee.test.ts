// SPDX-License-Identifier: AGPL-3.0-or-later

import {
	decryptMessageContent,
	deriveContentKeyId,
	E2eeDecryptError,
	E2eeKeyUnwrapError,
	encryptMessageContent,
	exportIdentityPublicKey,
	generateContentKey,
	generateIdentityKeyPair,
	importIdentityPublicKey,
	isE2eeMessageContent,
	parseMessageEnvelope,
	unwrapContentKey,
	wrapContentKeyForRecipient,
} from '@hearth/channel_e2ee/src/index';
import {base64ToUint8Array, uint8ArrayToBase64} from 'uint8array-extras';
import {describe, expect, it} from 'vitest';

describe('channel e2ee message encryption', () => {
	it('encrypts and decrypts a message roundtrip', async () => {
		const contentKey = await generateContentKey();
		const content = await encryptMessageContent({contentKey, epoch: 3, plaintext: 'hello hearth'});
		expect(isE2eeMessageContent(content)).toBe(true);
		const envelope = parseMessageEnvelope(content);
		expect(envelope).not.toBeNull();
		expect(envelope!.v).toBe(1);
		expect(envelope!.epoch).toBe(3);
		expect(envelope!.key_id).toBe(await deriveContentKeyId(contentKey));
		const plaintext = await decryptMessageContent({contentKey, content});
		expect(plaintext).toBe('hello hearth');
	});

	it('rejects decryption with the wrong content key', async () => {
		const contentKey = await generateContentKey();
		const otherKey = await generateContentKey();
		const content = await encryptMessageContent({contentKey, epoch: 0, plaintext: 'secret'});
		await expect(decryptMessageContent({contentKey: otherKey, content})).rejects.toThrow(E2eeDecryptError);
	});

	it('rejects decryption when the key id does not match the provided content key', async () => {
		const contentKey = await generateContentKey();
		const otherKey = await generateContentKey();
		const content = await encryptMessageContent({contentKey, epoch: 0, plaintext: 'secret'});
		const envelope = parseMessageEnvelope(content)!;
		expect(envelope.key_id).not.toBe(await deriveContentKeyId(otherKey));
	});

	it('detects ciphertext tampering', async () => {
		const contentKey = await generateContentKey();
		const content = await encryptMessageContent({contentKey, epoch: 1, plaintext: 'integrity check'});
		const envelope = parseMessageEnvelope(content)!;
		const ciphertextBytes = base64ToUint8Array(envelope.ct);
		ciphertextBytes[0] = ciphertextBytes[0]! ^ 0xff;
		const tampered = JSON.stringify({
			...envelope,
			ct: uint8ArrayToBase64(ciphertextBytes, {urlSafe: true}),
		});
		await expect(decryptMessageContent({contentKey, content: tampered})).rejects.toThrow(E2eeDecryptError);
	});

	it('detects iv tampering', async () => {
		const contentKey = await generateContentKey();
		const content = await encryptMessageContent({contentKey, epoch: 1, plaintext: 'integrity check'});
		const envelope = parseMessageEnvelope(content)!;
		const tampered = JSON.stringify({...envelope, iv: 'AAAAAAAAAAAAAAAA'});
		await expect(decryptMessageContent({contentKey, content: tampered})).rejects.toThrow(E2eeDecryptError);
	});

	it('binds ciphertext to additional authenticated data', async () => {
		const contentKey = await generateContentKey();
		const content = await encryptMessageContent({
			contentKey,
			epoch: 0,
			plaintext: 'bound',
			aad: 'channel:123',
		});
		await expect(decryptMessageContent({contentKey, content, aad: 'channel:456'})).rejects.toThrow(E2eeDecryptError);
		await expect(decryptMessageContent({contentKey, content})).rejects.toThrow(E2eeDecryptError);
		expect(await decryptMessageContent({contentKey, content, aad: 'channel:123'})).toBe('bound');
	});

	it('does not parse plaintext content as an envelope', () => {
		expect(isE2eeMessageContent('just a normal message')).toBe(false);
		expect(isE2eeMessageContent('{"v":2,"key_id":"x"}')).toBe(false);
		expect(isE2eeMessageContent(null)).toBe(false);
		expect(parseMessageEnvelope('not json')).toBeNull();
	});
});

describe('channel e2ee key wrap', () => {
	it('wraps and unwraps a content key for a member device', async () => {
		const contentKey = await generateContentKey();
		const member = await generateIdentityKeyPair();
		const memberPublic = await importIdentityPublicKey(await exportIdentityPublicKey(member.publicKey));
		const wrappedKey = await wrapContentKeyForRecipient({contentKey, recipientPublicKey: memberPublic});
		const unwrapped = await unwrapContentKey({wrappedKey, recipientPrivateKey: member.privateKey});
		const content = await encryptMessageContent({contentKey, epoch: 0, plaintext: 'wrapped roundtrip'});
		expect(await decryptMessageContent({contentKey: unwrapped, content})).toBe('wrapped roundtrip');
	});

	it('fails to unwrap for a non-member identity key', async () => {
		const contentKey = await generateContentKey();
		const member = await generateIdentityKeyPair();
		const outsider = await generateIdentityKeyPair();
		const memberPublic = await importIdentityPublicKey(await exportIdentityPublicKey(member.publicKey));
		const wrappedKey = await wrapContentKeyForRecipient({contentKey, recipientPublicKey: memberPublic});
		await expect(unwrapContentKey({wrappedKey, recipientPrivateKey: outsider.privateKey})).rejects.toThrow(
			E2eeKeyUnwrapError,
		);
	});

	it('produces a different ciphertext for every wrap of the same content key', async () => {
		const contentKey = await generateContentKey();
		const member = await generateIdentityKeyPair();
		const memberPublic = await importIdentityPublicKey(await exportIdentityPublicKey(member.publicKey));
		const first = await wrapContentKeyForRecipient({contentKey, recipientPublicKey: memberPublic});
		const second = await wrapContentKeyForRecipient({contentKey, recipientPublicKey: memberPublic});
		expect(first).not.toBe(second);
	});
});

describe('key rotation and membership edges', () => {
	it('a rotated epoch uses a new content key so removed members cannot read new messages', async () => {
		const member = await generateIdentityKeyPair();
		const memberPublic = await importIdentityPublicKey(await exportIdentityPublicKey(member.publicKey));
		const removedMember = await generateIdentityKeyPair();
		const removedMemberPublic = await importIdentityPublicKey(await exportIdentityPublicKey(removedMember.publicKey));
		const epochOneKey = await generateContentKey();
		const wrapMemberOne = await wrapContentKeyForRecipient({
			contentKey: epochOneKey,
			recipientPublicKey: memberPublic,
		});
		const wrapRemovedOne = await wrapContentKeyForRecipient({
			contentKey: epochOneKey,
			recipientPublicKey: removedMemberPublic,
		});
		const epochTwoKey = await generateContentKey();
		const wrapMemberTwo = await wrapContentKeyForRecipient({
			contentKey: epochTwoKey,
			recipientPublicKey: memberPublic,
		});
		const epochOneMessage = await encryptMessageContent({
			contentKey: epochOneKey,
			epoch: 1,
			plaintext: 'before removal',
		});
		const epochTwoMessage = await encryptMessageContent({
			contentKey: epochTwoKey,
			epoch: 2,
			plaintext: 'after removal',
		});
		expect(parseMessageEnvelope(epochTwoMessage)!.epoch).toBeGreaterThan(parseMessageEnvelope(epochOneMessage)!.epoch);
		const memberKeyOne = await unwrapContentKey({wrappedKey: wrapMemberOne, recipientPrivateKey: member.privateKey});
		const memberKeyTwo = await unwrapContentKey({wrappedKey: wrapMemberTwo, recipientPrivateKey: member.privateKey});
		expect(await decryptMessageContent({contentKey: memberKeyOne, content: epochOneMessage})).toBe('before removal');
		expect(await decryptMessageContent({contentKey: memberKeyTwo, content: epochTwoMessage})).toBe('after removal');
		const removedKey = await unwrapContentKey({
			wrappedKey: wrapRemovedOne,
			recipientPrivateKey: removedMember.privateKey,
		});
		expect(await decryptMessageContent({contentKey: removedKey, content: epochOneMessage})).toBe('before removal');
		await expect(decryptMessageContent({contentKey: removedKey, content: epochTwoMessage})).rejects.toThrow(
			E2eeDecryptError,
		);
	});

	it('a rejoined member can unwrap a new wrap for the current epoch', async () => {
		const rejoined = await generateIdentityKeyPair();
		const rejoinedPublic = await importIdentityPublicKey(await exportIdentityPublicKey(rejoined.publicKey));
		const epochOneKey = await generateContentKey();
		const epochTwoKey = await generateContentKey();
		const epochOneWrap = await wrapContentKeyForRecipient({
			contentKey: epochOneKey,
			recipientPublicKey: rejoinedPublic,
		});
		const epochTwoWrap = await wrapContentKeyForRecipient({
			contentKey: epochTwoKey,
			recipientPublicKey: rejoinedPublic,
		});
		const epochTwoMessage = await encryptMessageContent({
			contentKey: epochTwoKey,
			epoch: 2,
			plaintext: 'welcome back',
		});
		const rejoinedKeyTwo = await unwrapContentKey({
			wrappedKey: epochTwoWrap,
			recipientPrivateKey: rejoined.privateKey,
		});
		expect(await decryptMessageContent({contentKey: rejoinedKeyTwo, content: epochTwoMessage})).toBe('welcome back');
		const rejoinedKeyOne = await unwrapContentKey({
			wrappedKey: epochOneWrap,
			recipientPrivateKey: rejoined.privateKey,
		});
		const epochOneMessage = await encryptMessageContent({
			contentKey: epochOneKey,
			epoch: 1,
			plaintext: 'history still readable',
		});
		expect(await decryptMessageContent({contentKey: rejoinedKeyOne, content: epochOneMessage})).toBe(
			'history still readable',
		);
	});

	it('offline senders produce decryptable envelopes once the receiver unwraps later', async () => {
		const member = await generateIdentityKeyPair();
		const memberPublic = await importIdentityPublicKey(await exportIdentityPublicKey(member.publicKey));
		const contentKey = await generateContentKey();
		const message = await encryptMessageContent({contentKey, epoch: 7, plaintext: 'queued while offline'});
		const wrappedKey = await wrapContentKeyForRecipient({contentKey, recipientPublicKey: memberPublic});
		const unwrapped = await unwrapContentKey({wrappedKey, recipientPrivateKey: member.privateKey});
		expect(await decryptMessageContent({contentKey: unwrapped, content: message})).toBe('queued while offline');
	});
});
