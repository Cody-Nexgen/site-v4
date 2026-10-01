import React from 'react';
import ReactDOM from 'react-dom/client';
import OptionsApp from './OptionsApp';
import '../index.css'; // Import global styles (stored in src/index.css)
import { installDevConsole } from '../lib/devConsole';
import { initializeDashboardColorMode } from '../lib/themes';

installDevConsole();
void initializeDashboardColorMode();

// The blocked-site view has to be reachable from any page (sites and frames get redirected to it),
// so the dashboard is web-accessible. Anywhere other sites could frame it to trick clicks, show
// nothing but that view.
const framedByAnotherSite = window.top !== window && new URLSearchParams(window.location.search).get('view') !== 'blocked';

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        {framedByAnotherSite ? null : <OptionsApp />}
    </React.StrictMode>
);
