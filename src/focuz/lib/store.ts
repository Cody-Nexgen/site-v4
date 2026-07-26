import { create } from 'zustand';
import { signOutOnAuthError } from './authErrors';
import { BILLING_RETURN_URL } from './billingUrls';
import { initSupabaseFromStorage, isSupabaseConfigured, supabase } from './supabase';
import { Session } from '@supabase/supabase-js';
import {
    applyDocumentTheme,
    applyProWelcomePack,
    isProExclusiveTheme,
    normalizeThemeForUser,
    revertProThemeIfNeeded,
} from './themes';
import { capDayScreenMs } from './screenTimeCap';
import { fetchMyProfileQuiet } from './profileApi';

const SESSION_BACKUP_KEY = 'focuznow_session_backup';
const PROFILE_USER_KEY = 'focuznow_profile_user_id';
const INSTALL_KEY = 'focuznow_installed_at';
const SESSION_CACHE_KEY = 'focuznow_session_cache_v1';
const MIN_ACTIVE_MS = 60_000; // 1 minute of tracked usage counts as an active day
const HISTORY_IMPORT_COOLDOWN_MS = 5 * 60_000;
let lastHistoryImportAt = 0;

function parseStoredSession(raw: unknown): Session | null {
    if (!raw) return null;
    try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        const s =
            parsed?.currentSession?.session ??
            parsed?.session ??
            (parsed?.access_token && parsed?.refresh_token ? parsed : null);
        if (s?.access_token && s?.refresh_token) return s as Session;
    } catch {
        /* ignore */
    }
    return null;
}

function sendEngineProfileSettings(
    settings: Pick<EngineState, 'profileName' | 'profileUsername' | 'profileInitial' | 'profileAvatar'>,
): Promise<void> {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'UPDATE_ENGINE_SETTINGS', settings }, () => resolve());
    });
}

async function persistSessionBackup(session: Session | null) {
    if (!session?.access_token) return;
    await chrome.storage.local.set({
        [SESSION_BACKUP_KEY]: {
            access_token: session.access_token,
            refresh_token: session.refresh_token,
            expires_at: session.expires_at,
            user: session.user,
        },
    });
}

async function handleSubscriptionTierTransition(
    prev: 'free' | 'pro',
    next: 'free' | 'pro',
): Promise<void> {
    if (prev === next) return;
    if (prev === 'free' && next === 'pro') {
        const store = useAuthStore.getState();
        await store.fetchEngineState();
        if (!isProExclusiveTheme(store.engineState?.theme)) {
            await applyProWelcomePack();
        }
        await store.fetchEngineState();
    } else if (prev === 'pro' && next === 'free') {
        const { engineState } = useAuthStore.getState();
        if (isProExclusiveTheme(engineState?.theme)) {
            await revertProThemeIfNeeded();
        }
    }
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
    ]);
}

function dateOnOrAfterInstall(dateStr: string, installMs: number | null): boolean {
    if (!installMs) return true;
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    const install = new Date(installMs);
    install.setHours(0, 0, 0, 0);
    return d.getTime() >= install.getTime();
}

