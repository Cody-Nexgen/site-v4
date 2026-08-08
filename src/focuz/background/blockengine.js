import { isTemporarilyAllowed, pruneTemporaryAllows, grantEmergencyOverride } from '../lib/emergencyOverrideService';
import {
    SAFE_BLOCK_CATEGORIES,
    SAFE_BLOCK_CATEGORY_KEYS,
    isSafeBlockCategoryKey,
} from '../lib/blockCategories';
// Categories + Manual + Daily Schedules + Timers + Persistence
// =========================================================

// Global state
const state = {
    blocklist: {},      // domain -> { sources: Set(["manual","category","schedule","timer"]) }
    allowedSites: new Set(), // Whitelist (always allowed)
    regexBlocklist: {}, // pattern -> { sources: Set(["manual"]) }
    categoriesActive: {
        social: false, news: false, shopping: false, streaming: false,
        gambling: false, gaming: false, dating: false
    },
    schedules: {},      // domain -> [{ id, startHour, startMin, endHour, endMin, days: [0-6] }]
    timers: {},         // domain -> [{ id, endTime, durationMs }]
    onTimerExpired: null, // Callback for journaling

    // New Feature Settings
    activeDays: [0, 1, 2, 3, 4, 5, 6], // 0-6 (Sun-Sat)
    activeHours: { start: "00:00", end: "23:59" },
    dailyResetTime: "03:00",
    nuclearState: { active: false, endTime: 0, target: "blocked" }, // target: "blocked" | "all"
    redirectMessage: "Shouldn't you be working?",
    requireChallenge: false,
    blockedToday: 0,
    lastResetMarker: "",
    trackBackgroundAudio: false,
    draggableTimer: false,
    pomodoroWidget: false,
    focusMode: true,
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
    _localMutationAt: 0,
    emergencyOverrideSettings: {
        enabled: true,
        maxPerDay: 3,
        minReasonLength: 20,
        accessMinutes: 15,
        cooldownMinutes: 30,
    },
    weeklyGoalHours: 25,
    theme: 'purple',
    customTheme: { primary: '#7c3aed', accent: '#a855f7', highlight: '#c4b5fd' },
    todos: [],
    dailyFocusTarget: {},
    // Profile
    profileName: '',
    profileInitial: '',
    profileAvatar: '',
    // Productivity tools
    pomodoroSettings: null,
    habits: [],
    scratchpad: '',
    dailyPlanner: [],
    savedQuotes: [],

    // Integrations
    googleCalendarConnected: false,
    googleCalendarToken: '',
    googleProfile: null,
    notionConnected: false,
    notionToken: '',
    notionDatabaseId: '',
    notionJournalingEnabled: false,
    proDashboardVisuals: false
};

// =========================================================
// CATEGORY DEFINITIONS
// =========================================================

const CATEGORIES = SAFE_BLOCK_CATEGORIES;

function normalizeInAppBlock(raw) {
    const base = state.inAppBlock;
    const merged = { ...base, ...(raw || {}) };
    merged.smartYouTube = {
        ...base.smartYouTube,
        ...(merged.smartYouTube || {}),
    };
    merged.filters = Array.isArray(merged.filters) ? merged.filters : [];
    return merged;
}

export async function requestEmergencyOverride(url, reason) {
    return grantEmergencyOverride(
        () => state,
        saveState,
        applyRules,
        { url, reason },
    );
}

// =========================================================
// PERSISTENCE
// =========================================================

export async function saveState() {
    console.log("[BlockEngine] saveState called");
    const serialized = {
        blocklist: {},
        allowedSites: Array.from(state.allowedSites),
        regexBlocklist: {},
        categoriesActive: state.categoriesActive,
        schedules: state.schedules,
        timers: state.timers,
        activeDays: state.activeDays,
        activeHours: state.activeHours,
        dailyResetTime: state.dailyResetTime,
        nuclearState: state.nuclearState,
        redirectMessage: state.redirectMessage,
        requireChallenge: state.requireChallenge,
        blockedToday: state.blockedToday,
        trackBackgroundAudio: state.trackBackgroundAudio,
        draggableTimer: state.draggableTimer,
        pomodoroWidget: state.pomodoroWidget,
        focusMode: state.focusMode,
        inAppBlock: state.inAppBlock,
        temporaryAllows: state.temporaryAllows,
        emergencyOverrideSettings: state.emergencyOverrideSettings,
        theme: state.theme,
        customTheme: state.customTheme,
        todos: state.todos,
        dailyFocusTarget: state.dailyFocusTarget,
        profileName: state.profileName,
        profileInitial: state.profileInitial,
        profileAvatar: state.profileAvatar,
        pomodoroSettings: state.pomodoroSettings,
        habits: state.habits,
        scratchpad: state.scratchpad,
        dailyPlanner: state.dailyPlanner,
        savedQuotes: state.savedQuotes,
        googleCalendarConnected: state.googleCalendarConnected,
        googleCalendarToken: state.googleCalendarToken,
        googleProfile: state.googleProfile,
        notionConnected: state.notionConnected,
        notionToken: state.notionToken,
        notionDatabaseId: state.notionDatabaseId,
        notionJournalingEnabled: state.notionJournalingEnabled
    };

    // Convert Sets to Arrays for storage
    for (const domain in state.blocklist) {
        serialized.blocklist[domain] = {
            sources: Array.from(state.blocklist[domain].sources),
            categoryKeys: Array.from(state.blocklist[domain].categoryKeys || []),
        };
    }
    for (const pattern in state.regexBlocklist) {
        serialized.regexBlocklist[pattern] = {
            sources: Array.from(state.regexBlocklist[pattern].sources)
        };
    }

    await chrome.storage.local.set({ blockEngineState: serialized });

    // Also save critical state to sync storage for persistence across reinstalls
    const syncState = {
        blockedToday: state.blockedToday
    };

    if (state.nuclearState.active) {
        syncState.nuclearState = {
            ...state.nuclearState,
            remainingMs: Math.max(0, state.nuclearState.endTime - Date.now())
        };
    } else {
        syncState.nuclearState = state.nuclearState;
    }

    await chrome.storage.sync.set(syncState);

    console.log("[BlockEngine] State saved successfully");

    // Broadcast update
    try {
        const engineState = getEngineState();
        chrome.runtime.sendMessage({
            type: 'ENGINE_STATE_UPDATE',
            state: engineState
        }).catch(() => {
            // Ignore error if no popup is open
        });
    } catch (e) {
        console.error("[BlockEngine] Error broadcasting state:", e);
    }
}

