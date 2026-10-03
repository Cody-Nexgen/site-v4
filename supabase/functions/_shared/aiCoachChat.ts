import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { userHasProAccess } from './stripeBilling.ts';
import { geminiGenerateWithMeta, geminiStreamGenerate, type GeminiContent, type GeminiUsage } from './geminiAi.ts';

export type CoachModelId = 'gemini-2.5-flash' | 'gemini-2.5-pro';

export const COACH_MODELS: Record<CoachModelId, { label: string; description: string }> = {
    'gemini-2.5-flash': {
        label: 'Gemini 2.5 Flash',
        description: 'Fast — best for quick coaching',
    },
    'gemini-2.5-pro': {
        label: 'Gemini 2.5 Pro',
        description: 'Smarter — better for complex plans',
    },
};

/** Domain presets the model should use for category requests */
export const DOMAIN_PRESETS = {
    gaming: [
        'store.steampowered.com',
        'steampowered.com',
        'epicgames.com',
        'roblox.com',
        'battle.net',
        'xbox.com',
        'playstation.com',
        'twitch.tv',
        'discord.com',
        'minecraft.net',
        'ea.com',
        'riotgames.com',
        'nintendo.com',
    ],
    social: [
        'instagram.com',
        'facebook.com',
        'twitter.com',
        'x.com',
        'tiktok.com',
        'snapchat.com',
        'reddit.com',
        'pinterest.com',
        'threads.net',
    ],
    streaming: [
        'youtube.com',
        'netflix.com',
        'hulu.com',
        'disneyplus.com',
        'max.com',
        'primevideo.com',
        'crunchyroll.com',
    ],
    news: ['news.ycombinator.com', 'cnn.com', 'bbc.com', 'reddit.com'],
};

export const COACH_SYSTEM_PROMPT = `You are FocuzNow AI Coach, the assistant in the FocuzNow browser extension. You're a capable general assistant first: help with anything the user asks (coding, math, homework, writing, explanations, ideas, everyday questions) and answer it fully and accurately. Focus and productivity are your specialty, not a limit. Never turn a question down or deflect it just because it isn't about productivity, and never reply with "I can only help with productivity" or "I can't help with that, but I can set a timer".
When it genuinely fits, add ONE short, optional FocuzNow offer after a complete answer (e.g. "Want me to put the study session on your calendar?" or "I can block distracting sites while you work on this."). Skip it when it would feel forced, and never let it replace the answer.
You EXECUTE real FocuzNow changes via FOCUZNOW_ACTION lines after your reply. Match length to the question: short for quick ones, thorough for complex ones.

Formatting: your reply is rendered as GitHub-flavored Markdown, so use whatever makes the answer clearest:
- headings, **bold**, *italic*, ~~strikethrough~~, bulleted, numbered and "- [ ]" task lists, > quotes, links
- tables (| a | b |) for comparisons, schedules and data
- fenced code blocks with a language tag (\`\`\`python) for any code, commands or config
- math in LaTeX: $x^2$ inline and $$\\int_0^1 x\\,dx$$ on its own line for display equations
- math is rendered, so write it as math, never inside a code block: the user sees the typeset equation. Only show raw LaTeX source in a code block when the user explicitly asks for the source code
Don't put FOCUZNOW_ACTION lines inside code blocks.

When intent is clear, act — do not ask permission for blocks, timers, nuclear, theme, or toggles.
For analytics: If live context has analytics_approved true and analytics contains daily screen-time data, answer using that data directly — NEVER emit read_analytics again in that chat.
Only emit read_analytics when the user asks for screen-time insights and analytics_approved is false (extension shows in-chat Yes/No once).

FOCUZNOW_ACTION format (one JSON object per line, at end):
FOCUZNOW_ACTION: {"action_type":"...","data":{...}}

action_type and data:
- block / unblock — data.domains: string[] hostnames (no https)
- timer — data.domain, data.minutes
- blocks_list — list blocked sites
- change_setting — data.setting_name, data.new_value (bool|string|number). Keys: focusMode, requireChallenge, trackBackgroundAudio, draggableTimer, pomodoroWidget, redirectMessage, allowlistMode
- engine_settings — data.settings: object (batch). e.g. {"draggableTimer":true,"redirectMessage":"Stay focused"}
- theme — data.theme: purple|emerald|amber|rose|pro|custom. If custom, include data.custom_theme {primary,accent,highlight} as hex colors when user asks specific colors.
- nuclear_start — data.target: "blocked"|"all", data.minutes (default 60)
- in_app_block — data.enabled: bool. For all in-app blocking omit platform. Or set data.platform: youtube|instagram|tiktok and optional data.feature: youtubeShorts|instagramReels. Never invent keys like in.app.blocking.
- in_app_filter_add / in_app_filter_remove — data.handle (creator @name without @)
- habit_add — data.name
- habit_checkin — data.name or data.habit_id
- pomodoro_configure — data.focus_min, data.break_min
- pomodoro_start — data.focus_min optional
- calendar_open — opens calendar tab
- scheduling_links_list — lists user's booking links
- read_analytics — reads 7-day screen time IF user approved; else triggers approval modal
- daily_goal_set — data.goal: string (main focus for today)
- planner_set — data.planner_items: [{time, task, durationMin?, done?}] replaces daily planner
- calendar_add_events — data.events: [{title, date (yyyy-MM-dd), startHour, startMin, durationMin, color?}] adds focus blocks

Documents: when the user asks for something they'd keep or reuse — a focus plan, weekly plan, routine, study plan, checklist, notes, a report — or says "make a doc", write it as ONE document block. The app saves it to their Library and shows it as a card:
~~~focuz-doc
title: Weekly focus plan
type: plan
---
# Weekly focus plan
…markdown body (headings, lists, "- [ ]" checklists, tables)…
~~~
type is one of: plan, routine, study, checklist, notes, report. Use ~~~ (tildes) for the fence. Keep your chat reply outside the block to 1–2 sentences. You may still emit FOCUZNOW_ACTION lines after it (e.g. calendar_add_events for the plan's blocks). Don't wrap quick answers in a document.

Category blocks: gaming, social, streaming, news → 8–15 well-known domains.
You may emit MULTIPLE FOCUZNOW_ACTION lines. Never fake results.

Images: users may attach screenshots. The client OCR's them and appends a block like:
[User attached an image: filename.png]
[Image text]
…extracted characters…
Treat that block as what is visible in the image. Answer using the extracted text. Never say you cannot see images, that you are text-based only, or ask the user to describe the image when [User attached an image] or [Image text] is present — read the OCR block instead.`;

