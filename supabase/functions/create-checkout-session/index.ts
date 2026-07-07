import Stripe from 'https://esm.sh/stripe@17.7.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import {
    corsHeaders,
    getActiveSubscription,
    getUserFromAuthHeader,
    jsonResponse,
    sanitizeReturnUrl,
    stripeCustomerIdFromRow,
} from '../_shared/stripeBilling.ts';

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY');
        const priceId = Deno.env.get('STRIPE_PRICE_ID');

        if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey || !stripeSecret || !priceId) {
            return jsonResponse({ error: 'Server billing configuration is incomplete.' }, 500);
        }

        const auth = await getUserFromAuthHeader(req, supabaseAnonKey, supabaseUrl);
        if ('error' in auth) {
            return jsonResponse({ error: 'NOT_AUTHENTICATED' }, 401);
        }

        const body = await req.json().catch(() => ({}));
        const returnUrl = sanitizeReturnUrl(body?.return_url);
        const successUrl = returnUrl.includes('?')
            ? `${returnUrl}&subscription=success`
            : `${returnUrl}?subscription=success`;
        const cancelUrl = returnUrl;

        const admin = createClient(supabaseUrl, serviceRoleKey);
        const activeSub = await getActiveSubscription(admin, auth.user.id);

        if (activeSub) {
            const stripe = new Stripe(stripeSecret, { apiVersion: '2024-12-18.acacia' });
            const customerId = stripeCustomerIdFromRow(activeSub);

            if (customerId) {
                const portal = await stripe.billingPortal.sessions.create({
                    customer: customerId,
                    return_url: returnUrl,
                });
                return jsonResponse({
                    error: 'You are already subscribed to Pro.',
                    code: 'ALREADY_SUBSCRIBED',
                    already_subscribed: true,
                    url: portal.url,
                });
            }

            return jsonResponse({
                error: 'You are already subscribed to Pro. Open Manage Subscription to update billing.',
                code: 'ALREADY_SUBSCRIBED',
                already_subscribed: true,
            });
        }

        const stripe = new Stripe(stripeSecret, { apiVersion: '2024-12-18.acacia' });

        let customerId = stripeCustomerIdFromRow(activeSub);
        if (!customerId) {
            const { data: anySub } = await admin
                .from('subscriptions')
                .select('stripe_customer_id, customer_id')
                .eq('user_id', auth.user.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            customerId = stripeCustomerIdFromRow(anySub as Record<string, unknown> | null);
        }

        if (!customerId) {
            const customer = await stripe.customers.create({
                email: auth.user.email ?? undefined,
                metadata: { supabase_user_id: auth.user.id },
            });
            customerId = customer.id;
        }

        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            customer: customerId,
            client_reference_id: auth.user.id,
            line_items: [{ price: priceId, quantity: 1 }],
            success_url: successUrl,
            cancel_url: cancelUrl,
            allow_promotion_codes: true,
            subscription_data: {
                metadata: { supabase_user_id: auth.user.id },
            },
        });

        if (!session.url) {
            return jsonResponse({ error: 'Could not start checkout.' }, 500);
        }

        return jsonResponse({ url: session.url });
    } catch (err) {
        console.error('[create-checkout-session]', err);
        return jsonResponse({ error: 'Could not start checkout.' }, 500);
    }
});
