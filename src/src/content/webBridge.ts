/**
 * Page ↔ extension bridge for focuznow.com (and local dashboards).
 * Kept as a shared module so both the site content script and the
 * always-on command-palette script can install it (stale builds still
 * pick up RPC if either script is updated).
 */

import { holdExtensionAnchor, releaseExtensionAnchor } from './extensionAnchor';
import { isTrustedSiteOrigin } from '../lib/trustedOrigins';
import { isWebBridgeType } from '../lib/webBridgeProtocol';
import { EMBED_PAGE } from '../lib/focuzPass/embed';

const BRIDGE_FLAG = '__focuznowWebBridgeInstalled';

/** The FocuzNow site's own top frame (its local dev servers only on unpacked installs). */
export function isTrustedSitePage(): boolean {
    return typeof window !== 'undefined' && window.top === window && isTrustedSiteOrigin(window.location.origin);
}

export function installWebExtensionBridge(): void {
    if (!isTrustedSitePage()) return;

    const w = window as unknown as Record<string, unknown>;
    if (w[BRIDGE_FLAG]) return;
    w[BRIDGE_FLAG] = true;

    document.documentElement.setAttribute('data-focuznow-extension', 'true');
    document.documentElement.setAttribute('data-focuznow-bridge', 'rpc-v1');

    // Dashboard requests (FocuzPass, blocking toggles) go to the worker; keep the
    // extension at normal priority while a FocuzNow tab is on screen.
    const syncAnchor = () => {
        if (document.visibilityState === 'visible') holdExtensionAnchor('dashboard-bridge');
        else releaseExtensionAnchor('dashboard-bridge');
    };
    syncAnchor();
    document.addEventListener('visibilitychange', syncAnchor);

    const onMessage = (event: MessageEvent) => {
        if (event.source !== window) return;
        if (event.origin !== window.location.origin) return;
        const data = event.data;
        if (!data || typeof data !== 'object') return;

        // A fresh bridge (re-injected after an extension reload) announced itself.
        // If this one was orphaned by that reload, step aside so it can't answer first.
        if (data.type === 'FOCUZNOW_EXTENSION_READY') {
            if (!chrome.runtime?.id) window.removeEventListener('message', onMessage);
            return;
        }

        if (data.type === 'FOCUZNOW_WEB_PING') {
            window.postMessage(
                {
                    type: 'FOCUZNOW_EXTENSION_PONG',
                    bridge: 'rpc-v1',
                    extensionId: chrome.runtime?.id || null,
                    // FocuzPass on the site is a frame of this page (the site never gets vault contents).
                    focuzPassEmbedUrl: chrome.runtime?.id ? chrome.runtime.getURL(EMBED_PAGE) : null,
                },
                '*',
            );
            return;
        }

        if (data.type === 'FOCUZNOW_EXTENSION_RPC') {
            const requestId = data.requestId;
            const message = data.message;
            if (!isWebBridgeType(message?.type)) {
                // Only what the dashboard needs goes through; the account session and the rest stay inside.
                window.postMessage({ type: 'FOCUZNOW_EXTENSION_RPC_RESULT', requestId, ok: false, error: 'Not available from a web page' }, '*');
                return;
            }
            if (!chrome.runtime?.id) {
                window.postMessage(
                    {
                        type: 'FOCUZNOW_EXTENSION_RPC_RESULT',
                        requestId,
                        ok: false,
                        needsExtension: true,
                        // Orphaned by an extension reload — the page waits briefly for a
                        // freshly injected bridge before trusting this answer.
                        orphaned: true,
                        error: 'Extension context unavailable. Reload the page.',
                    },
                    '*',
                );
                return;
            }
            try {
                chrome.runtime.sendMessage(message, (resp) => {
                    const lastError = chrome.runtime.lastError?.message;
                    window.postMessage(
                        {
                            type: 'FOCUZNOW_EXTENSION_RPC_RESULT',
                            requestId,
                            ...(resp && typeof resp === 'object'
                                ? resp
                                : { ok: false, error: lastError || 'No response from extension' }),
                        },
                        '*',
                    );
                });
            } catch (e) {
                window.postMessage(
                    {
                        type: 'FOCUZNOW_EXTENSION_RPC_RESULT',
                        requestId,
                        ok: false,
                        error: e instanceof Error ? e.message : 'RPC failed',
                    },
                    '*',
                );
            }
            return;
        }

        if (data.type === 'FOCUZNOW_REQUEST_STATS') {
            if (!chrome.runtime?.id) return;
            try {
                chrome.runtime.sendMessage({ type: 'EXPORT_LOCAL_STATS' }, (resp) => {
                    window.postMessage(
                        {
                            type: 'FOCUZNOW_STATS_PAYLOAD',
                            requestId: data.requestId,
                            ...(resp || { ok: false }),
                        },
                        '*',
                    );
                });
            } catch (e) {
                console.error('[FocuzNow Bridge] Failed to export stats:', e);
            }
        }
    };
    window.addEventListener('message', onMessage);

    window.postMessage(
        {
            type: 'FOCUZNOW_EXTENSION_READY',
            bridge: 'rpc-v1',
            extensionId: chrome.runtime?.id || null,
        },
        '*',
    );
}
