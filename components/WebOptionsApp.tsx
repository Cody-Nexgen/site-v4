import { useEffect, useState, type ComponentType } from 'react';
import { installWebChromeShim, hydrateWebWorkspaceFromCloud } from '@/src/focuz/lib/platform';
import { initializeDashboardColorMode } from '@/src/focuz/lib/themes';
import '@/src/focuz/styles/focuzDesign.css';
import '@/src/focuz-web.css';

type Props = {
  onLogout?: () => void;
};

/**
 * Full extension OptionsApp mounted on the web with a chrome.* shim.
 * OptionsApp is loaded dynamically AFTER the shim is installed — store.ts
 * registers chrome.storage/runtime listeners at module scope.
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
        const mod = await import('@/src/focuz/options/OptionsApp');
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
          className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white"
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
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-sky-500 border-t-transparent" />
      </div>
    );
  }

  return <OptionsApp />;
}
