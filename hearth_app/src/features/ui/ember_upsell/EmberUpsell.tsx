// SPDX-License-Identifier: AGPL-3.0-or-later

import {GET_PREMIUM_DESCRIPTOR} from '@app/features/i18n/utils/CommonMessageDescriptors';
import * as PremiumModalCommands from '@app/features/premium/commands/PremiumModalCommands';
import {getPremiumProductName, shouldShowPremiumFeatures} from '@app/features/premium/utils/PremiumUtils';
import {remFromPx} from '@app/features/theme/layout/RemFromPx';
import {Button} from '@app/features/ui/button/Button';
import styles from '@app/features/ui/ember_upsell/EmberUpsell.module.css';
import {Trans, useLingui} from '@lingui/react/macro';
import {AtomIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import type React from 'react';

interface EmberUpsellProps {
	children: React.ReactNode;
	className?: string;
	buttonText?: React.ReactNode;
	onButtonClick?: () => void;
	dismissible?: boolean;
	onDismiss?: () => void;
}

export const EmberUpsell: React.FC<EmberUpsellProps> = ({
	children,
	className,
	buttonText,
	onButtonClick,
	dismissible,
	onDismiss,
}) => {
	const showPremiumFeatures = shouldShowPremiumFeatures();
	const {i18n} = useLingui();
	if (!showPremiumFeatures) {
		return null;
	}
	return (
		<div className={clsx(styles.upsell, className)} data-flx="ui.ember-upsell.ember-upsell.upsell">
			<AtomIcon
				size={remFromPx(16)}
				weight="fill"
				className={styles.icon}
				data-flx="ui.ember-upsell.ember-upsell.icon"
			/>
			<div className={styles.content} data-flx="ui.ember-upsell.ember-upsell.content">
				<div className={styles.text} data-flx="ui.ember-upsell.ember-upsell.text">
					{children}
				</div>
				<div className={styles.actions} data-flx="ui.ember-upsell.ember-upsell.actions">
					<Button
						variant="inverted"
						superCompact={true}
						fitContent={true}
						onClick={onButtonClick ?? (() => PremiumModalCommands.open())}
						aria-label={i18n._(GET_PREMIUM_DESCRIPTOR, {premiumProductName: getPremiumProductName()})}
						data-flx="ui.ember-upsell.ember-upsell.button"
					>
						{buttonText ?? i18n._(GET_PREMIUM_DESCRIPTOR, {premiumProductName: getPremiumProductName()})}
					</Button>
					{dismissible && onDismiss && (
						<button
							type="button"
							className={styles.dismissLink}
							onClick={onDismiss}
							data-flx="ui.ember-upsell.ember-upsell.dismiss-link.button"
						>
							<Trans>Don't show this again</Trans>
						</button>
					)}
				</div>
			</div>
		</div>
	);
};
