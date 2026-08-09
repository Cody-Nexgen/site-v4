import { useEffect, useState, type ComponentType } from 'react';
import {
  installWebChromeShim,
  hydrateWebWorkspaceFromCloud,
} from '@focuz/lib/platform';
import { initializeDashboardColorMode } from '@focuz/lib/themes';
import '@focuz/styles/focuzDesign.css';
import '@focuz/index.css';
import '@/focuz-web.css';

type Props = {
  onLogout?: () => void;
};

/**
 * Full extension OptionsApp on the web via chrome.* shim.
 * OptionsApp is loaded dynamically AFTER the shim — store.ts registers
 * chrome.storage/runtime listeners at module scope.
 */
export default function WebOptionsApp({ onLogout }: Props) {
  const [OptionsApp, setOptionsApp] = useState<ComponentType | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      try {
        installWebChromeShim();
        await initializeDashboardColorMode();
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
