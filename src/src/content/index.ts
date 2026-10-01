// Content script for the FocuzNow website: session sync + "open the extension" requests.
import { installWebExtensionBridge, isTrustedSitePage } from './webBridge';

installWebExtensionBridge();
// The manifest also runs this on the site's local dev ports; a Web Store install ignores those.
const trustedSite = isTrustedSitePage();

function sendToExtension(message: Record<string, unknown>) {
    // After an extension reload this script is orphaned; a fresh copy is injected
    // and handles messages, so stay quiet here.
    if (!chrome.runtime?.id) return;
    chrome.runtime.sendMessage(message).catch(() => undefined);
}

// Messages from the web app (same window, same origin only).
window.addEventListener('message', (event) => {
    if (!trustedSite) return;
    if (event.source !== window || event.origin !== window.location.origin) return;
    const data = event.data;
    if (!data || typeof data !== 'object') return;

    if (data.type === 'FOCUZNOW_SESSION_SYNC') {
        if (data.session) sendToExtension({ type: 'SYNC_SESSION', session: data.session });
        return;
    }

    if (data.type === 'OPEN_EXTENSION_OPTIONS') {
        const w = window as unknown as { __fnOpenOptionsAt?: number };
        const now = Date.now();
        if (now - (w.__fnOpenOptionsAt ?? 0) < 3000) return;
        w.__fnOpenOptionsAt = now;
        sendToExtension({ type: 'OPEN_OPTIONS', tab: data.tab });
    }
});

// Payment success page → let the extension celebrate the upgrade.
if (trustedSite && window.location.pathname === '/payment_success') {
    const sessionId = new URLSearchParams(window.location.search).get('session_id');
    if (sessionId) sendToExtension({ type: 'PAYMENT_SUCCESS', sessionId });
}
