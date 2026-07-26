import type { SupabaseClient } from '@supabase/supabase-js';
import { signOutOnAuthError } from './authErrors';

export type SessionTokens = {
    access_token: string;
    refresh_token: string;
};

export type UserProfile = {
    username: string;
    displayName: string;
    avatarUrl: string | null;
};

/** Attach extension session to Supabase client so RPCs see auth.uid(). */
export async function attachSupabaseSession(
    supabase: SupabaseClient,
    tokens?: SessionTokens | null,
): Promise<{ ok: boolean; userId?: string; error?: string }> {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) {
        return { ok: true, userId: session.user.id };
    }

    if (!tokens?.access_token || !tokens?.refresh_token) {
        return { ok: false, error: 'NOT_AUTHENTICATED' };
    }

    const { data, error } = await supabase.auth.setSession({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
    });

    if (error || !data.session?.user?.id) {
        return { ok: false, error: 'NOT_AUTHENTICATED' };
    }

    return { ok: true, userId: data.session.user.id };
}

/** Match public.normalize_username() in Supabase. */
export function normalizeUsername(raw: string): string {
    return raw
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '')
        .slice(0, 30);
}

export function suggestUsername(email: string | undefined): string {
    const local = (email || 'user').split('@')[0] || 'user';
    const normalized = normalizeUsername(local);
    return normalized.length >= 3 ? normalized : `user${Date.now().toString(36).slice(-4)}`;
}

export async function isUsernameAvailable(
    supabase: SupabaseClient,
    username: string,
    tokens?: SessionTokens | null,
): Promise<{ available: boolean; username: string; reason?: string }> {
    const auth = await attachSupabaseSession(supabase, tokens);
    if (!auth.ok) {
        return { available: false, username: normalizeUsername(username), reason: 'NOT_AUTHENTICATED' };
    }

    const { data, error } = await supabase.rpc('is_username_available', {
        p_username: username,
    });
    if (error) {
        return { available: false, username: normalizeUsername(username), reason: error.message };
    }

    const row = data as {
        ok?: boolean;
        available?: boolean;
        username?: string;
        reason?: string;
    } | null;
    return {
        available: row?.available === true,
        username: row?.username ?? normalizeUsername(username),
        reason: row?.reason,
    };
}

export async function fetchMyProfile(
    supabase: SupabaseClient,
    tokens?: SessionTokens | null,
): Promise<UserProfile | null> {
    const auth = await attachSupabaseSession(supabase, tokens);
    if (!auth.ok) {
        await signOutOnAuthError(auth.error ?? 'NOT_AUTHENTICATED');
        return null;
    }

    const { data, error } = await supabase.rpc('get_my_profile');
    if (error) {
        await signOutOnAuthError(error);
        return null;
    }
    const row = data as { ok?: boolean; profile?: UserProfile | null; error?: string } | null;
    if (row?.error === 'NOT_AUTHENTICATED') {
        await signOutOnAuthError('NOT_AUTHENTICATED');
        return null;
    }
    if (!row?.ok || !row.profile) return null;
    return row.profile;
}

/** Like fetchMyProfile but never signs the user out on transient auth/RPC errors. */
export async function fetchMyProfileQuiet(
    supabase: SupabaseClient,
    tokens?: SessionTokens | null,
): Promise<UserProfile | null> {
    const auth = await attachSupabaseSession(supabase, tokens);
    if (!auth.ok) return null;

    const { data, error } = await supabase.rpc('get_my_profile');
    if (error) return null;
    const row = data as { ok?: boolean; profile?: UserProfile | null; error?: string } | null;
    if (!row?.ok || !row.profile) return null;
    return row.profile;
}

