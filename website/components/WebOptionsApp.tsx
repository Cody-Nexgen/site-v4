import { useEffect, useState, type ComponentType } from 'react';
import { supabase as siteSupabase } from '@/lib/supabase';
import '@/focuz-web.css';

type Props = {
  onLogout?: () => void;
};

/**
 * Full extension OptionsApp on the web via chrome.* shim.
 * Site Supabase is bound on window BEFORE any focuz modules load, so Calendar
 * and RPCs share the marketing login session (no dual GoTrueClient).
 */
export default function WebOptionsApp({ onLogout }: Props) {
  const [OptionsApp, setOptionsApp] = useState<ComponentType | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      try {
        // Must happen before the first import of @focuz/lib/supabase.
        window.__FOCUZ_SITE_SUPABASE__ = siteSupabase as never;

        const { installWebChromeShim, hydrateWebWorkspaceFromCloud } = await import(
          '@focuz/lib/platform'
        );
        const { bindSiteSupabaseClient } = await import('@focuz/lib/supabase');
        const { initializeDashboardColorMode } = await import('@focuz/lib/themes');

        installWebChromeShim();
        bindSiteSupabaseClient(siteSupabase as never);
        await initializeDashboardColorMode();

        // CSS only after focuz modules can resolve
        await Promise.all([
          import('@focuz/styles/focuzDesign.css'),
          import('@focuz/index.css'),
        ]);

        await hydrateWebWorkspaceFromCloud();
        const mod = await import('@focuz/options/OptionsApp');
        if (!cancelled) setOptionsApp(() => mod.default);
      } catch (err) {
        console.error('[WebOptionsApp] failed to boot', err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load dashboard');
        }
      }
    };

    void boot();

    const onSignOut = () => onLogout?.();
    window.addEventListener('focuznow-web-signout', onSignOut);
    return () => {
      cancelled = true;
      window.removeEventListener('focuznow-web-signout', onSignOut);
    };
  }, [onLogout]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-black px-6 text-center">
        <p className="text-sm font-medium text-white">Could not load dashboard</p>
        <p className="max-w-md text-xs text-neutral-500">{error}</p>
        <button
          type="button"
          className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black"
          onClick={() => window.location.reload()}
        >
          Reload
        </button>
      </div>
    );
  }

  if (!OptionsApp) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/30 border-t-transparent" />
      </div>
    );
  }

  return <OptionsApp />;
}
