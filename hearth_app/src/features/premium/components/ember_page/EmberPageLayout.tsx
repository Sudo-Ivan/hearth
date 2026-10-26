// SPDX-License-Identifier: AGPL-3.0-or-later

import {Routes} from '@app/app/Routes';
import * as RouterUtils from '@app/features/navigation/utils/RouterUtils';
import {EmberPage} from '@app/features/premium/components/ember_page/EmberPage';
import styles from '@app/features/premium/components/ember_page/EmberPageLayout.module.css';
import {shouldShowPremiumFeatures} from '@app/features/premium/utils/PremiumUtils';
import {observer} from 'mobx-react-lite';
import {useEffect} from 'react';

export const EmberPageLayout = observer(function EmberPageLayout() {
	const enabled = shouldShowPremiumFeatures();
	useEffect(() => {
		if (!enabled) RouterUtils.replaceWith(Routes.ME);
	}, [enabled]);
	return (
		<div className={styles.layout} data-flx="premium.ember-page-layout.layout">
			{enabled && <EmberPage data-flx="premium.ember-page-layout.page" />}
		</div>
	);
});