export async function upsertMyProfile(
    supabase: SupabaseClient,
    input: { username: string; displayName: string; avatarUrl?: string | null },
    tokens?: SessionTokens | null,
): Promise<{ ok: boolean; profile?: UserProfile; error?: string }> {
    const auth = await attachSupabaseSession(supabase, tokens);
    if (!auth.ok) {
        await signOutOnAuthError(auth.error ?? 'NOT_AUTHENTICATED');
        return { ok: false, error: 'NOT_AUTHENTICATED' };
    }

    const normalizedUsername = normalizeUsername(input.username);
    const { data, error } = await supabase.rpc('upsert_my_profile', {
        p_username: normalizedUsername,
        p_display_name: input.displayName.trim(),
        p_avatar_url: input.avatarUrl ?? null,
    });
    if (error) {
        await signOutOnAuthError(error);
        return { ok: false, error: error.message };
    }

    const row = data as { ok?: boolean; profile?: UserProfile; error?: string } | null;
    if (!row?.ok) {
        if (row?.error === 'USERNAME_TAKEN') {
            return { ok: false, error: 'That handle is already taken.' };
        }
        if (row?.error === 'USERNAME_TOO_SHORT') {
            return { ok: false, error: 'Username must be at least 3 characters (letters, numbers, underscore).' };
        }
        if (row?.error === 'NOT_AUTHENTICATED') {
            await signOutOnAuthError('NOT_AUTHENTICATED');
            return { ok: false, error: 'NOT_AUTHENTICATED' };
        }
        return { ok: false, error: row?.error || 'Could not save profile.' };
    }
    return { ok: true, profile: row.profile };
}

export async function uploadAvatarFromDataUrl(
    supabase: SupabaseClient,
    userId: string,
    dataUrl: string,
): Promise<string | null> {
    const match = dataUrl.match(/^data:(image\/[\w+.-]+);base64,(.+)$/);
    if (!match) {
        if (dataUrl.startsWith('http://') || dataUrl.startsWith('https://')) return dataUrl;
        return null;
    }

    const mime = match[1];
    const ext =
        mime === 'image/jpeg' ? 'jpg' : mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'png';
    const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
    const path = `${userId}/avatar.${ext}`;

    const { error } = await supabase.storage.from('avatars').upload(path, bytes, {
        upsert: true,
        contentType: mime,
    });
    if (error) {
        console.error('[uploadAvatar]', error);
        return null;
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    return data.publicUrl;
}

/** Sync extension settings (name, avatar data URL) to Supabase profiles + storage. */
export async function syncProfileFromSettings(
    supabase: SupabaseClient,
    userId: string,
    input: {
        username: string;
        displayName: string;
        profileAvatar?: string | null;
    },
    tokens?: SessionTokens | null,
): Promise<{ ok: boolean; profile?: UserProfile; error?: string }> {
    let avatarUrl: string | null | undefined = undefined;
    const raw = input.profileAvatar?.trim();
    if (raw) {
        if (raw.startsWith('data:')) {
            avatarUrl = await uploadAvatarFromDataUrl(supabase, userId, raw);
        } else if (raw.startsWith('http')) {
            avatarUrl = raw;
        }
    }

    return upsertMyProfile(
        supabase,
        {
            username: normalizeUsername(input.username),
            displayName: input.displayName,
            avatarUrl: avatarUrl ?? undefined,
        },
        tokens,
    );
}

/** First-time profile sync: pick a handle that is not already taken. */
export async function syncProfileWithAvailableUsername(
    supabase: SupabaseClient,
    userId: string,
    input: {
        preferredUsername: string;
        displayName: string;
        profileAvatar?: string | null;
    },
    tokens?: SessionTokens | null,
): Promise<{ ok: boolean; profile?: UserProfile; error?: string }> {
    let candidate = normalizeUsername(input.preferredUsername);
    if (candidate.length < 3) {
        candidate = suggestUsername(undefined);
    }

    for (let attempt = 0; attempt < 8; attempt += 1) {
        const check = await isUsernameAvailable(supabase, candidate, tokens);
        if (check.available) {
            return syncProfileFromSettings(
                supabase,
                userId,
                {
                    username: candidate,
                    displayName: input.displayName,
                    profileAvatar: input.profileAvatar,
                },
                tokens,
            );
        }
        const suffix = attempt === 0 ? '' : `_${(attempt + 1).toString(36)}`;
        const base = normalizeUsername(input.preferredUsername).slice(0, Math.max(3, 30 - suffix.length));
        candidate = `${base}${suffix}`;
    }

    return { ok: false, error: 'Could not find an available handle. Pick a different username.' };
}
