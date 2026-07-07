import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type AuthProvider = 'google' | 'email';

export function usesGoogleSignIn(user: User): boolean {
    const methods = providersFromUser(user);
    return methods.includes('google') && !methods.includes('email');
}

export function usesEmailSignIn(user: User): boolean {
    const methods = providersFromUser(user);
    return methods.includes('email') && !methods.includes('google');
}

export function providersFromUser(user: User): AuthProvider[] {
    const identities = user.identities ?? [];
    const providers = new Set<AuthProvider>();
    for (const id of identities) {
        if (id.provider === 'google' || id.provider === 'email') {
            providers.add(id.provider);
        }
    }
    if (providers.size === 0 && user.app_metadata?.provider === 'google') {
        providers.add('google');
    }
    if (providers.size === 0 && user.app_metadata?.provider === 'email') {
        providers.add('email');
    }
    return [...providers];
}

export async function fetchSignInMethods(email: string): Promise<AuthProvider[]> {
    const trimmed = email.trim().toLowerCase();
    if (trimmed.length < 3) return [];

    const { data, error } = await supabase.rpc('get_sign_in_methods', { p_email: trimmed });
    if (error) {
        console.warn('[authProviders] get_sign_in_methods failed', error);
        return [];
    }

    if (!Array.isArray(data)) return [];
    return data.filter((p): p is AuthProvider => p === 'google' || p === 'email');
}

export function passwordLoginBlockedMessage(methods: AuthProvider[]): string | null {
    if (methods.includes('google') && !methods.includes('email')) {
        return 'This account uses Google sign-in. Use “Verify with Google” or sign in with Google on focuznow.com.';
    }
    return null;
}

export function googleLoginBlockedMessage(methods: AuthProvider[]): string | null {
    if (methods.includes('email') && !methods.includes('google')) {
        return 'This account uses email and password. Sign in with your password instead of Google.';
    }
    return null;
}
