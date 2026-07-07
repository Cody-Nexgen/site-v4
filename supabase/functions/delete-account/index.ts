import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders, getUserFromAuthHeader, jsonResponse } from '../_shared/stripeBilling.ts';

async function deleteUserDataInline(admin: SupabaseClient, userId: string) {
    const { data: sessions } = await admin
        .from('ai_chat_sessions')
        .select('id')
        .eq('user_id', userId);

    if (sessions?.length) {
        const sessionIds = sessions.map((s) => s.id as string);
        await admin.from('ai_chat_messages').delete().in('session_id', sessionIds);
        await admin.from('ai_chat_sessions').delete().eq('user_id', userId);
    }

    await admin.from('subscriptions').delete().eq('user_id', userId);

    const { data: links } = await admin
        .from('scheduling_links')
        .select('id')
        .eq('user_id', userId);

    if (links?.length) {
        const linkIds = links.map((row) => row.id as string);
        await admin.from('scheduling_bookings').delete().in('link_id', linkIds);
    }

    await admin.from('scheduling_links').delete().eq('user_id', userId);
    await admin.from('profiles').delete().eq('id', userId);
}

async function deleteUserData(admin: SupabaseClient, userId: string) {
    const { error: rpcError } = await admin.rpc('delete_account_data', {
        p_user_id: userId,
    });

    if (!rpcError) return;

    console.warn('[delete-account] RPC failed, using inline cleanup:', rpcError.message);
    await deleteUserDataInline(admin, userId);
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
        const userId = auth.user.id;

        await deleteUserData(admin, userId);

        const { error: deleteError } = await admin.auth.admin.deleteUser(userId);

        if (deleteError) {
            console.error('[delete-account] deleteUser failed', deleteError);
            return jsonResponse({ error: deleteError.message || 'Could not delete account.' }, 500);
        }

        return jsonResponse({ ok: true });
    } catch (err) {
        console.error('[delete-account]', err);
        return jsonResponse({ error: 'Could not delete account.' }, 500);
    }
});
