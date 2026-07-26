/** Where Stripe Checkout / Customer Portal should send users after billing. */
export const BILLING_RETURN_URL = 'https://focuznow.com/dashboard?billing=return';

export const BILLING_SUCCESS_URL = 'https://focuznow.com/dashboard?billing=return&subscription=success';

/** Reject chrome-extension:// and other unsafe return targets from the client. */
export function sanitizeBillingReturnUrl(requested?: string | null): string {
    const fallback = BILLING_RETURN_URL;
    if (!requested || typeof requested !== 'string') return fallback;

    const trimmed = requested.trim();
    if (!trimmed) return fallback;

    if (trimmed.startsWith('chrome-extension://')) return fallback;

    try {
        const parsed = new URL(trimmed);
        const host = parsed.hostname.replace(/^www\./, '');
        if (host === 'focuznow.com' || host === 'localhost' || host === '127.0.0.1') {
            return trimmed;
        }
    } catch {
        /* ignore */
    }

    return fallback;
}

export function isBillingReturnQuery(search: string): boolean {
    const params = new URLSearchParams(search);
    return params.get('billing') === 'return' || params.get('subscription') === 'success';
}
