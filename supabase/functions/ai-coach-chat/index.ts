import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders, getUserFromAuthHeader, jsonResponse } from '../_shared/stripeBilling.ts';
import {
    type CoachModelId,
    COACH_MODELS,
    buildCoachSystemPrompt,
    ensureChatSession,
    parseActionsFromContent,
    requirePro,
    saveChatTurn,
    streamCoachReply,
    stripActionMarkers,
    toGeminiContents,
} from '../_shared/aiCoachChat.ts';
import { geminiGenerate } from '../_shared/geminiAi.ts';

const SSE_HEADERS = {
    ...corsHeaders,
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
};

function sseEvent(payload: Record<string, unknown>): string {
    return `data: ${JSON.stringify(payload)}\n\n`;
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
            return jsonResponse({ error: 'Server configuration is incomplete.' }, 500);
        }

        const auth = await getUserFromAuthHeader(req, supabaseAnonKey, supabaseUrl);
        if ('error' in auth) {
            return jsonResponse({ error: 'NOT_AUTHENTICATED' }, 401);
        }

        const body = await req.json().catch(() => ({}));
        const model = (body.model as CoachModelId) || 'gemini-2.5-flash';
        const messages = Array.isArray(body.messages) ? body.messages : [];
        const sessionIdIn = typeof body.session_id === 'string' ? body.session_id : null;
        const stream = body.stream !== false;
        const coachContext =
            body.coach_context && typeof body.coach_context === 'object'
                ? (body.coach_context as Record<string, unknown>)
                : undefined;

        if (!(model in COACH_MODELS)) {
            return jsonResponse({ error: 'Invalid model' }, 400);
        }

        const admin = createClient(supabaseUrl, serviceRoleKey);
        const pro = await requirePro(admin, auth.user.id, auth.user.email ?? undefined);
        if (!pro.ok) {
            return jsonResponse({ error: pro.error, code: pro.code }, pro.status);
        }

        const chatSessionId = await ensureChatSession(admin, auth.user.id, sessionIdIn);
        const lastUser = [...messages].reverse().find((m: { role: string }) => m.role === 'user');
        const userMessage = lastUser?.content ?? '';

        const { count } = await admin
            .from('ai_chat_messages')
            .select('id', { count: 'exact', head: true })
            .eq('session_id', chatSessionId);

        const isFirstTurn = (count ?? 0) === 0;

        if (!stream) {
            let full = '';
            for await (const chunk of streamCoachReply(model, messages, coachContext)) {
                full += chunk;
            }
            const { text, actions } = parseActionsFromContent(full);
            const displayText = stripActionMarkers(text) || text;
            const { title } = await saveChatTurn({
                admin,
                sessionId: chatSessionId,
                userId: auth.user.id,
                model,
                userMessage,
                assistantText: displayText,
                actions,
                isFirstTurn,
            });
            return jsonResponse({
                session_id: chatSessionId,
                title,
                choices: [{ message: { content: displayText } }],
                action_data: actions.length === 1 ? actions[0] : actions,
                actions,
            });
        }

        const readable = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder();
                let full = '';

                try {
                    controller.enqueue(
                        encoder.encode(sseEvent({ type: 'session', session_id: chatSessionId })),
                    );

                    try {
                        for await (const chunk of streamCoachReply(model, messages, coachContext)) {
                            full += chunk;
                            const visible = stripActionMarkers(full);
                            controller.enqueue(
                                encoder.encode(sseEvent({ type: 'token', text: chunk, visible })),
                            );
                        }
                    } catch (streamErr) {
                        console.warn('[ai-coach-chat] stream failed, using non-stream', streamErr);
                        full = await geminiGenerate({
                            model,
                            systemInstruction: buildCoachSystemPrompt(coachContext),
                            contents: toGeminiContents(messages),
                        });
                        const visible = stripActionMarkers(full);
                        controller.enqueue(
                            encoder.encode(sseEvent({ type: 'token', text: full, visible })),
                        );
                    }

                    if (!full.trim()) {
                        full = await geminiGenerate({
                            model,
                            systemInstruction: buildCoachSystemPrompt(coachContext),
                            contents: toGeminiContents(messages),
                        });
                        const visible = stripActionMarkers(full);
                        controller.enqueue(
                            encoder.encode(sseEvent({ type: 'token', text: full, visible })),
                        );
                    }

                    const { text, actions } = parseActionsFromContent(full);
                    const displayText = stripActionMarkers(text) || text;

                    const { title } = await saveChatTurn({
                        admin,
                        sessionId: chatSessionId,
                        userId: auth.user.id,
                        model,
                        userMessage,
                        assistantText: displayText,
                        actions,
                        isFirstTurn,
                    });

                    controller.enqueue(
                        encoder.encode(
                            sseEvent({
                                type: 'done',
                                session_id: chatSessionId,
                                title,
                                content: displayText,
                                actions,
                                action_data: actions.length === 1 ? actions[0] : actions,
                            }),
                        ),
                    );
                } catch (err) {
                    const message = err instanceof Error ? err.message : 'Stream failed';
                    controller.enqueue(
                        encoder.encode(sseEvent({ type: 'error', error: message })),
                    );
                } finally {
                    controller.close();
                }
            },
        });

        return new Response(readable, { headers: SSE_HEADERS });
    } catch (err) {
        const status = (err as { status?: number }).status ?? 500;
        const message = err instanceof Error ? err.message : 'AI Coach request failed';
        console.error('[ai-coach-chat]', err);
        return jsonResponse({ error: message }, status);
    }
});
