import { supabase } from '@/lib/supabase';

export type BetaProfile = {
    id: string;
    email: string | null;
    is_approved: boolean;
    applied_at: string | null;
};

export async function fetchBetaProfile(userId: string): Promise<BetaProfile | null> {
    const { data, error } = await supabase
        .from('profiles')
        .select('id, email, is_approved, applied_at')
        .eq('id', userId)
        .maybeSingle();

    if (error) {
        console.error('[beta-profile] fetch failed:', error.message);
        return null;
    }

    return data;
}

/** Ensures the signed-in user has a profile row (beta application). */
export async function ensureBetaApplication(
    userId: string,
    email: string | null,
): Promise<BetaProfile | null> {
    const existing = await fetchBetaProfile(userId);
    if (existing) return existing;

    const { data, error } = await supabase
        .from('profiles')
        .insert({ id: userId, email })
        .select('id, email, is_approved, applied_at')
        .single();

    if (error) {
        console.error('[beta-profile] apply failed:', error.message);
        return null;
    }

    return data;
}
