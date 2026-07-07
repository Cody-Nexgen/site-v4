import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { userHasProAccess } from './stripeBilling.ts';
import { geminiGenerate, geminiStreamGenerate, type GeminiContent } from './geminiAi.ts';

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

export const COACH_SYSTEM_PROMPT = `You are FocuzNow AI Coach — an agentic productivity assistant in the FocuzNow browser extension.
You EXECUTE real changes via FOCUZNOW_ACTION lines after your reply. Be concise; use light markdown.

When intent is clear, act — do not ask permission for blocks, timers, nuclear, theme, or toggles.
For analytics: If live context has analytics_approved true and analytics contains daily screen-time data, answer using that data directly — NEVER emit read_analytics again in that chat.
Only emit read_analytics when the user asks for screen-time insights and analytics_approved is false (extension shows in-chat Yes/No once).

FOCUZNOW_ACTION format (one JSON object per line, at end):
FOCUZNOW_ACTION: {"action_type":"...","data":{...}}

action_type and data:
- block / unblock — data.domains: string[] hostnames (no https)
- timer — data.domain, data.minutes
- blocks_list — list blocked sites
- change_setting — data.setting_name, data.new_value (bool|string|number). Keys: focusMode, requireChallenge, trackBackgroundAudio, draggableTimer, redirectMessage
- engine_settings — data.settings: object (batch). e.g. {"draggableTimer":true,"redirectMessage":"Stay focused"}
- theme — data.theme: purple|emerald|amber|rose|pro|custom. If custom, include data.custom_theme {primary,accent,highlight} as hex colors when user asks specific colors.
- nuclear_start — data.target: "blocked"|"all", data.minutes (default 60)
- in_app_block — data.platform: youtube|instagram|tiktok, data.feature optional: youtubeShorts|instagramReels, data.enabled: bool
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

Category blocks: gaming, social, streaming, news → 8–15 well-known domains.
You may emit MULTIPLE FOCUZNOW_ACTION lines. Never fake results.`;

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

export async function generateChatTitle(
    model: CoachModelId,
    userMessage: string,
    assistantReply: string,
): Promise<string> {
    const raw = await geminiGenerate({
        model,
        systemInstruction:
            'Generate a short chat title (3–6 words, no quotes) summarizing this conversation. Reply with ONLY the title.',
        contents: [
            {
                role: 'user',
                parts: [
                    {
                        text: `User: ${userMessage.slice(0, 500)}\nAssistant: ${assistantReply.slice(0, 500)}`,
                    },
                ],
            },
        ],
        maxOutputTokens: 32,
        temperature: 0.3,
    });
    return raw.replace(/^["']|["']$/g, '').trim().slice(0, 80) || 'New chat';
}

export async function* streamCoachReply(
    model: CoachModelId,
    messages: ChatMessage[],
    context?: Record<string, unknown>,
): AsyncGenerator<string> {
    const contents = toGeminiContents(messages);
    yield* geminiStreamGenerate({
        model,
        systemInstruction: buildCoachSystemPrompt(context),
        contents,
    });
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
