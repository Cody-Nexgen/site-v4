/**
 * Page ↔ extension bridge for focuznow.com (and local dashboards).
 * Kept as a shared module so both the site content script and the
 * always-on command-palette script can install it (stale builds still
 * pick up RPC if either script is updated).
 */

const BRIDGE_FLAG = '__focuznowWebBridgeInstalled';

function isDashboardHost(hostname: string): boolean {
    return (
        hostname === 'focuznow.com' ||
        hostname === 'www.focuznow.com' ||
        hostname === 'dashboard.focuznow.com' ||
        hostname === 'localhost' ||
        hostname === '127.0.0.1'
    );
}

export function installWebExtensionBridge(): void {
    if (typeof window === 'undefined') return;
    if (!isDashboardHost(window.location.hostname)) return;

    const w = window as unknown as Record<string, unknown>;
    if (w[BRIDGE_FLAG]) return;
    w[BRIDGE_FLAG] = true;

    document.documentElement.setAttribute('data-focuznow-extension', 'true');
    document.documentElement.setAttribute('data-focuznow-bridge', 'rpc-v1');

    window.addEventListener('message', (event) => {
        if (event.source !== window) return;
        if (event.origin !== window.location.origin) return;
        const data = event.data;
        if (!data || typeof data !== 'object') return;

        if (data.type === 'FOCUZNOW_WEB_PING') {
            window.postMessage(
                {
                    type: 'FOCUZNOW_EXTENSION_PONG',
                    bridge: 'rpc-v1',
                    extensionId: chrome.runtime?.id || null,
                },
                '*',
            );
            return;
        }

        if (data.type === 'FOCUZNOW_EXTENSION_RPC') {
            const requestId = data.requestId;
            const message = data.message;
            if (!chrome.runtime?.id) {
                window.postMessage(
                    {
                        type: 'FOCUZNOW_EXTENSION_RPC_RESULT',
                        requestId,
                        ok: false,
                        needsExtension: true,
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
    });

    window.postMessage(
        {
            type: 'FOCUZNOW_EXTENSION_READY',
            bridge: 'rpc-v1',
            extensionId: chrome.runtime?.id || null,
        },
        '*',
    );
}
