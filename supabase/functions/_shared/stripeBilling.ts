import Stripe from 'https://esm.sh/stripe@17.7.0?target=deno';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

export const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export const DEFAULT_BILLING_RETURN_URL =
    'https://focuznow.com/dashboard?billing=return';

const ACTIVE_STATUSES = ['active', 'trialing'];

export function jsonResponse(body: Record<string, unknown>, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
}

export function sanitizeReturnUrl(requested?: string | null): string {
    if (!requested || typeof requested !== 'string') return DEFAULT_BILLING_RETURN_URL;

    const trimmed = requested.trim();
    if (!trimmed || trimmed.startsWith('chrome-extension://')) {
        return DEFAULT_BILLING_RETURN_URL;
    }

    try {
        const parsed = new URL(trimmed);
        const host = parsed.hostname.replace(/^www\./, '');
        if (host === 'focuznow.com' || host === 'localhost' || host === '127.0.0.1') {
            return trimmed;
        }
    } catch {
        /* ignore */
    }

    return DEFAULT_BILLING_RETURN_URL;
}

export async function getUserFromAuthHeader(
    req: Request,
    supabaseAnonKey: string,
    supabaseUrl: string,
) {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return { error: 'NOT_AUTHENTICATED' as const };
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
    });

    const {
        data: { user },
        error,
    } = await supabase.auth.getUser();

    if (error || !user) {
        return { error: 'NOT_AUTHENTICATED' as const };
    }

    return { user, supabase };
}

/** Pro access: DB row first, then Stripe active/trialing subscription (DB can lag webhooks). */
export async function userHasProAccess(
    admin: SupabaseClient,
    userId: string,
    email?: string,
): Promise<boolean> {
    const sub = await getActiveSubscription(admin, userId);
    if (sub) return true;

    const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecret) return false;

    try {
        const stripe = new Stripe(stripeSecret, { apiVersion: '2024-12-18.acacia' });
        const customerId = await resolveStripeCustomerId(stripe, admin, userId, email);
        if (!customerId) return false;

        for (const status of ACTIVE_STATUSES) {
            const { data } = await stripe.subscriptions.list({
                customer: customerId,
                status: status as Stripe.SubscriptionListParams['status'],
                limit: 1,
            });
            if (data.length > 0) return true;
        }
    } catch (e) {
        console.warn('[stripeBilling] Stripe pro check failed', e);
    }

    return false;
}

export async function getActiveSubscription(
    admin: SupabaseClient,
    userId: string,
) {
    const { data, error } = await admin
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .in('status', ACTIVE_STATUSES)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error('[stripeBilling] subscriptions lookup failed', error);
        return null;
    }

    return data;
}

export function stripeCustomerIdFromRow(row: Record<string, unknown> | null): string | null {
    if (!row) return null;
    const id =
        (row.stripe_customer_id as string | undefined) ||
        (row.customer_id as string | undefined) ||
        (row.stripeCustomerId as string | undefined);
    return typeof id === 'string' && id.length > 0 ? id : null;
}

function stripeSubscriptionIdFromRow(row: Record<string, unknown> | null): string | null {
    if (!row) return null;
    const id =
        (row.stripe_subscription_id as string | undefined) ||
        (row.subscription_id as string | undefined) ||
        (row.stripeSubscriptionId as string | undefined);
    return typeof id === 'string' && id.startsWith('sub_') ? id : null;
}

export async function resolveStripeCustomerId(
    stripe: Stripe,
    admin: SupabaseClient,
    userId: string,
    email: string | undefined,
): Promise<string | null> {
    const activeSub = await getActiveSubscription(admin, userId);
    let customerId = stripeCustomerIdFromRow(activeSub as Record<string, unknown> | null);

    const { data: latestRow } = await admin
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    const latest = latestRow as Record<string, unknown> | null;
    if (!customerId) {
        customerId = stripeCustomerIdFromRow(latest);
    }

    const subscriptionId = stripeSubscriptionIdFromRow(latest);
    if (!customerId && subscriptionId) {
        try {
            const sub = await stripe.subscriptions.retrieve(subscriptionId);
            if (typeof sub.customer === 'string') {
                customerId = sub.customer;
            }
        } catch (e) {
            console.warn('[stripeBilling] subscription retrieve failed', e);
        }
    }

    if (!customerId && email) {
        const customers = await stripe.customers.list({ email, limit: 10 });
        const match =
            customers.data.find((c) => c.metadata?.supabase_user_id === userId) ||
            customers.data[0];
        if (match) customerId = match.id;
    }

    if (!customerId) {
        try {
            const search = await stripe.customers.search({
                query: `metadata['supabase_user_id']:'${userId}'`,
                limit: 1,
            });
            customerId = search.data[0]?.id ?? null;
        } catch (e) {
            console.warn('[stripeBilling] customer search failed', e);
        }
    }

    if (customerId && latestRow) {
        await admin
            .from('subscriptions')
            .update({ stripe_customer_id: customerId })
            .eq('user_id', userId);
    }

    return customerId;
}
