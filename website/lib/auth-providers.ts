import { supabase } from '@/lib/supabase';

export type AuthProvider = 'google' | 'email';

export async function fetchSignInMethods(email: string): Promise<AuthProvider[]> {
    const trimmed = email.trim().toLowerCase();
    if (trimmed.length < 3) return [];

    const { data, error } = await supabase.rpc('get_sign_in_methods', { p_email: trimmed });
    if (error) {
        console.warn('[auth-providers] get_sign_in_methods failed', error);
        return [];
    }

    if (!Array.isArray(data)) return [];
    return data.filter((p): p is AuthProvider => p === 'google' || p === 'email');
}

export function passwordLoginBlockedMessage(methods: AuthProvider[]): string | null {
    if (methods.includes('google') && !methods.includes('email')) {
        return 'This account uses Google sign-in. Use “Continue with Google” instead.';
    }
    return null;
}

export function googleLoginBlockedMessage(methods: AuthProvider[]): string | null {
    if (methods.includes('email') && !methods.includes('google')) {
        return 'This account uses email and password. Sign in with your password instead.';
    }
    return null;
}

export function clearAuthErrorFromUrl(): string | null {
    if (typeof window === 'undefined') return null;

    const hash = window.location.hash.startsWith('#')
        ? window.location.hash.slice(1)
        : window.location.hash;
    const hashParams = new URLSearchParams(hash);
    const queryParams = new URLSearchParams(window.location.search);

    const err =
        hashParams.get('error_description') ||
        hashParams.get('error') ||
        queryParams.get('error_description') ||
        queryParams.get('error');

    if (!err) return null;

    const message = decodeURIComponent(err.replace(/\+/g, ' '));
    const clean = new URL(window.location.href);
    clean.hash = '';
    clean.searchParams.delete('error');
    clean.searchParams.delete('error_code');
    clean.searchParams.delete('error_description');
    window.history.replaceState({}, '', clean.pathname + clean.search);

    if (message.toLowerCase().includes('oauth state')) {
        return 'Your sign-in session expired. Close other login tabs and try Google again.';
    }
    return message;
}
