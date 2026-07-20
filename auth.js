import { createClient } from '@supabase/supabase-js';

const PRODUCTION_AUTH_ORIGIN = 'https://focuznow.com';
const DEFAULT_SUPABASE_URL = 'https://zbgbszatstigtbfvdfpb.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpiZ2JzemF0c3RpZ3RiZnZkZnBiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyNjY5NDAsImV4cCI6MjA3OTg0Mjk0MH0.6Uomu8F8qWp9bTCIwkj4yc48wZDMBT1U8efp9_M2vGw';
const PENDING_EXTENSION_REDIRECT_KEY = 'focuznow_redirect_extension';
const PENDING_EXTENSION_REDIRECT_AT_KEY = 'focuznow_redirect_extension_at';
const PENDING_MAX_AGE_MS = 10 * 60 * 1000;

// The anonymous key is intentionally public client configuration, protected by
// Supabase RLS. Environment values can override these production defaults.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || DEFAULT_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || DEFAULT_SUPABASE_ANON_KEY;
const isConfigured = Boolean(supabaseUrl && supabaseAnonKey);
const supabase = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

const forms = [...document.querySelectorAll('[data-auth-form]')];
const verificationForm = document.querySelector('[data-verification-form]');
let pendingVerificationEmail = '';
let handoffStarted = false;

const friendlyError = (error, fallback = 'Something went wrong. Please try again.') => {
  if (!error) return fallback;
  const message = typeof error === 'string' ? error : error.message;
  if (!message) return fallback;
  if (message === 'Failed to fetch' || /network request|fetch failed/i.test(message)) {
    return 'Network connection error. Check your connection and try again.';
  }
  if (/invalid login credentials/i.test(message)) return 'The email or password is incorrect.';
  if (/email not confirmed/i.test(message)) return 'Verify your email before signing in.';
  if (/user already registered/i.test(message)) return 'An account with this email already exists. Sign in instead.';
  return message;
};

const setMessage = (element, message = '', tone = 'error') => {
  if (!element) return;
  element.textContent = message;
  element.className = `form-message${tone === 'info' ? ' info' : ''}${tone === 'success' ? ' success' : ''}`;
};

const setLoading = (button, loading, loadingLabel) => {
  if (!button) return;
  const label = button.querySelector('span');
  if (!button.dataset.defaultLabel && label) button.dataset.defaultLabel = label.textContent;
  button.disabled = loading;
  button.classList.toggle('is-loading', loading);
  if (label) label.textContent = loading ? loadingLabel : button.dataset.defaultLabel;
};

const ensureConfigured = (messageElement) => {
  if (isConfigured) return true;
  setMessage(messageElement, 'Authentication is not configured for this deployment yet.');
  return false;
};

const getPasswordScore = (value) => [
  value.length >= 8,
  /[A-Z]/.test(value),
  /[a-z]/.test(value),
  /[0-9]/.test(value),
  /[^A-Za-z0-9]/.test(value),
].filter(Boolean).length;

const getPasswordStrength = (value) => {
  if (!value) return ['empty', 'Use 8+ characters'];
  const score = getPasswordScore(value);
  if (score <= 1) return ['weak', 'Weak password'];
  if (score <= 3) return ['fair', 'Add a number & symbol'];
  if (score === 4) return ['good', 'Good password'];
  return ['strong', 'Strong password'];
};

document.querySelectorAll('[data-toggle-password]').forEach((button) => {
  button.addEventListener('click', () => {
    const input = button.closest('.password-field').querySelector('input');
    const reveal = input.type === 'password';
    input.type = reveal ? 'text' : 'password';
    button.textContent = reveal ? 'Hide' : 'Show';
    button.setAttribute('aria-pressed', String(reveal));
  });
});

const passwordInput = document.querySelector('[data-password-input]');
const strength = document.querySelector('[data-password-strength]');
passwordInput?.addEventListener('input', () => {
  const [level, label] = getPasswordStrength(passwordInput.value);
  strength.dataset.strength = level;
  strength.querySelector('b').textContent = label;
});

