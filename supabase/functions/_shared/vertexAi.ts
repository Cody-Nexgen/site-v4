import { getGoogleAccessTokenFromServiceAccount, projectIdFromServiceAccount } from './googleAuth.ts';

export type VertexContent = {
    role: 'user' | 'model';
    parts: { text: string }[];
};

export function getVertexConfig() {
    const saJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON');
    if (!saJson) {
        throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not configured');
    }
    const projectId =
        Deno.env.get('GOOGLE_CLOUD_PROJECT_ID') || projectIdFromServiceAccount(saJson);
    const location = Deno.env.get('GOOGLE_CLOUD_LOCATION') || 'us-central1';
    if (!projectId) {
        throw new Error('GOOGLE_CLOUD_PROJECT_ID is not configured');
    }
    return { saJson, projectId, location };
}

function modelUrl(model: string, stream: boolean, projectId: string, location: string) {
    const base =
        `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}`;
    if (stream) return `${base}:streamGenerateContent?alt=sse`;
    return `${base}:generateContent`;
}

function* textFromVertexChunk(parsed: Record<string, unknown>): Generator<string> {
    const candidates = parsed.candidates as Array<Record<string, unknown>> | undefined;
    if (!candidates?.length) return;
    const content = candidates[0].content as { parts?: Array<{ text?: string }> } | undefined;
    const parts = content?.parts ?? [];
    for (const part of parts) {
        if (part.text) yield part.text;
    }
}

export async function vertexGenerate(opts: {
    model: string;
    systemInstruction: string;
    contents: VertexContent[];
    maxOutputTokens?: number;
    temperature?: number;
}): Promise<string> {
    const { projectId, location } = getVertexConfig();
    const token = await getGoogleAccessTokenFromServiceAccount(
        Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')!,
    );

    const res = await fetch(modelUrl(opts.model, false, projectId, location), {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
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
            data.error?.message || data.error || `Vertex AI failed (${res.status})`,
        );
    }

    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const text = parts.map((p: { text?: string }) => p.text || '').join('').trim();
    if (!text) throw new Error('Empty response from Vertex AI');
    return text;
}

/** Yields text deltas from Vertex streamGenerateContent. */
export async function* vertexStreamGenerate(opts: {
    model: string;
    systemInstruction: string;
    contents: VertexContent[];
    maxOutputTokens?: number;
    temperature?: number;
}): AsyncGenerator<string> {
    const { projectId, location } = getVertexConfig();
    const token = await getGoogleAccessTokenFromServiceAccount(
        Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')!,
    );

    const res = await fetch(modelUrl(opts.model, true, projectId, location), {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
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
        throw new Error(`Vertex stream failed (${res.status}): ${errText.slice(0, 200)}`);
    }

    if (!res.body) throw new Error('Vertex stream returned no body');

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
                    for (const text of textFromVertexChunk(parsed)) {
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
            'Vertex AI stream returned no text. Confirm the Vertex AI API is enabled and the model name is valid for your region.',
        );
    }
}