export async function loadState() {
    console.log("[BlockEngine] loadState called");
    const result = await chrome.storage.local.get('blockEngineState');

    if (result.blockEngineState) {
        const loaded = result.blockEngineState;
        console.log("[BlockEngine] Found saved state:", loaded);

        // Restore blocklist (convert Arrays back to Sets)
        state.blocklist = {};
        const loadedEntries = loaded.blocklist && typeof loaded.blocklist === 'object'
            ? loaded.blocklist
            : {};
        const hasCategoryMetadata = Object.values(loadedEntries).some((entry) =>
            entry && Object.prototype.hasOwnProperty.call(entry, 'categoryKeys'));
        for (const domain in loadedEntries) {
            const rawEntry = loaded.blocklist[domain] || {};
            const sources = Array.isArray(rawEntry.sources) ? rawEntry.sources : [];
            state.blocklist[domain] = {
                sources: new Set(sources.filter((source) =>
                    ['manual', 'category', 'schedule', 'timer'].includes(source))),
                categoryKeys: new Set(
                    (Array.isArray(rawEntry.categoryKeys) ? rawEntry.categoryKeys : [])
                        .filter(isSafeBlockCategoryKey),
                ),
            };
        }

        state.regexBlocklist = {};
        if (loaded.regexBlocklist) {
            for (const pattern in loaded.regexBlocklist) {
                state.regexBlocklist[pattern] = {
                    sources: new Set(loaded.regexBlocklist[pattern].sources)
                };
            }
        }

        const loadedCategoryStates = loaded.categoriesActive && typeof loaded.categoriesActive === 'object'
            ? loaded.categoriesActive
            : {};
        state.categoriesActive = Object.fromEntries(
            SAFE_BLOCK_CATEGORY_KEYS.map((key) => [key, loadedCategoryStates[key] === true]),
        );
        // Legacy entries only had a generic category source. Rebuild exact
        // memberships from active safe categories, dropping unknown categories.
        if (!hasCategoryMetadata) {
            for (const [categoryKey, domains] of Object.entries(CATEGORIES)) {
                if (!state.categoriesActive[categoryKey]) continue;
                for (const domain of domains) {
                    if (!state.blocklist[domain]) {
                        state.blocklist[domain] = { sources: new Set(), categoryKeys: new Set() };
                    }
                    state.blocklist[domain].categoryKeys.add(categoryKey);
                    state.blocklist[domain].sources.add('category');
                }
            }
        }
        for (const domain of Object.keys(state.blocklist)) {
            const entry = state.blocklist[domain];
            for (const categoryKey of entry.categoryKeys) {
                if (!state.categoriesActive[categoryKey]) entry.categoryKeys.delete(categoryKey);
            }
            if (entry.categoryKeys.size > 0) entry.sources.add('category');
            else entry.sources.delete('category');
            if (entry.sources.size === 0) delete state.blocklist[domain];
        }
        state.schedules = loaded.schedules || {};
        state.timers = loaded.timers || {};
        state.allowedSites = new Set(loaded.allowedSites || []);
        // Older palette-created timers also wrote a manual source. Restore the
        // timer source so each active mechanism can be managed independently.
        for (const domain in state.timers) {
            if (state.timers[domain]?.some((timer) => timer.endTime > Date.now())) {
                addSource(domain, 'timer');
            }
        }

        state.activeDays = loaded.activeDays || state.activeDays;
        state.activeHours = loaded.activeHours || state.activeHours;
        state.dailyResetTime = loaded.dailyResetTime || state.dailyResetTime;
        state.nuclearState = loaded.nuclearState || state.nuclearState;
        state.redirectMessage = loaded.redirectMessage || state.redirectMessage;
        state.requireChallenge = loaded.requireChallenge ?? state.requireChallenge;
        state.blockedToday = loaded.blockedToday || 0;
        state.lastResetMarker = loaded.lastResetMarker || "";
        state.trackBackgroundAudio = loaded.trackBackgroundAudio ?? state.trackBackgroundAudio;
        state.draggableTimer = loaded.draggableTimer ?? state.draggableTimer;
        state.pomodoroWidget = loaded.pomodoroWidget ?? state.pomodoroWidget;
        state.weeklyGoalHours = loaded.weeklyGoalHours ?? state.weeklyGoalHours;
        state.focusMode = true;
        state.inAppBlock = normalizeInAppBlock(loaded.inAppBlock);
        state.temporaryAllows = loaded.temporaryAllows || [];
        state.emergencyOverrideSettings = {
            ...state.emergencyOverrideSettings,
            ...(loaded.emergencyOverrideSettings || {}),
        };
        state._localMutationAt = Number(loaded._localMutationAt) || 0;
        state.theme = loaded.theme || state.theme;
        state.customTheme = loaded.customTheme || state.customTheme;
        state.todos = loaded.todos || state.todos;
        state.dailyFocusTarget = loaded.dailyFocusTarget || state.dailyFocusTarget;
        state.profileName = loaded.profileName || '';
        state.profileInitial = loaded.profileInitial || '';
        state.profileAvatar = loaded.profileAvatar || '';
        state.pomodoroSettings = loaded.pomodoroSettings || null;
        state.habits = loaded.habits || [];
        state.scratchpad = loaded.scratchpad || '';
        state.dailyPlanner = loaded.dailyPlanner || [];
        state.savedQuotes = loaded.savedQuotes || [];

        // Restore Integrations
        state.googleCalendarConnected = loaded.googleCalendarConnected ?? false;
        state.googleCalendarToken = loaded.googleCalendarToken || '';
        state.googleProfile = loaded.googleProfile || null;
        state.notionConnected = loaded.notionConnected ?? false;
        state.notionToken = loaded.notionToken || '';
        state.notionDatabaseId = loaded.notionDatabaseId || '';
        state.notionJournalingEnabled = loaded.notionJournalingEnabled ?? false;
        state.proDashboardVisuals = loaded.proDashboardVisuals ?? state.proDashboardVisuals;

        // Overlay sync state for Nuclear persistence
        const syncResult = await chrome.storage.sync.get(['nuclearState', 'blockedToday']);
        if (syncResult.nuclearState) {
            console.log("[BlockEngine] Found synced Nuclear state:", syncResult.nuclearState);
            if (syncResult.nuclearState.active) {
                // "Pause" logic: calculate new endTime based on remaining duration
                state.nuclearState = {
                    ...syncResult.nuclearState,
                    endTime: Date.now() + (syncResult.nuclearState.remainingMs || 0)
                };
            } else {
                state.nuclearState = syncResult.nuclearState;
            }
        }
        if (syncResult.blockedToday !== undefined) {
            state.blockedToday = syncResult.blockedToday;
        }

        console.log("[BlockEngine] State loaded into memory");
        applyRules();
    } else {
        console.log("[BlockEngine] No saved state found");
    }
}

