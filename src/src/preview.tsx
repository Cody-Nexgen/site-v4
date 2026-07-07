import React from 'react';
import ReactDOM from 'react-dom/client';
import OptionsApp from './options/OptionsApp';
import './index.css';
import './mockChrome'; // Import mock before App

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <OptionsApp />
    </React.StrictMode>
);
