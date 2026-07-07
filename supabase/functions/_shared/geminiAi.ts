const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export type GeminiContent = {
    role: 'user' | 'model';
    parts: { text: string }[];
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

function* textFromGeminiChunk(parsed: Record<string, unknown>): Generator<string> {
    const candidates = parsed.candidates as Array<Record<string, unknown>> | undefined;
    if (!candidates?.length) return;
    const content = candidates[0].content as { parts?: Array<{ text?: string }> } | undefined;
    const parts = content?.parts ?? [];
    for (const part of parts) {
        if (part.text) yield part.text;
    }
}

export async function geminiGenerate(opts: {
    model: string;
    systemInstruction: string;
    contents: GeminiContent[];
    maxOutputTokens?: number;
    temperature?: number;
}): Promise<string> {
    const res = await fetch(modelUrl(opts.model, false), {
        method: 'POST',
        headers: geminiHeaders(),
        body: JSON.stringify({
            systemInstruction: { parts: [{ text: opts.systemInstruction }] },
            contents: opts.contents,
            generationConfig: {
                temperature: opts.temperature ?? 0.55,
                maxOutputTokens: opts.maxOutputTokens ?? 2048,
            },
        }),
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(
            data.error?.message || data.error || `Gemini API failed (${res.status})`,
        );
    }

    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const text = parts.map((p: { text?: string }) => p.text || '').join('').trim();
    if (!text) throw new Error('Empty response from Gemini API');
    return text;
}

/** Yields text deltas from Gemini streamGenerateContent. */
export async function* geminiStreamGenerate(opts: {
    model: string;
    systemInstruction: string;
    contents: GeminiContent[];
    maxOutputTokens?: number;
    temperature?: number;
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
