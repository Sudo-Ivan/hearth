// SPDX-License-Identifier: AGPL-3.0-or-later

import styles from '@app/features/premium/components/ember_page/EmberPageButton.module.css';
import {EmberPageIcon} from '@app/features/premium/components/ember_page/EmberPageIcons';
import FocusRing from '@app/features/ui/focus_ring/FocusRing';
import {clsx} from 'clsx';
import type React from 'react';

type EmberPageButtonVariant = 'primary' | 'secondary' | 'danger';

interface EmberPageButtonProps {
	variant: EmberPageButtonVariant;
	onClick: () => void;
	disabled?: boolean;
	loading?: boolean;
	directional?: boolean;
	small?: boolean;
	className?: string;
	children: React.ReactNode;
	'aria-label'?: string;
	'data-flx'?: string;
}

const VARIANT_CLASS: Record<EmberPageButtonVariant, string | undefined> = {
	primary: styles.primary,
	secondary: undefined,
	danger: styles.danger,
};

export function EmberPageButton({
	variant,
	onClick,
	disabled,
	loading,
	directional,
	small,
	className,
	children,
	'aria-label': ariaLabel,
	'data-flx': flx,
}: EmberPageButtonProps) {
	return (
		<FocusRing offset={-4} data-flx="premium.ember-page.button.focus-ring">
			<button
				type="button"
				className={clsx(styles.button, VARIANT_CLASS[variant], small && styles.small, className)}
				onClick={() => {
					if (!loading) onClick();
				}}
				disabled={disabled}
				aria-busy={loading || undefined}
				aria-disabled={loading || undefined}
				aria-label={ariaLabel}
				data-flx={flx}
			>
				<span className={styles.label} data-flx="premium.ember-page.button.label">
					{children}
				</span>
				{loading ? (
					<span className={styles.spinner} aria-hidden="true" data-flx="premium.ember-page.button.spinner" />
				) : (
					directional && (
						<EmberPageIcon
							name="arrowRight"
							className={styles.icon}
							data-flx="premium.ember-page.button.icon"
						/>
					)
				)}
			</button>
		</FocusRing>
	);
}
