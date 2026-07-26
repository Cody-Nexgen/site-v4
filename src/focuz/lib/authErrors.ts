import { useAuthStore } from './store';

const AUTH_HINTS = [
    'not_authenticated',
    'not authenticated',
    'not logged in',
    'sign in again',
    'session not attached',
    'session expired',
    'jwt expired',
    'invalid jwt',
    'invalid claim',
    'unauthorized',
    '401',
];

/** True when the error means the Supabase session is missing or invalid. */
export function isAuthError(error: unknown): boolean {
    if (error == null) return false;

    const parts: string[] = [];
    if (typeof error === 'string') {
        parts.push(error);
    } else if (error instanceof Error) {
        parts.push(error.message);
    } else if (typeof error === 'object') {
        const e = error as Record<string, unknown>;
        if (typeof e.message === 'string') parts.push(e.message);
        if (typeof e.error === 'string') parts.push(e.error);
        if (typeof e.code === 'string') parts.push(e.code);
        if (typeof e.details === 'string') parts.push(e.details);
    }

    const lower = parts.join(' ').toLowerCase();
    return AUTH_HINTS.some((hint) => lower.includes(hint));
}

/** Sign out and return true if this was an auth error (so callers can skip other UI). */
export async function signOutOnAuthError(error: unknown): Promise<boolean> {
    if (!isAuthError(error)) return false;
    await useAuthStore.getState().signOut();
    return true;
}