export function buildCoachSystemPrompt(context?: Record<string, unknown>): string {
    if (!context) return COACH_SYSTEM_PROMPT;
    const slice = JSON.stringify(context).slice(0, 14000);
    return `${COACH_SYSTEM_PROMPT}\n\n## Live extension context (JSON)\n${slice}`;
}

type ChatMessage = { role: 'user' | 'assistant'; content: string };

export function toGeminiContents(messages: ChatMessage[]): GeminiContent[] {
    return messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
        }));
}

function domainFromEntry(entry: unknown): string {
    if (typeof entry === 'string') return entry;
    if (entry && typeof entry === 'object') {
        const o = entry as Record<string, unknown>;
        if (typeof o.name === 'string') return o.name;
        if (typeof o.host === 'string') return o.host;
        if (typeof o.domain === 'string') return o.domain;
    }
    return '';
}

/** Normalize model output so the extension never reads .name on undefined. */
function sanitizeCoachActionRow(raw: Record<string, unknown>): Record<string, unknown> {
    const action_type = raw.action_type;
    const nested =
        raw.data && typeof raw.data === 'object'
            ? { ...(raw.data as Record<string, unknown>) }
            : {};
    const out: Record<string, unknown> = { action_type, data: nested };

    if (action_type === 'block' || action_type === 'unblock') {
        const rawDomains = nested.domains ?? raw.domains ?? [];
        const list = Array.isArray(rawDomains) ? rawDomains : [rawDomains];
        nested.domains = list.map(domainFromEntry).filter(Boolean);
    }
    if (action_type === 'change_setting') {
        const setting_name = nested.setting_name ?? nested.name ?? raw.name;
        if (typeof setting_name === 'string') nested.setting_name = setting_name;
        delete nested.name;
    }
    return out;
}

const FOCUZNOW_MARKER = 'FOCUZNOW_ACTION:';

function readJsonObject(content: string, start: number): { json: string; end: number } | null {
    if (content[start] !== '{') return null;
    let depth = 0;
    let inString = false;
    let escape = false;

    for (let j = start; j < content.length; j++) {
        const c = content[j];
        if (inString) {
            if (escape) escape = false;
            else if (c === '\\') escape = true;
            else if (c === '"') inString = false;
            continue;
        }
        if (c === '"') {
            inString = true;
            continue;
        }
        if (c === '{') depth++;
        else if (c === '}') {
            depth--;
            if (depth === 0) {
                return { json: content.slice(start, j + 1), end: j + 1 };
            }
        }
    }
    return null;
}

export function stripActionMarkers(text: string): string {
    const idx = text.indexOf(FOCUZNOW_MARKER);
    if (idx === -1) return text.trim();
    return text.slice(0, idx).trim();
}

export function parseActionsFromContent(content: string): {
    text: string;
    actions: Record<string, unknown>[];
} {
    const actions: Record<string, unknown>[] = [];
    let firstMarker = -1;
    let searchFrom = 0;

    while (searchFrom < content.length) {
        const idx = content.indexOf(FOCUZNOW_MARKER, searchFrom);
        if (idx === -1) break;
        if (firstMarker === -1) firstMarker = idx;

        let i = idx + FOCUZNOW_MARKER.length;
        while (i < content.length && /\s/.test(content[i])) i++;

        if (content[i] === '{') {
            const parsed = readJsonObject(content, i);
            if (parsed) {
                try {
                    const obj = JSON.parse(parsed.json) as Record<string, unknown>;
                    if (obj && typeof obj === 'object') {
                        actions.push(sanitizeCoachActionRow(obj));
                    }
                } catch {
                    /* skip */
                }
                searchFrom = parsed.end;
                continue;
            }
        }

        searchFrom = idx + FOCUZNOW_MARKER.length;
    }

    const text = firstMarker === -1 ? content.trim() : content.slice(0, firstMarker).trim();
    return { text, actions };
}

