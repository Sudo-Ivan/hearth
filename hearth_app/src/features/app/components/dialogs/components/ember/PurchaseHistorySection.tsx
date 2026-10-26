// SPDX-License-Identifier: AGPL-3.0-or-later

import {InvoiceList} from '@app/features/app/components/dialogs/components/ember/InvoiceList';
import styles from '@app/features/app/components/dialogs/components/ember/PurchaseHistorySection.module.css';
import {EmberPageButton} from '@app/features/premium/components/ember_page/EmberPageButton';
import {Accordion} from '@app/features/ui/accordion/Accordion';
import type {PremiumStateResponse} from '@hearth/schema/src/domains/premium/PremiumSchemas';
import {Trans} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useState} from 'react';

interface PurchaseHistorySectionProps {
	premiumState: PremiumStateResponse | null;
	loadingPortal: boolean;
	handleOpenCustomerPortal: () => void;
}

export const PurchaseHistorySection: React.FC<PurchaseHistorySectionProps> = observer(
	({premiumState, loadingPortal, handleOpenCustomerPortal}) => {
		const invoices = premiumState?.billing.invoices ?? [];
		const [invoicesExpanded, setInvoicesExpanded] = useState(false);
		return (
			<section className={styles.section} data-flx="app.ember.purchase-history-section.section">
				<div className={styles.card} data-flx="app.ember.purchase-history-section.card">
					<div className={styles.grid} data-flx="app.ember.purchase-history-section.grid">
						<div className={styles.content} data-flx="app.ember.purchase-history-section.content">
							<h3 className={styles.title} data-flx="app.ember.purchase-history-section.title">
								<Trans>Purchase history</Trans>
							</h3>
						</div>
						<EmberPageButton
							variant="secondary"
							onClick={handleOpenCustomerPortal}
							loading={loadingPortal}
							small
							className={styles.button}
							data-flx="app.ember.purchase-history-section.button.open-customer-portal"
						>
							<Trans comment="Billing button that opens Stripe customer portal for payment-method management only.">
								Manage payment methods
							</Trans>
						</EmberPageButton>
					</div>
					<div className={styles.accordionStack} data-flx="app.ember.purchase-history-section.accordion-stack">
						<Accordion
							id="ember-invoices"
							className={styles.accordion}
							compact
							title={<Trans comment="Accordion title in the premium billing panel.">Billing history</Trans>}
							expanded={invoicesExpanded}
							onExpandedChange={setInvoicesExpanded}
							data-flx="app.ember.purchase-history-section.ember-invoices"
						>
							<InvoiceList invoices={invoices} data-flx="app.ember.purchase-history-section.invoice-list" />
						</Accordion>
					</div>
				</div>
			</section>
		);
	},
);