const hasFocuzNowExtension = () => Boolean(document.documentElement.getAttribute('data-focuznow-extension'));

const markPendingExtensionRedirect = () => {
  sessionStorage.setItem(PENDING_EXTENSION_REDIRECT_KEY, '1');
  sessionStorage.setItem(PENDING_EXTENSION_REDIRECT_AT_KEY, String(Date.now()));
};

const consumePendingExtensionRedirect = () => {
  const pending = sessionStorage.getItem(PENDING_EXTENSION_REDIRECT_KEY) === '1';
  const at = Number(sessionStorage.getItem(PENDING_EXTENSION_REDIRECT_AT_KEY) || 0);
  sessionStorage.removeItem(PENDING_EXTENSION_REDIRECT_KEY);
  sessionStorage.removeItem(PENDING_EXTENSION_REDIRECT_AT_KEY);
  return pending && Date.now() - at <= PENDING_MAX_AGE_MS;
};

const syncSessionWithExtension = (session) => {
  window.postMessage({
    type: 'FOCUZNOW_SESSION_SYNC',
    source: 'FOCUZNOW_WEB',
    session: {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      user: session.user,
    },
  }, '*');
};

const openExtension = () => window.postMessage({ type: 'OPEN_EXTENSION_OPTIONS' }, '*');

const getOAuthRedirectUrl = () => {
  const host = window.location.hostname.replace(/^www\./, '');
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
  const extensionQuery = hasFocuzNowExtension() ? '?extension_oauth=1' : '';
  if (isLocal) return `${window.location.origin}/dashboard.html${extensionQuery}`;
  return `${PRODUCTION_AUTH_ORIGIN}/dashboard${extensionQuery}`;
};

const beginDashboardHandoff = (session) => {
  syncSessionWithExtension(session);
  markPendingExtensionRedirect();
  const host = window.location.hostname.replace(/^www\./, '');
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
  const dashboardPath = isLocal ? '/dashboard.html' : '/dashboard';
  window.location.assign(`${window.location.origin}${dashboardPath}?extension_oauth=1`);
};

const renderHandoff = (extensionDetected) => {
  let handoff = document.querySelector('[data-auth-completion]');
  if (!handoff) {
    handoff = document.createElement('section');
    handoff.className = 'auth-completion';
    handoff.dataset.authCompletion = '';
    handoff.innerHTML = `
      <div class="auth-completion-card" role="status" aria-live="polite">
        <span class="completion-orbit" aria-hidden="true"><i></i></span>
        <p>ACCOUNT CONNECTED</p>
        <h1 data-completion-title>Opening FocuzNow…</h1>
        <span data-completion-copy>Your account is being securely handed to the extension.</span>
        <div class="completion-actions">
          <button type="button" class="auth-submit" data-open-extension><span>Open extension</span><svg viewBox="0 0 18 18"><path d="M3 9h11M10 5l4 4-4 4"/></svg></button>
          <a href="./index.html">Return to website</a>
        </div>
      </div>`;
    document.body.append(handoff);
    handoff.querySelector('[data-open-extension]').addEventListener('click', openExtension);
  }

  if (!extensionDetected) {
    handoff.querySelector('[data-completion-title]').textContent = 'You’re signed in.';
    handoff.querySelector('[data-completion-copy]').textContent = 'Open FocuzNow from your Chrome toolbar to continue in the extension.';
  }
  requestAnimationFrame(() => handoff.classList.add('is-visible'));
  return handoff;
};

const completeAuthentication = async (session) => {
  if (!session || handoffStarted) return;
  handoffStarted = true;
  syncSessionWithExtension(session);
  const extensionDetected = hasFocuzNowExtension();
  const handoff = renderHandoff(extensionDetected);

  window.setTimeout(() => {
    openExtension();
    if (extensionDetected) {
      handoff.querySelector('[data-completion-title]').textContent = 'Continue in FocuzNow.';
      handoff.querySelector('[data-completion-copy]').textContent = 'Your account is synced. You can close this tab after the extension opens.';
    }
  }, 900);
};

