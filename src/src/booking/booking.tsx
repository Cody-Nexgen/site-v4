import React from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import BookingApp from './BookingApp';

createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <BookingApp />
    </React.StrictMode>,
);
