/** OAuth redirect targets allowed in Supabase Auth URL configuration. */
export const PRODUCTION_AUTH_ORIGIN = 'https://focuznow.com';

function isExtensionBrowserContext(): boolean {
    if (typeof document === 'undefined') return false;
    return !!document.documentElement.getAttribute('data-focuznow-extension');
}

export function getOAuthRedirectUrl(context: 'web' | 'extension' = 'web'): string {
    const extensionFlow = context === 'extension' || isExtensionBrowserContext();

    if (typeof window === 'undefined') {
        return extensionFlow
            ? `${PRODUCTION_AUTH_ORIGIN}/dashboard?extension_oauth=1`
            : `${PRODUCTION_AUTH_ORIGIN}/dashboard`;
    }

    const host = window.location.hostname.replace(/^www\./, '');
    const isLocalDev =
        host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');

    if (extensionFlow) {
        if (isLocalDev) {
            return `${window.location.origin}/dashboard?extension_oauth=1`;
        }
        return `${PRODUCTION_AUTH_ORIGIN}/dashboard?extension_oauth=1`;
    }

    if (host === 'focuznow.com') {
        return `${PRODUCTION_AUTH_ORIGIN}/dashboard`;
    }

    if (isLocalDev) {
        return `${window.location.origin}/dashboard`;
    }

    return `${PRODUCTION_AUTH_ORIGIN}/dashboard`;
}
