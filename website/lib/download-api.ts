import { createClient } from '@supabase/supabase-js';

const RELEASE_BUCKET = 'releases';
const RELEASE_FILE = 'focuznow-latest.zip';
const SIGNED_URL_TTL_SECONDS = 60;

function getEnv(name: string): string | undefined {
    if (typeof process !== 'undefined' && process.env?.[name]) {
        return process.env[name];
    }
    return undefined;
}

export async function handleDownloadRequest(
    request: Request,
): Promise<Response> {
    const supabaseUrl =
        getEnv('SUPABASE_URL') ||
        getEnv('VITE_SUPABASE_URL') ||
        getEnv('NEXT_PUBLIC_SUPABASE_URL');
    const supabaseAnonKey =
        getEnv('SUPABASE_ANON_KEY') ||
        getEnv('VITE_SUPABASE_ANON_KEY') ||
        getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
        return new Response('Download service is not configured.', { status: 503 });
    }

    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ')
        ? authHeader.slice('Bearer '.length).trim()
        : null;

    if (!token) {
        return new Response('Authentication required.', { status: 401 });
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
        data: { user },
        error: userError,
    } = await authClient.auth.getUser(token);

    if (userError || !user) {
        return new Response('Invalid or expired session.', { status: 401 });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: profile, error: profileError } = await adminClient
        .from('profiles')
        .select('is_approved')
        .eq('id', user.id)
        .maybeSingle();

    if (profileError) {
        console.error('[api/download] profile lookup failed:', profileError.message);
        return new Response('Unable to verify beta access.', { status: 500 });
    }

    if (!profile?.is_approved) {
        return new Response('Beta access not approved yet.', { status: 403 });
    }

    const { data: signed, error: signError } = await adminClient.storage
        .from(RELEASE_BUCKET)
        .createSignedUrl(RELEASE_FILE, SIGNED_URL_TTL_SECONDS);

    if (signError || !signed?.signedUrl) {
        console.error('[api/download] signed URL failed:', signError?.message);
        return new Response('Release file is unavailable.', { status: 500 });
    }

    return Response.redirect(signed.signedUrl, 302);
}
