import React from 'react';
import ReactDOM from 'react-dom/client';
import { installWebChromeShim } from '@/src/focuz/lib/platform';
import App from '@/App.tsx';
import '@/src/app.css';

// Install before any dashboard code that expects chrome.* (dynamic OptionsApp still
// loads after this; this covers any other early chrome touches).
installWebChromeShim();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
