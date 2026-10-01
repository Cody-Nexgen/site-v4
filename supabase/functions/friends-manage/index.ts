// friends-manage — friendship actions the SQL RPCs don't cover.
//
//   { action: 'sent' }                      → pending requests I sent
//   { action: 'cancel', friendshipId }       → withdraw one of my pending requests
//   { action: 'remove', userId }             → unfriend someone
//
// The caller is identified from their JWT; every query is scoped to
// friendships that caller is part of, so nobody can touch other rows.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders, getUserFromAuthHeader, jsonResponse } from '../_shared/stripeBilling.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'METHOD_NOT_ALLOWED' }, 405);

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
            return jsonResponse({ ok: false, error: 'SERVER_MISCONFIGURED' }, 500);
        }

        const auth = await getUserFromAuthHeader(req, supabaseAnonKey, supabaseUrl);
        if ('error' in auth) return jsonResponse({ ok: false, error: 'NOT_AUTHENTICATED' }, 401);
        const uid = auth.user.id;

        const body = (await req.json().catch(() => ({}))) as { action?: string; friendshipId?: string; userId?: string };
        const admin = createClient(supabaseUrl, serviceRoleKey);

        if (body.action === 'sent') {
            const { data: rows, error } = await admin
                .from('friendships')
                .select('id, addressee_id, created_at')
                .eq('requester_id', uid)
                .eq('status', 'pending')
                .order('created_at', { ascending: false })
                .limit(100);
            if (error) throw error;
            const ids = (rows ?? []).map((r) => r.addressee_id as string);
            const { data: profiles } = ids.length
                ? await admin.from('profiles').select('id, username, display_name, avatar_url').in('id', ids)
                : { data: [] };
            const byId = new Map((profiles ?? []).map((p) => [p.id as string, p]));
            const sent = (rows ?? []).map((r) => {
                const p = byId.get(r.addressee_id as string);
                const username = (p?.username as string | null) || 'user';
                return {
                    friendshipId: r.id,
                    username,
                    displayName: (p?.display_name as string | null) || username,
                    avatarUrl: (p?.avatar_url as string | null) ?? null,
                    sentAt: r.created_at,
                };
            });
            return jsonResponse({ ok: true, sent });
        }

        if (body.action === 'cancel') {
            if (!body.friendshipId || !UUID.test(body.friendshipId)) return jsonResponse({ ok: false, error: 'BAD_REQUEST' }, 400);
            const { data, error } = await admin
                .from('friendships')
                .delete()
                .eq('id', body.friendshipId)
                .eq('requester_id', uid)
                .eq('status', 'pending')
                .select('id');
            if (error) throw error;
            return jsonResponse(data?.length ? { ok: true } : { ok: false, error: 'NOT_FOUND' });
        }

        if (body.action === 'remove') {
            if (!body.userId || !UUID.test(body.userId)) return jsonResponse({ ok: false, error: 'BAD_REQUEST' }, 400);
            const { data, error } = await admin
                .from('friendships')
                .delete()
                .eq('status', 'accepted')
                .or(`and(requester_id.eq.${uid},addressee_id.eq.${body.userId}),and(requester_id.eq.${body.userId},addressee_id.eq.${uid})`)
                .select('id');
            if (error) throw error;
            return jsonResponse(data?.length ? { ok: true } : { ok: false, error: 'NOT_FOUND' });
        }

        return jsonResponse({ ok: false, error: 'UNKNOWN_ACTION' }, 400);
    } catch (err) {
        console.error('[friends-manage]', err);
        return jsonResponse({ ok: false, error: 'SERVER_ERROR' }, 500);
    }
});
