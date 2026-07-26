import type { SupabaseClient } from '@supabase/supabase-js';
import { attachSupabaseSession } from './profileApi';
import {
    buildPublicFocusStats,
    loadProgressionState,
    type FocusProgressionState,
} from './focusProgression';

export type PublicFocusProfile = {
    username: string;
    displayName: string;
    avatarUrl: string | null;
    stats: {
        level: number;
        rank: string;
        xp: number;
        focusScore: number;
        longestStreak: number;
        hoursFocused: number;
        totalPomodoros: number;
        achievementsUnlocked: number;
        challengesCompleted: number;
        equippedFrame: string | null;
        equippedBadge: string | null;
        updatedAt: string;
    };
};

export async function syncPublicFocusProfile(
    supabase: SupabaseClient,
    input: {
        focusScore: number;
        longestStreak: number;
        currentStreak?: number;
        hoursFocused: number;
        achievementsUnlocked: number;
        progression?: FocusProgressionState;
    },
    tokens?: { access_token: string; refresh_token: string } | null,
): Promise<{ ok: boolean; error?: string }> {
    const auth = await attachSupabaseSession(supabase, tokens);
    if (!auth.ok) return { ok: false, error: 'NOT_AUTHENTICATED' };

    const progression = input.progression ?? (await loadProgressionState());
    if (!progression.publicProfileEnabled) {
        return { ok: true };
    }

    const focusStats = buildPublicFocusStats({
        progression,
        focusScore: input.focusScore,
        longestStreak: input.longestStreak,
        currentStreak: input.currentStreak ?? input.longestStreak,
        hoursFocused: input.hoursFocused,
        achievementsUnlocked: input.achievementsUnlocked,
    });

    const { data, error } = await supabase.rpc('sync_my_focus_stats', {
        p_focus_stats: focusStats,
        p_public_enabled: true,
    });

    if (error) return { ok: false, error: error.message };
    const row = data as { ok?: boolean; error?: string } | null;
    if (!row?.ok) return { ok: false, error: row?.error ?? 'SYNC_FAILED' };
    return { ok: true };
}

export async function fetchPublicFocusProfile(
    supabase: SupabaseClient,
    username: string,
): Promise<PublicFocusProfile | null> {
    const { data, error } = await supabase.rpc('get_public_focus_profile', {
        p_username: username,
    });
    if (error) return null;
    const row = data as { ok?: boolean; profile?: PublicFocusProfile | null } | null;
    if (!row?.ok || !row.profile) return null;
    return row.profile;
}

export function publicProfileUrl(username: string): string {
    const base = 'https://focuznow.com';
    return `${base}/u/${encodeURIComponent(username)}`;
}
