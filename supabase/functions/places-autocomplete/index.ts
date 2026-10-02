import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

/**
 * Address suggestions for FocuzPass identity items, through Google Places (New).
 *
 * The API key stays here (Supabase secret GOOGLE_PLACES_API_KEY), never in the extension or site.
 * Callers send one session token per typing session and reuse it for the details request, so
 * Google bills the whole session once instead of every keystroke. Only signed-in users may call
 * this, and each user is limited per minute.
 *
 *   POST { action: 'autocomplete', input, sessionToken } -> { suggestions: [{ placeId, main, secondary }] }
 *   POST { action: 'details', placeId, sessionToken }    -> { address: { formatted, addressLine1, … } }
 */

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PLACES = 'https://places.googleapis.com/v1';
const TOKEN = /^[A-Za-z0-9_-]{16,64}$/;
const PLACE_ID = /^[A-Za-z0-9_-]{10,300}$/;
const PER_MINUTE = 60;

function jsonResponse(body: Record<string, unknown>, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// Per-instance safety net against a runaway client; Google's own quota is the real limit.
const recent = new Map<string, number[]>();
function allowed(userId: string): boolean {
    const now = Date.now();
    const hits = (recent.get(userId) ?? []).filter((t) => now - t < 60_000);
    if (hits.length >= PER_MINUTE) return false;
    hits.push(now);
    recent.set(userId, hits);
    if (recent.size > 5000) recent.clear();
    return true;
}

type Component = { longText?: string; shortText?: string; types?: string[] };

function addressFrom(place: { formattedAddress?: string; addressComponents?: Component[] }) {
    const parts = place.addressComponents ?? [];
    const get = (type: string, short = false) => {
        const part = parts.find((p) => p.types?.includes(type));
        return (short ? part?.shortText : part?.longText) ?? '';
    };
    const street = [get('street_number'), get('route')].filter(Boolean).join(' ');
    const postal = [get('postal_code'), get('postal_code_suffix')].filter(Boolean).join('-');
    return {
        formatted: place.formattedAddress ?? '',
        addressLine1: street || get('premise'),
        addressLine2: get('subpremise'),
        city: get('locality') || get('postal_town') || get('sublocality') || get('administrative_area_level_2'),
        region: get('administrative_area_level_1', true) || get('administrative_area_level_1'),
        postalCode: postal,
        country: get('country'),
        countryCode: get('country', true),
    };
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
        const key = Deno.env.get('GOOGLE_PLACES_API_KEY');
        if (!supabaseUrl || !supabaseAnonKey) return jsonResponse({ error: 'Server misconfigured' }, 500);
        if (!key) return jsonResponse({ error: 'Address suggestions aren\'t set up yet.', code: 'not_configured' }, 503);

        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) return jsonResponse({ error: 'Unauthorized' }, 401);
        const supabase = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) return jsonResponse({ error: 'Unauthorized' }, 401);
        if (!allowed(user.id)) return jsonResponse({ error: 'Too many requests' }, 429);

        const body = await req.json().catch(() => ({})) as { action?: string; input?: string; sessionToken?: string; placeId?: string };
        const sessionToken = String(body.sessionToken ?? '');
        if (!TOKEN.test(sessionToken)) return jsonResponse({ error: 'Invalid session token' }, 400);

        if (body.action === 'autocomplete') {
            const input = String(body.input ?? '').trim().slice(0, 120);
            if (input.length < 3) return jsonResponse({ suggestions: [] });
            const res = await fetch(`${PLACES}/places:autocomplete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key },
                body: JSON.stringify({ input, sessionToken, includedPrimaryTypes: ['street_address', 'premise', 'subpremise', 'route'] }),
            });
            if (!res.ok) return jsonResponse({ error: 'Address lookup failed' }, 502);
            const data = await res.json() as {
                suggestions?: { placePrediction?: { placeId?: string; structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } }; text?: { text?: string } } }[];
            };
            const suggestions = (data.suggestions ?? [])
                .map((s) => s.placePrediction)
                .filter((p): p is NonNullable<typeof p> => Boolean(p?.placeId))
                .slice(0, 5)
                .map((p) => ({
                    placeId: p.placeId,
                    main: p.structuredFormat?.mainText?.text ?? p.text?.text ?? '',
                    secondary: p.structuredFormat?.secondaryText?.text ?? '',
                }));
            return jsonResponse({ suggestions });
        }

        if (body.action === 'details') {
            const placeId = String(body.placeId ?? '');
            if (!PLACE_ID.test(placeId)) return jsonResponse({ error: 'Invalid place' }, 400);
            const res = await fetch(`${PLACES}/places/${encodeURIComponent(placeId)}?sessionToken=${encodeURIComponent(sessionToken)}`, {
                // Only the address: the cheapest fields, nothing else about the place.
                headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'formattedAddress,addressComponents' },
            });
            if (!res.ok) return jsonResponse({ error: 'Address lookup failed' }, 502);
            return jsonResponse({ address: addressFrom(await res.json()) });
        }

        return jsonResponse({ error: 'Unknown action' }, 400);
    } catch (error) {
        console.error('[places-autocomplete]', error);
        return jsonResponse({ error: 'Address lookup failed' }, 500);
    }
});