// =========================================================
// INTERNAL HELPERS
// =========================================================

function addSource(domain, source) {
    console.log(`[BlockEngine] addSource: ${domain} [${source}]`);
    if (!state.blocklist[domain]) {
        state.blocklist[domain] = { sources: new Set(), categoryKeys: new Set() };
    }
    if (!state.blocklist[domain].categoryKeys) {
        state.blocklist[domain].categoryKeys = new Set();
    }
    state.blocklist[domain].sources.add(source);
}

function removeSource(domain, source) {
    console.log(`[BlockEngine] removeSource: ${domain} [${source}]`);
    if (!state.blocklist[domain]) return;
    state.blocklist[domain].sources.delete(source);

    if (state.blocklist[domain].sources.size === 0) {
        console.log(`[BlockEngine] Domain ${domain} has no more sources, removing from blocklist`);
        delete state.blocklist[domain];
    }
}

function assertCanRemoveBlockSource(domain) {
    if (state.nuclearState.active) {
        const error = new Error(`Cannot change blocking for ${domain} during Nuclear Lockdown.`);
        error.code = 'NUCLEAR_LOCKDOWN_ACTIVE';
        throw error;
    }
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// =========================================================
// WHITELIST / ALLOWED SITES
// =========================================================

function getNuclearAllowedSites() {
    if (!state.nuclearState.active) return state.allowedSites;
    if (!state.nuclearState.snapshotAllowedSites) {
        state.nuclearState.snapshotAllowedSites = Array.from(state.allowedSites);
    }
    return new Set(state.nuclearState.snapshotAllowedSites);
}

export async function addAllowedSite(rawDomain) {
    const domain = sanitizeDomain(rawDomain);
    if (!domain) return;
    console.log(`[BlockEngine] addAllowedSite: ${domain}`);
    state.allowedSites.add(domain);
    // During nuclear lockdown, keep blocklist intact — allowlist only takes effect after lockdown ends
    if (!state.nuclearState.active && state.blocklist[domain]) {
        console.log(`[BlockEngine] Removing ${domain} from blocklist because it was added to allowlist`);
        delete state.blocklist[domain];
    } else if (state.nuclearState.active) {
        console.log(`[BlockEngine] Allowlist add deferred during nuclear lockdown: ${domain}`);
    }
    applyRules();
    await saveState();
}

export async function removeAllowedSite(domain) {
    console.log(`[BlockEngine] removeAllowedSite: ${domain}`);
    state.allowedSites.delete(domain);
    applyRules();
    await saveState();
}

// =========================================================
// ACTIVE WINDOW (Days & Hours)
// =========================================================

function isWithinActiveWindow() {
    const now = new Date();
    const currentDay = now.getDay();
    if (!state.activeDays.includes(currentDay)) return false;

    if (!state.activeHours?.start || !state.activeHours?.end) return true;

    const [startH, startM] = state.activeHours.start.split(':').map(Number);
    const [endH, endM] = state.activeHours.end.split(':').map(Number);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    if (startMinutes <= endMinutes) {
        // Normal range (e.g. 09:00 - 17:00)
        return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    } else {
        // Overnight range (e.g. 22:00 - 02:00)
        return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
    }
}

function checkDailyReset() {
    if (!state.dailyResetTime) return;

    const now = new Date();
    const [resetH, resetM] = state.dailyResetTime.split(':').map(Number);

    const resetMarker = `${now.toDateString()} ${state.dailyResetTime}`;
    if (state.lastResetMarker === resetMarker) return;

    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const resetMinutes = resetH * 60 + resetM;

    if (currentMinutes >= resetMinutes) {
        console.log("[BlockEngine] Daily reset triggered at", now.toLocaleTimeString());
        state.blockedToday = 0;
        state.lastResetMarker = resetMarker;
        saveState();
        import('../lib/progressionService').then(({ updatePlatformStreaks }) => {
            updatePlatformStreaks(state.inAppBlock).catch(() => {});
        }).catch(() => {});
    }
}

// =========================================================
// NUCLEAR OPTION
// =========================================================

export async function startNuclearOption(type, durationMinutes) {
    console.log(`[BlockEngine] Starting NUCLEAR OPTION: ${type} for ${durationMinutes}m`);
    state.nuclearState = {
        active: true,
        endTime: Date.now() + (durationMinutes * 60 * 1000),
        target: type, // "blocked" or "all"
        snapshotAllowedSites: Array.from(state.allowedSites),
    };
    applyRules();
    await saveState();
}

function checkNuclearOption() {
    if (state.nuclearState.active && Date.now() > state.nuclearState.endTime) {
        console.log("[BlockEngine] Nuclear Option EXPIRED");
        state.nuclearState.active = false;
        // Apply deferred allowlist exclusivity for sites added during lockdown
        for (const domain of state.allowedSites) {
            if (state.blocklist[domain]) {
                console.log(`[BlockEngine] Applying deferred allowlist for ${domain}`);
                delete state.blocklist[domain];
            }
        }
        applyRules();
        saveState();
    }
}

// =========================================================
// MANUAL BLOCKING
// =========================================================

function sanitizeDomain(domain) {
    if (!domain) return '';
    try {
        let d = domain.trim().toLowerCase();
        let path = '';
        if (d.includes('://')) {
            const parsed = new URL(d);
            d = parsed.hostname;
            // Preserve path if present (for route-specific blocking)
            if (parsed.pathname && parsed.pathname !== '/') {
                path = parsed.pathname.replace(/\/$/, ''); // strip trailing slash
            }
        } else if (d.includes('/')) {
            const slashIdx = d.indexOf('/');
            path = d.slice(slashIdx).replace(/\/$/, '');
            d = d.slice(0, slashIdx);
        }
        // Remove www. from the hostname only
        d = d.replace(/^www\./, '');
        return path ? `${d}${path}` : d;
    } catch (e) {
        return domain.trim().toLowerCase();
    }
}

export async function blockDomainManual(rawDomain) {
    const domain = sanitizeDomain(rawDomain);
    if (!domain) return;
    console.log(`[BlockEngine] blockDomainManual called for: ${domain}`);
    // Remove from allowedSites if present (Exclusivity)
    if (state.allowedSites.has(domain)) {
        console.log(`[BlockEngine] Removing ${domain} from allowlist because it was manually blocked`);
        state.allowedSites.delete(domain);
    }
    addSource(domain, "manual");
    state._localMutationAt = Date.now();
    applyRules();
    await saveState();
    console.log(`[BlockEngine] blockDomainManual finished for: ${domain}`);
}

export async function unblockDomainManual(domain) {
    assertCanRemoveBlockSource(domain);
    console.log(`[BlockEngine] unblockDomainManual called for: ${domain}`);
    removeSource(domain, "manual");
    // Full manual unblock should also clear leftover category membership so the
    // site does not stay blocked after disappearing from the blocklist UI.
    const entry = state.blocklist[domain];
    if (entry) {
        entry.categoryKeys?.clear();
        entry.sources.delete('category');
        if (entry.sources.size === 0) delete state.blocklist[domain];
    }
    state._localMutationAt = Date.now();
    applyRules();
    await saveState();
    console.log(`[BlockEngine] unblockDomainManual finished for: ${domain}`);
}

// =========================================================
// REGEX BLOCKING
// =========================================================

export async function blockRegexManual(pattern) {
    console.log(`[BlockEngine] blockRegexManual called for: ${pattern}`);
    if (!state.regexBlocklist[pattern]) {
        state.regexBlocklist[pattern] = { sources: new Set() };
    }
    state.regexBlocklist[pattern].sources.add("manual");
    applyRules();
    await saveState();
    console.log(`[BlockEngine] blockRegexManual finished for: ${pattern}`);
}

export async function unblockRegexManual(pattern) {
    console.log(`[BlockEngine] unblockRegexManual called for: ${pattern}`);
    if (state.regexBlocklist[pattern]) {
        state.regexBlocklist[pattern].sources.delete("manual");
        if (state.regexBlocklist[pattern].sources.size === 0) {
            delete state.regexBlocklist[pattern];
        }
    }
    applyRules();
    await saveState();
    console.log(`[BlockEngine] unblockRegexManual finished for: ${pattern}`);
}

// =========================================================
// CATEGORY BLOCKING
// =========================================================

export async function enableCategory(categoryName) {
    console.log(`[BlockEngine] enableCategory called for: ${categoryName}`);
    if (!CATEGORIES[categoryName]) {
        const error = new Error(`Unsupported block category: ${categoryName}`);
        error.code = 'INVALID_CATEGORY_KEY';
        throw error;
    }

    state.categoriesActive[categoryName] = true;
    console.log(`[BlockEngine] Category enabled in state: ${categoryName}`);

    // Add all domains in this category
    for (const domain of CATEGORIES[categoryName]) {
        addSource(domain, "category");
        state.blocklist[domain].categoryKeys.add(categoryName);
    }

    state._localMutationAt = Date.now();
    applyRules();
    await saveState();
    console.log(`[BlockEngine] enableCategory finished for: ${categoryName}`);
}

export async function disableCategory(categoryName) {
    if (state.nuclearState.active) {
        console.warn(`[BlockEngine] CANNOT DISABLE CATEGORY ${categoryName}: Nuclear Lockdown is active.`);
        const error = new Error(`Cannot disable ${categoryName} during Nuclear Lockdown.`);
        error.code = 'NUCLEAR_LOCKDOWN_ACTIVE';
        throw error;
    }
    console.log(`[BlockEngine] disableCategory called for: ${categoryName}`);
    if (!CATEGORIES[categoryName]) {
        const error = new Error(`Unsupported block category: ${categoryName}`);
        error.code = 'INVALID_CATEGORY_KEY';
        throw error;
    }

    state.categoriesActive[categoryName] = false;
    console.log(`[BlockEngine] Category disabled in state: ${categoryName}`);

    // Remove category source from all domains
    for (const domain of CATEGORIES[categoryName]) {
        const entry = state.blocklist[domain];
        if (!entry) continue;
        entry.categoryKeys?.delete(categoryName);
        if (!entry.categoryKeys?.size) removeSource(domain, "category");
    }

    state._localMutationAt = Date.now();
    applyRules();
    await saveState();
    console.log(`[BlockEngine] disableCategory finished for: ${categoryName}`);
}

export function getCategoryState(categoryName) {
    return state.categoriesActive[categoryName] || false;
}

export function getAllCategoryStates() {
    return { ...state.categoriesActive };
}

// =========================================================
// SCHEDULE MANAGEMENT
// =========================================================

export async function addDailySchedule(domain, startHour, startMin, endHour, endMin, days = [0, 1, 2, 3, 4, 5, 6], specificDate = null) {
    console.log(`[BlockEngine] addDailySchedule called for: ${domain}`);
    if (!state.schedules[domain]) {
        state.schedules[domain] = [];
    }

    const schedule = {
        id: generateId(),
        startHour,
        startMin,
        endHour,
        endMin,
        days, // 0=Sunday, 6=Saturday
        specificDate
    };

    state.schedules[domain].push(schedule);

    // Immediately evaluate if this schedule is active RIGHT NOW
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const sTime = startHour * 60 + startMin;
    const eTime = endHour * 60 + endMin;

    let matchesDay = false;
    if (specificDate) {
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        matchesDay = (specificDate === todayStr);
    } else {
        matchesDay = days.includes(now.getDay());
    }

    let isActiveNow = false;
    if (matchesDay) {
        if (eTime < sTime) {
            isActiveNow = (currentTime >= sTime || currentTime < eTime);
        } else {
            isActiveNow = (currentTime >= sTime && currentTime < eTime);
        }
    }

    if (isActiveNow) {
        console.log(`[BlockEngine] New schedule is ACTIVE NOW — enforcing immediately for ${domain}`);
        addSource(domain, "schedule");
        applyRules();
    }

    await saveState();
    console.log(`[BlockEngine] addDailySchedule finished. ID: ${schedule.id}`);
    return schedule.id;
}

export async function removeDailySchedule(domain, scheduleId) {
    console.log(`[BlockEngine] removeDailySchedule called for: ${domain}, ID: ${scheduleId}`);
    assertCanRemoveBlockSource(domain);
    if (!state.schedules[domain]) return;

    state.schedules[domain] = state.schedules[domain].filter(s => s.id !== scheduleId);

    if (state.schedules[domain].length === 0) {
        delete state.schedules[domain];
    }

    await saveState();
    checkSchedules();
    console.log(`[BlockEngine] removeDailySchedule finished`);
}

export function getSchedules(domain = null) {
    if (domain) {
        return state.schedules[domain] || [];
    }
    return { ...state.schedules };
}

export function checkSchedules() {
    console.log("[BlockEngine] checkSchedules heartbeat...");
    const now = new Date();
    const currentDay = now.getDay();
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    const currentTime = currentHour * 60 + currentMin;

    let changed = false;

    for (const domain in state.schedules) {
        let shouldBlock = false;

        for (const schedule of state.schedules[domain]) {
            let matchesDay = false;
            if (schedule.specificDate) {
                // Determine if today matches the specific YYYY-MM-DD
                const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                matchesDay = (schedule.specificDate === todayStr);
            } else {
                matchesDay = schedule.days.includes(currentDay);
            }

            if (!matchesDay) continue;

            const startTime = schedule.startHour * 60 + schedule.startMin;
            const endTime = schedule.endHour * 60 + schedule.endMin;

            if (endTime < startTime) {
                // Cross-midnight logic (e.g. 10:00 PM to 2:00 AM)
                if (currentTime >= startTime || currentTime < endTime) {
                    shouldBlock = true;
                    break;
                }
            } else {
                if (currentTime >= startTime && currentTime < endTime) {
                    shouldBlock = true;
                    break;
                }
            }
        }

        const hasScheduleSource = state.blocklist[domain]?.sources?.has("schedule");

        if (shouldBlock && !hasScheduleSource) {
            console.log(`[BlockEngine] Schedule ACTIVATING for ${domain}`);
            // Only add if not manually blocked (optional, but requested behavior usually)
            // Actually, we should add it regardless, so it persists if manual is removed
            addSource(domain, "schedule");
            changed = true;
        } else if (!shouldBlock && hasScheduleSource) {
            console.log(`[BlockEngine] Schedule DEACTIVATING for ${domain}`);
            removeSource(domain, "schedule");
            changed = true;
        }
    }

    if (changed) {
        applyRules();
        saveState();
    }
}

// =========================================================
// TIMER MANAGEMENT
// =========================================================

export async function startTimer(domain, durationMinutes) {
    console.log(`[BlockEngine] startTimer called for: ${domain}, duration: ${durationMinutes}m`);
    if (!state.timers[domain]) {
        state.timers[domain] = [];
    }

    const timer = {
        id: generateId(),
        endTime: Date.now() + (durationMinutes * 60 * 1000),
        durationMs: durationMinutes * 60 * 1000
    };

    state.timers[domain].push(timer);

    // Timers remain an independent source even when another source already blocks the domain.
    addSource(domain, "timer");

    applyRules();
    await saveState();

    console.log(`[BlockEngine] startTimer finished. ID: ${timer.id}`);
    return timer.id;
}

export async function cancelTimer(domain, timerId) {
    console.log(`[BlockEngine] cancelTimer called for: ${domain}, ID: ${timerId}`);
    assertCanRemoveBlockSource(domain);
    if (!state.timers[domain]) return;

    state.timers[domain] = state.timers[domain].filter(t => t.id !== timerId);

    if (state.timers[domain].length === 0) {
        delete state.timers[domain];
        removeSource(domain, "timer");
    }

    applyRules();
    await saveState();
    console.log(`[BlockEngine] cancelTimer finished`);
}

export async function removeBlockSource(rawDomain, source, sourceId = null) {
    const domain = sanitizeDomain(rawDomain);
    if (!domain) return;
    assertCanRemoveBlockSource(domain);

    if (source === 'manual') {
        removeSource(domain, source);
    } else if (source === 'category') {
        if (!isSafeBlockCategoryKey(sourceId)) {
            const error = new Error('A valid category key is required to remove a category block.');
            error.code = 'INVALID_CATEGORY_KEY';
            throw error;
        }
        const entry = state.blocklist[domain];
        entry?.categoryKeys?.delete(sourceId);
        if (entry && !entry.categoryKeys?.size) removeSource(domain, 'category');
    } else if (source === 'timer') {
        if (sourceId) {
            state.timers[domain] = (state.timers[domain] || []).filter((timer) => timer.id !== sourceId);
        } else {
            delete state.timers[domain];
        }
        if (!state.timers[domain]?.length) {
            delete state.timers[domain];
            removeSource(domain, 'timer');
        }
    } else if (source === 'schedule') {
        if (sourceId) {
            state.schedules[domain] = (state.schedules[domain] || []).filter((schedule) => schedule.id !== sourceId);
        } else {
            delete state.schedules[domain];
        }
        if (!state.schedules[domain]?.length) {
            delete state.schedules[domain];
            removeSource(domain, 'schedule');
        } else {
            checkSchedules();
        }
    } else {
        const error = new Error(`Unsupported block source: ${source}`);
        error.code = 'UNSUPPORTED_BLOCK_SOURCE';
        throw error;
    }

    // If the user cleared the last explicit (non-category) block, also drop
    // category membership for this domain — otherwise the row vanishes from
    // the UI while the site stays blocked by Social/Gaming/etc.
    const remaining = state.blocklist[domain];
    if (remaining) {
        const hasExplicit = [...remaining.sources].some((s) => s !== 'category');
        if (!hasExplicit && remaining.sources.has('category')) {
            remaining.categoryKeys?.clear();
            remaining.sources.delete('category');
            if (remaining.sources.size === 0) delete state.blocklist[domain];
        }
    }

    state._localMutationAt = Date.now();
    applyRules();
    await saveState();
}

export function checkTimers() {
    // Log every second as requested
    console.log(`[BlockEngine] checkTimers heartbeat... Active timers: ${Object.keys(state.timers).length}`);

    const now = Date.now();
    let changed = false;

    for (const domain in state.timers) {
        const activeBefore = state.timers[domain].length;

        const expired = state.timers[domain].filter(t => t.endTime <= now);
        state.timers[domain] = state.timers[domain].filter(t => t.endTime > now);

        if (state.timers[domain].length === 0) {
            console.log(`[BlockEngine] Timer EXPIRED for ${domain}`);

            // Log to Notion if callback is set
            if (state.onTimerExpired && expired.length > 0) {
                const totalDuration = expired.reduce((acc, t) => acc + (t.durationMs || 0), 0);
                state.onTimerExpired(domain, totalDuration);
            }

            delete state.timers[domain];
            removeSource(domain, "timer");
            changed = true;
        } else if (state.timers[domain].length !== activeBefore) {
            console.log(`[BlockEngine] A timer expired for ${domain}, but others remain`);
            changed = true;
        }
    }

    if (changed) {
        applyRules();
        saveState();
    }
}

export function getTimers(domain = null) {
    if (domain) {
        return state.timers[domain] || [];
    }
    return { ...state.timers };
}

export async function updateEngineSettings(settings) {
    const allowedFields = ['activeDays', 'activeHours', 'dailyResetTime', 'redirectMessage', 'requireChallenge', 'trackBackgroundAudio', 'draggableTimer', 'pomodoroWidget', 'focusMode', 'inAppBlock', 'theme', 'customTheme', 'todos', 'dailyFocusTarget', 'profileName', 'profileInitial', 'profileAvatar', 'pomodoroSettings', 'habits', 'scratchpad', 'dailyPlanner', 'savedQuotes', 'googleCalendarConnected', 'googleCalendarToken', 'googleProfile', 'notionConnected', 'notionToken', 'notionDatabaseId', 'notionJournalingEnabled', 'dashboardLayout', 'weeklyGoalHours', 'proDashboardVisuals', 'temporaryAllows', 'emergencyOverrideSettings'];
    for (const field of allowedFields) {
        if (settings[field] !== undefined) {
            state[field] = settings[field];
        }
    }
    await saveState();
    if (settings.notionJournalingEnabled !== undefined) {
        // Force immediate save if journaling toggle changed
        await saveState();
    }
    applyRules();

    if (settings.inAppBlock !== undefined) {
        import('../lib/progressionService').then(({ updatePlatformStreaks }) => {
            updatePlatformStreaks(state.inAppBlock).catch(() => {});
        }).catch(() => {});
    }

    if (settings.pomodoroWidget !== undefined || settings.draggableTimer !== undefined) {
        try {
            const tabs = await chrome.tabs.query({});
            for (const tab of tabs) {
                if (tab.id != null) {
                    chrome.tabs.sendMessage(tab.id, { type: 'SYNC_OVERLAY_WIDGETS' }).catch(() => {});
                }
            }
        } catch (e) {
            console.warn('[BlockEngine] overlay widget tab sync failed', e);
        }
    }
}

/**
 * Merge cloud workspace state into the local engine (except integration secrets).
 * Skips blocklist/allowlist overwrite when local mutations are newer than remote
 * (prevents stale in-flight fetches from re-blocking after an unblock).
 */
export async function applyCloudWorkspaceState(remote) {
    if (!remote || typeof remote !== 'object') return;

    const settings = { ...remote };
    delete settings.googleCalendarToken;
    delete settings.notionToken;
    delete settings.googleProfile;

    const remoteMutationAt = Number(settings._localMutationAt) || 0;
    const localMutationAt = Number(state._localMutationAt) || 0;
    const preferLocalBlocking = localMutationAt > remoteMutationAt;

    if (settings.blocklist && typeof settings.blocklist === 'object') {
        if (preferLocalBlocking) {
            console.log('[BlockEngine] Skipping remote blocklist — local mutations are newer');
            delete settings.blocklist;
        } else {
            state.blocklist = {};
            for (const domain of Object.keys(settings.blocklist)) {
                const rawEntry = settings.blocklist[domain] || {};
                const sources = Array.isArray(rawEntry.sources)
                    ? rawEntry.sources
                    : (rawEntry === true || rawEntry?.enabled ? ['manual'] : []);
                state.blocklist[domain] = {
                    sources: new Set(sources.filter((source) =>
                        ['manual', 'category', 'schedule', 'timer'].includes(source))),
                    categoryKeys: new Set(
                        (Array.isArray(rawEntry.categoryKeys) ? rawEntry.categoryKeys : [])
                            .filter(isSafeBlockCategoryKey),
                    ),
                };
            }
            delete settings.blocklist;
        }
    }

    if (Array.isArray(settings.allowedSites)) {
        if (preferLocalBlocking) {
            delete settings.allowedSites;
        } else {
            state.allowedSites = new Set(settings.allowedSites);
            delete settings.allowedSites;
        }
    }

    if (settings.regexBlocklist && typeof settings.regexBlocklist === 'object') {
        if (preferLocalBlocking) {
            delete settings.regexBlocklist;
        } else {
            state.regexBlocklist = {};
            for (const pattern of Object.keys(settings.regexBlocklist)) {
                const rawEntry = settings.regexBlocklist[pattern] || {};
                const sources = Array.isArray(rawEntry.sources) ? rawEntry.sources : ['manual'];
                state.regexBlocklist[pattern] = {
                    sources: new Set(sources),
                };
            }
            delete settings.regexBlocklist;
        }
    }

    if (settings.schedules && typeof settings.schedules === 'object') {
        if (!preferLocalBlocking) {
            state.schedules = settings.schedules;
        }
        delete settings.schedules;
    }

    if (settings.categoriesActive && typeof settings.categoriesActive === 'object') {
        if (!preferLocalBlocking) {
            state.categoriesActive = { ...state.categoriesActive, ...settings.categoriesActive };
        }
        delete settings.categoriesActive;
    }

    if (settings._localMutationAt !== undefined) {
        if (!preferLocalBlocking) {
            state._localMutationAt = remoteMutationAt;
        }
        delete settings._localMutationAt;
    }

    const EXTRA_STORAGE_SYNC_KEYS = [
        'focuznow_calendar_events_v1',
        'focuznow_calendar_groups_v1',
        'focuznow_scheduling_links_v2',
        'focuznow_lists_v1',
        'activeChallenges',
        'challengeProgress',
        'completedChallenges',
    ];
    const extraStorage = {};
    for (const key of EXTRA_STORAGE_SYNC_KEYS) {
        if (settings[key] !== undefined) {
            extraStorage[key] = settings[key];
            delete settings[key];
        }
    }
    if (Object.keys(extraStorage).length > 0) {
        await chrome.storage.local.set(extraStorage);
    }

    await updateEngineSettings(settings);
    await saveState();
    applyRules();
}

// =========================================================
// STATE EXPORT
// =========================================================

export function setTimerExpiredCallback(callback) {
    state.onTimerExpired = callback;
}

export function getEngineState() {
    console.log("[BlockEngine] getEngineState called");
    const formatted = {};

    for (const domain in state.blocklist) {
        formatted[domain] = {
            sources: Array.from(state.blocklist[domain].sources),
            categoryKeys: Array.from(state.blocklist[domain].categoryKeys || []),
        };
    }
    return {
        blocklist: formatted,
        allowedSites: Array.from(state.allowedSites),
        regexBlocklist: state.regexBlocklist,
        categoriesActive: { ...state.categoriesActive },
        schedules: { ...state.schedules },
        timers: { ...state.timers },
        activeDays: state.activeDays,
        activeHours: state.activeHours,
        dailyResetTime: state.dailyResetTime,
        nuclearState: state.nuclearState,
        redirectMessage: state.redirectMessage,
        requireChallenge: state.requireChallenge,
        blockedToday: state.blockedToday,
        trackBackgroundAudio: state.trackBackgroundAudio,
        draggableTimer: state.draggableTimer,
        pomodoroWidget: state.pomodoroWidget,
        focusMode: state.focusMode,
        inAppBlock: state.inAppBlock,
        temporaryAllows: state.temporaryAllows,
        emergencyOverrideSettings: state.emergencyOverrideSettings,
        _localMutationAt: state._localMutationAt || 0,
        theme: state.theme,
        customTheme: state.customTheme,
        todos: state.todos,
        dailyFocusTarget: state.dailyFocusTarget,
        profileName: state.profileName,
        profileInitial: state.profileInitial,
        profileAvatar: state.profileAvatar,
        pomodoroSettings: state.pomodoroSettings,
        habits: state.habits,
        scratchpad: state.scratchpad,
        dailyPlanner: state.dailyPlanner,
        savedQuotes: state.savedQuotes,
        googleCalendarConnected: state.googleCalendarConnected,
        googleCalendarToken: state.googleCalendarToken,
        googleProfile: state.googleProfile,
        notionConnected: state.notionConnected,
        notionToken: state.notionToken,
        notionDatabaseId: state.notionDatabaseId,
        notionJournalingEnabled: state.notionJournalingEnabled,
        proDashboardVisuals: state.proDashboardVisuals
    };
}

export async function incrementBlockedCount() {
    state.blockedToday++;
    await saveState();
    try {
        const { onBlockResisted } = await import('../lib/progressionService');
        await onBlockResisted();
    } catch (e) {
        console.warn('[BlockEngine] progression block award failed', e);
    }
}

// =========================================================
// APPLY MV3 DNR RULES
// =========================================================

export function applyRules() {
    console.log("[BlockEngine] applyRules called");
    pruneTemporaryAllows(state);
    const rules = [];
    let idCounter = 1;

    const isNuclear = state.nuclearState.active;
    const effectiveAllowedSites = isNuclear ? getNuclearAllowedSites() : state.allowedSites;

    // 1. Domain Blocking
    for (const domain in state.blocklist) {
        if (effectiveAllowedSites.has(domain)) continue;
        if (isTemporarilyAllowed(state, domain)) continue;

        const sources = state.blocklist[domain].sources;
        const hasExplicit = sources.has("schedule") || sources.has("timer");
        const hasGlobal = sources.has("manual") || sources.has("category");

        let shouldBlock = false;

        if (isNuclear) {
            shouldBlock = true;
        } else if (hasExplicit) {
            shouldBlock = true;
        } else if (hasGlobal) {
            // Manual and Category blocks are now always active if focusMode is on OR if they were explicitly set
            // The user wants "Focus Sessions" to be the main thing, but manual blocks should probably just WORK.
            shouldBlock = true;
        }

        if (!shouldBlock) continue;

        // Determine primary source for the redirect guidance
        let primarySource = "manual";
        if (sources.has("timer")) primarySource = "timer";
        else if (sources.has("schedule")) primarySource = "schedule";
        else if (sources.has("category")) primarySource = "category";

        // Separate hostname from optional path component
        const slashIdx = domain.indexOf('/');
        const hostname = slashIdx >= 0 ? domain.slice(0, slashIdx) : domain;
        const pathPart = slashIdx >= 0 ? domain.slice(slashIdx) : '';

        // Use exact subdomain anchor: ||hostname means "hostname or any subdomain".
        // For path-specific blocks we append the path so only that route is blocked.
        const urlFilter = pathPart ? `||${hostname}${pathPart}` : `||${hostname}`;

        rules.push({
            id: idCounter++,
            priority: 1,
            action: {
                type: "redirect",
                redirect: { url: chrome.runtime.getURL(`src/options/index.html?view=blocked&url=https://${domain}&source=${primarySource}`) }
            },
            condition: {
                urlFilter,
                resourceTypes: ["main_frame"]
            }
        });
    }

    // 2. Nuclear "Block All"
    if (state.nuclearState.active && state.nuclearState.target === 'all') {
        rules.push({
            id: idCounter++,
            priority: 2,
            action: {
                type: "redirect",
                redirect: { url: chrome.runtime.getURL(`src/options/index.html?view=blocked&url=LOCKDOWN`) }
            },
            condition: {
                urlFilter: "*",
                resourceTypes: ["main_frame"],
                excludedInitiatorDomains: effectiveAllowedSites.size > 0 ? Array.from(effectiveAllowedSites) : ["focuznow.com"]
            }
        });
    }

    // 3. Regex Blocking
    for (const pattern in state.regexBlocklist) {
        if (!isNuclear && !state.regexBlocklist[pattern].sources.has("manual")) continue;
        try {
            rules.push({
                id: idCounter++,
                priority: 1,
                action: {
                    type: "redirect",
                    redirect: { url: chrome.runtime.getURL(`src/options/index.html?view=blocked&url=REDACTED`) }
                },
                condition: {
                    regexFilter: pattern,
                    resourceTypes: ["main_frame"]
                }
            });
        } catch (e) {
            console.error(`[BlockEngine] Invalid regex pattern: ${pattern}`, e);
        }
    }

    // 4. YouTube Shorts (in-app block)
    const smartYt = state.inAppBlock?.smartYouTube || {};
    const blockShorts =
        state.inAppBlock?.youtubeShorts ||
        (smartYt.enabled && smartYt.blockShorts !== false);
    if (blockShorts) {
        const shortsBlockedUrl = chrome.runtime.getURL(
            'src/options/index.html?view=blocked&url=https://youtube.com/shorts&source=in_app',
        );
        for (const urlFilter of [
            '||youtube.com/shorts',
            '||m.youtube.com/shorts',
            '||www.youtube.com/shorts',
        ]) {
            rules.push({
                id: idCounter++,
                priority: 3,
                action: {
                    type: 'redirect',
                    redirect: { url: shortsBlockedUrl },
                },
                condition: {
                    urlFilter,
                    resourceTypes: ['main_frame'],
                },
            });
        }
    }

    // 5. Full platform blocks (when smart YouTube is off)
    const blockedPage = (site) =>
        chrome.runtime.getURL(`src/options/index.html?view=blocked&url=https://${site}&source=in_app`);

    if (state.inAppBlock?.youtube && !smartYt.enabled) {
        rules.push({
            id: idCounter++,
            priority: 2,
            action: { type: 'redirect', redirect: { url: blockedPage('youtube.com') } },
            condition: { urlFilter: '||youtube.com', resourceTypes: ['main_frame'] },
        });
    }

    if (state.inAppBlock?.tiktok) {
        for (const filter of ['||tiktok.com', '||www.tiktok.com']) {
            rules.push({
                id: idCounter++,
                priority: 2,
                action: { type: 'redirect', redirect: { url: blockedPage('tiktok.com') } },
                condition: { urlFilter: filter, resourceTypes: ['main_frame'] },
            });
        }
    }

    console.log(`[BlockEngine] Generated ${rules.length} rules. Updating dynamic rules...`);
    // console.log("[BlockEngine] Rules:", JSON.stringify(rules, null, 2)); // Verbose logging

    chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: Array.from({ length: 1000 }, (_, i) => i + 1), // Clear old rules (naive max ID)
        addRules: rules
    }, () => {
        if (chrome.runtime.lastError) {
            console.error("[BlockEngine] Error updating rules:", chrome.runtime.lastError);
        } else {
            console.log("[BlockEngine] Rules updated successfully");
        }
    });
}

// =========================================================
// INITIALIZATION
// =========================================================

export async function initBlockEngine() {
    console.log("[BlockEngine] initBlockEngine STARTING");
    await loadState();
    checkSchedules();
    checkTimers();
    checkNuclearOption();

    // MV3 Lifecycle Heartbeat
    chrome.alarms.create('blockEngineHeartbeat', { periodInMinutes: 1 });
    chrome.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === 'blockEngineHeartbeat') {
            checkNuclearOption();
            checkTimers();
            checkSchedules();
            checkDailyReset();
        }
    });

    console.log("[BlockEngine] initBlockEngine COMPLETED");
}
