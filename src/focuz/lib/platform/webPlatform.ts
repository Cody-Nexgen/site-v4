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
        writeRaw(key, value);
        changes[key] = { oldValue, newValue: value };
    }
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

async function handleMessage(message: PlatformMessage): Promise<unknown> {
    const type = message.type;
    if (!type) return { ok: false };

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
        for (const listener of onChangedListeners) listener(changes);
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
        const existing = getEngineState();
        await storageSet({ blockEngineState: { ...existing, ...row.state } });
    } catch {
        /* ignore */
    }
}
