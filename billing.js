import { supabase } from './supabase-client.js';

const query = new URLSearchParams(location.search);
const preview = import.meta.env.DEV ? query.get('billing_preview') : null;
const dashboard = document.querySelector('[data-billing-dashboard]');
const checkout = document.querySelector('[data-billing-checkout]');
const manager = document.querySelector('[data-billing-manager]');
const paymentForm = document.querySelector('[data-payment-form]');
const paymentSubmit = document.querySelector('[data-payment-submit]');
const paymentMessage = document.querySelector('[data-payment-message]');
let session = null;
let snapshot = null;
let accountName = 'FocuzNow Member';
let stripe = null;
let elements = null;
let paymentMounted = false;

if (query.get('from') === 'auth') document.body.classList.add('billing-from-auth');

const asText = (value, fallback = '') => typeof value === 'string' && value.trim() ? value.trim() : fallback;
const asNumber = (value) => Number.isFinite(Number(value)) ? Number(value) : null;

const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number' || /^\d+$/.test(String(value))) {
    const numeric = Number(value);
    const date = new Date(numeric < 10_000_000_000 ? numeric * 1000 : numeric);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDate = (value, fallback = 'Not scheduled') => {
  const date = toDate(value);
  return date ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date) : fallback;
};

const formatMoney = (amount, currency = 'usd') => {
  const safeCurrency = /^[a-z]{3}$/i.test(asText(currency, 'usd')) ? asText(currency, 'usd').toUpperCase() : 'USD';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: safeCurrency }).format((asNumber(amount) || 0) / 100);
};

const brandKey = (value) => {
  const brand = asText(value, 'card').toLowerCase().replace(/[\s_-]+/g, '');
  if (brand === 'americanexpress') return 'amex';
  if (brand === 'mastercard') return 'mastercard';
  if (brand === 'dinersclub') return 'diners';
  return ['visa', 'amex', 'discover', 'jcb', 'unionpay', 'diners'].includes(brand) ? brand : 'card';
};

const brandLabel = (value) => ({
  visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express', discover: 'Discover',
  jcb: 'JCB', unionpay: 'UnionPay', diners: 'Diners Club', card: 'Card',
})[brandKey(value)];

const normalizePaymentMethod = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const last4 = String(raw.last4 || raw.last_4 || '').replace(/\D/g, '').slice(-4);
  const expMonth = asNumber(raw.expMonth ?? raw.exp_month);
  const expYear = asNumber(raw.expYear ?? raw.exp_year);
  const expires = asText(raw.expires, expMonth && expYear ? `${String(expMonth).padStart(2, '0')}/${String(expYear).slice(-2)}` : '');
  if (!last4 && !raw.brand && !expires) return null;
  return { name: asText(raw.name || raw.cardholderName || raw.cardholder_name), brand: brandKey(raw.brand), last4, expMonth, expYear, expires, funding: asText(raw.funding), country: asText(raw.country) };
};

const normalizeInvoice = (raw) => ({
  id: asText(raw?.id, crypto.randomUUID?.() || String(Math.random())),
  number: asText(raw?.number, 'FocuzNow Pro'),
  created: raw?.created || raw?.created_at || null,
  amountPaid: asNumber(raw?.amountPaid ?? raw?.amount_paid) || 0,
  currency: asText(raw?.currency, 'usd'),
  status: asText(raw?.status, 'paid'),
  url: asText(raw?.url || raw?.hosted_invoice_url),
});

