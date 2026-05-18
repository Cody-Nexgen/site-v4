import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { groqApiDevPlugin } from './plugins/vite-groq-api';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const groqKey = env.GROQ_API_KEY || process.env.GROQ_API_KEY;

    return {
        server: {
            port: 3000,
            host: '0.0.0.0',
        },
        plugins: [react(), groqApiDevPlugin(groqKey)],
        define: {
            'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
            'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        },
        resolve: {
            alias: {
                '@': path.resolve(__dirname, '.'),
            },
        },
    };
});
