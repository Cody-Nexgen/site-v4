// Vertex AI (express mode): Google's Gemini models, called with a Vertex API key in GEMINI_API_KEY.
// Same request and response shapes as the Gemini API; only the address differs.
const GEMINI_API_BASE = 'https://aiplatform.googleapis.com/v1/publishers/google';

export type GeminiPart =
    | { text: string }
    | { inlineData: { mimeType: string; data: string } };

export type GeminiContent = {
    role: 'user' | 'model';
    parts: GeminiPart[];
};

function getGeminiApiKey(): string {
    const key = Deno.env.get('GEMINI_API_KEY');
    if (!key) {
        throw new Error('GEMINI_API_KEY is not configured');
    }
    return key;
}

function modelUrl(model: string, stream: boolean): string {
    const base = `${GEMINI_API_BASE}/models/${model}`;
    if (stream) return `${base}:streamGenerateContent?alt=sse`;
    return `${base}:generateContent`;
}

function geminiHeaders(): Record<string, string> {
    return {
        'Content-Type': 'application/json',
        'x-goog-api-key': getGeminiApiKey(),
    };
}

/** Token counts Gemini reports in `usageMetadata`. */
export type GeminiUsage = { input: number; output: number; total: number };

function usageFromGemini(parsed: Record<string, unknown>): GeminiUsage | null {
    const u = parsed.usageMetadata as
        | { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number; totalTokenCount?: number }
        | undefined;
    if (!u || typeof u.totalTokenCount !== 'number') return null;
    const input = u.promptTokenCount ?? 0;
    return { input, output: u.totalTokenCount - input, total: u.totalTokenCount };
}

function* textFromGeminiChunk(parsed: Record<string, unknown>): Generator<string> {
    const candidates = parsed.candidates as Array<Record<string, unknown>> | undefined;
    if (!candidates?.length) return;
    const content = candidates[0].content as { parts?: Array<{ text?: string }> } | undefined;
    const parts = content?.parts ?? [];
    for (const part of parts) {
        if (part.text) yield part.text;
    }
}

export async function geminiGenerateWithMeta(opts: {
    model: string;
    systemInstruction: string;
    contents: GeminiContent[];
    maxOutputTokens?: number;
    temperature?: number;
    thinkingBudget?: number;
}): Promise<{ text: string; finishReason?: string; usage: GeminiUsage | null }> {
    const res = await fetch(modelUrl(opts.model, false), {
        method: 'POST',
        headers: geminiHeaders(),
        body: JSON.stringify({
            systemInstruction: { parts: [{ text: opts.systemInstruction }] },
            contents: opts.contents,
            generationConfig: {
                temperature: opts.temperature ?? 0.55,
                maxOutputTokens: opts.maxOutputTokens ?? 2048,
                ...(opts.thinkingBudget !== undefined
                    ? { thinkingConfig: { thinkingBudget: opts.thinkingBudget } }
                    : {}),
            },
        }),
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(
            data.error?.message || data.error || `Gemini API failed (${res.status})`,
        );
    }

    const candidate = data.candidates?.[0] ?? {};
    const parts = candidate.content?.parts ?? [];
    const text = parts.map((p: { text?: string }) => p.text || '').join('').trim();
    const finishReason = candidate.finishReason as string | undefined;
    if (!text) throw new Error('Empty response from Gemini API');
    return { text, finishReason, usage: usageFromGemini(data) };
}

export async function geminiGenerate(opts: {
    model: string;
    systemInstruction: string;
    contents: GeminiContent[];
    maxOutputTokens?: number;
    temperature?: number;
    thinkingBudget?: number;
}): Promise<string> {
    const { text } = await geminiGenerateWithMeta(opts);
    return text;
}

/** Yields text deltas from Gemini streamGenerateContent. */
export async function* geminiStreamGenerate(opts: {
    model: string;
    systemInstruction: string;
    contents: GeminiContent[];
    maxOutputTokens?: number;
    temperature?: number;
    thinkingBudget?: number;
    /** Called with Gemini's running token counts (the last call is the final total). */
    onUsage?: (usage: GeminiUsage) => void;
}): AsyncGenerator<string> {
    const res = await fetch(modelUrl(opts.model, true), {
        method: 'POST',
        headers: geminiHeaders(),
        body: JSON.stringify({
            systemInstruction: { parts: [{ text: opts.systemInstruction }] },
            contents: opts.contents,
            generationConfig: {
                temperature: opts.temperature ?? 0.55,
                maxOutputTokens: opts.maxOutputTokens ?? 2048,
                ...(opts.thinkingBudget !== undefined
                    ? { thinkingConfig: { thinkingBudget: opts.thinkingBudget } }
                    : {}),
            },
        }),
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini stream failed (${res.status}): ${errText.slice(0, 200)}`);
    }

    if (!res.body) throw new Error('Gemini stream returned no body');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let yielded = false;

    const processBuffer = function* (flush: boolean) {
        const chunks = buffer.split('\n\n');
        const rest = flush ? chunks : chunks.slice(0, -1);
        if (!flush) buffer = chunks[chunks.length - 1] || '';

        for (const block of rest) {
            for (const line of block.split('\n')) {
                const trimmed = line.trim();
                if (!trimmed.startsWith('data:')) continue;
                const data = trimmed.slice(5).trim();
                if (!data || data === '[DONE]') continue;
                try {
                    const parsed = JSON.parse(data) as Record<string, unknown>;
                    const usage = usageFromGemini(parsed);
                    if (usage) opts.onUsage?.(usage);
                    for (const text of textFromGeminiChunk(parsed)) {
                        yielded = true;
                        yield text;
                    }
                } catch {
                    /* partial SSE chunk */
                }
            }
        }
        if (flush) buffer = '';
    };

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        yield* processBuffer(false);
    }

    buffer += decoder.decode();
    yield* processBuffer(true);

    if (!yielded) {
        throw new Error(
            'Gemini API stream returned no text. Confirm GEMINI_API_KEY is valid and the model name is supported.',
        );
    }
}
