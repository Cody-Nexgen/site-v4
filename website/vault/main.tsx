/**
 * focuznow.com/vault.html — FocuzPass on its own, for browsers without the FocuzNow extension:
 * the same FocuzPass as the dashboard's tab, backed by the web vault. Its own page and bundle, so
 * it can move to its own origin (vault.focuznow.com). Boots like WebOptionsApp: the site's
 * Supabase client and the chrome.* shim go in before any FocuzNow module loads.
 */
import { createRoot } from 'react-dom/client';
import { supabase as siteSupabase, supabaseAnonKey, supabaseUrl } from '../lib/supabase';
import '../focuz-web.css';

const root = createRoot(document.getElementById('root')!);

async function boot() {
    window.__FOCUZ_SITE_SUPABASE__ = siteSupabase as never;
    const { installWebChromeShim } = await import('@focuz/lib/platform');
    installWebChromeShim();
    const { bindSiteSupabaseClient } = await import('@focuz/lib/supabase');
    bindSiteSupabaseClient(siteSupabase as never, { url: supabaseUrl, anonKey: supabaseAnonKey });
    const { initializeDashboardColorMode } = await import('@focuz/lib/themes');
    await initializeDashboardColorMode().catch(() => undefined);
    await Promise.all([import('@focuz/styles/focuzDesign.css'), import('@focuz/index.css')]);
    document.documentElement.classList.add('focuz-web-dashboard');
    const { WebVaultApp } = await import('./WebVaultApp');

    if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('demo')) {
        // Dev only: a sample vault in an in-memory cloud (production builds drop this branch).
        const { demoCloud, DEMO_MASTER_PASSWORD } = await import('./demo');
        const demo = await demoCloud();
        root.render(<WebVaultApp demo={{ store: demo.store, email: demo.email, hint: `Security Key ${demo.secretKey} · master password ${DEMO_MASTER_PASSWORD}` }} />);
        return;
    }
    root.render(<WebVaultApp />);
}

void boot();