export function computeActivityStreak(
    stats: { date: string; total: number }[],
    habits: { checkins?: string[] }[] = [],
    pomodoro?: { lastDate?: string; sessionsCompleted?: number },
    installedAtMs?: number | null
): { current: number; best: number } {
    const activeDates = new Set<string>();

    for (const day of stats) {
        if (day.total < MIN_ACTIVE_MS) continue;
        if (!dateOnOrAfterInstall(day.date, installedAtMs ?? null)) continue;
        activeDates.add(day.date);
    }
    for (const h of habits) {
        for (const c of h.checkins || []) {
            if (dateOnOrAfterInstall(c, installedAtMs ?? null)) activeDates.add(c);
        }
    }
    if (
        pomodoro?.lastDate &&
        (pomodoro.sessionsCompleted ?? 0) > 0 &&
        dateOnOrAfterInstall(pomodoro.lastDate, installedAtMs ?? null)
    ) {
        activeDates.add(pomodoro.lastDate);
    }

    if (activeDates.size === 0) return { current: 0, best: 0 };

    const sorted = [...activeDates]
        .map((d) => new Date(d).setHours(0, 0, 0, 0))
        .sort((a, b) => a - b);

    let best = 0;
    let run = 0;
    let prev: number | null = null;
    const dayMs = 86400000;

    for (const t of sorted) {
        if (prev !== null && t - prev === dayMs) run += 1;
        else run = 1;
        best = Math.max(best, run);
        prev = t;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const todayStr = today.toDateString();
    const yesterdayStr = yesterday.toDateString();

    if (!activeDates.has(todayStr) && !activeDates.has(yesterdayStr)) {
        return { current: 0, best };
    }

    let cursor = activeDates.has(todayStr) ? today : yesterday;
    let current = 0;
    while (activeDates.has(cursor.toDateString())) {
        current += 1;
        cursor = new Date(cursor);
        cursor.setDate(cursor.getDate() - 1);
    }

    return { current, best: Math.max(best, current) };
}

function stripeCustomerIdFromSub(
    sub: {
        stripe_customer_id?: string | null;
        customer_id?: string | null;
    } | null,
): string | null {
    if (!sub) return null;
    const id = sub.stripe_customer_id || sub.customer_id;
    return typeof id === 'string' && id.length > 0 ? id : null;
}

const ACTIVE_SUBSCRIPTION_STATUSES = ['active', 'trialing'] as const;

function subscriptionPatchFromRow(
    sub: {
        price_id?: string | null;
        status: string;
        stripe_customer_id?: string | null;
        customer_id?: string | null;
        current_period_start?: string | null;
        current_period_end?: string | null;
        cancel_at?: string | null;
        canceled_at?: string | null;
        cancel_at_period_end?: boolean | null;
    } | null,
): Pick<AuthState, 'subscriptionTier' | 'subscriptionDetails'> {
    if (!sub || !ACTIVE_SUBSCRIPTION_STATUSES.includes(sub.status as (typeof ACTIVE_SUBSCRIPTION_STATUSES)[number])) {
        return { subscriptionTier: 'free', subscriptionDetails: null };
    }

    return {
        subscriptionTier: 'pro',
        subscriptionDetails: {
            plan: sub.price_id || 'pro',
            status: sub.status,
            stripeCustomerId: stripeCustomerIdFromSub(sub),
            currentPeriodStart: sub.current_period_start ?? null,
            currentPeriodEnd: sub.current_period_end ?? null,
            cancelAt: sub.cancel_at ?? null,
            canceledAt: sub.canceled_at ?? null,
            cancelAtPeriodEnd: sub.cancel_at_period_end || false,
        },
    };
}

export interface EngineState {
    blocklist: Record<string, { sources: string[]; categoryKeys?: string[] }>;
    regexBlocklist: Record<string, { sources: string[] }>;
    categoriesActive: Record<string, boolean>;
    schedules: Record<string, any[]>;
    timers: Record<string, any[]>;
    allowedSites: string[];
    activeDays: number[];
    activeHours: { start: string, end: string };
    dailyResetTime: string;
    nuclearState: { active: boolean, endTime: number, target: string };
    redirectMessage: string;
    requireChallenge: boolean;
    focusMode: boolean;
    blockedToday: number;
    trackBackgroundAudio: boolean;
    draggableTimer: boolean;
    pomodoroWidget: boolean;
    inAppBlock: {
        youtube: boolean; youtubeShorts: boolean;
        instagram: boolean; instagramReels: boolean;
        tiktok: boolean;
        filters: string[];
        smartYouTube?: {
            enabled: boolean;
            blockShorts: boolean;
            blockGaming?: boolean;
            blockMusic?: boolean;
            blockedCategoryIds?: string[];
            useDataApi?: boolean;
        };
    };
    temporaryAllows?: { id: string; domain: string; expiresAt: number; reason: string }[];
    emergencyOverrideSettings?: {
        enabled: boolean;
        maxPerDay: number;
        minReasonLength: number;
        accessMinutes: number;
        cooldownMinutes: number;
    };
    theme: string;
    customTheme?: { primary: string; accent: string; highlight: string };
    timerScale?: number;
    todos: { id: number; text: string; done: boolean }[];
    dailyFocusTarget: Record<string, number>;
    profileName?: string;
    profileUsername?: string;
    profileInitial?: string;
    profileAvatar?: string;
    // Productivity tools
    pomodoroSettings?: { focusMin: number; breakMin: number; sessionsCompleted: number; lastDate: string };
    habits?: { id: number; name: string; streak: number; checkins: string[] }[];
    scratchpad?: string;
    dailyPlanner?: { id: number; time: string; task: string; done: boolean; notionId?: string }[];
    savedQuotes?: string[];
    // Integrations
    googleCalendarConnected?: boolean;
    googleCalendarToken?: string;
    googleClientId?: string;
    googleProfile?: { email: string; name: string; picture: string };
    notionConnected?: boolean;
    notionToken?: string;
    notionDatabaseId?: string;
    notionJournalingEnabled?: boolean;
    dashboardLayout?: string[];
    weeklyGoalHours?: number;
    /** When true (default for Pro), enhanced dashboard visuals are shown. */
    proDashboardVisuals?: boolean;
}

interface AuthState {
    session: Session | null;
    loading: boolean;

    // Engine sync state
    engineState: EngineState;
    setEngineState: (state: EngineState) => void;
    patchEngineState: (patch: Partial<EngineState>) => void;
    toggleEngineBool: (key: 'draggableTimer' | 'pomodoroWidget' | 'trackBackgroundAudio' | 'requireChallenge') => Promise<boolean>;
    fetchEngineState: () => Promise<void>;

    // UI-only focus tracking (NOT blocking)
    focusStartTime: number | null;

    // UI stats
    xp: number;
    streak: number;
    bestStreak: number;
    dashboardStreak: number;
    dashboardBestStreak: number;
    recalculateStreak: () => Promise<void>;
    recordDashboardOpen: () => Promise<void>;

    subscriptionTier: 'free' | 'pro';
    subscriptionDetails: {
        plan: string;
        status: string;
        stripeCustomerId: string | null;
        currentPeriodStart: string | null;
        currentPeriodEnd: string | null;
        cancelAt: string | null;
        canceledAt: string | null;
        cancelAtPeriodEnd: boolean;
    } | null;
    screenTime: Record<string, number>;
    dailyLimit: number;

    // UI audio
    sounds: { id: string; name: string; url: string; category: string }[];

    // Session methods
    setSession: (session: Session | null) => void;
    checkSession: (opts?: { background?: boolean }) => Promise<void>;
    signOut: () => Promise<void>;
    clearProfileFromEngine: () => Promise<void>;
    syncProfileFromServer: () => Promise<void>;
    upgradeToPro: () => Promise<{ ok: boolean; alreadySubscribed?: boolean; message?: string }>;
    syncSubscriptionFromDb: () => Promise<void>;
    isPro: () => boolean;

    // Stats updates
    updateStats: () => Promise<void>;
    setDailyLimit: (limit: number) => Promise<void>;

    // Onboarding & Consent
    onboardingCompleted: boolean;
    featurePreviewSeen: boolean;
    historyPermission: boolean;
    setOnboardingCompleted: (val: boolean) => Promise<void>;
    setFeaturePreviewSeen: (val: boolean) => Promise<void>;
    setHistoryPermission: (val: boolean) => Promise<void>;
    importHistory: () => Promise<void>;
    refreshStats: () => Promise<void>;

    // Stats
    last7DaysStats: { date: string, total: number, sites: Record<string, number> }[];
    offsetWeeks: number;
    setOffsetWeeks: (offset: number) => void;

    // Initialization
    initialized: boolean;
    init: () => void | Promise<void>;
}

const PLACEHOLDER_SOUNDS = [
    { id: '1', name: 'Rainfall', url: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3', category: 'Nature' },
    { id: '2', name: 'Forest Ambience', url: 'https://cdn.pixabay.com/download/audio/2021/09/06/audio_3715e32394.mp3', category: 'Nature' },
    { id: '3', name: 'White Noise', url: 'https://cdn.pixabay.com/download/audio/2021/08/09/audio_04d1796b01.mp3', category: 'Focus' },
    { id: '4', name: 'Lo-Fi Beats', url: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3', category: 'Music' },
];

export const useAuthStore = create<AuthState>((set, get) => ({
    session: null,
    loading: true,
    initialized: false,

    // NEW engine-driven blocking state
    engineState: {
        blocklist: {},
        regexBlocklist: {},
        categoriesActive: {},
        schedules: {},
        timers: {},
        allowedSites: [],
        activeDays: [1, 2, 3, 4, 5],
        activeHours: { start: '09:00', end: '17:00' },
        dailyResetTime: '00:00',
        nuclearState: { active: false, endTime: 0, target: '' },
        redirectMessage: 'This site is blocked by FocuzNow. Stay focused!',
        requireChallenge: false,
        focusMode: true,
        blockedToday: 0,
        trackBackgroundAudio: false,
        draggableTimer: false,
        pomodoroWidget: false,
        inAppBlock: {
            youtube: false,
            youtubeShorts: false,
            instagram: false,
            instagramReels: false,
            tiktok: false,
            filters: [],
            smartYouTube: {
                enabled: false,
                blockShorts: true,
                blockedCategoryIds: ['10', '20', '23', '24'],
                useDataApi: true,
            },
        },
        temporaryAllows: [],
        emergencyOverrideSettings: {
            enabled: true,
            maxPerDay: 3,
            minReasonLength: 20,
            accessMinutes: 15,
            cooldownMinutes: 30,
        },
        theme: 'purple',
        timerScale: 1.0,
        todos: [],
        dailyFocusTarget: {},
        notionJournalingEnabled: false
    },

    setEngineState: (state) => set({ engineState: state }),

    patchEngineState: (patch) => {
        const { engineState } = get();
        set({ engineState: { ...engineState, ...patch } });
    },

    toggleEngineBool: async (key) => {
        const { engineState } = get();
        const prev = !!(engineState[key] ?? false);
        const next = !prev;
        set({ engineState: { ...engineState, [key]: next } });
        return new Promise<boolean>((resolve) => {
            chrome.runtime.sendMessage(
                { type: 'UPDATE_ENGINE_SETTINGS', settings: { [key]: next } },
                (resp) => {
                    if (chrome.runtime.lastError || !resp?.ok) {
                        set({ engineState: { ...engineState, [key]: prev } });
                        resolve(false);
                        return;
                    }
                    resolve(true);
                },
            );
        });
    },

    fetchEngineState: async () => {
        return new Promise<void>((resolve) => {
            const timeoutId = setTimeout(() => {
                console.warn('[Store] fetchEngineState timed out after 5s');
                resolve();
            }, 5000);

            chrome.runtime.sendMessage({ type: 'GET_STATE' }, async (resp) => {
                clearTimeout(timeoutId);
                if (resp?.ok && resp.state) {
                    const state = resp.state as EngineState;
                    const tierPro = get().subscriptionTier === 'pro';
                    const displayTheme = normalizeThemeForUser(state.theme, tierPro);
                    set({ engineState: state });
                    applyDocumentTheme(
                        { theme: displayTheme, customTheme: state.customTheme },
                        tierPro,
                    );
                }
                resolve();
            });
        });
    },

    // UI-only focus timer (for streak, not blocking)
    focusStartTime: null,

    xp: 0,
    streak: 0,
    bestStreak: 0,
    dashboardStreak: 0,
    dashboardBestStreak: 0,
    subscriptionTier: 'free',
    subscriptionDetails: null,
    screenTime: {},
    dailyLimit: 2 * 60 * 60 * 1000,
    sounds: PLACEHOLDER_SOUNDS,

    onboardingCompleted: false,
    featurePreviewSeen: false,
    historyPermission: false,
    last7DaysStats: [],
    offsetWeeks: 0,
    setOffsetWeeks: (offset: number) => {
        set({ offsetWeeks: offset });
        get().refreshStats();
    },

    setOnboardingCompleted: async (val) => {
        set({ onboardingCompleted: val });
        await chrome.storage.local.set({ onboardingCompleted: val });
    },

    setFeaturePreviewSeen: async (val) => {
        set({ featurePreviewSeen: val, onboardingCompleted: val ? true : get().onboardingCompleted });
        await chrome.storage.local.set({
            featurePreviewSeen: val,
            ...(val ? { onboardingCompleted: true } : {}),
        });
    },

    setHistoryPermission: async (val) => {
        set({ historyPermission: val });
        await chrome.storage.local.set({ historyPermission: val });
    },

    importHistory: async () => {
        // Dedupe: history ingestion is expensive and must never loop the dashboard.
        if (Date.now() - lastHistoryImportAt < HISTORY_IMPORT_COOLDOWN_MS) return;
        lastHistoryImportAt = Date.now();
        try {
            const response = await chrome.runtime.sendMessage({ type: 'IMPORT_HISTORY' });
            if (response?.ok) {
                await get().refreshStats();
                await get().recalculateStreak();
            }
        } catch (e) {
            console.error('[Store] Import history failed:', e);
        }
    },

    setSession: (session) => {
        set({ session });
        if (session) void persistSessionBackup(session);
    },

    recalculateStreak: async () => {
        const { last7DaysStats, engineState } = get();
        const { [INSTALL_KEY]: installedAt } = await chrome.storage.local.get(INSTALL_KEY);
        const { current, best } = computeActivityStreak(
            last7DaysStats,
            engineState.habits || [],
            engineState.pomodoroSettings,
            typeof installedAt === 'number' ? installedAt : null
        );
        set({ streak: current, bestStreak: best });
        void chrome.storage.local.set({ streak: current, bestStreak: best });
    },

    recordDashboardOpen: async () => {
        const { recordDashboardOpen: record } = await import('./dashboardStreak');
        const { current, best } = await record();
        set({ dashboardStreak: current, dashboardBestStreak: best });
    },

    checkSession: async (opts?: { background?: boolean }) => {
        const background = opts?.background === true;
        console.log('[Store] checkSession triggered', background ? '(background)' : '');
        if (!background) set({ loading: true });

        try {
            const result = await chrome.storage.local.get([
                'sb-auth-token',
                SESSION_BACKUP_KEY,
                SESSION_CACHE_KEY,
                INSTALL_KEY,
                'xp',
                'streak',
                'bestStreak',
                'dashboardStreak',
                'dashboardBestStreak',
                'subscriptionTier',
                'subscriptionDetails',
                'screenTime',
                'dailyLimit',
                'onboardingCompleted',
                'featurePreviewSeen',
                'historyPermission',
            ]);

            if (!result[INSTALL_KEY]) {
                await chrome.storage.local.set({ [INSTALL_KEY]: Date.now() });
            }

            let session: Session | null =
                parseStoredSession(result['sb-auth-token']) ||
                parseStoredSession(result[SESSION_BACKUP_KEY]);

            if (session) {
                set({ session });
            }

            if (isSupabaseConfigured()) {
                if (session) {
                    const restored = await withTimeout(
                        supabase.auth.setSession({
                            access_token: session.access_token,
                            refresh_token: session.refresh_token,
                        }),
                        4000,
                        { data: { session: null }, error: null } as Awaited<
                            ReturnType<typeof supabase.auth.setSession>
                        >,
                    );
                    if (!restored.error && restored.data?.session) {
                        session = restored.data.session;
                        set({ session });
                        await persistSessionBackup(session);
                    }
                } else {
                    const remote = await withTimeout(supabase.auth.getSession(), 4000, {
                        data: { session: null },
                        error: null,
                    } as Awaited<ReturnType<typeof supabase.auth.getSession>>);
                    if (remote.error) console.error('[Store] Auth error:', remote.error);
                    if (remote.data?.session) {
                        session = remote.data.session;
                        set({ session });
                        await persistSessionBackup(session);
                    }
                }
            } else if (session) {
                await persistSessionBackup(session);
            }

            const cachedTier = (result.subscriptionTier as 'free' | 'pro') || 'free';
            const cachedDetails = (result.subscriptionDetails as AuthState['subscriptionDetails']) ?? null;

            set({
                session,
                xp: (result.xp as number) || 0,
                streak: (result.streak as number) || 0,
                bestStreak: (result.bestStreak as number) || (result.streak as number) || 0,
                dashboardStreak: (result.dashboardStreak as number) || 0,
                dashboardBestStreak: (result.dashboardBestStreak as number) || 0,
                subscriptionTier: cachedTier,
                subscriptionDetails: cachedDetails,
                screenTime: (result.screenTime as Record<string, number>) || {},
                dailyLimit: (result.dailyLimit as number) || 2 * 60 * 60 * 1000,
                onboardingCompleted: !!result.onboardingCompleted,
                featurePreviewSeen: !!(result.featurePreviewSeen ?? result.onboardingCompleted),
                historyPermission: !!result.historyPermission,
            });

            if (session?.user && isSupabaseConfigured()) {
                if (background) {
                    void (async () => {
                        await get().syncSubscriptionFromDb();
                        await get().syncProfileFromServer();
                    })();
                } else {
                    await get().syncSubscriptionFromDb();
                    await get().syncProfileFromServer();
                }
            } else {
                await get().fetchEngineState();
            }

            set({ loading: false });

            await get().refreshStats();
            await get().recalculateStreak();

            await chrome.storage.local.set({
                [SESSION_CACHE_KEY]: {
                    session,
                    subscriptionTier: get().subscriptionTier,
                    subscriptionDetails: get().subscriptionDetails,
                    onboardingCompleted: !!result.onboardingCompleted,
                    featurePreviewSeen: !!(result.featurePreviewSeen ?? result.onboardingCompleted),
                    cachedAt: Date.now(),
                },
            });
        } catch (e) {
            console.error('[Store] CRITICAL ERROR IN checkSession:', e);
        } finally {
            set({ loading: false });
        }
    },

    refreshStats: async () => {
        const stats: { date: string, total: number, sites: Record<string, number> }[] = [];
        const todayObj = new Date();
        const lookbackDays = 90;
        const keysToFetch: string[] = [];
        const days: string[] = [];

        for (let i = lookbackDays - 1; i >= 0; i--) {
            const d = new Date(todayObj);
            d.setDate(todayObj.getDate() - i);
            const ds = d.toDateString();
            days.push(ds);
            keysToFetch.push(`screenTime_${ds}`);
        }

        const historyResult = await chrome.storage.local.get(keysToFetch);
        days.forEach((ds) => {
            const dayData = historyResult[`screenTime_${ds}`] || {};
            const rawTotal = Object.values(dayData).reduce((a: number, b: any) => a + (b as number), 0);
            stats.push({
                date: ds,
                total: capDayScreenMs(rawTotal as number),
                sites: dayData as Record<string, number>,
            });
        });

        set({ last7DaysStats: stats });
        get().recalculateStreak();
    },

    updateStats: async () => {
        const result = await chrome.storage.local.get([
            'sb-auth-token',
            'xp',
            'streak',
            'subscriptionTier',
            'screenTime',
            'dailyLimit',
            'lastActiveDate',
            'focusTimeToday'
        ]);

        set({ screenTime: (result.screenTime as Record<string, number>) || {} });
    },

    setDailyLimit: async (limit) => {
        set({ dailyLimit: limit });
        await chrome.storage.local.set({ dailyLimit: limit });
    },

    clearProfileFromEngine: async () => {
        const cleared = { profileName: '', profileUsername: '', profileInitial: '', profileAvatar: '' };
        try {
            await sendEngineProfileSettings(cleared);
        } catch (e) {
            console.warn('[Store] clearProfileFromEngine failed:', e);
        }
        const { engineState } = get();
        set({ engineState: { ...engineState, ...cleared } });
        await chrome.storage.local.remove(PROFILE_USER_KEY);
    },

    syncProfileFromServer: async () => {
        const { session } = get();
        const userId = session?.user?.id;
        if (!userId || !session?.access_token || !session?.refresh_token) return;

        const stored = await chrome.storage.local.get(PROFILE_USER_KEY);
        const prevUserId = stored[PROFILE_USER_KEY] as string | undefined;
        if (prevUserId && prevUserId !== userId) {
            await get().clearProfileFromEngine();
        }

        const tokens = {
            access_token: session.access_token,
            refresh_token: session.refresh_token,
        };

        try {
            const { data: current } = await supabase.auth.getSession();
            // Avoid re-firing SIGNED_IN if this session is already active.
            if (current?.session?.user?.id !== userId) {
                await supabase.auth.setSession(tokens);
            }
        } catch (e) {
            console.warn('[Store] syncProfileFromServer setSession failed:', e);
        }

        const profile = await fetchMyProfileQuiet(supabase, tokens);
        if (!profile) return;

        const displayName = profile.displayName.trim();
        const settings = {
            profileName: displayName,
            profileUsername: profile.username.trim(),
            profileInitial: (displayName.charAt(0) || 'F').toUpperCase(),
            profileAvatar: profile.avatarUrl || '',
        };

        try {
            await sendEngineProfileSettings(settings);
        } catch (e) {
            console.warn('[Store] syncProfileFromServer engine update failed:', e);
        }

        const { engineState } = get();
        set({ engineState: { ...engineState, ...settings } });
        await chrome.storage.local.set({ [PROFILE_USER_KEY]: userId });
    },

    signOut: async () => {
        try {
            await supabase.auth.signOut();
        } catch (e) {
            console.error('[Store] Supabase signOut failed:', e);
        }

        await get().clearProfileFromEngine();

        // Aggressively clear all auth/subscription data
        await chrome.storage.local.remove([
            'sb-auth-token',
            SESSION_BACKUP_KEY,
            'subscriptionTier',
            'subscriptionDetails',
            'user',
        ]);

        // Also try sync storage if used
        try {
            await chrome.storage.sync.remove('sb-auth-token');
        } catch (e) { }

        set({ session: null, subscriptionTier: 'free', subscriptionDetails: null });
    },

    syncSubscriptionFromDb: async () => {
        const { session } = get();
        if (!session?.user?.id || !session.access_token) return;

        try {
            await supabase.auth.setSession({
                access_token: session.access_token,
                refresh_token: session.refresh_token,
            });

            const { data: sub } = await supabase
                .from('subscriptions')
                .select('*')
                .eq('user_id', session.user.id)
                .in('status', [...ACTIVE_SUBSCRIPTION_STATUSES])
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            const prevTier = get().subscriptionTier;
            const subPatch = subscriptionPatchFromRow(sub);
            await handleSubscriptionTierTransition(prevTier, subPatch.subscriptionTier);
            await chrome.storage.local.set({
                subscriptionTier: subPatch.subscriptionTier,
                subscriptionDetails: subPatch.subscriptionDetails,
            });
            set(subPatch);
            await get().fetchEngineState();
        } catch (e) {
            console.error('[Store] syncSubscriptionFromDb failed:', e);
        }
    },

    upgradeToPro: async () => {
        const { session, subscriptionTier } = get();
        if (!session?.access_token) {
            await signOutOnAuthError('NOT_AUTHENTICATED');
            return { ok: false, message: 'Please sign in again.' };
        }

        if (subscriptionTier === 'pro') {
            return { ok: false, alreadySubscribed: true, message: 'You are already subscribed to Pro.' };
        }

        const { data, error } = await supabase.functions.invoke('create-checkout-session', {
            body: { return_url: BILLING_RETURN_URL },
            headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (error) {
            console.error('[Store] create-checkout-session failed:', error);
            await signOutOnAuthError(error);
            return { ok: false, message: 'Could not start checkout.' };
        }

        if (data?.already_subscribed || data?.code === 'ALREADY_SUBSCRIBED') {
            await get().syncSubscriptionFromDb();
            if (data?.url) chrome.tabs.create({ url: data.url });
            return {
                ok: false,
                alreadySubscribed: true,
                message: data.error || 'You are already subscribed to Pro.',
            };
        }

        if (data?.error) {
            if (!(await signOutOnAuthError(data.error))) {
                return { ok: false, message: data.error };
            }
            return { ok: false, message: 'Could not start checkout.' };
        }

        if (data?.url) {
            chrome.tabs.create({ url: data.url });
            return { ok: true };
        }

        return { ok: false, message: 'Could not start checkout.' };
    },

    isPro: () => {
        return get().subscriptionTier === 'pro';
    },

    // Initialize storage listener
    init: async () => {
        if (get().initialized) {
            console.log('[Store] init() called but already initialized, skipping.');
            return;
        }
        console.log('[Store] Initializing store...');
        set({ initialized: true });

        await initSupabaseFromStorage();

        const cached = await chrome.storage.local.get([
            SESSION_CACHE_KEY,
            SESSION_BACKUP_KEY,
            'sb-auth-token',
            'subscriptionTier',
            'subscriptionDetails',
            'onboardingCompleted',
            'featurePreviewSeen',
            'historyPermission',
            'xp',
            'streak',
            'bestStreak',
        ]);

        const cachedSession =
            (cached[SESSION_CACHE_KEY] as { session?: Session } | undefined)?.session ||
            parseStoredSession(cached['sb-auth-token']) ||
            parseStoredSession(cached[SESSION_BACKUP_KEY]);

        if (cachedSession) {
            set({
                session: cachedSession,
                loading: false,
                subscriptionTier: (cached.subscriptionTier as 'free' | 'pro') || 'free',
                subscriptionDetails:
                    (cached.subscriptionDetails as AuthState['subscriptionDetails']) ?? null,
                onboardingCompleted: !!cached.onboardingCompleted,
                featurePreviewSeen: !!(cached.featurePreviewSeen ?? cached.onboardingCompleted),
                historyPermission: !!cached.historyPermission,
                xp: (cached.xp as number) || 0,
                streak: (cached.streak as number) || 0,
                bestStreak: (cached.bestStreak as number) || 0,
                dashboardStreak: (cached.dashboardStreak as number) || 0,
                dashboardBestStreak: (cached.dashboardBestStreak as number) || 0,
            });
        } else {
            set({ loading: false });
        }

        if (isSupabaseConfigured()) {
            let lastProfileSyncUserId: string | null = null;
            supabase.auth.onAuthStateChange((event, session) => {
                console.log('[Store] Auth event:', event);
                if (session) {
                    const prevUserId = get().session?.user?.id;
                    set({ session, loading: false });
                    void persistSessionBackup(session);
                    // setSession() re-fires SIGNED_IN; only sync when the user actually changes.
                    const userId = session.user?.id ?? null;
                    if (userId && (userId !== lastProfileSyncUserId || prevUserId !== userId)) {
                        lastProfileSyncUserId = userId;
                        void get().syncProfileFromServer();
                    }
                } else if (event === 'SIGNED_OUT') {
                    lastProfileSyncUserId = null;
                    void get().clearProfileFromEngine();
                }
            });
        }

        void get().checkSession({ background: true });

        // Listen for real-time analytics updates
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'local') {
                const isScreenTimeUpdate = Object.keys(changes).some(k => k.startsWith('screenTime_'));
                if (isScreenTimeUpdate) {
                    void get().refreshStats();
                }
                if (changes.habits || changes.engineState) {
                    get().recalculateStreak();
                }
            }
        });
    }
}));

// Keep session updates from background
chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'SESSION_UPDATED' && message.session) {
        const prevUserId = useAuthStore.getState().session?.user?.id;
        const nextUserId = message.session.user?.id;
        useAuthStore.setState({
            session: message.session,
            loading: false,
        });
        void persistSessionBackup(message.session);
        if (nextUserId && prevUserId !== nextUserId) {
            void useAuthStore.getState().clearProfileFromEngine();
        }
        void useAuthStore.getState().syncProfileFromServer();
        void useAuthStore.getState().syncSubscriptionFromDb();
    }
    if (message.type === 'ENGINE_STATE_UPDATE' && message.state) {
        useAuthStore.setState({ engineState: message.state });
        useAuthStore.getState().recalculateStreak();
    }
});
