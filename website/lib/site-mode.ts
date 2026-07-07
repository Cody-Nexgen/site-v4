const BETA_HOST = 'tester.focuznow.com';

export function isBetaTesterSite(): boolean {
    if (typeof window === 'undefined') return false;

    const host = window.location.hostname.replace(/^www\./, '');
    const isLocalBeta =
        (host === 'localhost' || host === '127.0.0.1') &&
        import.meta.env.VITE_BETA_SITE === 'true';

    return host === BETA_HOST || isLocalBeta;
}

export const BETA_SITE_ORIGIN = `https://${BETA_HOST}`;
