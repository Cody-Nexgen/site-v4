import type { Plugin } from 'vite';
import { runGroqChat, type GroqChatMessage } from '../lib/groq-chat';

/** Local dev: POST /api/chat → Groq (uses GROQ_API_KEY from .env) */
export function groqApiDevPlugin(apiKey: string | undefined): Plugin {
    return {
        name: 'focuznow-groq-api-dev',
        configureServer(server) {
            server.middlewares.use(async (req, res, next) => {
                const pathname = (req.url || '').split('?')[0];
                if (pathname !== '/api/chat') {
                    return next();
                }
                if (req.method !== 'POST') {
                    res.statusCode = 405;
                    res.end(JSON.stringify({ error: 'Method not allowed' }));
                    return;
                }

                const chunks: Buffer[] = [];
                req.on('data', (c) => chunks.push(c));
                req.on('end', async () => {
                    try {
                        if (!apiKey) {
                            res.statusCode = 503;
                            res.setHeader('Content-Type', 'application/json');
                            res.end(
                                JSON.stringify({
                                    error: 'Set GROQ_API_KEY in website/.env for local chat.',
                                }),
                            );
                            return;
                        }

                        const body = JSON.parse(
                            Buffer.concat(chunks).toString('utf8') || '{}',
                        ) as { messages?: GroqChatMessage[] };

                        if (!body.messages?.length) {
                            res.statusCode = 400;
                            res.setHeader('Content-Type', 'application/json');
                            res.end(JSON.stringify({ error: 'messages array is required' }));
                            return;
                        }

                        const { content } = await runGroqChat(apiKey, body.messages);
                        res.statusCode = 200;
                        res.setHeader('Content-Type', 'application/json');
                        res.end(
                            JSON.stringify({
                                message: { role: 'assistant', content },
                            }),
                        );
                    } catch (err) {
                        const msg = err instanceof Error ? err.message : 'Chat failed';
                        res.statusCode = 502;
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({ error: msg }));
                    }
                });
            });
        },
    };
}
