import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders, getUserFromAuthHeader, jsonResponse, userHasProAccess } from '../_shared/stripeBilling.ts';
import { groqChat } from '../_shared/groqAi.ts';

const GROQ_MODEL = 'llama-3.3-70b-versatile';
const DOMAIN_RE = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?:\/\S*)?$/i;

function extractJson(raw: string): Record<string, unknown> | null {
    const trimmed = raw.trim();
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fenced ? fenced[1] : trimmed;
    try {
        return JSON.parse(candidate);
    } catch {
        const match = candidate.match(/\{[\s\S]*\}/);
        if (!match) return null;
        try {
            return JSON.parse(match[0]);
        } catch {
            return null;
        }
    }
}

function sanitizeDomain(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const cleaned = value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '');
    if (!cleaned || !DOMAIN_RE.test(cleaned)) return null;
    return cleaned;
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

        const admin = createClient(supabaseUrl, serviceRoleKey);
        const hasPro = await userHasProAccess(admin, auth.user.id, auth.user.email ?? undefined);
        if (!hasPro) {
            return jsonResponse(
                { error: 'AI site lookup is a Pro feature. Upgrade to continue.', code: 'PRO_REQUIRED' },
                403,
            );
        }

        const body = await req.json().catch(() => ({}));
        const query = typeof body?.query === 'string' ? body.query.trim().slice(0, 200) : '';
        if (!query) {
            return jsonResponse({ error: 'A site name or description is required.' }, 400);
        }

        if (!Deno.env.get('GROQ_API_KEY')) {
            return jsonResponse({ error: 'Server AI configuration is incomplete.' }, 500);
        }

        let raw: string;
        try {
            raw = await groqChat({
                model: GROQ_MODEL,
                temperature: 0.1,
                maxTokens: 100,
                responseFormat: 'json_object',
                messages: [
                    {
                        role: 'system',
                        content:
                            'You turn a short, informal description of a website into its real domain. ' +
                            'Reply with ONLY a JSON object of the form {"domain":"example.com","url":"https://www.example.com"}. ' +
                            'Use the most well-known, official site for the query. No markdown, no extra text.',
                    },
                    { role: 'user', content: query },
                ],
            });
        } catch (err) {
            console.error('[resolve-site-query] Groq request failed', err);
            return jsonResponse({ error: 'Could not reach the AI site resolver.' }, 502);
        }

        const parsed = extractJson(raw);
        const domain = sanitizeDomain(parsed?.domain);
        if (!domain) {
            return jsonResponse({ error: `Could not find a site for "${query}".` }, 422);
        }

        const url = typeof parsed?.url === 'string' && /^https?:\/\//i.test(parsed.url)
            ? parsed.url
            : `https://${domain}`;

        return jsonResponse({ domain, url });
    } catch (err) {
        console.error('[resolve-site-query]', err);
        return jsonResponse({ error: 'Could not resolve that site.' }, 500);
    }
});
