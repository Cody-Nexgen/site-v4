import { corsHeaders, getUserFromAuthHeader, jsonResponse } from '../_shared/stripeBilling.ts';
import { buildPreview, sanitizeUrl } from './preview.ts';

// Link previews for Lists bookmarks. Fetching happens server-side so the client
// never deals with CORS; every fetch is time-boxed, size-capped and refuses
// private hosts (including via redirects). See preview.ts for the sources used.

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
        if (!supabaseUrl || !supabaseAnonKey) {
            return jsonResponse({ error: 'Server configuration is incomplete.' }, 500);
        }

        const auth = await getUserFromAuthHeader(req, supabaseAnonKey, supabaseUrl);
        if ('error' in auth) {
            return jsonResponse({ error: 'NOT_AUTHENTICATED' }, 401);
        }

        const body = await req.json().catch(() => ({}));
        const target = sanitizeUrl(body?.url);
        if (!target) {
            return jsonResponse({ error: 'A valid http(s) URL is required.' }, 400);
        }

        return jsonResponse(await buildPreview(target));
    } catch (err) {
        console.error('[link-preview]', err);
        return jsonResponse({ error: 'Could not preview that link.' }, 500);
    }
});
