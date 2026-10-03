// Mock Chrome API for browser testing / screenshot harness.
// Seeds a signed-in session, engine state, history stats, and a FocuzPass
// vault so the real OptionsApp renders every tab without the extension.
import { installWebChromeShim } from './lib/platform/webPlatform';

type StorageListener = (changes: Record<string, { oldValue?: unknown; newValue?: unknown }>, areaName: string) => void;

if (typeof window !== 'undefined') {
    window.addEventListener('error', (e) => {
        (window as any).__lastError = `${e.message} @ ${e.filename}:${e.lineno}`;
    });
    window.addEventListener('unhandledrejection', (e) => {
        (window as any).__lastError = `unhandled: ${e.reason}`;
    });
}

const q = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
const isPro = q.get('pro') === '1';

const now = Date.now();
const iso = (ms: number) => new Date(ms).toISOString();
const dayStr = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() - offset);
    return d.toDateString();
};


// --- seeded storage -------------------------------------------------------
const memoryStore: Record<string, unknown> = {
    hasSeenOnboarding: true,
    devMode: true,
    onboardingCompleted: true,
    featurePreviewSeen: true,
    historyPermission: true,
    setupCompleted: true,
    subscriptionTier: isPro ? 'pro' : 'free',
    xp: 4320,
    streak: 12,
    bestStreak: 21,
    dashboardStreak: 12,
    dashboardBestStreak: 21,
    focusProgressionV1: {
        version: 1,
        xp: 4320,
        coins: 260,
        ownedCosmetics: [],
        equippedCosmetics: {},
        completedChallenges: [],
        activeChallenges: [],
        awardedKeys: [],
        stats: {
            totalPomodoros: 87,
            totalBlocksResisted: 210,
            totalHabitCheckins: 96,
            focusMinutesTotal: 2180,
            noShortsStreakDays: 6,
            noShortsLastDate: dayStr(0),
            noTiktokStreakDays: 3,
            noTiktokLastDate: dayStr(0),
            weekPomodorosKey: '',
            weekPomodorosCount: 9,
            todayPomodorosKey: dayStr(0),
            todayPomodorosCount: 3,
        },
        publicProfileEnabled: false,
    },
    focuznow_session_backup: {
        session: {
            access_token: 'mock-access-token',
            refresh_token: 'mock-refresh-token',
            expires_at: Math.floor(now / 1000) + 3600,
            token_type: 'bearer',
            user: {
                id: 'mock-user-1',
                email: 'compooteriolyt@focuznow.com',
                user_metadata: { full_name: 'Compooteriolyt' },
            },
        },
    },
    focuznow_session_cache_v1: {
        session: {
            access_token: 'mock-access-token',
            refresh_token: 'mock-refresh-token',
            expires_at: Math.floor(now / 1000) + 3600,
            token_type: 'bearer',
            user: {
                id: 'mock-user-1',
                email: 'compooteriolyt@focuznow.com',
                user_metadata: { full_name: 'Compooteriolyt' },
            },
        },
    },
};

// 14 days of screen time / focus history for Overview + Stats charts.
const SITE_SETS: Record<string, number>[] = [
    { 'github.com': 5_400_000, 'notion.so': 2_700_000, 'youtube.com': 1_800_000 },
    { 'figma.com': 4_200_000, 'github.com': 3_100_000, 'x.com': 900_000 },
    { 'github.com': 6_300_000, 'stackoverflow.com': 1_400_000, 'youtube.com': 2_400_000 },
    { 'linear.app': 3_600_000, 'github.com': 4_800_000, 'reddit.com': 1_200_000 },
    { 'notion.so': 3_300_000, 'github.com': 5_700_000, 'youtube.com': 700_000 },
    { 'github.com': 4_400_000, 'vercel.com': 1_900_000, 'x.com': 2_100_000 },
    { 'github.com': 7_200_000, 'figma.com': 2_800_000, 'youtube.com': 1_500_000 },
];
for (let i = 13; i >= 0; i--) {
    const sites = SITE_SETS[i % SITE_SETS.length];
    memoryStore[`screenTime_${dayStr(i)}`] = sites;
    memoryStore[`focusTime_${dayStr(i)}`] = 45 * 60_000 + (i % 4) * 25 * 60_000;
}

