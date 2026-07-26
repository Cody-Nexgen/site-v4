import { getSupabaseConfig } from './supabase';
import { supabase } from './supabase';
import type { AiCoachModelId } from './aiCoachModels';

export type StreamCoachCallbacks = {
    onSession?: (sessionId: string) => void;
    onToken?: (chunk: string, visibleText: string) => void;
    onDone?: (payload: {
        session_id: string;
        content: string;
        title?: string;
        actions: Record<string, unknown>[];
        action_data: Record<string, unknown> | Record<string, unknown>[] | null;
    }) => void;
    onError?: (message: string, code?: string) => void;
};

type SsePayload = {
    type: string;
    session_id?: string;
    text?: string;
    visible?: string;
    content?: string;
    title?: string;
    actions?: Record<string, unknown>[];
    action_data?: Record<string, unknown> | Record<string, unknown>[];
    error?: string;
    code?: string;
};

function parseSsePart(part: string, callbacks: StreamCoachCallbacks): boolean {
    const line = part.trim();
    if (!line.startsWith('data:')) return false;
    try {
        const payload = JSON.parse(line.slice(5).trim()) as SsePayload;

        if (payload.type === 'session' && payload.session_id) {
            callbacks.onSession?.(payload.session_id);
        } else if (payload.type === 'token') {
            callbacks.onToken?.(payload.text || '', payload.visible || '');
        } else if (payload.type === 'done') {
            callbacks.onDone?.({
                session_id: payload.session_id || '',
                content: payload.content || '',
                title: payload.title,
                actions: payload.actions || [],
                action_data: payload.action_data ?? null,
            });
            return true;
        } else if (payload.type === 'error') {
            callbacks.onError?.(payload.error || 'Stream error', payload.code);
            return true;
        }
    } catch {
        /* partial SSE frame */
    }
    return false;
}

function drainSseBuffer(
    buffer: string,
    callbacks: StreamCoachCallbacks,
    flush: boolean,
): { buffer: string; finished: boolean } {
    const parts = buffer.split('\n\n');
    let finished = false;
    const toProcess = flush ? parts : parts.slice(0, -1);
    const rest = flush ? '' : parts[parts.length - 1] || '';

    for (const part of toProcess) {
        if (parseSsePart(part, callbacks)) finished = true;
    }
    return { buffer: rest, finished };
}

export async function streamAiCoachChat(opts: {
    model: AiCoachModelId;
    messages: { role: 'user' | 'assistant'; content: string }[];
    sessionId: string | null;
    coachContext?: Record<string, unknown>;
    callbacks: StreamCoachCallbacks;
}): Promise<void> {
    const cfg = getSupabaseConfig();
    if (!cfg.isConfigured) {
        opts.callbacks.onError?.('Supabase is not configured');
        return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
        opts.callbacks.onError?.('Please sign in again.');
        return;
    }

    const url = `${cfg.url.replace(/\/$/, '')}/functions/v1/ai-coach-chat`;

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            apikey: cfg.anonKey,
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
        },
        body: JSON.stringify({
            model: opts.model,
            messages: opts.messages,
            session_id: opts.sessionId,
            stream: true,
            coach_context: opts.coachContext,
        }),
    });

    if (!res.ok) {
        let errMsg = `Request failed (${res.status})`;
        let errCode: string | undefined;
        try {
            const errJson = await res.json();
            errMsg = errJson.error || errMsg;
            errCode = errJson.code;
        } catch {
            /* ignore */
        }
        opts.callbacks.onError?.(errMsg, errCode);
        return;
    }

    if (!res.body) {
        opts.callbacks.onError?.('No response stream');
        return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let streamFinished = false;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const drained = drainSseBuffer(buffer, opts.callbacks, false);
        buffer = drained.buffer;
        if (drained.finished) streamFinished = true;
    }

    buffer += decoder.decode();
    const final = drainSseBuffer(buffer, opts.callbacks, true);
    if (final.finished) streamFinished = true;

    if (!streamFinished) {
        opts.callbacks.onError?.(
            'Stream ended before a complete reply. Ensure ai-coach-chat is deployed with GEMINI_API_KEY set.',
        );
    }
}
