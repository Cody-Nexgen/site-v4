import React from 'react';
import ReactDOM from 'react-dom/client';
import { Toast } from '@heroui/react';
import OptionsApp from './OptionsApp';
import '../index.css'; // Import global styles (stored in src/index.css)
import { installDevConsole } from '../lib/devConsole';
import { initializeDashboardColorMode } from '../lib/themes';

installDevConsole();
void initializeDashboardColorMode();

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <Toast.Provider />
        <OptionsApp />
    </React.StrictMode>
);
