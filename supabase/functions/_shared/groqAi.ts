const GROQ_API_BASE = 'https://api.groq.com/openai/v1';

function getGroqApiKey(): string {
    const key = Deno.env.get('GROQ_API_KEY');
    if (!key) {
        throw new Error('GROQ_API_KEY is not configured');
    }
    return key;
}

export type GroqMessage = {
    role: 'system' | 'user' | 'assistant';
    content: string | Array<
        | { type: 'text'; text: string }
        | { type: 'image_url'; image_url: { url: string } }
    >;
};

/** Non-streaming chat completion against Groq's OpenAI-compatible API. */
export async function groqChat(opts: {
    model: string;
    messages: GroqMessage[];
    temperature?: number;
    maxTokens?: number;
    responseFormat?: 'json_object';
}): Promise<string> {
    const res = await fetch(`${GROQ_API_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getGroqApiKey()}`,
        },
        body: JSON.stringify({
            model: opts.model,
            messages: opts.messages,
            temperature: opts.temperature ?? 0.2,
            max_tokens: opts.maxTokens ?? 200,
            ...(opts.responseFormat ? { response_format: { type: opts.responseFormat } } : {}),
        }),
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(
            data?.error?.message || data?.error || `Groq API failed (${res.status})`,
        );
    }

    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('Empty response from Groq API');
    return text;
}
