/**
 * Chat-title helpers for the AI Coach UI. Keep in sync with the server copy in
 * `supabase/functions/_shared/aiCoachChat.ts` (that file imports Deno env, so it
 * cannot be imported by the extension/website bundle).
 */

const GENERIC_TITLES = new Set([
    'new chat', 'chat', 'focus', 'focus help', 'help', 'question', 'conversation', 'untitled',
]);

/** Strips markdown/quotes/prefix and caps length at a word boundary. */
export function sanitizeTitle(raw: string): string {
    let t = raw.trim();
    t = t.replace(/^title\s*:\s*/i, '');
    t = t.replace(/^["'`]+|["'`]+$/g, '');
    t = t.replace(/[*_`#>\[\](){}]/g, '');
    t = t.replace(/\s+/g, ' ').trim();
    t = t.replace(/[.!?,;:]+$/g, '');
    if (t.length > 60) {
        t = t.slice(0, 60);
        const lastSpace = t.lastIndexOf(' ');
        if (lastSpace > 20) t = t.slice(0, lastSpace);
        t = t.replace(/[.!?,;:\s]+$/g, '');
    }
    return t;
}

/** True when a candidate title is usable (not truncated, not generic). */
export function isAcceptableTitle(title: string, finishReason?: string): boolean {
    if (finishReason === 'MAX_TOKENS') return false;
    if (title.length < 8) return false;
    if (title.split(' ').filter(Boolean).length < 2) return false;
    if (GENERIC_TITLES.has(title.toLowerCase())) return false;
    return true;
}

const LEADING_FILLER =
    /^(?:hey|hi|hello|yo|ok|okay|so|well|the|a|an|please|thanks|thank you|can you|could you|would you|will you|i want to|i need to|i'd like to|i would like to|im trying to|i'm trying to|how do i|how can i|how to|what is|what's|whats|what are|tell me)\b[\s,!.?]*/i;

/** Deterministic title from the user's first message when the model fails. */
export function fallbackTitleFromMessage(userMessage: string): string {
    const first = (userMessage.split(/\n/)[0] || '').trim();
    const sentence = (first.match(/^[^.!?]+/)?.[0] || first).trim();
    let cleaned = sentence;
    let prev = '';
    while (cleaned !== prev) {
        prev = cleaned;
        cleaned = cleaned.replace(LEADING_FILLER, '').trim();
    }
    if (!cleaned) return 'New chat';
    let title = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    const words = title.split(' ').filter(Boolean);
    if (words.length > 6 || title.length > 50) {
        title = words.slice(0, 6).join(' ');
        if (title.length > 50) {
            title = title.slice(0, 50);
            const lastSpace = title.lastIndexOf(' ');
            if (lastSpace > 15) title = title.slice(0, lastSpace);
        }
        title = title.replace(/[.!?,;:\s]+$/g, '');
    }
    if (title.split(' ').filter(Boolean).length < 2) {
        const word = (words[0] || title).replace(/[.!?,;:]+$/g, '');
        return word ? `Chat about ${word}` : 'New chat';
    }
    return title;
}
