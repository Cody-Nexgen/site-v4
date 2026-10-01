/**
 * Keeps the extension responsive while it matters.
 *
 * Browsers run an extension's process at idle priority (Windows "efficiency mode")
 * whenever none of its pages are visible. On a busy machine that made every
 * request to the service worker wait seconds — FocuzPass lookups timed out and the
 * secure unlock window took ages to open. An extension frame on the page counts as
 * visible, so while one is present the worker answers immediately (measured: 1–7 s
 * waits → ~1 ms). The frame is 1×1, transparent, inert, and only kept while its
 * owner (login fields / the dashboard) is on screen.
 */

const ANCHOR_ID = 'focuznow-extension-anchor';
const ANCHOR_PAGE = 'focuzpass-anchor.html';

type AnchorWindow = Window & { __focuznowAnchorOwners?: Set<string> };

function owners(): Set<string> {
    const w = window as AnchorWindow;
    if (!w.__focuznowAnchorOwners) w.__focuznowAnchorOwners = new Set();
    return w.__focuznowAnchorOwners;
}

export function holdExtensionAnchor(owner: string) {
    owners().add(owner);
    if (typeof chrome === 'undefined' || !chrome.runtime?.id) return;
    const url = chrome.runtime.getURL(ANCHOR_PAGE);
    const existing = document.getElementById(ANCHOR_ID) as HTMLIFrameElement | null;
    // A frame left by a previous (reloaded) extension instance no longer helps.
    if (existing && existing.src === url) return;
    existing?.remove();
    const frame = document.createElement('iframe');
    frame.id = ANCHOR_ID;
    frame.src = url;
    frame.title = '';
    frame.tabIndex = -1;
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'all:initial;position:fixed;left:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none;z-index:-2147483647;';
    document.documentElement.appendChild(frame);
}

export function releaseExtensionAnchor(owner: string) {
    const set = owners();
    set.delete(owner);
    if (set.size === 0) document.getElementById(ANCHOR_ID)?.remove();
}