export async function requirePro(
    admin: SupabaseClient,
    userId: string,
    email?: string,
): Promise<
    | { ok: true }
    | { ok: false; error: string; status: number; code: 'PRO_REQUIRED' }
> {
    const hasPro = await userHasProAccess(admin, userId, email);
    if (!hasPro) {
        return {
            ok: false,
            status: 403,
            code: 'PRO_REQUIRED',
            error: 'AI Coach is a Pro feature. Upgrade to continue.',
        };
    }
    return { ok: true };
}

const TITLE_SYSTEM_PROMPT =
    'You name chat conversations. Write a title of 3 to 7 words in sentence case that states the specific topic of the user\'s request, like a descriptive email subject. Use concrete nouns from the conversation. Never output generic titles such as "New chat", "Focus help", "Question", "Chat", or a single word. No quotes, no emoji, no trailing punctuation.\n' +
    'Examples:\n' +
    'User: how do i stop checking youtube when studying -> Block YouTube during study sessions\n' +
    'User: make me a plan for my bio exam friday -> Biology exam study plan\n' +
    'User: whats the savanna climate like -> Savanna climate overview\n' +
    'User: translate cross to spanish -> Spanish translation of cross\n' +
    'Reply with only the title.';

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

export async function generateChatTitle(
    model: CoachModelId,
    userMessage: string,
    assistantReply: string,
): Promise<string> {
    const prompt = `User: ${userMessage.slice(0, 600)}\nAssistant: ${assistantReply.slice(0, 400)}`;
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const { text, finishReason } = await geminiGenerateWithMeta({
                model,
                systemInstruction: TITLE_SYSTEM_PROMPT,
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                maxOutputTokens: 60,
                temperature: 0.2,
                thinkingBudget: 0,
            });
            const title = sanitizeTitle(text);
            if (isAcceptableTitle(title, finishReason)) return title;
        } catch {
            /* retry once, then deterministic fallback */
        }
    }
    return fallbackTitleFromMessage(userMessage);
}

export async function* streamCoachReply(
    model: CoachModelId,
    messages: ChatMessage[],
    context?: Record<string, unknown>,
    onUsage?: (usage: GeminiUsage) => void,
): AsyncGenerator<string> {
    const contents = toGeminiContents(messages);
    yield* geminiStreamGenerate({
        model,
        systemInstruction: buildCoachSystemPrompt(context),
        contents,
        onUsage,
    });
}

/** Rough token count when Gemini doesn't report usage (~4 chars/token). */
export function estimateTurnUsage(
    messages: ChatMessage[],
    context: Record<string, unknown> | undefined,
    reply: string,
): { input: number; output: number; total: number; estimated: true } {
    const inChars =
        buildCoachSystemPrompt(context).length + messages.reduce((n, m) => n + m.content.length, 0);
    const input = Math.ceil(inChars / 4);
    const output = Math.ceil(reply.length / 4);
    return { input, output, total: input + output, estimated: true };
}

export async function saveChatTurn(opts: {
    admin: SupabaseClient;
    sessionId: string;
    userId: string;
    model: CoachModelId;
    userMessage: string;
    assistantText: string;
    actions: Record<string, unknown>[];
    isFirstTurn: boolean;
}): Promise<{ title?: string }> {
    await opts.admin.from('ai_chat_messages').insert({
        session_id: opts.sessionId,
        role: 'user',
        content: opts.userMessage,
    });

    const action_data = opts.actions.length === 1
        ? opts.actions[0]
        : opts.actions.length > 1
        ? opts.actions
        : null;

    await opts.admin.from('ai_chat_messages').insert({
        session_id: opts.sessionId,
        role: 'assistant',
        content: opts.assistantText,
        action_data,
    });

    let title: string | undefined;
    if (opts.isFirstTurn) {
        try {
            title = await generateChatTitle(opts.model, opts.userMessage, opts.assistantText);
            await opts.admin
                .from('ai_chat_sessions')
                .update({ title, updated_at: new Date().toISOString() })
                .eq('id', opts.sessionId);
        } catch (e) {
            console.warn('[ai-coach] title generation failed', e);
        }
    } else {
        await opts.admin
            .from('ai_chat_sessions')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', opts.sessionId);
    }

    return { title };
}

export async function ensureChatSession(
    admin: SupabaseClient,
    userId: string,
    sessionId?: string | null,
): Promise<string> {
    if (sessionId) return sessionId;

    const { data, error } = await admin
        .from('ai_chat_sessions')
        .insert({ user_id: userId, title: 'New chat' })
        .select('id')
        .single();

    if (error || !data?.id) {
        throw new Error('Could not create chat session');
    }
    return data.id as string;
}
