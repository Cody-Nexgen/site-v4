import { BETA_SITE_ORIGIN } from '@/lib/site-mode';

export function getBetaAuthRedirectUrl(): string {
    if (typeof window === 'undefined') {
        return BETA_SITE_ORIGIN;
    }

    const host = window.location.hostname.replace(/^www\./, '');
    const isLocalDev =
        host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');

    if (isLocalDev) {
        return window.location.origin;
    }

    return BETA_SITE_ORIGIN;
}