const normalizeSnapshot = (raw = {}) => {
  const subscriptionRaw = raw.subscription && typeof raw.subscription === 'object' ? raw.subscription : null;
  const rawStatus = asText(raw.status || subscriptionRaw?.status, 'active').toLowerCase();
  const rawPlan = asText(raw.plan).toLowerCase();
  const entitled = ['active', 'trialing', 'past_due'].includes(rawStatus);
  const plan = rawPlan === 'pro' || (!rawPlan && subscriptionRaw && entitled) ? 'pro' : 'free';
  return {
    plan,
    status: rawStatus || 'active',
    subscription: subscriptionRaw ? {
      id: asText(subscriptionRaw.id),
      cancelAtPeriodEnd: Boolean(subscriptionRaw.cancelAtPeriodEnd ?? subscriptionRaw.cancel_at_period_end),
      periodEnd: subscriptionRaw.periodEnd || subscriptionRaw.current_period_end || subscriptionRaw.cancel_at || null,
      priceId: asText(subscriptionRaw.priceId || subscriptionRaw.price_id),
    } : null,
    paymentMethod: normalizePaymentMethod(raw.paymentMethod || raw.payment_method),
    invoices: Array.isArray(raw.invoices) ? raw.invoices.map(normalizeInvoice) : [],
    warnings: Array.isArray(raw.warnings) ? raw.warnings.filter((warning) => typeof warning === 'string') : [],
    source: asText(raw.source, 'stripe'),
  };
};

const showNotice = (message) => {
  const notice = document.querySelector('[data-billing-notice]');
  if (!notice || !message) return;
  notice.querySelector('p').textContent = message;
  notice.hidden = false;
};

document.querySelector('[data-billing-notice] button')?.addEventListener('click', (event) => { event.currentTarget.parentElement.hidden = true; });

const mockSnapshot = (mode) => mode === 'pro' ? {
  plan: 'pro', status: 'active', subscription: { cancelAtPeriodEnd: false, periodEnd: Math.floor(Date.now() / 1000) + 86400 * 24 },
  paymentMethod: { name: 'Maya Chen', brand: 'visa', last4: '4242', expMonth: 9, expYear: 2029 },
  invoices: [{ id: 'demo', number: 'FN-0001', created: Math.floor(Date.now() / 1000) - 86400 * 7, amountPaid: 800, currency: 'usd', status: 'paid', url: '#' }],
} : { plan: 'free', status: 'active', subscription: null, paymentMethod: null, invoices: [] };

