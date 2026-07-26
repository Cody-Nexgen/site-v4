/** OAuth redirect targets allowed in Supabase Auth URL configuration. */
export const PRODUCTION_AUTH_ORIGIN = 'https://focuznow.com';
export const WEB_APP_PATH = '/app';

function wantsExtensionHandoff(): boolean {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('extension_oauth') === '1' || params.get('extension_handoff') === '1';
}

export function getOAuthRedirectUrl(context: 'web' | 'extension' = 'web'): string {
    const extensionFlow = context === 'extension' || wantsExtensionHandoff();

    if (typeof window === 'undefined') {
        return extensionFlow
            ? `${PRODUCTION_AUTH_ORIGIN}/extension-connect?extension_oauth=1`
            : `${PRODUCTION_AUTH_ORIGIN}${WEB_APP_PATH}`;
    }

    const host = window.location.hostname.replace(/^www\./, '');
    const isLocalDev =
        host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
    const isDashboardHost = host === 'dashboard.focuznow.com';

    if (extensionFlow) {
        if (isLocalDev) {
            return `${window.location.origin}/extension-connect?extension_oauth=1`;
        }
        return `${PRODUCTION_AUTH_ORIGIN}/extension-connect?extension_oauth=1`;
    }

    if (isDashboardHost) {
        return `https://dashboard.focuznow.com${WEB_APP_PATH}`;
    }

    if (host === 'focuznow.com' || isLocalDev) {
        return `${isLocalDev ? window.location.origin : PRODUCTION_AUTH_ORIGIN}${WEB_APP_PATH}`;
    }

    return `${PRODUCTION_AUTH_ORIGIN}${WEB_APP_PATH}`;
}

export function getPasswordResetRedirectUrl(): string {
    if (typeof window === 'undefined') {
        return `${PRODUCTION_AUTH_ORIGIN}/reset-password`;
    }

    const host = window.location.hostname.replace(/^www\./, '');
    const isLocalDev =
        host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');

    if (host === 'focuznow.com') {
        return `${PRODUCTION_AUTH_ORIGIN}/reset-password`;
    }

    if (isLocalDev) {
        return `${window.location.origin}/reset-password`;
    }

    return `${PRODUCTION_AUTH_ORIGIN}/reset-password`;
}