// --- engine state returned by GET_STATE ------------------------------------
const engineState = {
    blocklist: {
        'youtube.com': { enabled: true, sources: ['manual'] },
        'x.com': { enabled: true, sources: ['manual'] },
        'reddit.com': { enabled: true, sources: ['manual'] },
        'instagram.com': { enabled: true, sources: ['manual'] },
    },
    regexBlocklist: {},
    categoriesActive: { social: true, video: true },
    requireChallenge: true,
    schedules: {},
    timers: {},
    blockedToday: 14,
    profileName: 'Compooteriolyt',
    dailyPlanner: [
        { id: 1, time: '9:00', task: 'Deep work: finish proposal draft', done: true },
        { id: 2, time: '13:30', task: 'Review design handoff notes', done: false },
        { id: 3, time: 'Anytime', task: 'Inbox zero before 6pm', done: false },
    ],
    habits: [
        { id: 11, name: 'Morning pages', streak: 8, checkins: [dayStr(1), dayStr(2), dayStr(3), dayStr(4), dayStr(5), dayStr(6)] },
        { id: 12, name: 'No phone first hour', streak: 4, checkins: [dayStr(1), dayStr(3)] },
        { id: 13, name: 'Read 20 minutes', streak: 2, checkins: [dayStr(0), dayStr(2)] },
    ],
    pomodoroSettings: { focusMin: 25, breakMin: 5, sessionsCompleted: 3, lastDate: dayStr(0) },
    inAppBlock: {
        smartYouTube: { enabled: true, blockShorts: true, blockedCategoryIds: ['10', '20', '23', '24'] },
    },
};

// Calendar/scheduling seeds use the app's `date: toDateString()` convention.
const seedDate = (offset: number) => dayStr(-offset);
const calendarSeed = {
    focuznow_calendar_events: [
        { id: 'ev-1', title: 'Deep work: proposal draft', date: seedDate(0), allDay: false, startHour: 9, startMin: 0, durationMin: 120, color: '#7aa2f7' },
        { id: 'ev-2', title: 'Design review', date: seedDate(0), allDay: false, startHour: 13, startMin: 30, durationMin: 45, color: '#52d58e' },
        { id: 'ev-3', title: 'Team standup', date: seedDate(1), allDay: false, startHour: 10, startMin: 0, durationMin: 30, color: '#bb9af7' },
        { id: 'ev-4', title: 'Ship release candidate', date: seedDate(2), allDay: true, startHour: 0, startMin: 0, durationMin: 60, color: '#e0af68' },
    ],
    focuznow_scheduling_links: [
        {
            id: 'sl-1', type: 'recurring', title: 'Intro call', slug: 'intro-call',
            durationMin: 30, bufferMin: 0,
            availability: { days: [1, 2, 3, 4, 5], startHour: 9, startMin: 0, endHour: 17, endMin: 0 },
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
            singleUse: false, hostName: 'Compooteriolyt', hostEmail: 'compooteriolyt@focuznow.com',
            createdAt: iso(now - 86400e3 * 10),
        },
    ],
};
Object.assign(memoryStore, calendarSeed);

