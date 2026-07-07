export type ChatApiResult =
    | { ok: true; content: string }
    | { ok: false; error: string };

/** POST /api/chat — always returns parsed JSON or a clear error (never raw HTML). */
export async function postChatMessage(
    messages: { role: 'user' | 'assistant'; content: string }[],
): Promise<ChatApiResult> {
    let res: Response;
    try {
        res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages }),
        });
    } catch {
        return { ok: false, error: 'Network error — check your connection.' };
    }

    const raw = await res.text();
    let data: { error?: string; message?: { content?: string } } | null = null;

    try {
        data = raw ? (JSON.parse(raw) as typeof data) : null;
    } catch {
        const preview = raw.trim().slice(0, 80);
        const looksLikeHtml = preview.startsWith('<!') || preview.startsWith('<html');
        if (looksLikeHtml) {
            return {
                ok: false,
                error:
                    'Chat API returned the website page instead of JSON. Redeploy with the website folder as the Vercel root, or run `npm run dev` locally with GROQ_API_KEY in website/.env.',
            };
        }
        return {
            ok: false,
            error: preview ? `Invalid server response: ${preview}` : 'Empty response from chat API.',
        };
    }

    if (!res.ok) {
        return { ok: false, error: data?.error || `Request failed (${res.status})` };
    }

    const content = data?.message?.content;
    if (!content) {
        return { ok: false, error: 'No message in response.' };
    }

    return { ok: true, content };
}
