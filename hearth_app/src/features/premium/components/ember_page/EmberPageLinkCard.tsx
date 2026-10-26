// SPDX-License-Identifier: AGPL-3.0-or-later

import * as EmberPageCommands from '@app/features/premium/commands/EmberPageCommands';
import styles from '@app/features/premium/components/ember_page/EmberPageLinkCard.module.css';
import {getPremiumProductFullName} from '@app/features/premium/utils/PremiumUtils';
import {Button} from '@app/features/ui/button/Button';
import {msg} from '@lingui/core/macro';
import {useLingui} from '@lingui/react/macro';
import {AtomIcon} from '@phosphor-icons/react';

const LINK_CARD_BODY_DESCRIPTOR = msg({
	message: 'Plans, perks, gifts and your subscription are all on one page.',
	comment: 'Text on the card in settings that links to the Ember page.',
});
const LINK_CARD_BUTTON_DESCRIPTOR = msg({
	message: 'Open {premiumProductFullName}',
	comment:
		'Button on the settings card that opens the Ember page. premiumProductFullName is the full paid tier name.',
});

export function EmberPageLinkCard() {
	const {i18n} = useLingui();
	return (
		<div className={styles.card} data-flx="premium.ember-page-link-card.card">
			<AtomIcon
				weight="fill"
				className={styles.icon}
				aria-hidden="true"
				data-flx="premium.ember-page.ember-page-link-card.icon"
			/>
			<div className={styles.text} data-flx="premium.ember-page.ember-page-link-card.text">
				<p className={styles.title} data-flx="premium.ember-page.ember-page-link-card.title">
					{getPremiumProductFullName()}
				</p>
				<p className={styles.body} data-flx="premium.ember-page.ember-page-link-card.body">
					{i18n._(LINK_CARD_BODY_DESCRIPTOR)}
				</p>
			</div>
			<Button
				variant="primary"
				small
				fitContent
				onClick={EmberPageCommands.openEmberPage}
				data-flx="premium.ember-page-link-card.open"
			>
				{i18n._(LINK_CARD_BUTTON_DESCRIPTOR, {premiumProductFullName: getPremiumProductFullName()})}
			</Button>
		</div>
	);
}
