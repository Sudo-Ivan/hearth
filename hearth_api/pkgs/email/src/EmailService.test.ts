// SPDX-License-Identifier: AGPL-3.0-or-later

import type {EmailConfig, EmailMessage, IEmailProvider} from '@pkgs/email/src/EmailProviderTypes';
import {EmailService} from '@pkgs/email/src/EmailService';
import {describe, expect, it} from 'vitest';

const CONFIG: EmailConfig = {
	enabled: true,
	fromEmail: 'noreply@example.com',
	fromName: 'Hearth',
	appBaseUrl: 'https://example.com',
	apiBaseUrl: 'https://api.example.com',
	appealsEmail: 'appeals@hearth.com',
	privacyEmail: 'privacy@hearth.com',
	safetyEmail: 'safety@hearth.com',
	supportEmail: 'support@hearth.com',
	productName: 'Hearth',
	marketingBaseUrl: 'https://example.com',
	staticCdnBaseUrl: 'https://static.example.com',
	legalAddress: 'Hearth Platform AB, c/o Embassy House, Östgötagatan 12, 116 25 Stockholm, Sweden',
	brandLogo: true,
};

function createCapturingServiceFor(config: EmailConfig): {service: EmailService; sent: Array<EmailMessage>} {
	const sent: Array<EmailMessage> = [];
	const provider: IEmailProvider = {
		sendEmail: async (message) => {
			sent.push(message);
			return true;
		},
	};
	return {service: new EmailService(config, provider), sent};
}

describe('EmailService', () => {
	it('keeps the HTML part on a plain-http instance whose links stay on its own origins', async () => {
		const {service, sent} = createCapturingServiceFor({
			...CONFIG,
			appBaseUrl: 'http://chat.example.org',
			apiBaseUrl: 'http://chat.example.org/api',
			marketingBaseUrl: 'http://chat.example.org',
			staticCdnBaseUrl: 'http://static.chat.example.org:8080',
		});
		await service.send('password_reset', 'user@example.com', {resetToken: 'tok.abc'}, 'en-US');
		const html = sent[0].html ?? '';
		expect(html).toContain('href="http://chat.example.org/reset#token=tok.abc"');
		expect(html).toContain('src="http://static.chat.example.org:8080/email/brand/v1/logo-color.png"');
		expect(html).not.toContain('%%');
	});
});
