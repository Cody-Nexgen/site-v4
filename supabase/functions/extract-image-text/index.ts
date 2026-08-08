import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { geminiGenerate, type GeminiContent } from '../_shared/geminiAi.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
}

function parseDataUrl(imageDataUrl: string): { mimeType: string; data: string } | null {
    const match = imageDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/);
    if (!match) return null;
    return { mimeType: match[1], data: match[2].replace(/\s+/g, '') };
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
        if (!supabaseUrl || !supabaseAnonKey) {
            return jsonResponse({ error: 'Server misconfigured' }, 500);
        }
        if (!Deno.env.get('GEMINI_API_KEY')) {
            return jsonResponse({ error: 'Server AI configuration is incomplete.' }, 500);
        }

        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return jsonResponse({ error: 'Unauthorized' }, 401);
        }

        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } },
        });
        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser();
        if (userError || !user) return jsonResponse({ error: 'Unauthorized' }, 401);

        const body = await req.json().catch(() => ({})) as { imageDataUrl?: string };
        const imageDataUrl = String(body.imageDataUrl || '').trim();
        if (!imageDataUrl.startsWith('data:image/')) {
            return jsonResponse({ error: 'imageDataUrl must be a data:image/* URL' }, 400);
        }

        const parsed = parseDataUrl(imageDataUrl);
        if (!parsed) {
            return jsonResponse({ error: 'Invalid image data URL' }, 400);
        }

        // Cap ~4MB raw base64 to stay under edge/runtime limits
        if (parsed.data.length > 5_500_000) {
            return jsonResponse({ error: 'Image too large. Try a smaller screenshot.' }, 413);
        }

        const contents: GeminiContent[] = [
            {
                role: 'user',
                parts: [
                    {
                        text:
                            'Extract ALL readable text from this image exactly. Preserve line breaks when helpful. ' +
                            'If there is stylized logo text, still transcribe the letters. ' +
                            'If there is truly no text, reply with exactly: (no readable text)',
                    },
                    {
                        inlineData: {
                            mimeType: parsed.mimeType,
                            data: parsed.data,
                        },
                    },
                ],
            },
        ];

        const text = await geminiGenerate({
            model: 'gemini-2.5-flash',
            systemInstruction:
                'You are an OCR engine. Return only the text found in the image. Do not refuse. Do not say you cannot see images.',
            contents,
            maxOutputTokens: 1200,
            temperature: 0.1,
        });

        return jsonResponse({ ok: true, text: text.trim() });
    } catch (err) {
        console.error('[extract-image-text]', err);
        return jsonResponse(
            { error: err instanceof Error ? err.message : 'Failed to extract text' },
            500,
        );
    }
});
