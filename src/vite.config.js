import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import manifest from './manifest.json';
import path from 'path';
// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        react(),
        tailwindcss(),
        crx({ manifest }),
    ],
    build: {
        rollupOptions: {
            input: {
                options: path.resolve(__dirname, 'src/options/index.html'),
                calendar: path.resolve(__dirname, 'src/options/calendar.html'),
                booking: path.resolve(__dirname, 'src/booking/index.html'),
            },
        },
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    server: {
        port: 5173,
        strictPort: true,
        hmr: {
            port: 5173,
        },
    },
});
