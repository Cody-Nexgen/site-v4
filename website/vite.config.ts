import path from 'path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { groqApiDevPlugin } from './plugins/vite-groq-api';
import { betaApiDevPlugin } from './plugins/vite-beta-api';

const websiteRoot = path.resolve(__dirname);
const focuzRoot = path.resolve(__dirname, '../src/src');

function normalizeImporter(importer?: string) {
    if (!importer) return '';
    let importerNorm = importer.replace(/\\/g, '/');
    try {
        importerNorm = decodeURIComponent(importerNorm);
    } catch {
        /* keep raw */
    }
    return importerNorm;
}

function isFocuzImporter(importer?: string) {
    return /\/src\/src\//.test(normalizeImporter(importer));
}

/**
 * Single `@/` resolver:
 * - importers under extension `src/src` → focuz root
 * - everything else → website root
 */
function atAlias(): Plugin {
    return {
        name: 'at-alias',
        enforce: 'pre',
        async resolveId(source, importer, opts) {
            if (!source.startsWith('@/')) return null;
            const base = isFocuzImporter(importer) ? focuzRoot : websiteRoot;
            const target = path.resolve(base, source.slice(2));
            return this.resolve(target, importer, { skipSelf: true, ...opts });
        },
    };
}

/**
 * Bare imports from files outside `website/` (the extension tree) must resolve
 * against website/node_modules — Vite won't walk up from ../src by default.
 */
function focuzBareDeps(): Plugin {
    const websiteEntry = path.join(websiteRoot, 'index.html');
    return {
        name: 'focuz-bare-deps',
        enforce: 'pre',
        async resolveId(source, importer, opts) {
            if (!importer || !isFocuzImporter(importer)) return null;
            if (
                source.startsWith('.') ||
                source.startsWith('/') ||
                source.startsWith('\\') ||
                source.startsWith('@/') ||
                source.startsWith('@focuz') ||
                source.startsWith('\0')
            ) {
                return null;
            }
            return this.resolve(source, websiteEntry, { skipSelf: true, ...opts });
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
            focuzBareDeps(),
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
