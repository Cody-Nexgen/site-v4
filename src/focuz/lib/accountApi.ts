import { supabase } from './supabase';
import {
    fetchSignInMethods,
    googleLoginBlockedMessage,
    passwordLoginBlockedMessage,
    usesGoogleSignIn,
} from './authProviders';
import { invokeAuthedFunction } from './supabaseFunctions';

export { usesGoogleSignIn };

export async function verifyAccountPassword(
    email: string,
    password: string,
): Promise<{ ok: boolean; error?: string }> {
    const methods = await fetchSignInMethods(email);
    const blocked = passwordLoginBlockedMessage(methods);
    if (blocked) {
        return { ok: false, error: blocked };
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
        if (
            error.message.toLowerCase().includes('invalid') ||
            error.message.toLowerCase().includes('credentials')
        ) {
            return { ok: false, error: 'Incorrect password. Try again.' };
        }
        return { ok: false, error: error.message };
    }
    return { ok: true };
}

function parseOAuthCallbackUrl(responseUrl: string): {
    tokens: { accessToken: string; refreshToken: string } | null;
    error: string | null;
} {
    try {
        const url = new URL(responseUrl);
        const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
        const queryParams = url.searchParams;

        const oauthError =
            hashParams.get('error_description') ||
            hashParams.get('error') ||
            queryParams.get('error_description') ||
            queryParams.get('error');
        if (oauthError) {
            const decoded = decodeURIComponent(oauthError.replace(/\+/g, ' '));
            if (decoded.toLowerCase().includes('oauth state')) {
                return {
                    tokens: null,
                    error: 'Sign-in expired. Close other login windows and try again.',
                };
            }
            return { tokens: null, error: decoded };
        }

        const accessToken =
            hashParams.get('access_token') || queryParams.get('access_token');
        const refreshToken =
            hashParams.get('refresh_token') || queryParams.get('refresh_token');
        if (!accessToken || !refreshToken) {
            return { tokens: null, error: 'Could not complete Google verification.' };
        }
        return { tokens: { accessToken, refreshToken }, error: null };
    } catch {
        return { tokens: null, error: 'Could not complete Google verification.' };
    }
}

/** Chrome extension OAuth callback — must be allowlisted in Supabase (https://*.chromiumapp.org/*). */
function extensionOAuthRedirectUrl(): string {
    return chrome.identity.getRedirectURL();
}

export async function verifyAccountWithGoogle(email?: string): Promise<{ ok: boolean; error?: string }> {
    if (email?.trim()) {
        const methods = await fetchSignInMethods(email);
        const blocked = googleLoginBlockedMessage(methods);
        if (blocked) {
            return { ok: false, error: blocked };
        }
    }

    const redirectTo = extensionOAuthRedirectUrl();
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo,
            skipBrowserRedirect: true,
            queryParams: { prompt: 'select_account' },
        },
    });

    if (error || !data?.url) {
        return { ok: false, error: error?.message || 'Could not start Google sign-in.' };
    }

    return new Promise((resolve) => {
        chrome.identity.launchWebAuthFlow(
            { url: data.url, interactive: true },
            async (responseUrl) => {
                if (chrome.runtime.lastError) {
                    resolve({
                        ok: false,
                        error: chrome.runtime.lastError.message || 'Google sign-in cancelled.',
                    });
                    return;
                }
                if (!responseUrl) {
                    resolve({ ok: false, error: 'Google sign-in cancelled.' });
                    return;
                }

                const parsed = parseOAuthCallbackUrl(responseUrl);
                if (parsed.error || !parsed.tokens) {
                    resolve({ ok: false, error: parsed.error || 'Could not complete Google verification.' });
                    return;
                }

                const { error: sessionError } = await supabase.auth.setSession({
                    access_token: parsed.tokens.accessToken,
                    refresh_token: parsed.tokens.refreshToken,
                });

                if (sessionError) {
                    resolve({ ok: false, error: sessionError.message });
                    return;
                }

                resolve({ ok: true });
            },
        );
    });
}

export async function deleteAccountPermanently(
    accessToken: string,
    opts: { email: string; password: string; googleAlreadyVerified?: boolean },
): Promise<{ ok: boolean; error?: string }> {
    if (opts.googleAlreadyVerified) {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session?.access_token) {
            accessToken = sessionData.session.access_token;
        }
    } else {
        const verified = await verifyAccountPassword(opts.email, opts.password);
        if (!verified.ok) {
            return verified;
        }
    }

    const { data, error } = await invokeAuthedFunction('delete-account', accessToken);

    if (error) {
        return { ok: false, error: error.message || 'Could not delete account.' };
    }

    const payload = data as { ok?: boolean; error?: string } | null;
    if (payload?.ok) {
        return { ok: true };
    }

    return { ok: false, error: payload?.error || 'Could not delete account.' };
}
