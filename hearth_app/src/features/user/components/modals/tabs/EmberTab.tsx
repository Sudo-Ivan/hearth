// SPDX-License-Identifier: AGPL-3.0-or-later

import * as EmberPageCommands from '@app/features/premium/commands/EmberPageCommands';
import {EmberPageLinkCard} from '@app/features/premium/components/ember_page/EmberPageLinkCard';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useEffect} from 'react';

const EmberPageRedirect: React.FC = () => {
	useEffect(() => {
		EmberPageCommands.openEmberPage();
	}, []);
	return <EmberPageLinkCard data-flx="user.ember-tab.ember-page-link-card" />;
};

const EmberTab: React.FC = observer(() => {
	return <EmberPageRedirect data-flx="user.ember-tab.ember-page-redirect" />;
});

export const EmberInlineTab: React.FC = observer(() => {
	return <EmberPageLinkCard data-flx="user.ember-tab.inline.ember-page-link-card" />;
});

export default EmberTab;
