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
let stripe = null;
let elements = null;
let paymentMounted = false;

if (query.get('from') === 'auth') document.body.classList.add('billing-from-auth');

const formatDate = (timestamp) => timestamp
  ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(timestamp * 1000))
  : 'No expiration';

const formatMoney = (amount, currency = 'usd') => new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format((amount || 0) / 100);

const showNotice = (message) => {
  const notice = document.querySelector('[data-billing-notice]');
  notice.querySelector('p').textContent = message;
  notice.hidden = false;
};

document.querySelector('[data-billing-notice] button')?.addEventListener('click', (event) => { event.currentTarget.parentElement.hidden = true; });

const mockSnapshot = (mode) => mode === 'pro' ? {
  plan: 'pro', status: 'active', subscription: { cancelAtPeriodEnd: false, periodEnd: Math.floor(Date.now() / 1000) + 86400 * 24 },
  paymentMethod: { brand: 'visa', last4: '4242', expires: '09/29' },
  invoices: [{ id: 'demo', number: 'FN-0001', created: Math.floor(Date.now() / 1000) - 86400 * 7, amountPaid: 800, currency: 'usd', status: 'paid', url: '#' }],
} : { plan: 'free', status: 'active', subscription: null, paymentMethod: null, invoices: [] };

const billingRequest = async (method = 'GET', body) => {
  const response = await fetch('/api/billing', {
    method,
    headers: { Authorization: `Bearer ${session.access_token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Billing could not be loaded.');
  return data;
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
    label.textContent = invoice.number || 'FocuzNow Pro';
    const date = document.createElement('span');
    date.textContent = formatDate(invoice.created);
    const status = document.createElement('em');
    status.textContent = `${formatMoney(invoice.amountPaid, invoice.currency)} · ${invoice.status}`;
    const link = document.createElement('a');
    link.href = invoice.url || '#';
    link.textContent = '↗';
    link.target = '_blank';
    link.rel = 'noreferrer';
    row.append(label, date, status, link);
    return row;
  }));
};

const renderSnapshot = (data) => {
  snapshot = data;
  const isPro = data.plan === 'pro';
  const canceling = Boolean(data.subscription?.cancelAtPeriodEnd);
  const periodDate = isPro ? formatDate(data.subscription?.periodEnd) : 'No expiration';
  document.querySelector('[data-plan-name]').textContent = isPro ? 'FocuzNow Pro' : 'FocuzNow Free';
  document.querySelector('[data-plan-mark]').textContent = isPro ? 'P' : 'F';
  document.querySelector('[data-plan-copy]').textContent = isPro ? 'The complete focus system is unlocked.' : 'The essentials for protecting your attention.';
  document.querySelector('[data-plan-status]').textContent = canceling ? 'ENDS SOON' : data.status.toUpperCase();
  document.querySelector('[data-plan-price]').textContent = isPro ? '$8 / month' : '$0 forever';
  document.querySelector('[data-period-label]').textContent = canceling ? 'EXPIRES' : isPro ? 'RENEWS' : 'EXPIRY';
  document.querySelector('[data-period-date]').textContent = periodDate;
  document.querySelector('[data-account-state]').textContent = isPro ? 'Pro access' : 'Free access';
  document.querySelector('[data-renewal-date]').textContent = isPro ? periodDate : 'Whenever you’re ready';
  document.querySelector('[data-renewal-copy]').textContent = isPro
    ? canceling ? 'Pro remains available until this date.' : 'Your subscription renews automatically on this date.'
    : 'Free has no expiration and requires no payment method.';
  document.querySelector('[data-payment-brand]').textContent = data.paymentMethod?.brand?.toUpperCase() || 'NOT REQUIRED';
  document.querySelector('[data-payment-last4]').textContent = data.paymentMethod?.last4 ? `•••• ${data.paymentMethod.last4}` : '••••';
  document.querySelector('[data-payment-copy]').textContent = data.paymentMethod
    ? `${data.paymentMethod.brand.toUpperCase()} ending ${data.paymentMethod.last4} · expires ${data.paymentMethod.expires}`
    : 'Add a payment method only when you choose Pro.';
  document.querySelector('[data-coverage-summary]').textContent = isPro ? 'Every FocuzNow surface is included in your plan.' : 'Upgrade once to unlock the complete system.';
  document.querySelectorAll('[data-pro-feature]').forEach((feature) => feature.classList.toggle('is-included', isPro || feature.dataset.proFeature === 'core'));
  document.querySelectorAll('[data-pro-feature] em').forEach((label, index) => { label.textContent = isPro || index === 0 ? 'INCLUDED' : 'PRO'; });
  const upgrade = document.querySelector('[data-upgrade-plan]');
  upgrade.hidden = isPro;
  document.querySelector('[data-manage-plan]').hidden = !isPro;
  document.querySelector('[data-manager-copy]').textContent = canceling ? 'Your plan is scheduled to end, but you can keep it active.' : 'Your Pro plan renews automatically unless you change it.';
  document.querySelector('[data-manager-status]').textContent = canceling ? 'Ends at period close' : 'Active';
  document.querySelector('[data-manager-date]').textContent = periodDate;
  document.querySelector('[data-cancel-plan]').hidden = canceling;
  document.querySelector('[data-resume-plan]').hidden = !canceling;
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
  const data = preview ? mockSnapshot(preview === 'pro' ? 'pro' : 'free') : await billingRequest();
  renderSnapshot(data);
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
  const name = metadata.full_name || metadata.name || [metadata.first_name, metadata.last_name].filter(Boolean).join(' ') || session.user.email;
  document.querySelector('[data-billing-identity]').textContent = `${name} · ${session.user.email}`;
  try { await refreshBilling(); }
  catch (error) { dashboard.setAttribute('aria-busy', 'false'); showNotice(error.message); }
  if (query.get('upgraded') === '1' || query.get('payment') === 'return') showNotice('Your payment was received. Pro access is being confirmed.');
  if (query.get('checkout') === 'pro' || preview === 'checkout') openCheckout();
};

initialize();
