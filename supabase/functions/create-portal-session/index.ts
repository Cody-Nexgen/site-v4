import Stripe from 'https://esm.sh/stripe@17.7.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import {
    corsHeaders,
    getUserFromAuthHeader,
    jsonResponse,
    resolveStripeCustomerId,
    sanitizeReturnUrl,
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

        if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey || !stripeSecret) {
            return jsonResponse({ error: 'Server billing configuration is incomplete.' }, 500);
        }

        const auth = await getUserFromAuthHeader(req, supabaseAnonKey, supabaseUrl);
        if ('error' in auth) {
            return jsonResponse({ error: 'NOT_AUTHENTICATED' }, 401);
        }

        const body = await req.json().catch(() => ({}));
        const returnUrl = sanitizeReturnUrl(body?.return_url);

        const admin = createClient(supabaseUrl, serviceRoleKey);
        const stripe = new Stripe(stripeSecret, { apiVersion: '2024-12-18.acacia' });

        const customerId = await resolveStripeCustomerId(
            stripe,
            admin,
            auth.user.id,
            auth.user.email ?? undefined,
        );

        if (!customerId) {
            return jsonResponse({
                error:
                    'We could not find your Stripe billing profile. Use Upgrade to Pro in the extension to link billing, or contact support with the email on your account.',
                code: 'NO_CUSTOMER',
            }, 200);
        }

        const portal = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: returnUrl,
        });

        return jsonResponse({ url: portal.url, stripeCustomerId: customerId });
    } catch (err) {
        console.error('[create-portal-session]', err);
        return jsonResponse({ error: 'Could not open billing portal.' }, 500);
    }
});
