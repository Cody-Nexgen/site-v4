import { checkRateLimits } from '../lib/rate-limit.mjs';

export const maxDuration = 20;

const DEFAULT_SUPABASE_URL = 'https://zbgbszatstigtbfvdfpb.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpiZ2JzemF0c3RpZ3RiZnZkZnBiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyNjY5NDAsImV4cCI6MjA3OTg0Mjk0MH0.6Uomu8F8qWp9bTCIwkj4yc48wZDMBT1U8efp9_M2vGw';
const STRIPE_API = 'https://api.stripe.com/v1';
const STRIPE_VERSION = '2025-06-30.basil';
const ACTIVE_SUBSCRIPTION_STATES = new Set(['active', 'trialing', 'past_due', 'unpaid', 'incomplete']);
const ENTITLED_SUBSCRIPTION_STATES = new Set(['active', 'trialing', 'past_due']);
const BILLING_LIMITS = [{ limit: 20, windowMs: 60_000 }, { limit: 120, windowMs: 60 * 60_000 }];

const json = (payload, status = 200, headers = {}) => new Response(JSON.stringify(payload), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
});

const requireUser = async (request) => {
  const accessToken = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) return null;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return null;
  return response.json();
};

const stripeRequest = async (path, { method = 'GET', params = [] } = {}) => {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error('BILLING_NOT_CONFIGURED');
  const url = new URL(`${STRIPE_API}${path}`);
  const form = new URLSearchParams(params);
  if (method === 'GET') url.search = form.toString();
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Version': STRIPE_VERSION,
    },
    body: method === 'GET' ? undefined : form,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error?.message || 'Stripe request failed.');
    error.status = response.status;
    throw error;
  }
  return data;
};

const customerName = (user) => {
  const metadata = user.user_metadata || {};
  return metadata.full_name || metadata.name || [metadata.first_name, metadata.last_name].filter(Boolean).join(' ') || undefined;
};

const findCustomer = async (user) => {
  if (!user.email) return null;
  const customers = await stripeRequest('/customers', { params: [['email', user.email], ['limit', '100']] });
  return customers.data?.find((customer) => customer.metadata?.supabase_user_id === user.id || customer.metadata?.user_id === user.id) || customers.data?.[0] || null;
};

const getOrCreateCustomer = async (user) => {
  const existing = await findCustomer(user);
  if (existing) return existing;
  const params = [['email', user.email || ''], ['metadata[supabase_user_id]', user.id], ['metadata[user_id]', user.id]];
  const name = customerName(user);
  if (name) params.push(['name', name]);
  return stripeRequest('/customers', { method: 'POST', params });
};

const listSubscriptions = (customerId) => stripeRequest('/subscriptions', {
  params: [
    ['customer', customerId],
    ['status', 'all'],
    ['limit', '10'],
    ['expand[]', 'data.default_payment_method'],
    ['expand[]', 'data.items.data.price.product'],
  ],
});

const selectSubscription = (subscriptions) => {
  const ordered = [...(subscriptions.data || [])].sort((a, b) => b.created - a.created);
  return ordered.find((subscription) => ACTIVE_SUBSCRIPTION_STATES.has(subscription.status)) || ordered[0] || null;
};

const getPeriodEnd = (subscription) => subscription?.items?.data?.[0]?.current_period_end
  || subscription?.current_period_end
  || subscription?.cancel_at
  || subscription?.ended_at
  || null;

const subscriptionSecret = (subscription) => subscription?.latest_invoice?.confirmation_secret?.client_secret || null;

const billingSnapshot = async (customer) => {
  if (!customer) {
    return { plan: 'free', status: 'active', subscription: null, paymentMethod: null, invoices: [] };
  }
  const [subscriptions, invoices, paymentMethods] = await Promise.all([
    listSubscriptions(customer.id),
    stripeRequest('/invoices', { params: [['customer', customer.id], ['limit', '5']] }),
    stripeRequest('/payment_methods', { params: [['customer', customer.id], ['type', 'card'], ['limit', '10']] }),
  ]);
  const subscription = selectSubscription(subscriptions);
  const isPro = subscription && ENTITLED_SUBSCRIPTION_STATES.has(subscription.status);
  const subscriptionPaymentMethod = subscription?.default_payment_method;
  const preferredPaymentMethodId = typeof subscriptionPaymentMethod === 'string'
    ? subscriptionPaymentMethod
    : subscriptionPaymentMethod?.id || customer.invoice_settings?.default_payment_method || null;
  const paymentMethod = typeof subscriptionPaymentMethod === 'object' && subscriptionPaymentMethod
    ? subscriptionPaymentMethod
    : paymentMethods.data?.find((method) => method.id === preferredPaymentMethodId) || paymentMethods.data?.[0] || null;
  return {
    plan: isPro ? 'pro' : 'free',
    status: isPro ? subscription.status : 'active',
    subscription: subscription ? {
      id: subscription.id,
      cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
      periodEnd: getPeriodEnd(subscription),
      priceId: subscription.items?.data?.[0]?.price?.id || null,
    } : null,
    paymentMethod: paymentMethod && typeof paymentMethod !== 'string' ? {
      name: paymentMethod.billing_details?.name || null,
      brand: paymentMethod.card?.brand || paymentMethod.type || 'card',
      last4: paymentMethod.card?.last4 || null,
      expMonth: paymentMethod.card?.exp_month || null,
      expYear: paymentMethod.card?.exp_year || null,
      expires: paymentMethod.card ? `${String(paymentMethod.card.exp_month).padStart(2, '0')}/${String(paymentMethod.card.exp_year).slice(-2)}` : null,
      funding: paymentMethod.card?.funding || null,
      country: paymentMethod.card?.country || null,
    } : null,
    invoices: (invoices.data || []).map((invoice) => ({
      id: invoice.id,
      number: invoice.number,
      created: invoice.created,
      amountPaid: invoice.amount_paid,
      currency: invoice.currency,
      status: invoice.status,
      url: invoice.hosted_invoice_url,
    })),
  };
};

