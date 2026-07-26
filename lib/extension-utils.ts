const PENDING_EXTENSION_REDIRECT_KEY = 'focuznow_redirect_extension';
const PENDING_EXTENSION_REDIRECT_AT_KEY = 'focuznow_redirect_extension_at';
const PENDING_MAX_AGE_MS = 10 * 60 * 1000;

export const hasFocuzNowExtension = (): boolean => {
  if (typeof document === 'undefined') return false;
  return !!document.documentElement.getAttribute('data-focuznow-extension');
};

/** Only used for explicit extension connect flows (`extension_oauth=1`). */
export const markPendingExtensionRedirect = () => {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(PENDING_EXTENSION_REDIRECT_KEY, '1');
  sessionStorage.setItem(PENDING_EXTENSION_REDIRECT_AT_KEY, String(Date.now()));
};

export const consumePendingExtensionRedirect = (): boolean => {
  if (typeof sessionStorage === 'undefined') return false;
  const pending = sessionStorage.getItem(PENDING_EXTENSION_REDIRECT_KEY) === '1';
  const at = Number(sessionStorage.getItem(PENDING_EXTENSION_REDIRECT_AT_KEY) || 0);
  sessionStorage.removeItem(PENDING_EXTENSION_REDIRECT_KEY);
  sessionStorage.removeItem(PENDING_EXTENSION_REDIRECT_AT_KEY);
  if (!pending) return false;
  return Date.now() - at <= PENDING_MAX_AGE_MS;
};

export const hasExtensionOAuthParam = (): boolean => {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('extension_oauth') === '1' || params.get('extension_handoff') === '1';
};

/** Handoff ONLY when explicitly requested — never on every fresh sign-in. */
export const shouldHandoffToExtension = (_opts?: { freshSignIn?: boolean }): boolean => {
  if (!hasFocuzNowExtension()) return false;
  if (hasExtensionOAuthParam()) return true;
  if (consumePendingExtensionRedirect()) return true;
  return false;
};

export const clearExtensionOAuthParam = () => {
  if (typeof window === 'undefined') return;
  const clean = new URL(window.location.href);
  let changed = false;
  for (const key of ['extension_oauth', 'extension_handoff']) {
    if (clean.searchParams.has(key)) {
      clean.searchParams.delete(key);
      changed = true;
    }
  }
  if (!changed) return;
  window.history.replaceState({}, '', clean.pathname + clean.search + clean.hash);
};

export const syncSessionWithExtension = (session: any) => {
  if (!session) return;

  window.postMessage(
    {
      type: "FOCUZNOW_SESSION_SYNC",
      source: "FOCUZNOW_WEB",
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        user: session.user,
      },
    },
    "*"
  );
};

export const redirectToExtension = () => {
  window.postMessage({ type: "OPEN_EXTENSION_OPTIONS" }, "*");
};