const fetchSignInMethods = async (email) => {
  const normalized = email.trim().toLowerCase();
  if (!supabase || normalized.length < 3) return [];
  const { data, error } = await supabase.rpc('get_sign_in_methods', { p_email: normalized });
  if (error || !Array.isArray(data)) return [];
  return data.filter((provider) => provider === 'google' || provider === 'email');
};

const validateRequiredFields = (form, message) => {
  const controls = [...form.querySelectorAll('input[required]')];
  controls.forEach((control) => control.removeAttribute('aria-invalid'));
  const invalid = controls.find((control) => !control.checkValidity());
  if (!invalid) return true;
  invalid.setAttribute('aria-invalid', 'true');
  invalid.focus();
  const label = invalid.closest('label')?.childNodes[0]?.textContent?.trim().toLowerCase() || invalid.name;
  const copy = invalid.type === 'email'
    ? 'Enter a valid email address.'
    : invalid.type === 'checkbox'
      ? 'Accept the Terms and Privacy Policy to continue.'
      : `Please complete ${label}.`;
  setMessage(message, copy);
  return false;
};

const showVerificationPanel = (email) => {
  pendingVerificationEmail = email.trim().toLowerCase();
  document.querySelector('[data-verification-email]').textContent = pendingVerificationEmail;
  document.querySelector('[data-auth-panel]').hidden = true;
  const panel = document.querySelector('[data-verify-panel]');
  panel.hidden = false;
  panel.querySelector('input').focus();
};

const showSignupPanel = () => {
  document.querySelector('[data-verify-panel]').hidden = true;
  document.querySelector('[data-auth-panel]').hidden = false;
};

forms.forEach((form) => {
  const mode = form.dataset.authMode;
  const message = form.querySelector('[data-form-message]');
  const submitButton = form.querySelector('[data-submit-button]');
  const googleButton = form.querySelector('[data-google-auth]');

  googleButton?.addEventListener('click', async () => {
    setMessage(message);
    if (!ensureConfigured(message)) return;
    setLoading(googleButton, true, 'Connecting…');
    try {
      const email = form.elements.email?.value || '';
      if (email.trim()) {
        const methods = await fetchSignInMethods(email);
        if (methods.includes('email') && !methods.includes('google')) {
          throw new Error('This account uses email and password. Sign in with your password instead.');
        }
      }
      markPendingExtensionRedirect();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: getOAuthRedirectUrl() },
      });
      if (error) throw error;
    } catch (error) {
      setMessage(message, friendlyError(error, 'Failed to sign in with Google.'));
      setLoading(googleButton, false, 'Connecting…');
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setMessage(message);
    if (!validateRequiredFields(form, message) || !ensureConfigured(message)) return;
    setLoading(submitButton, true, mode === 'signin' ? 'Signing in…' : 'Creating account…');

    try {
      const email = form.elements.email.value.trim().toLowerCase();
      const password = form.elements.password.value;
      const methods = await fetchSignInMethods(email);

      if (mode === 'signin') {
        if (methods.includes('google') && !methods.includes('email')) {
          throw new Error('This account uses Google sign-in. Use “Continue with Google” instead.');
        }
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (!data.session) throw new Error('Sign-in completed without a session. Please try again.');
        beginDashboardHandoff(data.session);
        return;
      }

      if (getPasswordScore(password) < 4) {
        throw new Error('Use at least 8 characters with upper and lowercase letters, a number, and a symbol.');
      }
      if (methods.includes('google') && !methods.includes('email')) {
        throw new Error('An account with this email already uses Google. Sign in with Google instead.');
      }
      if (methods.includes('email')) {
        throw new Error('An account with this email already exists. Sign in with your password.');
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: form.elements.firstName.value.trim(),
            last_name: form.elements.lastName.value.trim(),
          },
        },
      });
      if (error) throw error;
      if (data.session) {
        beginDashboardHandoff(data.session);
      } else {
        showVerificationPanel(email);
      }
    } catch (error) {
      setMessage(message, friendlyError(error));
    } finally {
      if (!handoffStarted) setLoading(submitButton, false, '');
    }
  });
});

verificationForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const message = verificationForm.querySelector('[data-verification-message]');
  const button = verificationForm.querySelector('[data-verify-button]');
  const tokenInput = verificationForm.elements.token;
  const token = tokenInput.value.replace(/\D/g, '').slice(0, 8);
  tokenInput.value = token;
  setMessage(message);
  if (!/^\d{8}$/.test(token)) {
    setMessage(message, 'Enter the complete 8-digit verification code.');
    tokenInput.focus();
    return;
  }
  if (!ensureConfigured(message)) return;
  setLoading(button, true, 'Verifying…');
  try {
    const { data, error } = await supabase.auth.verifyOtp({
      email: pendingVerificationEmail,
      token,
      type: 'signup',
    });
    if (error) throw error;
    if (!data.session) throw new Error('Verification completed without a session. Sign in to continue.');
    beginDashboardHandoff(data.session);
  } catch (error) {
    setMessage(message, friendlyError(error, 'Invalid or expired verification code.'));
  } finally {
    if (!handoffStarted) setLoading(button, false, '');
  }
});

verificationForm?.elements.token?.addEventListener('input', (event) => {
  event.target.value = event.target.value.replace(/\D/g, '').slice(0, 8);
});

document.querySelectorAll('[data-back-to-signup]').forEach((button) => button.addEventListener('click', showSignupPanel));

document.querySelector('[data-resend-code]')?.addEventListener('click', async (event) => {
  const button = event.currentTarget;
  const message = document.querySelector('[data-verification-message]');
  if (!ensureConfigured(message)) return;
  button.disabled = true;
  setMessage(message, 'Sending a new code…', 'info');
  try {
    const { error } = await supabase.auth.resend({ type: 'signup', email: pendingVerificationEmail });
    if (error) throw error;
    setMessage(message, 'A new verification code is on its way.', 'success');
  } catch (error) {
    setMessage(message, friendlyError(error, 'Could not resend the code.'));
  } finally {
    window.setTimeout(() => { button.disabled = false; }, 3000);
  }
});

const clearAuthErrorFromUrl = () => {
  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
  const hashParams = new URLSearchParams(hash);
  const queryParams = new URLSearchParams(window.location.search);
  const error = hashParams.get('error_description') || hashParams.get('error') || queryParams.get('error_description') || queryParams.get('error');
  if (!error) return null;
  const message = decodeURIComponent(error.replace(/\+/g, ' '));
  const clean = new URL(window.location.href);
  clean.hash = '';
  clean.searchParams.delete('error');
  clean.searchParams.delete('error_code');
  clean.searchParams.delete('error_description');
  window.history.replaceState({}, '', clean.pathname + clean.search);
  return message.toLowerCase().includes('oauth state')
    ? 'Your sign-in session expired. Close other login tabs and try Google again.'
    : message;
};

const initializeAuthReturn = async () => {
  const formMessage = document.querySelector('[data-form-message]');
  const authError = clearAuthErrorFromUrl();
  if (authError) setMessage(formMessage, authError);
  if (!supabase || authError) return;

  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const pendingExtensionHandoff = consumePendingExtensionRedirect();
  const isAuthReturn = query.has('code') || query.get('extension_oauth') === '1' || hash.has('access_token') || pendingExtensionHandoff;
  if (!isAuthReturn) return;

  setMessage(formMessage, 'Finishing your secure sign-in…', 'info');
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    setMessage(formMessage, friendlyError(error));
    return;
  }
  if (data.session) {
    await completeAuthentication(data.session);
  } else {
    setMessage(formMessage, 'No sign-in session was found. Return to sign in and try again.');
  }
};

if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('auth_preview') === 'verify' && verificationForm) {
  showVerificationPanel('you@example.com');
}

initializeAuthReturn();
