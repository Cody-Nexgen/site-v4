import type { Platform, PlatformMessage } from './types';
import { pickSyncableWorkspaceState } from '../workspaceSync';
import { WEB_EXTENSION_RPC_TYPES } from '../webBridgeProtocol';

const LS_PREFIX = 'focuznow.web.storage.';
const CHANGE_EVENT = 'focuznow-web-storage-changed';

type ChangeListener = (changes: Record<string, { oldValue?: unknown; newValue?: unknown }>) => void;

const messageListeners = new Set<(message: PlatformMessage) => void>();
const storageListeners = new Set<ChangeListener>();

function lsKey(key: string) {
    return `${LS_PREFIX}${key}`;
}

function readRaw(key: string): unknown {
    try {
        const raw = localStorage.getItem(lsKey(key));
        if (raw == null) return undefined;
        return JSON.parse(raw) as unknown;
    } catch {
        return undefined;
    }
}

function writeRaw(key: string, value: unknown) {
    localStorage.setItem(lsKey(key), JSON.stringify(value));
}

function removeRaw(key: string) {
    localStorage.removeItem(lsKey(key));
}

async function storageGet(keys?: string | string[] | Record<string, unknown> | null) {
    const out: Record<string, unknown> = {};
    if (keys == null) {
        for (let i = 0; i < localStorage.length; i++) {
            const full = localStorage.key(i);
            if (!full?.startsWith(LS_PREFIX)) continue;
            const key = full.slice(LS_PREFIX.length);
            out[key] = readRaw(key);
        }
        return out;
    }
    if (typeof keys === 'string') {
        const v = readRaw(keys);
        if (v !== undefined) out[keys] = v;
        return out;
    }
    if (Array.isArray(keys)) {
        for (const key of keys) {
            const v = readRaw(key);
            if (v !== undefined) out[key] = v;
        }
        return out;
    }
    for (const [key, fallback] of Object.entries(keys)) {
        const v = readRaw(key);
        out[key] = v !== undefined ? v : fallback;
    }
    return out;
}

async function storageSet(items: Record<string, unknown>, opts?: { syncCloud?: boolean }) {
    const changes: Record<string, { oldValue?: unknown; newValue?: unknown }> = {};
    for (const [key, value] of Object.entries(items)) {
        const oldValue = readRaw(key);
        try {
            if (JSON.stringify(oldValue) === JSON.stringify(value)) continue;
        } catch {
            /* fall through and write */
        }
        writeRaw(key, value);
        changes[key] = { oldValue, newValue: value };
    }
    if (Object.keys(changes).length === 0) return;
    for (const listener of storageListeners) listener(changes);
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: changes }));

    // Only upsert after intentional mutations — never during cloud hydrate / stats pull.
    if (opts?.syncCloud === false) return;
    if ('blockEngineState' in items && items.blockEngineState) scheduleCloudUpsert();
}

/*
 * Cloud upsert runs in the background, coalesced: the UI (a to-do tick, a toggle) never
 * waits on the network. Like the extension's syncSettingsInBackground.
 */
const CLOUD_UPSERT_DELAY_MS = 800;
let cloudTimer: ReturnType<typeof setTimeout> | undefined;
let cloudInFlight = false;
let cloudAgain = false;

function scheduleCloudUpsert() {
    if (typeof window === 'undefined') return;
    clearTimeout(cloudTimer);
    cloudTimer = setTimeout(() => void runCloudUpsert(), CLOUD_UPSERT_DELAY_MS);
}

async function runCloudUpsert() {
    cloudTimer = undefined;
    if (cloudInFlight) {
        cloudAgain = true;
        return;
    }
    cloudInFlight = true;
    try {
        const { supabase } = await import('../supabase');
        await supabase.rpc('upsert_my_workspace_state', { p_state: pickSyncableWorkspaceState(getEngineState()) });
    } catch {
        /* offline / unauthenticated */
    } finally {
        cloudInFlight = false;
        if (cloudAgain) {
            cloudAgain = false;
            scheduleCloudUpsert();
        }
    }
}

// Leaving the page: send a pending upsert now instead of dropping it.
if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden' && cloudTimer !== undefined) {
            clearTimeout(cloudTimer);
            void runCloudUpsert();
        }
    });
}

