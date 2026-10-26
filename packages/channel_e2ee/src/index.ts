// SPDX-License-Identifier: AGPL-3.0-or-later

export {
	ChannelE2eeClient,
	type E2eeChannelKeyBundle,
	type E2eeDeviceIdentity,
	type E2eeDeviceKeyStore,
	type E2eeMemberDeviceKey,
	type E2eeTransport,
	type E2eeWrappedKeyEntry,
} from '@hearth/channel_e2ee/src/Client';
export {
	E2EE_MESSAGE_VERSION,
	E2EE_WRAP_ALGORITHM,
	E2EE_WRAP_VERSION,
	type E2eeMessageEnvelope,
	type E2eeWrappedKeyEnvelope,
	isE2eeMessageContent,
	parseMessageEnvelope,
	parseWrappedKey,
	serializeMessageEnvelope,
	serializeWrappedKey,
} from '@hearth/channel_e2ee/src/Envelope';
export {
	E2eeCryptoUnavailableError,
	E2eeDecryptError,
	E2eeEnvelopeError,
	E2eeError,
	E2eeKeyUnwrapError,
} from '@hearth/channel_e2ee/src/Errors';
export {
	deriveContentKeyId,
	type E2eeIdentityKeyPair,
	exportContentKey,
	exportIdentityPublicKey,
	generateContentKey,
	generateIdentityKeyPair,
	importContentKey,
	importIdentityPublicKey,
	unwrapContentKey,
	wrapContentKeyForRecipient,
} from '@hearth/channel_e2ee/src/Keys';
export {decryptMessageContent, encryptMessageContent} from '@hearth/channel_e2ee/src/Messages';
