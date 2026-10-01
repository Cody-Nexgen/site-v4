/**
 * Dev-only harness for the FocuzPass overlay — NOT part of the extension manifest.
 * Drives `initFocuzPassOverlay` with a mocked transport that mimics the real
 * service-worker bridge, including an artificial response delay.
 */
import { initFocuzPassOverlay } from '../src/content/focuzPassOverlay';

const q = new URLSearchParams(location.search);
const DELAY_MS = Number(q.get('delay') || 60);
const STATE = q.get('state') || 'unlocked'; // unlocked | locked | unconfigured
const PENDING = q.get('pending') || 'none'; // none | new | update

const MATCH = {
    id: 'demo-1',
    type: 'login',
    title: 'Demo Site',
    identity: 'jane@example.com',
    domain: location.hostname,
    password: 'HarnessSecret!42',
    authMethod: 'PASSWORD',
    mark: 'DE',
    markTone: '#86b7d9',
};

const MATCH2 = {
    ...MATCH,
    id: 'demo-2',
    title: 'Demo Site (work)',
    identity: 'jane@work.example.com',
    password: 'WorkSecret!99',
};

const delay = () => new Promise((r) => setTimeout(r, DELAY_MS));

export function mockTransport() {
    let pendingCleared = false;
    return async function send<T>(message: Record<string, unknown>): Promise<T> {
        const t0 = performance.now();
        const type = String(message.type);
        (window as unknown as { __fpCalls?: string[] }).__fpCalls?.push(type);
        await delay();
        let out: unknown;
        switch (type) {
            case 'FOCUZPASS_STATUS':
                out = {
                    configured: STATE !== 'unconfigured',
                    unlocked: STATE === 'unlocked',
                    itemCount: 2,
                    idleLockMinutes: 15,
                    unlockedAt: STATE === 'unlocked' ? Date.now() : null,
                    absoluteLockAt: null,
                    remainingMs: null,
                    platform: 'extension',
                    passkeysExperimental: true,
                };
                break;
            case 'FOCUZPASS_PAGE_CONTEXT':
                if (STATE === 'unconfigured') {
                    out = { state: 'unconfigured', domain: location.hostname, matches: [], items: [] };
                } else if (STATE === 'locked') {
                    out = { state: 'locked', domain: location.hostname, matches: [], items: [] };
                } else {
                    const matches = q.get('nomatch') === '1' ? [] : [MATCH, MATCH2];
                    out = { state: 'ready', domain: location.hostname, matches, items: matches };
                }
                break;
            case 'FOCUZPASS_GENERATE':
                out = `Gen-${Math.random().toString(36).slice(2, 14)}!9`;
                break;
            case 'FOCUZPASS_PENDING_LOGIN':
                out = pendingCleared || PENDING === 'none'
                    ? { available: false }
                    : {
                        available: true,
                        domain: location.hostname,
                        title: 'Demo Site',
                        identity: 'jane@example.com',
                        accountCreation: PENDING === 'update' ? false : PENDING === 'new',
                        update: PENDING === 'update',
                    };
                break;
            case 'FOCUZPASS_COMMIT_PENDING_LOGIN':
                pendingCleared = true;
                out = STATE === 'locked'
                    ? { saved: true, queued: true }
                    : { saved: true };
                break;
            case 'FOCUZPASS_DISMISS_PENDING_LOGIN':
                pendingCleared = true;
                out = null;
                break;
            case 'FOCUZPASS_CAPTURE_LOGIN':
                out = { captured: false };
                break;
            case 'FOCUZPASS_MARK_USED':
                out = null;
                break;
            default:
                out = null;
        }
        if (localStorage.getItem('focuzpass:debug')) {
            console.debug(`[harness] ${type}: ${Math.round(performance.now() - t0)}ms`);
        }
        return out as T;
    };
}

export async function boot() {
    (window as unknown as { __fpCalls?: string[] }).__fpCalls = [];
    if (q.get('debug') === '1') localStorage.setItem('focuzpass:debug', '1');
    // ?baseline=1 runs the pre-§5 overlay (1200ms polling, generic router) for before/after timing.
    (window as unknown as { __fpMode?: string }).__fpMode = q.get('baseline') === '1' ? 'baseline' : 'current';
    const impl = q.get('baseline') === '1'
        ? (await import('./overlay-baseline')).initFocuzPassOverlay
        : initFocuzPassOverlay;
    try {
        impl(mockTransport());
    } catch (e) {
        (window as unknown as { __fpErr?: string }).__fpErr = String(e);
    }
}