async function storageRemove(keys: string | string[]) {
    const list = Array.isArray(keys) ? keys : [keys];
    const changes: Record<string, { oldValue?: unknown; newValue?: unknown }> = {};
    for (const key of list) {
        changes[key] = { oldValue: readRaw(key), newValue: undefined };
        removeRaw(key);
    }
    for (const listener of storageListeners) listener(changes);
}

function getEngineState(): Record<string, unknown> {
    return (readRaw('blockEngineState') as Record<string, unknown>) || {};
}

/**
 * The website has no background service worker, so progression/challenge messages that the
 * extension normally routes to `messagerouter.js` must be handled locally here. Without this,
 * every progression action (including START_CHALLENGE) silently returned `needsExtension: true`
 * on the web, which is what produced "No active challenge was found in storage."
 */
async function handleProgressionMessage(message: PlatformMessage): Promise<unknown> {
    const type = message.type;
    const progressionService = await import('../progressionService');
    const { loadProgressionState } = await import('../focusProgression');

    switch (type) {
        case 'GET_PROGRESSION':
            return { ok: true, progression: await loadProgressionState() };

        case 'START_CHALLENGE': {
            try {
                const result = await progressionService.startChallengeById(
                    message.challengeId as string,
                    message.challenge as never,
                );
                return {
                    ok: true,
                    started: result.started,
                    active: result.active,
                    persisted: result.persisted,
                    cloudPersisted: result.cloudPersisted,
                    reason: result.reason,
                    progression: result.state,
                };
            } catch (error) {
                return {
                    ok: false,
                    started: false,
                    active: false,
                    persisted: false,
                    reason: 'handler_error',
                    error: error instanceof Error ? error.message : String(error),
                };
            }
        }

        case 'SET_CHALLENGE_FOCUS_SCORE':
            return {
                ok: true,
                progression: await progressionService.setChallengeFocusScore(Number(message.focusScore) || 0),
            };

        case 'PROGRESSION_HABIT_CHECKIN':
            await progressionService.onHabitCheckin(message.habitId as number);
            return { ok: true, progression: await loadProgressionState() };

        case 'PROGRESSION_ACHIEVEMENT':
            await progressionService.onAchievementUnlock(message.achievementId as string);
            return { ok: true, progression: await loadProgressionState() };

        case 'PURCHASE_SHOP_ITEM': {
            const result = await progressionService.purchaseShopItem(
                message.itemId as string,
                message.cost as number,
            );
            return { ...result, progression: await loadProgressionState() };
        }

        case 'EQUIP_COSMETIC':
            await progressionService.equipShopItem(
                message.cosmeticType as 'frame' | 'badge' | 'widget',
                (message.itemId as string) ?? null,
            );
            return { ok: true, progression: await loadProgressionState() };

        case 'SET_PUBLIC_PROFILE':
            await progressionService.setPublicProfileEnabled(!!message.enabled);
            return { ok: true, progression: await loadProgressionState() };

        default:
            return null;
    }
}

const PROGRESSION_MESSAGE_TYPES = new Set([
    'GET_PROGRESSION',
    'START_CHALLENGE',
    'SET_CHALLENGE_FOCUS_SCORE',
    'PROGRESSION_HABIT_CHECKIN',
    'PROGRESSION_ACHIEVEMENT',
    'PURCHASE_SHOP_ITEM',
    'EQUIP_COSMETIC',
    'SET_PUBLIC_PROFILE',
]);

// The page bridge only forwards these (see webBridgeProtocol).
function shouldUseExtensionRpc(type: string | undefined): boolean {
    if (!type) return false;
    if (type.startsWith('FUTURE_SELF_')) return true;
    return WEB_EXTENSION_RPC_TYPES.has(type);
}

export type FocuzPassEmbedLookup = { kind: 'ready'; embedUrl: string } | { kind: 'outdated' } | { kind: 'missing' };

/**
 * Where the extension's FocuzPass frame lives, asked through the page bridge. "outdated": an
 * extension from before FocuzPass moved into a frame. The bridge can install a moment after the
 * page starts, so keep asking for a little while.
 */
