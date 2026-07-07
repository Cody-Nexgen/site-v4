import React from 'react';
import ReactDOM from 'react-dom/client';
import OptionsApp from './OptionsApp';
import '../index.css'; // Import global styles (stored in src/index.css)
import { installDevConsole } from '../lib/devConsole';

installDevConsole();

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <OptionsApp />
    </React.StrictMode>
);
