import { supabase } from './supabase-client.js';

const AUTH_RETURN_KEY = 'focuznow_after_auth';
const DEFAULT_INSTALL_URL = 'mailto:hello@focuznow.com?subject=Get%20FocuzNow';

const getBrowserName = async () => {
  const preview = import.meta.env.DEV && new URLSearchParams(location.search).get('browser_preview');
  if (preview) {
    const normalized = preview.charAt(0).toUpperCase() + preview.slice(1).toLowerCase();
    return ['Chrome', 'Edge', 'Opera', 'Brave', 'Vivaldi', 'Yandex'].includes(normalized) ? normalized : 'Chrome';
  }
  try {
    if (await navigator.brave?.isBrave?.()) return 'Brave';
  } catch { /* Browser detection falls through to the user agent. */ }
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR\//.test(ua)) return 'Opera';
  if (/Vivaldi\//.test(ua)) return 'Vivaldi';
  if (/YaBrowser\//.test(ua)) return 'Yandex';
  if (/(Chrome|CriOS)\//.test(ua)) return 'Chrome';
  return 'Chrome';
};

const installUrlFor = (browser) => {
  if (browser === 'Edge') return import.meta.env.VITE_EDGE_EXTENSION_URL?.trim() || import.meta.env.VITE_CHROME_EXTENSION_URL?.trim() || DEFAULT_INSTALL_URL;
  if (browser === 'Opera') return import.meta.env.VITE_OPERA_EXTENSION_URL?.trim() || import.meta.env.VITE_CHROME_EXTENSION_URL?.trim() || DEFAULT_INSTALL_URL;
  return import.meta.env.VITE_CHROME_EXTENSION_URL?.trim() || DEFAULT_INSTALL_URL;
};

const setInstallLabel = (element, label) => {
  const target = element.querySelector('[data-install-label], span') || element;
  target.textContent = label;
  element.setAttribute('aria-label', label);
};

let extensionInstalled = document.documentElement.hasAttribute('data-focuznow-extension')
  || (import.meta.env.DEV && new URLSearchParams(location.search).get('extension_preview') === 'installed');

const updateInstallActions = async () => {
  const browser = await getBrowserName();
  document.querySelectorAll('[data-install-cta]').forEach((element) => {
    if (extensionInstalled && element.hasAttribute('data-install-header')) {
      setInstallLabel(element, 'Dashboard');
      element.href = '/dashboard';
      element.dataset.opensExtension = 'true';
      return;
    }
    setInstallLabel(element, `Add to ${browser}${element.dataset.installSuffix || ''}`);
    element.href = installUrlFor(browser);
    delete element.dataset.opensExtension;
  });
};

const markExtensionInstalled = () => {
  if (extensionInstalled) return;
  extensionInstalled = true;
  updateInstallActions();
};

addEventListener('message', (event) => {
  if (event.origin !== location.origin) return;
  if (event.data?.type === 'FOCUZNOW_EXTENSION_READY' || event.data?.type === 'FOCUZNOW_EXTENSION_PONG') markExtensionInstalled();
});

new MutationObserver(() => {
  if (document.documentElement.hasAttribute('data-focuznow-extension')) markExtensionInstalled();
}).observe(document.documentElement, { attributes: true, attributeFilter: ['data-focuznow-extension'] });

addEventListener('click', async (event) => {
  const installAction = event.target.closest('[data-install-cta][data-opens-extension="true"]');
  if (installAction) {
    event.preventDefault();
    window.postMessage({ type: 'OPEN_EXTENSION_OPTIONS' }, '*');
    return;
  }

  const proAction = event.target.closest('[data-pro-cta]');
  if (!proAction) return;
  event.preventDefault();
  const returnPath = '/billing?checkout=pro&from=auth';
  localStorage.setItem(AUTH_RETURN_KEY, returnPath);
  const { data } = await supabase.auth.getSession();
  location.assign(data.session ? '/billing?checkout=pro' : `/signup?plan=pro&next=${encodeURIComponent(returnPath)}`);
});

window.postMessage({ type: 'FOCUZNOW_WEB_PING' }, '*');
updateInstallActions();

export { AUTH_RETURN_KEY };
