import path from 'path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { groqApiDevPlugin } from './plugins/vite-groq-api';
import { betaApiDevPlugin } from './plugins/vite-beta-api';

const websiteRoot = path.resolve(__dirname);
const focuzRoot = path.resolve(__dirname, '../src/src');

/**
 * Single `@/` resolver:
 * - importers under extension `src/src` → focuz root
 * - everything else → website root
 *
 * Avoids competing with `resolve.alias['@']`, which was stealing focuz imports.
 */
function atAlias(): Plugin {
    return {
        name: 'at-alias',
        enforce: 'pre',
        async resolveId(source, importer, opts) {
            if (!source.startsWith('@/')) return null;
            let importerNorm = importer ? importer.replace(/\\/g, '/') : '';
            try {
                importerNorm = decodeURIComponent(importerNorm);
            } catch {
                /* keep raw */
            }
            const base = /\/src\/src\//.test(importerNorm) ? focuzRoot : websiteRoot;
            const target = path.resolve(base, source.slice(2));
            return this.resolve(target, importer, { skipSelf: true, ...opts });
        },
    };
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const groqKey = env.GROQ_API_KEY || process.env.GROQ_API_KEY;

    return {
        server: {
            port: 3000,
            host: '0.0.0.0',
            fs: {
                allow: [path.resolve(__dirname, '..')],
            },
        },
        plugins: [
            atAlias(),
            react(),
            tailwindcss(),
            groqApiDevPlugin(groqKey),
            betaApiDevPlugin(),
        ],
        define: {
            'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
            'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        },
        resolve: {
            alias: {
                '@focuz': focuzRoot,
                react: path.resolve(websiteRoot, 'node_modules/react'),
                'react-dom': path.resolve(websiteRoot, 'node_modules/react-dom'),
            },
            dedupe: ['react', 'react-dom'],
        },
        optimizeDeps: {
            include: [
                'zustand',
                'framer-motion',
                'lucide-react',
                'date-fns',
                'three',
                '@tanstack/react-query',
            ],
        },
        build: {
            chunkSizeWarningLimit: 2500,
        },
    };
});
