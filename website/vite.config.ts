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

/**
 * Dev-only SPA fallback for page navigations. Vite treats extensionless URLs as
 * module requests, and on case-insensitive filesystems (Windows) `/app`
 * resolves to `App.tsx` — so the browser got the compiled source instead of
 * the app. Top-level document requests for extensionless paths get
 * `index.html`, mirroring the catch-all rewrite in vercel.json.
 */
function spaDocumentFallback(): Plugin {
    return {
        name: 'spa-document-fallback',
        apply: 'serve',
        configureServer(server) {
            server.middlewares.use((req, _res, next) => {
                const url = req.url ?? '/';
                const [pathname, query] = url.split('?');
                const isDocument =
                    req.headers['sec-fetch-dest'] === 'document' ||
                    (req.headers.accept ?? '').includes('text/html');
                if (
                    req.method === 'GET' &&
                    isDocument &&
                    pathname !== '/' &&
                    !path.extname(pathname) &&
                    !pathname.startsWith('/api/') &&
                    !pathname.startsWith('/@')
                ) {
                    req.url = `/index.html${query ? `?${query}` : ''}`;
                }
                next();
            });
        },
    };
}

/**
 * The web vault (vault.html) decrypts FocuzPass in the page, so it gets an enforced CSP of its own
 * in production builds: only its own scripts, and connections to Supabase alone. (Dev keeps Vite's
 * inline preamble working, so it's build-only.)
 */
const WEB_VAULT_CSP = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "img-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
].join('; ');

function webVaultCsp(): Plugin {
    return {
        name: 'web-vault-csp',
        apply: 'build',
        transformIndexHtml: {
            order: 'post',
            handler(html, ctx) {
                if (!ctx.filename.replace(/\\/g, '/').endsWith('/vault.html')) return html;
                return html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${WEB_VAULT_CSP}" />`);
            },
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
            spaDocumentFallback(),
            atAlias(),
            focuzBareDeps(),
            react(),
            tailwindcss(),
            groqApiDevPlugin(groqKey),
            betaApiDevPlugin(),
            webVaultCsp(),
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
            rollupOptions: {
                input: {
                    main: path.join(websiteRoot, 'index.html'),
                    // Real extension UI on demo data, embedded by the landing page.
                    demo: path.join(websiteRoot, 'demo.html'),
                    // FocuzPass without the extension (its own small bundle).
                    vault: path.join(websiteRoot, 'vault.html'),
                },
            },
        },
    };
});