const createSubscription = async (user) => {
  const priceId = process.env.STRIPE_PRO_PRICE_ID;
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY || process.env.VITE_STRIPE_PUBLISHABLE_KEY;
  if (!priceId || !publishableKey) throw new Error('BILLING_NOT_CONFIGURED');
  const customer = await getOrCreateCustomer(user);
  const existing = selectSubscription(await listSubscriptions(customer.id));
  if (existing && ['active', 'trialing', 'past_due', 'unpaid'].includes(existing.status)) {
    return { alreadySubscribed: true, subscriptionId: existing.id };
  }
  if (existing?.status === 'incomplete') {
    const expanded = await stripeRequest(`/subscriptions/${existing.id}`, { params: [['expand[]', 'latest_invoice.confirmation_secret']] });
    return { subscriptionId: existing.id, clientSecret: subscriptionSecret(expanded), publishableKey };
  }
  const subscription = await stripeRequest('/subscriptions', {
    method: 'POST',
    params: [
      ['customer', customer.id],
      ['items[0][price]', priceId],
      ['payment_behavior', 'default_incomplete'],
      ['payment_settings[save_default_payment_method]', 'on_subscription'],
      ['billing_mode[type]', 'flexible'],
      ['metadata[supabase_user_id]', user.id],
      ['metadata[user_id]', user.id],
      ['expand[]', 'latest_invoice.confirmation_secret'],
    ],
  });
  const clientSecret = subscriptionSecret(subscription);
  if (!clientSecret) throw new Error('PAYMENT_INTENT_UNAVAILABLE');
  return { subscriptionId: subscription.id, clientSecret, publishableKey };
};

const updateCancellation = async (customer, cancelAtPeriodEnd) => {
  if (!customer) throw new Error('NO_SUBSCRIPTION');
  const subscription = selectSubscription(await listSubscriptions(customer.id));
  if (!subscription || !ACTIVE_SUBSCRIPTION_STATES.has(subscription.status)) throw new Error('NO_SUBSCRIPTION');
  await stripeRequest(`/subscriptions/${subscription.id}`, {
    method: 'POST',
    params: [['cancel_at_period_end', cancelAtPeriodEnd ? 'true' : 'false']],
  });
  return billingSnapshot(customer);
};

export default {
  async fetch(request) {
    const rateLimit = checkRateLimits(request, { namespace: 'billing', policies: BILLING_LIMITS });
    if (rateLimit.limited) return json({ error: 'Too many billing requests. Please wait and try again.', retryAfter: rateLimit.retryAfter }, 429, rateLimit.headers);
    const user = await requireUser(request).catch(() => null);
    if (!user) return json({ error: 'Sign in to manage billing.' }, 401, rateLimit.headers);

    try {
      if (request.method === 'GET') {
        const customer = await findCustomer(user);
        return json({ ...(await billingSnapshot(customer)), publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || process.env.VITE_STRIPE_PUBLISHABLE_KEY || null }, 200, rateLimit.headers);
      }
      if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, rateLimit.headers);
      const body = await request.json().catch(() => ({}));
      if (body.action === 'create-subscription') return json(await createSubscription(user), 200, rateLimit.headers);
      const customer = await findCustomer(user);
      if (body.action === 'cancel-subscription') return json(await updateCancellation(customer, true), 200, rateLimit.headers);
      if (body.action === 'resume-subscription') return json(await updateCancellation(customer, false), 200, rateLimit.headers);
      return json({ error: 'Unknown billing action.' }, 400, rateLimit.headers);
    } catch (error) {
      const code = error instanceof Error ? error.message : 'BILLING_FAILED';
      if (code === 'BILLING_NOT_CONFIGURED') return json({ error: 'Billing is not configured for this deployment yet.' }, 503, rateLimit.headers);
      if (code === 'NO_SUBSCRIPTION') return json({ error: 'No active subscription was found.' }, 404, rateLimit.headers);
      console.error('[api/billing]', code);
      return json({ error: 'Billing could not be updated right now.' }, error.status || 502, rateLimit.headers);
    }
  },
};
