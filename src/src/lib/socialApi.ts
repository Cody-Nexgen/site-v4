import type { SupabaseClient } from '@supabase/supabase-js';
import { attachSupabaseSession } from './profileApi';

export type FriendEntry = {
    userId: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    streak: number;
    isFocusing: boolean;
    sessionEndsAt: string | null;
    weeklyFocusMinutes: number;
    level: number;
};

export type PendingFriendRequest = {
    friendshipId: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
};

function normalizePending(raw: unknown): PendingFriendRequest[] {
    if (!Array.isArray(raw)) return [];
    return raw
        .map((item) => {
            const row = item as Record<string, unknown>;
            const friendshipId = String(row.friendshipId ?? row.friendship_id ?? '');
            if (!friendshipId) return null;
            return {
                friendshipId,
                username: String(row.username ?? 'user'),
                displayName: String(row.displayName ?? row.display_name ?? row.username ?? 'FocuzNow user'),
                avatarUrl: (row.avatarUrl ?? row.avatar_url ?? null) as string | null,
            };
        })
        .filter((item): item is PendingFriendRequest => item != null);
}

export type LeaderboardEntry = {
    username: string;
    displayName: string;
    avatarUrl: string | null;
    weeklyFocusMinutes: number;
    isMe: boolean;
};

export async function sendFriendRequest(
    supabase: SupabaseClient,
    username: string,
    tokens?: { access_token: string; refresh_token: string } | null,
): Promise<{ ok: boolean; error?: string }> {
    const auth = await attachSupabaseSession(supabase, tokens);
    if (!auth.ok) return { ok: false, error: 'NOT_AUTHENTICATED' };
    const { data, error } = await supabase.rpc('send_friend_request', { p_username: username });
    if (error) return { ok: false, error: error.message };
    const row = data as { ok?: boolean; error?: string } | null;
    return row?.ok ? { ok: true } : { ok: false, error: row?.error ?? 'REQUEST_FAILED' };
}

export async function respondFriendRequest(
    supabase: SupabaseClient,
    friendshipId: string,
    accept: boolean,
    tokens?: { access_token: string; refresh_token: string } | null,
): Promise<{ ok: boolean; error?: string }> {
    const auth = await attachSupabaseSession(supabase, tokens);
    if (!auth.ok) return { ok: false, error: 'NOT_AUTHENTICATED' };
    const { data, error } = await supabase.rpc('respond_friend_request', {
        p_friendship_id: friendshipId,
        p_accept: accept,
    });
    if (error) return { ok: false, error: error.message };
    const row = data as { ok?: boolean; error?: string } | null;
    return row?.ok ? { ok: true } : { ok: false, error: row?.error ?? 'RESPONSE_FAILED' };
}

export async function listMyFriends(
    supabase: SupabaseClient,
    tokens?: { access_token: string; refresh_token: string } | null,
): Promise<{ ok: boolean; friends: FriendEntry[]; pending: PendingFriendRequest[]; error?: string }> {
    const auth = await attachSupabaseSession(supabase, tokens);
    if (!auth.ok) return { ok: false, friends: [], pending: [], error: 'NOT_AUTHENTICATED' };
    const { data, error } = await supabase.rpc('list_my_friends');
    if (error) return { ok: false, friends: [], pending: [], error: error.message };
    const row = data as {
        ok?: boolean;
        friends?: FriendEntry[];
        pending?: PendingFriendRequest[];
        error?: string;
    } | null;
    if (!row?.ok) return { ok: false, friends: [], pending: [], error: row?.error ?? 'LOAD_FAILED' };
    return {
        ok: true,
        friends: row.friends ?? [],
        pending: normalizePending(row.pending),
    };
}

export async function getFriendsWeeklyLeaderboard(
    supabase: SupabaseClient,
    tokens?: { access_token: string; refresh_token: string } | null,
): Promise<{ ok: boolean; leaderboard: LeaderboardEntry[]; error?: string }> {
    const auth = await attachSupabaseSession(supabase, tokens);
    if (!auth.ok) return { ok: false, leaderboard: [], error: 'NOT_AUTHENTICATED' };
    const { data, error } = await supabase.rpc('get_friends_weekly_leaderboard');
    if (error) return { ok: false, leaderboard: [], error: error.message };
    const row = data as { ok?: boolean; leaderboard?: LeaderboardEntry[]; error?: string } | null;
    if (!row?.ok) return { ok: false, leaderboard: [], error: row?.error ?? 'LOAD_FAILED' };
    return { ok: true, leaderboard: row.leaderboard ?? [] };
}

export async function heartbeatFocusSession(
    supabase: SupabaseClient,
    opts: { focusing: boolean; endsAt?: string | null; focusMinutesDelta?: number },
    tokens?: { access_token: string; refresh_token: string } | null,
): Promise<void> {
    const auth = await attachSupabaseSession(supabase, tokens);
    if (!auth.ok) return;
    await supabase.rpc('heartbeat_focus_session', {
        p_focusing: opts.focusing,
        p_ends_at: opts.endsAt ?? null,
        p_focus_minutes_delta: opts.focusMinutesDelta ?? 0,
    });
}

export const AUTO_SCHEDULE_COACH_PROMPT = `Analyze my daily goal, planner tasks, habits, calendar events, and recent focus patterns. Build an optimal deep work schedule for today with realistic time blocks.

Use these actions:
- daily_goal_set if my goal should change
- planner_set to populate my daily planner (time, task, durationMin)
- calendar_add_events for focus blocks on my calendar

Prioritize high-impact work in my peak hours. Keep blocks 25–90 minutes. Explain your plan briefly, then emit the actions.`;
