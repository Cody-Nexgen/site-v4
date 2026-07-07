import type { Plugin } from 'vite';
import { handleDownloadRequest } from '../lib/download-api';

/** Local dev: GET /api/download with Authorization Bearer token */
export function betaApiDevPlugin(): Plugin {
    return {
        name: 'focuznow-beta-api-dev',
        configureServer(server) {
            server.middlewares.use(async (req, res, next) => {
                const pathname = (req.url || '').split('?')[0];
                if (pathname !== '/api/download') {
                    return next();
                }
                if (req.method !== 'GET') {
                    res.statusCode = 405;
                    res.end('Method not allowed');
                    return;
                }

                try {
                    const headers = new Headers();
                    for (const [key, value] of Object.entries(req.headers)) {
                        if (value) {
                            headers.set(key, Array.isArray(value) ? value.join(', ') : value);
                        }
                    }

                    const response = await handleDownloadRequest(
                        new Request(`http://localhost${req.url}`, {
                            method: 'GET',
                            headers,
                        }),
                    );

                    res.statusCode = response.status;
                    response.headers.forEach((value, key) => {
                        res.setHeader(key, value);
                    });

                    const body = await response.text();
                    res.end(body);
                } catch (err) {
                    const msg = err instanceof Error ? err.message : 'Download failed';
                    res.statusCode = 500;
                    res.end(msg);
                }
            });
        },
    };
}
