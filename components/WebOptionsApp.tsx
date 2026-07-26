import { useEffect, useState } from 'react';
import { installWebChromeShim, hydrateWebWorkspaceFromCloud } from '@/src/focuz/lib/platform';
import OptionsApp from '@/src/focuz/options/OptionsApp';
import '@/src/focuz/styles/focuzDesign.css';
import '@/src/focuz-web.css';

type Props = {
  onLogout?: () => void;
};

/**
 * Full extension OptionsApp mounted on the web with a chrome.* shim.
 */
export default function WebOptionsApp({ onLogout }: Props) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    installWebChromeShim();
    void hydrateWebWorkspaceFromCloud().finally(() => setReady(true));

    // Bridge sign-out from dashboard if host provides handler
    const onSignOut = () => onLogout?.();
    window.addEventListener('focuznow-web-signout', onSignOut);
    return () => window.removeEventListener('focuznow-web-signout', onSignOut);
  }, [onLogout]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-sky-500 border-t-transparent" />
      </div>
    );
  }

  return <OptionsApp />;
}
