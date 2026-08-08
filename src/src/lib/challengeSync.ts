/**
 * Cloud persistence for focus challenges (`public.user_challenges`).
 *
 * chrome.storage (via focusProgression.ts) remains the fast local cache that the UI reads
 * synchronously; this module is the durable source of truth so a challenge start survives
 * service-worker eviction, storage races, or a fresh install. All functions are best-effort:
 * network/auth failures are swallowed so the local-only flow keeps working offline.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ActiveChallengeSnapshot, FocusProgressionState } from './focusProgression';

export type CloudChallengeStatus = 'active' | 'completed' | 'failed';

export type UserChallengeRow = {
    id: string;
    user_id: string;
    challenge_id: string;
    status: CloudChallengeStatus;
    progress: Record<string, unknown> | null;
    started_at: string | null;
    completed_at: string | null;
    created_at: string;
    updated_at: string;
};

async function resolveClient(client?: SupabaseClient): Promise<SupabaseClient | null> {
    if (client) return client;
    try {
        const mod = await import('./supabase');
        return mod.supabase;
    } catch {
        return null;
    }
}

async function getUserId(client: SupabaseClient): Promise<string | null> {
    try {
        const { data, error } = await client.auth.getSession();
        if (error) return null;
        return data.session?.user?.id ?? null;
    } catch {
        return null;
    }
}

function snapshotToProgress(snapshot?: Partial<ActiveChallengeSnapshot>): Record<string, unknown> {
    if (!snapshot) return {};
    return {
        title: snapshot.title,
        description: snapshot.description,
        icon: snapshot.icon,
        metric: snapshot.metric,
        target: snapshot.target,
        baseline: snapshot.baseline,
        xpReward: snapshot.xpReward,
        coinReward: snapshot.coinReward,
        periodKind: snapshot.periodKind,
        periodKey: snapshot.periodKey,
    };
}

/** Upsert one challenge's lifecycle status to the cloud. Returns true on confirmed success. */
export async function upsertCloudChallenge(
    challengeId: string,
    status: CloudChallengeStatus,
    snapshot?: Partial<ActiveChallengeSnapshot>,
    client?: SupabaseClient,
): Promise<boolean> {
    const supabase = await resolveClient(client);
    if (!supabase) return false;
    const userId = await getUserId(supabase);
    if (!userId) return false;

    const now = new Date().toISOString();
    const row: Record<string, unknown> = {
        user_id: userId,
        challenge_id: challengeId,
        status,
        progress: snapshotToProgress(snapshot),
        updated_at: now,
    };
    if (status === 'active') row.started_at = snapshot?.startedAt ?? now;
    if (status === 'completed' || status === 'failed') row.completed_at = now;

    try {
        const { error } = await supabase
            .from('user_challenges')
            .upsert(row, { onConflict: 'user_id,challenge_id' });
        if (error) {
            console.error('[ChallengeSync] upsert failed:', error.message);
            return false;
        }
        return true;
    } catch (error) {
        console.error('[ChallengeSync] upsert exception:', error);
        return false;
    }
}

/** Fetch all cloud challenge rows for the current user. */
export async function fetchCloudChallenges(client?: SupabaseClient): Promise<UserChallengeRow[]> {
    const supabase = await resolveClient(client);
    if (!supabase) return [];
    const userId = await getUserId(supabase);
    if (!userId) return [];

    try {
        const { data, error } = await supabase
            .from('user_challenges')
            .select('*')
            .eq('user_id', userId);
        if (error) {
            console.error('[ChallengeSync] fetch failed:', error.message);
            return [];
        }
        return (data ?? []) as UserChallengeRow[];
    } catch (error) {
        console.error('[ChallengeSync] fetch exception:', error);
        return [];
    }
}

/**
 * Check the cloud for a single challenge's status. Used as a fallback authority when the
 * local chrome.storage write cannot be confirmed (e.g. the write raced a service-worker
 * eviction), so the UI never reports "not found" for a challenge the DB actually has.
 */
export async function isChallengeConfirmedInCloud(
    challengeId: string,
    client?: SupabaseClient,
): Promise<{ active: boolean; completed: boolean; row: UserChallengeRow | null }> {
    const supabase = await resolveClient(client);
    if (!supabase) return { active: false, completed: false, row: null };
    const userId = await getUserId(supabase);
    if (!userId) return { active: false, completed: false, row: null };

    try {
        const { data, error } = await supabase
            .from('user_challenges')
            .select('*')
            .eq('user_id', userId)
            .eq('challenge_id', challengeId)
            .maybeSingle();
        if (error || !data) return { active: false, completed: false, row: null };
        const row = data as UserChallengeRow;
        return { active: row.status === 'active', completed: row.status === 'completed', row };
    } catch {
        return { active: false, completed: false, row: null };
    }
}

/**
 * Merge cloud rows into a local progression snapshot without clobbering local state that the
 * cloud doesn't know about yet. Cloud `completed` always wins (terminal state); cloud `active`
 * rows are only added when the local cache is missing them entirely.
 */
export function mergeCloudChallengesIntoProgression(
    state: FocusProgressionState,
    rows: UserChallengeRow[],
): FocusProgressionState {
    if (rows.length === 0) return state;

    const completedFromCloud = rows.filter((r) => r.status === 'completed').map((r) => r.challenge_id);
    const completedChallenges = completedFromCloud.every((id) => state.completedChallenges.includes(id))
        ? state.completedChallenges
        : Array.from(new Set([...state.completedChallenges, ...completedFromCloud]));

    const activeById = new Map(state.activeChallenges.map((c) => [c.id, c] as const));
    let changedActive = false;
    for (const row of rows) {
        if (row.status !== 'active') continue;
        if (completedChallenges.includes(row.challenge_id)) continue;
        if (activeById.has(row.challenge_id)) continue;

        const progress = (row.progress ?? {}) as Record<string, unknown>;
        if (typeof progress.metric !== 'string' || typeof progress.target !== 'number') continue;

        activeById.set(row.challenge_id, {
            id: row.challenge_id,
            startedAt: row.started_at ?? row.created_at,
            title: typeof progress.title === 'string' ? progress.title : row.challenge_id,
            description: typeof progress.description === 'string' ? progress.description : '',
            icon: typeof progress.icon === 'string' ? progress.icon : '🎯',
            metric: progress.metric,
            target: progress.target,
            baseline: typeof progress.baseline === 'number' ? progress.baseline : 0,
            xpReward: typeof progress.xpReward === 'number' ? progress.xpReward : 0,
            coinReward: typeof progress.coinReward === 'number' ? progress.coinReward : 0,
            periodKind: progress.periodKind as 'day' | 'week' | undefined,
            periodKey: typeof progress.periodKey === 'string' ? progress.periodKey : undefined,
        });
        changedActive = true;
    }

    if (!changedActive && completedChallenges === state.completedChallenges) return state;

    const activeChallenges = Array.from(activeById.values()).filter(
        (c) => !completedChallenges.includes(c.id),
    );

    return { ...state, completedChallenges, activeChallenges };
}