export function findFocuzPassEmbed(timeoutMs = 3000): Promise<FocuzPassEmbedLookup> {
    if (typeof window === 'undefined') return Promise.resolve({ kind: 'missing' });
    return new Promise((resolve) => {
        const finish = (result: FocuzPassEmbedLookup) => {
            window.clearInterval(ping);
            window.clearTimeout(timer);
            window.removeEventListener('message', onMessage);
            resolve(result);
        };
        const onMessage = (event: MessageEvent) => {
            if (event.source !== window || event.data?.type !== 'FOCUZNOW_EXTENSION_PONG') return;
            const url = event.data.focuzPassEmbedUrl;
            finish(typeof url === 'string' && url.startsWith('chrome-extension://') ? { kind: 'ready', embedUrl: url } : { kind: 'outdated' });
        };
        window.addEventListener('message', onMessage);
        const send = () => window.postMessage({ type: 'FOCUZNOW_WEB_PING' }, window.location.origin);
        const ping = window.setInterval(send, 250);
        const timer = window.setTimeout(() => finish({ kind: 'missing' }), timeoutMs);
        send();
    });
}

export function extensionPresent(): boolean {
    if (typeof document === 'undefined') return false;
    return (
        document.documentElement.getAttribute('data-focuznow-extension') === 'true' ||
        document.documentElement.getAttribute('data-focuznow-bridge') === 'rpc-v1'
    );
}