// --- canned FocuzPass vault -------------------------------------------------
const fpVaults = [
    { id: 'v-work', name: 'Work', color: '#7aa2f7', icon: 'vault', createdAt: iso(now - 86400e3 * 40) },
    { id: 'v-personal', name: 'Personal', color: '#52d58e', icon: 'vault', createdAt: iso(now - 86400e3 * 40) },
];
const fpTags = [
    { id: 't-sso', name: 'SSO', color: '#bb9af7', icon: 'tag', createdAt: iso(now - 86400e3 * 30) },
    { id: 't-finance', name: 'Finance', color: '#e0af68', icon: 'tag', createdAt: iso(now - 86400e3 * 30) },
];
const fpItems: Record<string, unknown>[] = [
    { id: 'i-gh', type: 'login', title: 'GitHub', identity: 'compooteriolyt@focuznow.com', domain: 'github.com', authMethod: 'PASSWORD', password: 'correct-horse-battery', strength: 'strong', mark: 'GH', markTone: '#e5e5e5', vaultId: 'v-work', tagIds: ['t-sso'], favorite: true, sortOrder: 0, createdAt: iso(now - 86400e3 * 20), updatedAt: iso(now - 86400e3 * 2), lastUsedAt: iso(now - 3600e3) },
    { id: 'i-linear', type: 'login', title: 'Linear', identity: 'compooteriolyt', domain: 'linear.app', authMethod: 'PASSWORD', password: 'hunter2-but-longer', strength: 'okay', mark: 'LN', markTone: '#7aa2f7', vaultId: 'v-work', tagIds: [], favorite: false, sortOrder: 1, createdAt: iso(now - 86400e3 * 18), updatedAt: iso(now - 86400e3 * 4), lastUsedAt: iso(now - 7200e3) },
    { id: 'i-notion', type: 'login', title: 'Notion', identity: 'compooteriolyt@focuznow.com', domain: 'notion.so', authMethod: 'PASSWORD', password: 'weakpass', strength: 'weak', risk: 'weak', mark: 'NO', markTone: '#e5e5e5', vaultId: 'v-personal', tagIds: [], favorite: false, sortOrder: 2, createdAt: iso(now - 86400e3 * 15), updatedAt: iso(now - 86400e3 * 15), lastUsedAt: iso(now - 86400e3) },
    { id: 'i-figma', type: 'login', title: 'Figma', identity: 'compooteriolyt@focuznow.com', domain: 'figma.com', authMethod: 'GOOGLE_SSO', mark: 'FI', markTone: '#bb9af7', vaultId: 'v-work', tagIds: ['t-sso'], favorite: true, sortOrder: 3, createdAt: iso(now - 86400e3 * 12), updatedAt: iso(now - 86400e3 * 1), lastUsedAt: iso(now - 1800e3) },
    { id: 'i-card', type: 'card', title: 'Amex Gold', identity: '•••• 1005', cardNumber: '378282246310005', expiry: '09/28', mark: 'AX', markTone: '#e0af68', vaultId: 'v-personal', tagIds: ['t-finance'], favorite: false, sortOrder: 4, createdAt: iso(now - 86400e3 * 10), updatedAt: iso(now - 86400e3 * 10) },
    { id: 'i-pk', type: 'passkey', title: 'Google passkey', identity: 'compooteriolyt@gmail.com', domain: 'accounts.google.com', credentialId: 'cred-1', experimental: true, mark: 'GP', markTone: '#52d58e', vaultId: 'v-personal', tagIds: [], favorite: false, sortOrder: 5, createdAt: iso(now - 86400e3 * 8), updatedAt: iso(now - 86400e3 * 8) },
    { id: 'i-wifi', type: 'custom', kind: 'wireless_router', title: 'Home Wi-Fi', identity: 'FocuzHouse_5G', fields: { Password: 'netpw-99', 'Security type': 'WPA3' }, mark: 'WF', markTone: '#7dcfff', vaultId: 'v-personal', tagIds: [], favorite: false, sortOrder: 6, createdAt: iso(now - 86400e3 * 5), updatedAt: iso(now - 86400e3 * 5) },
    { id: 'i-id', type: 'custom', kind: 'identity', title: 'Me', identity: 'Maya Jones', fields: { fullName: 'Maya Jones', email: 'maya@focuznow.com' }, mark: 'ME', markTone: '#6fcf97', vaultId: 'v-personal', tagIds: [], favorite: false, sortOrder: 7, createdAt: iso(now - 86400e3 * 4), updatedAt: iso(now - 86400e3 * 4) },
];

