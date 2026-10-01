import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import { EmbedApp } from './EmbedApp';
import { applyDashboardColorMode, initializeDashboardColorMode } from '../lib/themes';
import { isTrustedSiteOrigin } from '../lib/trustedOrigins';
import { readHostToEmbed } from '../lib/focuzPass/embed';
import { reloadWhenExtensionReloaded } from '../lib/focuzPass/extensionReload';

/**
 * FocuzPass for the FocuzNow website, as a frame of this extension page. The code comes from
 * the extension, and the site can't reach into the frame, so the vault never touches site code.
 */

/** The page that framed us: only the FocuzNow site itself (not something framing the site). */
function hostOrigin(): string | null {
    if (window.top === window) return null;
    const ancestors = window.location.ancestorOrigins;
    if (!ancestors || ancestors.length !== 1) return null;
    return isTrustedSiteOrigin(ancestors[0]) ? ancestors[0] : null;
}

const host = hostOrigin();
const refused = window.top !== window && !host;
const params = new URLSearchParams(window.location.search);
const view = params.get('view') === 'receive' ? 'receive' : 'vault';
const themeParam = params.get('theme');

// A code from a focuznow.com/pwcode#CODE link: read once, then out of the frame's history. It's
// kept for this frame's session too, so a reload after an extension update doesn't lose it.
const LINK_CODE_KEY = 'focuzpass.embed.link-code';
function takeLinkCode(): string | undefined {
    const fromHash = window.location.hash.replace(/^#/, '');
    if (fromHash) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        try {
            sessionStorage.setItem(LINK_CODE_KEY, JSON.stringify({ code: fromHash, at: Date.now() }));
        } catch {
            /* storage blocked: the code still works for this load */
        }
        return fromHash;
    }
    try {
        const saved = JSON.parse(sessionStorage.getItem(LINK_CODE_KEY) || 'null') as { code?: unknown; at?: unknown } | null;
        // Transfer codes are short-lived; an old one would only fail.
        if (saved && typeof saved.code === 'string' && typeof saved.at === 'number' && Date.now() - saved.at < 10 * 60_000) return saved.code;
        sessionStorage.removeItem(LINK_CODE_KEY);
    } catch {
        /* nothing saved */
    }
    return undefined;
}
const linkCode = takeLinkCode();

// Left open across an extension reload or update: reload into the new copy (in this frame only).
reloadWhenExtensionReloaded();

if (themeParam === 'light' || themeParam === 'dark') applyDashboardColorMode(themeParam);
else void initializeDashboardColorMode();

// The site may only change the theme.
window.addEventListener('message', (event) => {
    if (!host || event.source !== window.parent || event.origin !== host) return;
    const message = readHostToEmbed(event.data);
    if (message) applyDashboardColorMode(message.mode);
});

if (view === 'receive') {
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
}

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <EmbedApp host={host} refused={refused} view={view} params={params} linkCode={linkCode} />
    </StrictMode>,
);
