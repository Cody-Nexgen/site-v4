import type { VercelRequest, VercelResponse } from '@vercel/node';
import { runGroqChat, type GroqChatMessage } from '../lib/groq-chat';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        return res.status(503).json({ error: 'Chat is not configured (missing GROQ_API_KEY).' });
    }

    const body = req.body as { messages?: GroqChatMessage[] } | undefined;
    const messages = body?.messages;

    if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: 'messages array is required' });
    }

    if (messages.length > 30) {
        return res.status(400).json({ error: 'Too many messages in one request' });
    }

    try {
        const { content } = await runGroqChat(apiKey, messages);
        return res.status(200).json({
            message: { role: 'assistant', content },
        });
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Chat failed';
        console.error('[api/chat]', msg);
        return res.status(502).json({ error: msg });
    }
}