const fpStatus = {
    configured: true,
    unlocked: true,
    itemCount: fpItems.length,
    idleLockMinutes: 15,
    unlockedAt: now,
    absoluteLockAt: now + 12 * 3600e3,
    remainingMs: 15 * 60e3,
    platform: 'extension' as const,
    passkeysExperimental: true as const,
};

// Demo only: FocuzPass Cloud without a server. The master password is "demo".
const fpCloud: { state: 'off' | 'pending' | 'on'; uploadedAt?: string; lastSyncAt?: string; joinedAt?: string } = { state: 'off' };
let fpPasskeysEnabled = true;
// ?cloudAccount=1: the demo account already has Cloud sync from another device (the "Add this device" flow).
const fpCloudAccountExists = typeof location !== 'undefined' && new URLSearchParams(location.search).has('cloudAccount');
const DEMO_KIT = { secretKey: 'A1-7QX2KD-9MPWZ-4RTB8-HN3CF-V6YGJ', secretKeyId: '7QX2KD', email: 'maya@focuznow.com' };

function handleFocuzPass(msg: { type: string; [k: string]: any }): { ok: boolean; data?: unknown; error?: string } | null {
    switch (msg.type) {
        case 'FOCUZPASS_STATUS': return { ok: true, data: { ...fpStatus } };
        case 'FOCUZPASS_LIST': return { ok: true, data: fpItems };
        case 'FOCUZPASS_SNAPSHOT': return { ok: true, data: { items: fpItems, vaults: fpVaults, tags: fpTags } };
        case 'FOCUZPASS_UPSERT': {
            // New items have no id yet; the real vault assigns one.
            const item = { ...msg.item, id: msg.item?.id || `i-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, tagIds: msg.item?.tagIds ?? [], sortOrder: msg.item?.sortOrder ?? -fpItems.length };
            const idx = fpItems.findIndex((i) => i.id === item.id);
            if (idx >= 0) fpItems[idx] = item; else fpItems.push(item);
            return { ok: true, data: item };
        }
        case 'FOCUZPASS_IMPORT': {
            const incoming = (Array.isArray(msg.items) ? msg.items : []) as Record<string, any>[];
            const stamp = iso(Date.now());
            incoming.forEach((item, i) => {
                fpItems.unshift({
                    ...item,
                    id: `imp-${Date.now()}-${i}`,
                    mark: String(item.title || '?').slice(0, 2).toUpperCase(),
                    markTone: '#8b93a1',
                    vaultId: msg.importOptions?.vaultId || 'v-personal',
                    tagIds: [],
                    favorite: !!item.favorite,
                    sortOrder: -incoming.length + i,
                    createdAt: stamp,
                    updatedAt: stamp,
                });
            });
            return { ok: true, data: { added: incoming.length, duplicates: 0, failed: 0 } };
        }
        case 'FOCUZPASS_EXPORT_PACKAGE': {
            // Demo only: shaped like a real package, but nothing in it opens.
            const blob = { iv: 'ZGVtbw==', ct: 'ZGVtbw==' };
            return { ok: true, data: { format: 'focuzpass-export', version: 1, createdAt: iso(Date.now()), itemCount: fpItems.length, kdf: 'PBKDF2-SHA256', iterations: 600000, salt: 'ZGVtbw==', verifier: blob, data: blob } };
        }
        case 'FOCUZPASS_IMPORT_PACKAGE': {
            if (msg.masterPassword !== 'demo') return { ok: false, error: 'That isn\'t the master password of the vault this came from.' };
            return { ok: true, data: { added: Number(msg.package?.itemCount) || 0, duplicates: 0, failed: 0 } };
        }
        case 'FOCUZPASS_CLOUD_STATUS':
            return { ok: true, data: { state: fpCloud.state, email: 'maya@focuznow.com', secretKeyId: '7QX2KD', uploadedAt: fpCloud.uploadedAt, lastSyncAt: fpCloud.lastSyncAt, joinedAt: fpCloud.joinedAt, records: fpCloud.state === 'on' ? fpItems.length + 4 : 0 } };
        case 'FOCUZPASS_PASSKEY_SETTINGS':
            if (typeof msg.enabled === 'boolean') fpPasskeysEnabled = msg.enabled;
            return { ok: true, data: { enabled: fpPasskeysEnabled } };
        case 'FOCUZPASS_CLOUD_ACCOUNT':
            return { ok: true, data: { signedIn: true, email: 'maya@focuznow.com', exists: fpCloud.state === 'on' || fpCloudAccountExists } };
        case 'FOCUZPASS_CLOUD_SYNC':
            if (fpCloud.state !== 'on') return { ok: false, error: "Cloud sync isn't on" };
            fpCloud.lastSyncAt = iso(Date.now());
            return { ok: true, data: { pulled: 0, pushed: 0, conflicts: 0, refused: 0 } };
        case 'FOCUZPASS_CLOUD_ADD_DEVICE': {
            const key = String(msg.secretKey || '').toUpperCase().replace(/[\s-]/g, '');
            if (key !== DEMO_KIT.secretKey.replace(/-/g, '') || msg.masterPassword !== 'demo') {
                return { ok: false, error: "That master password and Security Key don't open this account. Check both and try again." };
            }
            if (msg.localPassword !== 'demo') return { ok: false, error: "That isn't your master password" };
            fpCloud.state = 'on';
            fpCloud.joinedAt = iso(Date.now());
            fpCloud.lastSyncAt = fpCloud.joinedAt;
            return { ok: true, data: { added: 3, alreadyThere: fpItems.length - 3 } };
        }
        case 'FOCUZPASS_CLOUD_PREPARE':
            if (msg.masterPassword !== 'demo') return { ok: false, error: 'That isn\'t your master password' };
            fpCloud.state = 'pending';
            return { ok: true, data: { ...DEMO_KIT, recoveryKey: msg.recoveryKey ? 'R1-4HNWQ8-ZC3RT-7PX2M-KV9DB-F6YJG' : undefined } };
        case 'FOCUZPASS_CLOUD_ENABLE':
            fpCloud.state = 'on';
            fpCloud.uploadedAt = iso(Date.now());
            fpCloud.lastSyncAt = fpCloud.uploadedAt;
            return { ok: true, data: { uploaded: fpItems.length + 4 } };
        case 'FOCUZPASS_CLOUD_CANCEL':
            if (fpCloud.state === 'pending') fpCloud.state = 'off';
            return { ok: true, data: { state: fpCloud.state } };
        case 'FOCUZPASS_CLOUD_KIT':
            if (msg.masterPassword !== 'demo') return { ok: false, error: 'That isn\'t your master password' };
            return { ok: true, data: DEMO_KIT };
        case 'FOCUZPASS_CHANGE_MASTER_PASSWORD':
            if (msg.masterPassword !== 'demo') return { ok: false, error: 'The current master password isn\'t right' };
            return { ok: true, data: { ...fpStatus } };
        case 'FOCUZPASS_DELETE': return { ok: true, data: null };
        case 'FOCUZPASS_ITEM_ACTION': return { ok: true, data: null };
        case 'FOCUZPASS_REORDER': return { ok: true, data: null };
        case 'FOCUZPASS_CREATE_VAULT': return { ok: true, data: msg.collection };
        case 'FOCUZPASS_CREATE_TAG': return { ok: true, data: msg.collection };
        case 'FOCUZPASS_TOUCH': return { ok: true, data: null };
        case 'FOCUZPASS_GENERATE': return { ok: true, data: 'Xk9#mQ2$vL8!pR4' };
        case 'FOCUZPASS_LOCK': fpStatus.unlocked = false; return { ok: true, data: { ...fpStatus } };
        case 'FOCUZPASS_UNLOCK': fpStatus.unlocked = true; return { ok: true, data: { ...fpStatus } };
        case 'FOCUZPASS_OPEN_ACCESS_WINDOW': return { ok: true, data: null };
        default: return null;
    }
}

const storageListeners = new Set<StorageListener>();

function pickKeys(keys?: string | string[] | Record<string, unknown> | null) {
    if (keys == null) return { ...memoryStore };
    const list = typeof keys === 'string' ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys);
    const defaults = typeof keys === 'object' && !Array.isArray(keys) ? keys : {};
    const result: Record<string, unknown> = {};
    list.forEach((k) => {
        if (k in memoryStore) result[k] = memoryStore[k];
        else if (k in defaults) result[k] = defaults[k];
    });
    return result;
}

function makeArea(areaName: string) {
    return {
        get: (keys?: string | string[] | Record<string, unknown> | null, cb?: (result: any) => void) => {
            const result = pickKeys(keys);
            cb?.(result);
            return Promise.resolve(result);
        },
        set: (items: Record<string, unknown>, cb?: () => void) => {
            const changes: Record<string, { oldValue?: unknown; newValue?: unknown }> = {};
            Object.entries(items).forEach(([k, v]) => {
                changes[k] = { oldValue: memoryStore[k], newValue: v };
                memoryStore[k] = v;
            });
            storageListeners.forEach((listener) => listener(changes, areaName));
            cb?.();
            return Promise.resolve();
        },
        remove: (keys: string | string[], cb?: () => void) => {
            (Array.isArray(keys) ? keys : [keys]).forEach((k) => delete memoryStore[k]);
            cb?.();
            return Promise.resolve();
        },
        clear: (cb?: () => void) => { cb?.(); return Promise.resolve(); },
    };
}

function respondTo(msg: any): any {
    if (!msg || typeof msg !== 'object') return { ok: true };
    const fp = handleFocuzPass(msg);
    if (fp) return fp;
    switch (msg.type) {
        case 'GET_STATE': return { ok: true, state: engineState };
        case 'IMPORT_HISTORY': return { ok: true, imported: 12 };
        case 'UPDATE_ENGINE_SETTINGS': {
            Object.assign(engineState, msg.settings || {});
            return { ok: true };
        }
        case 'GET_STREAK': return { ok: true, streak: 12, bestStreak: 21 };
        case 'GET_CURRENT_URL_TIME': return { ok: true, timeSpent: 18 * 60 * 1000 + 24 * 1000 };
        case 'PROGRESSION_GET':
        case 'PROGRESSION_STATE':
            return { ok: true, progression: { xp: 4320, coins: 260, equippedCosmetics: {}, checkins: [] } };
        default:
            return { ok: true, ...('progression' in msg ? {} : {}), state: msg.type === 'GET_PROGRESSION' ? { xp: 4320, coins: 260, equippedCosmetics: {} } : undefined };
    }
}

export const mockChrome = {
    runtime: {
        sendMessage: (msg: any, cb?: (resp: any) => void) => {
            const resp = respondTo(msg);
            cb?.(resp);
            return Promise.resolve(resp);
        },
        onMessage: {
            addListener: () => { },
            removeListener: () => { },
        },
        getManifest: () => ({ version: '1.0.9' }),
        getURL: (path: string) => path,
        lastError: null,
        id: 'mock-extension',
    },
    storage: {
        onChanged: {
            addListener: (listener: StorageListener) => { storageListeners.add(listener); },
            removeListener: (listener: StorageListener) => { storageListeners.delete(listener); },
        },
        local: makeArea('local'),
        session: makeArea('session'),
        sync: makeArea('sync'),
    },
    tabs: {
        query: async () => [],
        create: async (props: any) => {
            console.log('[MockChrome] tabs.create:', props);
            return { id: 1 };
        },
        sendMessage: async () => ({}),
    },
    alarms: {
        create: () => { },
        clear: async () => true,
        onAlarm: { addListener: () => { } },
    },
    action: {
        onClicked: { addListener: () => { } },
        setBadgeText: async () => { },
    },
    scripting: {
        executeScript: async () => [],
    },
};

// Deterministic Supabase stub: `createSupabaseClient` prefers
// window.__FOCUZ_SITE_SUPABASE__, so provide one that returns the seeded
// session and empty query results instead of hitting the real backend.
if (typeof window !== 'undefined') {
    const mockSession = (memoryStore.focuznow_session_backup as any).session;
    const thenable = (value: unknown) => ({
        then: (resolve: (v: unknown) => unknown) => resolve(value),
        catch: () => thenable(value),
        finally: (fn?: () => void) => { fn?.(); return thenable(value); },
    });
    const emptyResult = { data: [] as unknown[], error: null };
    const chainFor = (result: unknown): any =>
        new Proxy(() => result, {
            get(_t, prop) {
                if (prop === 'then') return (resolve: (v: unknown) => unknown) => resolve(result);
                if (prop === 'catch') return () => chainFor(result);
                if (prop === 'finally') return (fn?: () => void) => { fn?.(); return chainFor(result); };
                return chainFor(result);
            },
            apply() { return chainFor(result); },
        });
    const chain = chainFor(emptyResult);
    // ?pro=1 → the subscriptions query resolves to an active Pro row so
    // syncSubscriptionFromDb keeps the seeded pro tier.
    const proSubRow = {
        data: {
            status: 'active',
            price_id: 'pro',
            current_period_start: iso(now - 86400e3 * 10),
            current_period_end: iso(now + 86400e3 * 20),
            cancel_at_period_end: false,
        },
        error: null,
    };
    (window as any).__FOCUZ_SITE_SUPABASE__ = {
        auth: {
            getSession: async () => ({ data: { session: mockSession }, error: null }),
            setSession: async () => ({ data: { session: mockSession }, error: null }),
            getUser: async () => ({ data: { user: mockSession.user }, error: null }),
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => { } } } }),
            signOut: async () => ({ error: null }),
            refreshSession: async () => ({ data: { session: mockSession }, error: null }),
        },
        from: (table: string) => chainFor(table === 'subscriptions' && isPro ? proSubRow : emptyResult),
        rpc: () => thenable({ data: null, error: { message: 'mock rpc' } }),
        functions: { invoke: async () => ({ data: null, error: { message: 'mock function' } }) },
        // FocuzPass transfer channels join (and wait there, since no other device exists in the demo).
        channel: (topic: string) => (String(topic).startsWith('fzp-xfer-') ? {
            on() { return this; },
            subscribe(cb?: (state: string) => void) { window.setTimeout(() => cb?.('SUBSCRIBED'), 250); return this; },
            send: async () => 'ok',
            unsubscribe: async () => 'ok',
        } : chain),
        removeChannel: async () => 'ok',
        storage: { from: () => chain },
        supabaseUrl: 'https://mock.supabase.local',
        supabaseKey: 'mock-anon-key',
    };
    void thenable;
}

// Inject unless this is a real extension page. An installed extension exposes a
// partial chrome.runtime (no onMessage) to web pages, so presence isn't enough.
if (typeof window !== 'undefined' && window.location.protocol !== 'chrome-extension:') {
    (window as any).chrome = mockChrome;
}

// Ensure the setup gate is satisfied for harness runs.
try {
    window.localStorage.setItem('focuznow-setup-v1', 'done');
} catch { /* ignore */ }

// ?coachDemo=1 (or ?stayExtension=1): keep tabs that would normally redirect
// to the web dashboard (ai_coach etc.) rendering inline in the harness.
if (typeof window !== 'undefined' && (q.get('coachDemo') === '1' || q.get('stayExtension') === '1')) {
    (window as unknown as Record<string, unknown>).__FOCUZ_STAY_EXTENSION__ = true;
}

// ---------------------------------------------------------------------------
// Web-platform mode (?platform=web): the real OptionsApp runs as the /app
// surface — chrome.runtime.id is removed so the web shim installs, storage is
// seeded through its localStorage backend, and a postMessage bridge answers
// extension RPCs (FocuzPass vault, GET_STATE, stats hydration).
// ---------------------------------------------------------------------------
if (typeof window !== 'undefined' && q.get('platform') === 'web') {
    try {
        // Let the real web shim take over window.chrome before any app module
        // evaluates (this file is imported first in the harness entry).
        (window as any).chrome = undefined;
        installWebChromeShim();
        const LS_PREFIX = 'focuznow.web.storage.';
        for (const [k, v] of Object.entries(memoryStore)) {
            window.localStorage.setItem(`${LS_PREFIX}${k}`, JSON.stringify(v));
        }
        window.localStorage.setItem(`${LS_PREFIX}blockEngineState`, JSON.stringify(engineState));
        document.documentElement.setAttribute('data-focuznow-extension', 'true');

        window.addEventListener('message', (event) => {
            if (event.source !== window) return;
            const data = event.data;
            if (!data || typeof data !== 'object') return;
            if (data.type === 'FOCUZNOW_EXTENSION_RPC' && data.requestId) {
                const response = respondTo(data.message);
                window.postMessage(
                    { type: 'FOCUZNOW_EXTENSION_RPC_RESULT', requestId: data.requestId, ...response },
                    window.location.origin,
                );
            }
            if (data.type === 'FOCUZNOW_REQUEST_STATS' && data.requestId) {
                const screenTime: Record<string, unknown> = {};
                const focusTime: Record<string, unknown> = {};
                for (const [k, v] of Object.entries(memoryStore)) {
                    if (k.startsWith('screenTime_')) screenTime[k] = v;
                    if (k.startsWith('focusTime_')) focusTime[k] = v;
                }
                window.postMessage(
                    {
                        type: 'FOCUZNOW_STATS_PAYLOAD',
                        requestId: data.requestId,
                        ok: true,
                        screenTime,
                        focusTime,
                        pomodoroSettings: engineState.pomodoroSettings,
                        blockedToday: engineState.blockedToday,
                    },
                    window.location.origin,
                );
            }
        });
    } catch { /* ignore */ }
}

// AI Coach: stub the SSE endpoint so the harness shows a real thread + action card.
if (typeof window !== 'undefined') {
    const origFetch = window.fetch.bind(window);
    const coachReply = "Done — I set a 25 minute focus timer on youtube.com. Want me to add a matching calendar block too?";
    window.fetch = ((input: unknown, init?: unknown) => {
        const url = typeof input === 'string' ? input : (input as Request)?.url || '';
        if (url.includes('/functions/v1/ai-coach-chat')) {
            const frames = [
                `data: {"type":"session","session_id":"mock-session-1"}

`,
                `data: {"type":"token","text":${JSON.stringify(coachReply)},"visible":${JSON.stringify(coachReply)}}

`,
                `data: {"type":"done","session_id":"mock-session-1","content":${JSON.stringify(coachReply)},"title":"Focus block","actions":[{"action_type":"timer","domain":"youtube.com","minutes":25}],"action_data":null}

`,
            ];
            return Promise.resolve(new Response(frames.join(''), {
                status: 200,
                headers: { 'Content-Type': 'text/event-stream' },
            }));
        }
        return origFetch(input as Request, init as RequestInit);
    }) as typeof fetch;
}
