import { supabase } from './supabase';

/** Background-safe focus presence + weekly minutes sync. */
export async function sendSocialHeartbeat(opts: {
    focusing: boolean;
    endsAt?: string | null;
    focusMinutesDelta?: number;
}): Promise<void> {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;
        await supabase.rpc('heartbeat_focus_session', {
            p_focusing: opts.focusing,
            p_ends_at: opts.endsAt ?? null,
            p_focus_minutes_delta: opts.focusMinutesDelta ?? 0,
        });
    } catch (e) {
        console.warn('[Social] heartbeat failed', e);
    }
}
