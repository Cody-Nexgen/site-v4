// Content script to listen for session sync from web app
console.log('[Content Script] FocuzNow content script loaded on:', window.location.href);
document.documentElement.setAttribute('data-focuznow-extension', 'true');


// Listen for messages from the web app
window.addEventListener("message", (event) => {
    // Only accept messages from same origin
    if (event.origin !== window.location.origin) {
        return;
    }

    // Check if this is a FocuzNow session sync message
    if (event.data.type === "FOCUZNOW_SESSION_SYNC" || event.data.session) {
        console.log('[Content Script] ✓ Received FOCUZNOW_SESSION_SYNC message!');

        // Check if extension context is valid
        if (!chrome.runtime?.id) {
            console.error('[Content Script] Extension context invalid. The extension might have been reloaded. Please refresh the page.');
            return;
        }

        // Forward the session to the background script
        try {
            chrome.runtime.sendMessage({
                type: 'SYNC_SESSION',
                session: event.data.session
            });
        } catch (error) {
            console.error('[Content Script] Exception sending message:', error);
        }
        return;
    }

    // Check for Unblock Request from Blocked Page
    if (event.data.type === 'REQUEST_UNBLOCK_FROM_PAGE') {
        if (!chrome.runtime?.id) return;
        try {
            chrome.runtime.sendMessage({
                type: 'REQUEST_UNBLOCK',
                url: event.data.url
            });
        } catch (e) {
            console.error('[Content Script] Failed to send unblock request:', e);
        }
        return;
    }

    // Check for Open Extension Options Request
    if (event.data.type === 'OPEN_EXTENSION_OPTIONS') {
        if (!chrome.runtime?.id) return;
        const now = Date.now();
        const last = (window as unknown as { __fnOpenOptionsAt?: number }).__fnOpenOptionsAt ?? 0;
        if (now - last < 3000) return;
        (window as unknown as { __fnOpenOptionsAt: number }).__fnOpenOptionsAt = now;
        try {
            chrome.runtime.sendMessage({
                type: 'OPEN_OPTIONS',
                tab: event.data.tab,
            });
        } catch (e) {
            console.error('[Content Script] Failed to send open options request:', e);
        }
        return;
    }
    // Check for Ping from Web App
    if (event.data.type === 'FOCUZNOW_WEB_PING') {
        console.log('[Content Script] Received Ping from Web App. Sending Pong...');
        window.postMessage({ type: 'FOCUZNOW_EXTENSION_PONG' }, '*');
        return;
    }
});

// Notify web app that extension is ready
console.log('[Content Script] Sending FOCUZNOW_EXTENSION_READY message...');
window.postMessage({ type: 'FOCUZNOW_EXTENSION_READY' }, '*');

// Check for payment success page
if (window.location.pathname === '/payment_success') {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');
    if (sessionId && chrome.runtime?.id) {
        chrome.runtime.sendMessage({
            type: 'PAYMENT_SUCCESS',
            sessionId
        });
    }
}
console.log('[Content Script] Extension ready!');

// Command palette runs via commandPalette.ts on <all_urls> (skipped on focuznow.com)