const billingRequest = async (method = 'GET', body) => {
  const response = await fetch('/api/billing', {
    method,
    headers: { Authorization: `Bearer ${session.access_token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(asText(data.error, 'Billing could not be loaded.'));
    error.status = response.status;
    throw error;
  }
  return data;
};

const loadSubscriptionFallback = async () => {
  if (!supabase || !session?.user?.id) return normalizeSnapshot();
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', session.user.id)
    .in('status', ['active', 'trialing', 'past_due'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return normalizeSnapshot();
  return normalizeSnapshot({
    plan: 'pro',
    status: data.status,
    source: 'supabase',
    subscription: {
      id: data.id || data.stripe_subscription_id || data.subscription_id,
      cancel_at_period_end: data.cancel_at_period_end,
      current_period_end: data.current_period_end || data.cancel_at,
      price_id: data.price_id,
    },
  });
};

const renderHistory = (invoices) => {
  const history = document.querySelector('[data-billing-history]');
  if (!invoices?.length) {
    history.innerHTML = '<span class="billing-empty"><i>○</i><b>No invoices yet</b><small>Your first Pro receipt will appear here.</small></span>';
    return;
  }
  history.replaceChildren(...invoices.map((invoice) => {
    const row = document.createElement('div');
    row.className = 'billing-history-row';
    const label = document.createElement('b');
    label.textContent = invoice.number;
    const date = document.createElement('span');
    date.textContent = formatDate(invoice.created, '—');
    const amount = document.createElement('em');
    amount.textContent = `${formatMoney(invoice.amountPaid, invoice.currency)} · ${invoice.status}`;
    const link = document.createElement(invoice.url ? 'a' : 'span');
    link.textContent = invoice.url ? '↗' : '—';
    if (invoice.url) { link.href = invoice.url; link.target = '_blank'; link.rel = 'noreferrer'; }
    row.append(label, date, amount, link);
    return row;
  }));
};

const renderPaymentMethod = (paymentMethod) => {
  const visual = document.querySelector('[data-card-visual]');
  const paymentLayout = document.querySelector('.payment-layout');
  const emptyState = document.querySelector('[data-payment-empty]');
  const brand = paymentMethod ? brandLabel(paymentMethod.brand) : 'Card';
  const last4 = paymentMethod?.last4 || '••••';
  const expiry = paymentMethod?.expires || '—';
  paymentLayout.hidden = !paymentMethod;
  emptyState.hidden = Boolean(paymentMethod);
  visual.dataset.brand = paymentMethod ? brandKey(paymentMethod.brand) : 'none';
  document.querySelector('[data-card-brand]').textContent = paymentMethod ? brand : 'NO CARD';
  document.querySelector('[data-card-number]').textContent = `•••• •••• •••• ${last4}`;
  document.querySelector('[data-card-expiry]').textContent = expiry;
  document.querySelector('[data-cardholder]').textContent = asText(paymentMethod?.name, 'CARDHOLDER').toUpperCase().slice(0, 26);
  document.querySelector('[data-payment-brand]').textContent = paymentMethod ? brand : 'Not on file';
  document.querySelector('[data-payment-last4]').textContent = `•••• •••• •••• ${last4}`;
  document.querySelector('[data-payment-expiry]').textContent = expiry;
  document.querySelector('[data-payment-copy]').textContent = paymentMethod
    ? `${brand} ending in ${last4}. Card details are securely stored by Stripe.`
    : 'No payment method is available for this account.';
};

const renderSnapshot = (rawData) => {
  const data = normalizeSnapshot(rawData);
  snapshot = data;
  const isPro = data.plan === 'pro';
  const canceling = Boolean(data.subscription?.cancelAtPeriodEnd);
  const hasPeriodEnd = Boolean(toDate(data.subscription?.periodEnd));
  const periodDate = isPro ? formatDate(data.subscription?.periodEnd, 'Unavailable') : 'No expiration';
  const statusLabel = data.status === 'past_due' ? 'Past due' : data.status === 'trialing' ? 'Trial' : canceling ? 'Ends soon' : isPro ? 'Active' : 'Free';
  document.querySelectorAll('[data-pro-section]').forEach((section) => { section.hidden = !isPro; });
  document.querySelector('[data-billing-description]').textContent = isPro
    ? 'Manage your plan, payment method, and billing history.'
    : 'Review your current plan or upgrade to Pro.';
  document.querySelector('[data-plan-name]').textContent = isPro ? 'FocuzNow Pro' : 'FocuzNow Free';
  document.querySelector('[data-plan-mark]').textContent = isPro ? 'P' : 'F';
  document.querySelector('[data-plan-copy]').textContent = isPro ? 'All focus tools are unlocked.' : 'Core focus tools for getting started.';
  document.querySelector('[data-plan-status]').textContent = statusLabel;
  document.querySelector('[data-plan-price]').textContent = isPro ? '$8 / month' : '$0';
  document.querySelector('[data-period-label]').textContent = canceling ? 'Access ends' : isPro ? 'Next renewal' : 'Expiration';
  document.querySelector('[data-period-date]').textContent = periodDate;
  document.querySelector('[data-account-state]').textContent = isPro ? 'Pro access' : 'Free access';
  document.querySelector('[data-renewal-date]').textContent = periodDate;
  document.querySelector('[data-renewal-copy]').textContent = isPro
    ? !hasPeriodEnd ? 'Stripe did not return a renewal date for this subscription.'
      : canceling ? `Pro remains available until ${periodDate}.` : `Renews automatically on ${periodDate}.`
    : 'No automatic renewal.';
  document.querySelector('[data-coverage-summary]').textContent = isPro ? 'All FocuzNow features are included.' : 'Upgrade to unlock the complete focus system.';
  document.querySelectorAll('[data-pro-feature]').forEach((feature) => feature.classList.toggle('is-included', isPro || feature.dataset.proFeature === 'core'));
  document.querySelectorAll('[data-pro-feature] em').forEach((label, index) => { label.textContent = isPro || index === 0 ? 'Included' : 'Pro'; });
  document.querySelector('[data-upgrade-plan]').hidden = isPro;
  document.querySelector('[data-manage-plan]').hidden = !isPro;
  document.querySelector('[data-manager-copy]').textContent = canceling ? 'Your plan is scheduled to end, but you can keep it active.' : 'Your Pro plan renews automatically unless you change it.';
  document.querySelector('[data-manager-status]').textContent = canceling ? 'Ends at period close' : statusLabel;
  document.querySelector('[data-manager-date]').textContent = periodDate;
  document.querySelector('[data-cancel-plan]').hidden = canceling;
  document.querySelector('[data-resume-plan]').hidden = !canceling;
  renderPaymentMethod(data.paymentMethod);
  renderHistory(data.invoices);
  dashboard.setAttribute('aria-busy', 'false');
};

const closeCheckout = () => { checkout.hidden = true; document.body.classList.remove('checkout-open'); };
const closeManager = () => { manager.hidden = true; };
document.querySelectorAll('[data-close-checkout]').forEach((button) => button.addEventListener('click', closeCheckout));
document.querySelectorAll('[data-close-manager]').forEach((button) => button.addEventListener('click', closeManager));
addEventListener('keydown', (event) => { if (event.key === 'Escape') { closeCheckout(); closeManager(); } });

const mountPreviewElement = () => {
  const mount = document.querySelector('#payment-element');
  mount.innerHTML = '<div style="display:grid;gap:14px"><label style="display:grid;gap:7px;color:#858790;font-size:9px">Card information<span style="height:48px;padding:16px 13px;border:1px solid rgba(255,255,255,.12);border-radius:8px;background:#15161a;color:#999ba2">4242 4242 4242 4242　09 / 29　123</span></label><label style="display:grid;gap:7px;color:#858790;font-size:9px">Name on card<span style="height:48px;padding:16px 13px;border:1px solid rgba(255,255,255,.12);border-radius:8px;background:#15161a;color:#6e7078">FocuzNow Member</span></label></div>';
  document.querySelector('[data-element-loading]').hidden = true;
  paymentSubmit.disabled = false;
  paymentMounted = true;
};

const openCheckout = async () => {
  checkout.hidden = false;
  document.body.classList.add('checkout-open');
  if (paymentMounted) return;
  if (preview) { mountPreviewElement(); return; }
  paymentMessage.textContent = '';
  try {
    const data = await billingRequest('POST', { action: 'create-subscription' });
    if (data.alreadySubscribed) { closeCheckout(); await refreshBilling(); showNotice('Your Pro subscription is already active.'); return; }
    if (!window.Stripe || !data.publishableKey || !data.clientSecret) throw new Error('Secure payment fields are not configured yet.');
    stripe = window.Stripe(data.publishableKey);
    elements = stripe.elements({
      clientSecret: data.clientSecret,
      appearance: {
        theme: 'night',
        variables: { colorPrimary: '#8583ff', colorBackground: '#15161a', colorText: '#efeff1', colorDanger: '#e07882', colorTextSecondary: '#7c7e86', borderRadius: '8px', fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif', spacingUnit: '4px' },
        rules: { '.Input': { border: '1px solid rgba(255,255,255,.1)', boxShadow: 'none' }, '.Input:focus': { borderColor: 'rgba(133,131,255,.65)', boxShadow: '0 0 0 3px rgba(119,117,255,.08)' }, '.Tab': { border: '1px solid rgba(255,255,255,.09)' }, '.Tab--selected': { borderColor: '#7775ff', boxShadow: 'none' } },
      },
    });
    const element = elements.create('payment', { layout: { type: 'accordion', defaultCollapsed: false, radios: false, spacedAccordionItems: true } });
    element.mount('#payment-element');
    element.on('ready', () => { document.querySelector('[data-element-loading]').hidden = true; paymentSubmit.disabled = false; });
    paymentMounted = true;
  } catch (error) {
    document.querySelector('[data-element-loading]').hidden = true;
    paymentMessage.textContent = error.message;
  }
};

document.querySelector('[data-upgrade-plan]').addEventListener('click', openCheckout);
document.querySelector('[data-manage-plan]').addEventListener('click', () => { manager.hidden = false; });

paymentForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  paymentSubmit.disabled = true;
  paymentSubmit.querySelector('span').textContent = 'Confirming…';
  paymentMessage.textContent = '';
  if (preview) {
    paymentMessage.className = 'billing-form-message success';
    paymentMessage.textContent = 'Preview complete — Pro is ready.';
    window.setTimeout(closeCheckout, 900);
    return;
  }
  const { error } = await stripe.confirmPayment({ elements, confirmParams: { return_url: `${location.origin}/billing?payment=return` }, redirect: 'if_required' });
  if (error) {
    paymentMessage.textContent = error.message;
    paymentSubmit.disabled = false;
    paymentSubmit.querySelector('span').textContent = 'Start Pro for $8';
    return;
  }
  paymentMessage.className = 'billing-form-message success';
  paymentMessage.textContent = 'Payment confirmed. Unlocking Pro…';
  window.setTimeout(() => location.assign('/billing?upgraded=1'), 850);
});

const updatePlan = async (action, button) => {
  button.disabled = true;
  try {
    const data = preview ? { ...snapshot, subscription: { ...snapshot.subscription, cancelAtPeriodEnd: action === 'cancel-subscription' } } : await billingRequest('POST', { action });
    renderSnapshot(data);
    closeManager();
    showNotice(action === 'cancel-subscription' ? 'Pro will remain active until the end of your billing period.' : 'Your Pro renewal is active again.');
  } catch (error) { showNotice(error.message); }
  finally { button.disabled = false; }
};

document.querySelector('[data-cancel-plan]').addEventListener('click', (event) => updatePlan('cancel-subscription', event.currentTarget));
document.querySelector('[data-resume-plan]').addEventListener('click', (event) => updatePlan('resume-subscription', event.currentTarget));

async function refreshBilling() {
  if (preview) { renderSnapshot(mockSnapshot(preview === 'pro' ? 'pro' : 'free')); return; }
  const fallback = await loadSubscriptionFallback().catch(() => normalizeSnapshot());
  try {
    const stripeSnapshot = normalizeSnapshot(await billingRequest());
    if (fallback.plan === 'pro' && stripeSnapshot.plan !== 'pro') {
      renderSnapshot({ ...stripeSnapshot, plan: fallback.plan, status: fallback.status, subscription: fallback.subscription });
    } else {
      renderSnapshot(stripeSnapshot);
    }
    if (stripeSnapshot.warnings.includes('customer_not_found')) {
      showNotice('Your Pro record points to a Stripe customer that is not available to this key. Check that Vercel uses a live secret key from the same Stripe account as the Customer Portal.');
    } else if (stripeSnapshot.warnings.includes('invoices_unavailable') || stripeSnapshot.warnings.includes('payment_method_unavailable')) {
      showNotice('Your plan loaded, but the Stripe key could not read every billing detail. Enable Customer, Payment Method, and Invoice read permissions, then redeploy.');
    }
  } catch (error) {
    renderSnapshot(fallback);
    if (fallback.plan === 'pro') showNotice('Pro access is active. Connect Stripe in Vercel to display card details and invoices.');
    else showNotice(error.message);
  }
}

const initialize = async () => {
  if (preview) {
    session = { access_token: 'preview', user: { email: 'member@focuznow.com', user_metadata: { full_name: 'FocuzNow Member' } } };
  } else {
    const { data } = await supabase.auth.getSession();
    session = data.session;
    if (!session) {
      localStorage.setItem('focuznow_after_auth', location.pathname + location.search);
      location.replace(`/login?next=${encodeURIComponent(location.pathname + location.search)}`);
      return;
    }
  }
  const metadata = session.user.user_metadata || {};
  accountName = metadata.full_name || metadata.name || [metadata.first_name, metadata.last_name].filter(Boolean).join(' ') || session.user.email?.split('@')[0] || 'FocuzNow Member';
  document.querySelector('[data-billing-identity]').textContent = `${accountName} · ${session.user.email}`;
  await refreshBilling();
  if (query.get('upgraded') === '1' || query.get('payment') === 'return') showNotice('Your payment was received. Pro access is being confirmed.');
  if (query.get('checkout') === 'pro' || preview === 'checkout') openCheckout();
};

initialize().catch((error) => {
  dashboard.setAttribute('aria-busy', 'false');
  showNotice(asText(error?.message, 'Billing could not be loaded.'));
});
