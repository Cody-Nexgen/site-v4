/**
 * focuznow.com/demo.html — the real extension UI running on demo data, embedded by the
 * landing page. Order matters: storage isolation, then the chrome.* mock, then the app.
 *
 *   ?tab=overview|sessions|calendar|statistics|…   the dashboard (OptionsApp)
 *   ?view=blocked&url=…&source=…                   the blocked-site screen (also OptionsApp)
 *   ?view=popup                                    the toolbar popup
 *   ?view=login                                    a sign-in page with the FocuzPass overlay
 *   &pomodoro=1                                    a focus session already running
 */
import './isolate';
import '@focuz/mockChrome';
import { applyPersona, startPomodoro } from './persona';

const params = new URLSearchParams(window.location.search);
const view = params.get('view') || 'app';

// Keep every dashboard tab inline instead of handing off to the web dashboard.
(window as unknown as Record<string, unknown>).__FOCUZ_STAY_EXTENSION__ = true;

/** Tell the landing page the frame has painted, so it can fade it in. */
function announceReady() {
    const post = () => window.parent?.postMessage({ type: 'fzl-demo-ready', view }, window.location.origin);
    requestAnimationFrame(() => requestAnimationFrame(() => window.setTimeout(post, 250)));
}

async function main() {
    await applyPersona();
    if (params.get('pomodoro') === '1') await startPomodoro();

    await import('@focuz/index.css');
    const { initializeDashboardColorMode } = await import('@focuz/lib/themes');
    await initializeDashboardColorMode();

    const root = document.getElementById('root')!;
    const [{ createRoot }, React] = await Promise.all([import('react-dom/client'), import('react')]);

    if (view === 'popup') {
        // PopupApp mounts itself on #root.
        await import('@focuz/popup/PopupApp');
    } else if (view === 'login') {
        const { LoginDemo } = await import('./LoginDemo');
        createRoot(root).render(React.createElement(LoginDemo));
    } else {
        const { default: OptionsApp } = await import('@focuz/options/OptionsApp');
        createRoot(root).render(React.createElement(OptionsApp));
    }
    announceReady();
}

void main();
