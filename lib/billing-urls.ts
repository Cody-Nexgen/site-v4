export const BILLING_RETURN_URL = 'https://focuznow.com/dashboard?billing=return';

export function isBillingReturnQuery(search: string): boolean {
    const params = new URLSearchParams(search);
    return params.get('billing') === 'return' || params.get('subscription') === 'success';
}