/** Forward a chrome.runtime message through the installed extension content script. */
export function sendExtensionRpc<T = unknown>(message: PlatformMessage, timeoutMs = 8000): Promise<T> {
    if (typeof window === 'undefined') {
        return Promise.resolve({ ok: false, needsExtension: true, error: 'Not in browser' } as T);
    }
    if (!extensionPresent()) {
        // Still attempt postMessage — attribute may appear a tick late — but warn clearly.
        console.warn('[FocuzNow] Extension attribute missing; attempting RPC anyway');
    }
    return new Promise((resolve) => {
        const requestId = `rpc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        let provisional: Record<string, unknown> | null = null;
        let provisionalTimer = 0;
        const finish = (payload: Record<string, unknown>) => {
            window.clearTimeout(timeout);
            window.clearTimeout(provisionalTimer);
            window.removeEventListener('message', onMessage);
            resolve(payload as T);
        };
        const timeout = window.setTimeout(() => {
            finish(provisional || {
                ok: false,
                needsExtension: true,
                error: 'The FocuzNow extension didn’t respond in time. It may still be starting up — try again in a moment.',
            });
        }, timeoutMs);

        const onMessage = (event: MessageEvent) => {
            // Content scripts post with target '*'; origin is still this page when same-window.
            if (event.source !== window && event.origin !== window.location.origin) return;
            const data = event.data;
            if (!data || data.type !== 'FOCUZNOW_EXTENSION_RPC_RESULT' || data.requestId !== requestId) return;
            const { type: _t, requestId: _r, ...payload } = data as Record<string, unknown>;
            // A bridge orphaned by an extension reload answers instantly with an error.
            // Give a freshly injected bridge a moment to answer properly first.
            const orphaned = payload.orphaned === true || /context unavailable/i.test(String(payload.error || ''));
            if (orphaned) {
                if (!provisional) {
                    provisional = payload;
                    provisionalTimer = window.setTimeout(() => finish(provisional!), 2500);
                }
                return;
            }
            finish(payload);
        };

        window.addEventListener('message', onMessage);
        window.postMessage({ type: 'FOCUZNOW_EXTENSION_RPC', requestId, message }, '*');
    });
}

function applyEngineSettingsPatch(patch: Record<string, unknown>): Record<string, unknown> {
    const current = getEngineState() as Record<string, unknown>;
    const next: Record<string, unknown> = { ...current, ...patch, _localMutationAt: Date.now() };
    if (patch.inAppBlock && typeof patch.inAppBlock === 'object') {
        const curBlock = (current.inAppBlock || {}) as Record<string, unknown>;
        const patchBlock = patch.inAppBlock as Record<string, unknown>;
        const curSmart = (curBlock.smartYouTube || {}) as Record<string, unknown>;
        const patchSmart = (patchBlock.smartYouTube || {}) as Record<string, unknown>;
        next.inAppBlock = {
            ...curBlock,
            ...patchBlock,
            smartYouTube: { ...curSmart, ...patchSmart },
        };
    }
    return next;
}

async function handleMessage(message: PlatformMessage): Promise<unknown> {
    const type = message.type;
    if (!type) return { ok: false };

    // Quick to-do (command palette): the extension handles ADD_TODO itself; on the
    // web it becomes a planner update so it goes through the same local-first path.
    if (type === 'ADD_TODO') {
        const title = String((message as { title?: unknown }).title ?? '').trim();
        if (!title) return { ok: false };
        const planner = Array.isArray(getEngineState().dailyPlanner) ? (getEngineState().dailyPlanner as unknown[]) : [];
        const res = (await handleMessage({
            type: 'UPDATE_ENGINE_SETTINGS',
            settings: { dailyPlanner: [...planner, { id: Date.now(), time: 'Anytime', task: title, done: false }] },
        })) as { ok?: boolean; state?: Record<string, unknown> };
        return { ok: res?.ok !== false, title, state: res?.state };
    }

    // Apply settings locally first so the web UI never depends on a slow/failed extension RPC.
    if (type === 'UPDATE_ENGINE_SETTINGS') {
        const patch = (message.settings || message.patch || {}) as Record<string, unknown>;
        const next = applyEngineSettingsPatch(patch);
        await storageSet({ blockEngineState: next });

        if (shouldUseExtensionRpc(type) && extensionPresent()) {
            // Fire-and-forget extension sync for real blocking; keep local state authoritative for UI.
            void sendExtensionRpc(message).then(async (rpc) => {
                const resp = rpc as { ok?: boolean; state?: Record<string, unknown> };
                if (!resp?.ok || !resp.state || typeof resp.state !== 'object') return;
                const local = getEngineState() as Record<string, unknown>;
                const localMut = Number(local._localMutationAt) || 0;
                const remoteMut = Number(resp.state._localMutationAt) || 0;
                // Don't let a slower extension round-trip roll back a newer local toggle.
                if (remoteMut > localMut) {
                    await storageSet({
                        blockEngineState: {
                            ...resp.state,
                            inAppBlock: local.inAppBlock ?? resp.state.inAppBlock,
                            _localMutationAt: Math.max(localMut, remoteMut),
                        },
                    }, { syncCloud: false });
                }
            });
        }

        return { ok: true, state: next };
    }

    if (shouldUseExtensionRpc(type)) {
        const rpc = await sendExtensionRpc(message);
        // After blocking/settings mutations, mirror engine state into web storage when provided.
        const resp = rpc as { ok?: boolean; state?: Record<string, unknown>; needsExtension?: boolean };
        if (resp?.ok && resp.state && typeof resp.state === 'object') {
            await storageSet({ blockEngineState: { ...getEngineState(), ...resp.state } });
        } else if (
            resp?.ok &&
            (type === 'CATEGORY_TOGGLE' ||
                type === 'ADD_BLOCK' ||
                type === 'REMOVE_BLOCK' ||
                type === 'REMOVE_BLOCK_SOURCE' ||
                type === 'ADD_ALLOWED_SITE' ||
                type === 'REMOVE_ALLOWED_SITE' ||
                type === 'START_NUCLEAR' ||
                type === 'SCHEDULE_ADD' ||
                type === 'SCHEDULE_REMOVE')
        ) {
            const stateResp = await sendExtensionRpc<{ ok?: boolean; state?: Record<string, unknown> }>({
                type: 'GET_STATE',
            });
            if (stateResp?.state) {
                await storageSet({ blockEngineState: stateResp.state });
            }
        }
        return rpc;
    }

    if (PROGRESSION_MESSAGE_TYPES.has(type)) {
        const result = await handleProgressionMessage(message);
        if (result !== null) return result;
    }

    if (type === 'GET_STATE' || type === 'GET_ENGINE_STATE') {
        // Prefer extension when present so refresh matches live blocking state.
        if (extensionPresent()) {
            const rpc = await sendExtensionRpc<{ ok?: boolean; state?: Record<string, unknown> }>({ type: 'GET_STATE' });
            if (rpc?.ok && rpc.state && typeof rpc.state === 'object') {
                const local = getEngineState() as Record<string, unknown>;
                const localMut = Number(local._localMutationAt) || 0;
                const remoteMut = Number(rpc.state._localMutationAt) || 0;
                const merged = remoteMut >= localMut
                    ? { ...local, ...rpc.state }
                    : {
                        ...rpc.state,
                        ...local,
                        // Keep nested blocks from the newer side.
                        inAppBlock: localMut > remoteMut ? local.inAppBlock : (rpc.state.inAppBlock ?? local.inAppBlock),
                    };
                await storageSet({ blockEngineState: merged }, { syncCloud: false });
                return { state: merged, ok: true };
            }
        }
        return { state: getEngineState(), ok: true };
    }

    // Default: acknowledge without crashing UI
    return { ok: false, needsExtension: true };
}

export function addWebStorageListener(fn: ChangeListener) {
    storageListeners.add(fn);
    return () => storageListeners.delete(fn);
}

export const webPlatform: Platform = {
    kind: 'web',
    storageLocal: {
        get: storageGet,
        set: storageSet,
        remove: storageRemove,
    },
    sendMessage: async <T = unknown>(message: PlatformMessage) => {
        const result = await handleMessage(message);
        for (const listener of messageListeners) {
            try {
                listener(message);
            } catch {
                /* ignore */
            }
        }
        return result as T;
    },
    onMessage: {
        addListener: (fn) => {
            messageListeners.add(fn);
        },
        removeListener: (fn) => {
            messageListeners.delete(fn);
        },
    },
    tabsCreate: (opts) => {
        window.open(opts.url, '_blank', 'noopener,noreferrer');
    },
    runtimeGetURL: (path) => {
        if (path.startsWith('http')) return path;
        return `${window.location.origin}/${path.replace(/^\//, '')}`;
    },
};

/**
 * Install a minimal `chrome.*` polyfill so OptionsApp can run on the web
 * without rewriting every call site.
 */
export function installWebChromeShim() {
    if (typeof window === 'undefined') return;
    const g = globalThis as typeof globalThis & { chrome?: unknown; __FOCUZ_WEB_PLATFORM__?: boolean };
    if (g.__FOCUZ_WEB_PLATFORM__) return;
    g.__FOCUZ_WEB_PLATFORM__ = true;

    const onChangedListeners = new Set<ChangeListener>();

    addWebStorageListener((changes) => {
        for (const listener of onChangedListeners) {
            (listener as (c: typeof changes, area?: string) => void)(changes, 'local');
        }
    });

    const chromeShim = {
        runtime: {
            id: undefined as string | undefined,
            lastError: undefined as { message?: string } | undefined,
            getURL: (path: string) => webPlatform.runtimeGetURL(path),
            sendMessage: (
                message: PlatformMessage,
                callback?: (response: unknown) => void,
            ) => {
                const p = webPlatform.sendMessage(message);
                if (callback) void p.then(callback);
                return p;
            },
            onMessage: {
                addListener: (fn: (message: PlatformMessage) => void) => {
                    webPlatform.onMessage.addListener(fn);
                },
                removeListener: (fn: (message: PlatformMessage) => void) => {
                    webPlatform.onMessage.removeListener(fn);
                },
            },
            openOptionsPage: () => {
                window.location.assign('/app');
            },
        },
        storage: {
            local: {
                get: (
                    keys?: string | string[] | Record<string, unknown> | null,
                    callback?: (items: Record<string, unknown>) => void,
                ) => {
                    const p = webPlatform.storageLocal.get(keys ?? null);
                    if (callback) void p.then(callback);
                    return p;
                },
                set: (items: Record<string, unknown>, callback?: () => void) => {
                    const p = webPlatform.storageLocal.set(items);
                    if (callback) void p.then(callback);
                    return p;
                },
                remove: (keys: string | string[], callback?: () => void) => {
                    const p = webPlatform.storageLocal.remove(keys);
                    if (callback) void p.then(callback);
                    return p;
                },
            },
            sync: {
                remove: (_keys: string | string[], callback?: () => void) => {
                    if (callback) callback();
                    return Promise.resolve();
                },
            },
            onChanged: {
                addListener: (fn: ChangeListener) => {
                    onChangedListeners.add(fn);
                },
                removeListener: (fn: ChangeListener) => {
                    onChangedListeners.delete(fn);
                },
            },
        },
        tabs: {
            create: (opts: { url: string }, callback?: () => void) => {
                webPlatform.tabsCreate(opts);
                callback?.();
                return Promise.resolve();
            },
        },
        history: {
            search: async () => [] as unknown[],
        },
    };

    // The site is externally_connectable, so Chrome re-binds its own `chrome.runtime`
    // onto this object whenever the extension installs or reloads. That native
    // runtime has no onMessage/storage, which crashed the app on the next render.
    // Lock the shim's members so those re-binds are ignored.
    const locked: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(chromeShim)) {
        Object.defineProperty(locked, key, {
            get: () => value,
            set: () => undefined,
            enumerable: true,
            configurable: false,
        });
    }
    g.chrome = locked as unknown as typeof chrome;
}

export async function hydrateWebWorkspaceFromCloud() {
    try {
        const { supabase } = await import('../supabase');
        const { data, error } = await supabase.rpc('get_my_workspace_state');
        if (error) return;
        const row = (Array.isArray(data) ? data[0] : data) as { state?: Record<string, unknown> } | null;
        if (!row?.state || typeof row.state !== 'object') return;
        const remote = { ...row.state };
        const EXTRA_KEYS = [
            'focuznow_calendar_events_v1',
            'focuznow_calendar_groups_v1',
            'focuznow_scheduling_links_v2',
            'focuznow_lists_v1',
            'activeChallenges',
            'challengeProgress',
            'completedChallenges',
        ];
        const extras: Record<string, unknown> = {};
        for (const key of EXTRA_KEYS) {
            if (remote[key] !== undefined) {
                extras[key] = remote[key];
                delete remote[key];
            }
        }
        const existing = getEngineState();
        await storageSet({ blockEngineState: { ...existing, ...remote }, ...extras }, { syncCloud: false });
    } catch {
        /* ignore */
    }
    try {
        const { hydrateChallengesFromCloud } = await import('../progressionService');
        await hydrateChallengesFromCloud();
    } catch {
        /* ignore */
    }
    await hydrateWebStatsFromExtension();
}

/** Pull weekly/history/pomodoro stats from the installed extension (content-script bridge). */
export async function hydrateWebStatsFromExtension(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    return new Promise((resolve) => {
        const requestId = `stats-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const timeout = window.setTimeout(() => {
            window.removeEventListener('message', onMessage);
            resolve(false);
        }, 6000);

        const onMessage = (event: MessageEvent) => {
            if (event.origin !== window.location.origin) return;
            const data = event.data;
            if (!data || data.type !== 'FOCUZNOW_STATS_PAYLOAD' || data.requestId !== requestId) return;
            window.clearTimeout(timeout);
            window.removeEventListener('message', onMessage);
            void (async () => {
                try {
                    if (!data.ok) {
                        resolve(false);
                        return;
                    }
                    const patch: Record<string, unknown> = {};
                    if (data.screenTime && typeof data.screenTime === 'object') {
                        Object.assign(patch, data.screenTime);
                    }
                    if (data.focusTime && typeof data.focusTime === 'object') {
                        Object.assign(patch, data.focusTime);
                    }
                    if (data.pomodoroRuntime) patch.pomodoroRuntimeV1 = data.pomodoroRuntime;
                    if (data.pomodoroSettings) {
                        const existing = getEngineState();
                        patch.blockEngineState = {
                            ...existing,
                            pomodoroSettings: data.pomodoroSettings,
                            blockedToday: data.blockedToday ?? existing.blockedToday,
                        };
                    }
                    if (Object.keys(patch).length) await storageSet(patch, { syncCloud: false });
                    // Nudge web store to re-read screenTime_* keys
                    window.dispatchEvent(new CustomEvent('focuznow-web-storage-changed', { detail: patch }));
                    resolve(true);
                } catch {
                    resolve(false);
                }
            })();
        };

        window.addEventListener('message', onMessage);
        window.postMessage({ type: 'FOCUZNOW_REQUEST_STATS', requestId }, '*');
    });
}
