import type { Platform, PlatformMessage } from './types';
import { pickSyncableWorkspaceState } from '../workspaceSync';

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

async function storageSet(items: Record<string, unknown>) {
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

    // Best-effort cloud sync for workspace state
    try {
        const engine = (items.blockEngineState || readRaw('blockEngineState')) as Record<string, unknown> | undefined;
        if (engine && typeof window !== 'undefined') {
            const { supabase } = await import('../supabase');
            const syncable = pickSyncableWorkspaceState(engine);
            await supabase.rpc('upsert_my_workspace_state', { p_state: syncable });
        }
    } catch {
        /* offline / unauthenticated */
    }
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

async function handleMessage(message: PlatformMessage): Promise<unknown> {
    const type = message.type;
    if (!type) return { ok: false };

    if (PROGRESSION_MESSAGE_TYPES.has(type)) {
        const result = await handleProgressionMessage(message);
        if (result !== null) return result;
    }

    if (type === 'GET_STATE' || type === 'GET_ENGINE_STATE') {
        return { state: getEngineState(), ok: true };
    }

    if (type === 'UPDATE_ENGINE_SETTINGS') {
        const patch = (message.settings || message.patch || {}) as Record<string, unknown>;
        const next = { ...getEngineState(), ...patch };
        await storageSet({ blockEngineState: next });
        return { ok: true, state: next };
    }

    if (type === 'START_SESSION' || type === 'TIMER_START' || type === 'TIMER_CANCEL' || type === 'BLOCK_DOMAIN') {
        return { ok: false, needsExtension: true };
    }

    if (typeof type === 'string' && type.startsWith('FUTURE_SELF_')) {
        return {
            ok: false,
            needsExtension: true,
            error: 'Future Self Mode needs the FocuzNow browser extension.',
        };
    }

    if (type === 'CATEGORY_TOGGLE' || type === 'ADD_BLOCK' || type === 'REMOVE_BLOCK') {
        return {
            ok: false,
            needsExtension: true,
            error: 'Blocking actions require the FocuzNow browser extension.',
        };
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

    g.chrome = chromeShim as unknown as typeof chrome;
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
        await storageSet({ blockEngineState: { ...existing, ...remote }, ...extras });
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
        }, 2500);

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
                    if (data.pomodoroRuntime) patch.pomodoroRuntimeV1 = data.pomodoroRuntime;
                    if (data.pomodoroSettings) {
                        const existing = getEngineState();
                        patch.blockEngineState = {
                            ...existing,
                            pomodoroSettings: data.pomodoroSettings,
                            blockedToday: data.blockedToday ?? existing.blockedToday,
                        };
                    }
                    if (Object.keys(patch).length) await storageSet(patch);
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
