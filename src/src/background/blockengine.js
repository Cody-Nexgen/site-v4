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
    /** When true and allowlist is non-empty: block ALL sites except allowlisted ones. */
    allowlistMode: false,
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

/** Fields of the removed Notion / Google Calendar integrations (purged from old saves). */
const REMOVED_INTEGRATION_KEYS = ['googleCalendarConnected', 'googleCalendarToken', 'googleProfile', 'notionConnected', 'notionToken', 'notionDatabaseId', 'notionJournalingEnabled'];

/** Last blockedToday/nuclear pair written to storage.sync (see saveState). */
let lastSyncedKey = '';

export async function saveState() {
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
        _localMutationAt: state._localMutationAt || 0,
        allowlistMode: state.allowlistMode === true,
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

    // Also save critical state to sync storage for persistence across reinstalls.
    // storage.sync allows ~120 writes/minute, so only write when these change —
    // it used to be rewritten on every save (every toggle, every blocked page).
    const syncState = {
        blockedToday: state.blockedToday,
        nuclearState: state.nuclearState.active
            ? { ...state.nuclearState, remainingMs: Math.max(0, state.nuclearState.endTime - Date.now()) }
            : state.nuclearState,
    };
    const syncKey = JSON.stringify({ blockedToday: syncState.blockedToday, nuclear: state.nuclearState });
    if (syncKey !== lastSyncedKey) {
        try {
            await chrome.storage.sync.set(syncState);
            lastSyncedKey = syncKey;
        } catch (e) {
            console.warn("[BlockEngine] storage.sync write failed:", e?.message || e);
        }
    }


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
    const result = await chrome.storage.local.get('blockEngineState');

    if (result.blockEngineState) {
        const loaded = result.blockEngineState;

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
        state.allowlistMode = loaded.allowlistMode === true;
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
        state.proDashboardVisuals = loaded.proDashboardVisuals ?? state.proDashboardVisuals;

        // Overlay sync state for Nuclear persistence
        const syncResult = await chrome.storage.sync.get(['nuclearState', 'blockedToday']);
        if (syncResult.nuclearState) {
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

        applyRules();

        // The Notion / Google Calendar integrations were removed. Once everything above
        // is loaded, rewrite the saved state so their old tokens don't linger in storage.
        if (REMOVED_INTEGRATION_KEYS.some((key) => key in loaded)) await saveState();
    }
}

// =========================================================
// INTERNAL HELPERS
// =========================================================

function addSource(domain, source) {
    if (!state.blocklist[domain]) {
        state.blocklist[domain] = { sources: new Set(), categoryKeys: new Set() };
    }
    if (!state.blocklist[domain].categoryKeys) {
        state.blocklist[domain].categoryKeys = new Set();
    }
    state.blocklist[domain].sources.add(source);
}

function removeSource(domain, source) {
    if (!state.blocklist[domain]) return;
    state.blocklist[domain].sources.delete(source);

    if (state.blocklist[domain].sources.size === 0) {
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

function hostnameOnly(domain) {
    return String(domain || '').split('/')[0].replace(/^www\./i, '').toLowerCase();
}

/** True if domain (or a parent/child host) is on the allowlist. */
function isDomainAllowlisted(domain, allowedSet) {
    if (!allowedSet || allowedSet.size === 0) return false;
    const host = hostnameOnly(domain);
    if (!host) return false;
    for (const raw of allowedSet) {
        const allowed = hostnameOnly(raw);
        if (!allowed) continue;
        if (host === allowed || host.endsWith('.' + allowed) || allowed.endsWith('.' + host)) {
            return true;
        }
    }
    return false;
}

function getAllowlistHostnames(allowedSet) {
    const hosts = new Set();
    for (const raw of allowedSet || []) {
        const h = hostnameOnly(raw);
        if (h) hosts.add(h);
    }
    hosts.add('focuznow.com');
    hosts.add('www.focuznow.com');
    return Array.from(hosts);
}

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
    state.allowedSites.add(domain);
    state._localMutationAt = Date.now();
    // Strip matching blocklist entries so allowlist actually unblocks. During a
    // nuclear lockdown the allowlist change is deferred until it ends.
    if (!state.nuclearState.active) {
        for (const blocked of Object.keys(state.blocklist)) {
            if (isDomainAllowlisted(blocked, state.allowedSites)) {
                delete state.blocklist[blocked];
            }
        }
    }
    // First allowlist entry turns on exclusive mode (matches UI copy).
    if (state.allowedSites.size === 1) {
        state.allowlistMode = true;
    }
    applyRules();
    await saveState();
}

export async function removeAllowedSite(domain) {
    state.allowedSites.delete(domain);
    state._localMutationAt = Date.now();
    if (state.allowedSites.size === 0) {
        state.allowlistMode = false;
    }
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
        state.nuclearState.active = false;
        // Apply deferred allowlist exclusivity for sites added during lockdown
        for (const domain of state.allowedSites) {
            if (state.blocklist[domain]) {
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
    // Remove from allowedSites if present (Exclusivity)
    if (state.allowedSites.has(domain)) {
        state.allowedSites.delete(domain);
    }
    addSource(domain, "manual");
    state._localMutationAt = Date.now();
    applyRules();
    await saveState();
}

export async function unblockDomainManual(domain) {
    assertCanRemoveBlockSource(domain);
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
}

// =========================================================
// REGEX BLOCKING
// =========================================================

export async function blockRegexManual(pattern) {
    if (!state.regexBlocklist[pattern]) {
        state.regexBlocklist[pattern] = { sources: new Set() };
    }
    state.regexBlocklist[pattern].sources.add("manual");
    applyRules();
    await saveState();
}

export async function unblockRegexManual(pattern) {
    if (state.regexBlocklist[pattern]) {
        state.regexBlocklist[pattern].sources.delete("manual");
        if (state.regexBlocklist[pattern].sources.size === 0) {
            delete state.regexBlocklist[pattern];
        }
    }
    applyRules();
    await saveState();
}

// =========================================================
// CATEGORY BLOCKING
// =========================================================

export async function enableCategory(categoryName) {
    if (!CATEGORIES[categoryName]) {
        const error = new Error(`Unsupported block category: ${categoryName}`);
        error.code = 'INVALID_CATEGORY_KEY';
        throw error;
    }

    state.categoriesActive[categoryName] = true;

    // Add all domains in this category (skip allowlisted hosts)
    for (const domain of CATEGORIES[categoryName]) {
        if (isDomainAllowlisted(domain, state.allowedSites)) continue;
        addSource(domain, "category");
        state.blocklist[domain].categoryKeys.add(categoryName);
    }

    state._localMutationAt = Date.now();
    applyRules();
    await saveState();
}

export async function disableCategory(categoryName) {
    if (state.nuclearState.active) {
        console.warn(`[BlockEngine] CANNOT DISABLE CATEGORY ${categoryName}: Nuclear Lockdown is active.`);
        const error = new Error(`Cannot disable ${categoryName} during Nuclear Lockdown.`);
        error.code = 'NUCLEAR_LOCKDOWN_ACTIVE';
        throw error;
    }
    if (!CATEGORIES[categoryName]) {
        const error = new Error(`Unsupported block category: ${categoryName}`);
        error.code = 'INVALID_CATEGORY_KEY';
        throw error;
    }

    state.categoriesActive[categoryName] = false;

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
        addSource(domain, "schedule");
        applyRules();
    }

    await saveState();
    return schedule.id;
}

export async function removeDailySchedule(domain, scheduleId) {
    assertCanRemoveBlockSource(domain);
    if (!state.schedules[domain]) return;

    state.schedules[domain] = state.schedules[domain].filter(s => s.id !== scheduleId);

    if (state.schedules[domain].length === 0) {
        delete state.schedules[domain];
    }

    await saveState();
    checkSchedules();
}

export function getSchedules(domain = null) {
    if (domain) {
        return state.schedules[domain] || [];
    }
    return { ...state.schedules };
}

export function checkSchedules() {
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
            // Only add if not manually blocked (optional, but requested behavior usually)
            // Actually, we should add it regardless, so it persists if manual is removed
            addSource(domain, "schedule");
            changed = true;
        } else if (!shouldBlock && hasScheduleSource) {
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

    return timer.id;
}

export async function cancelTimer(domain, timerId) {
    assertCanRemoveBlockSource(domain);
    if (!state.timers[domain]) return;

    state.timers[domain] = state.timers[domain].filter(t => t.id !== timerId);

    if (state.timers[domain].length === 0) {
        delete state.timers[domain];
        removeSource(domain, "timer");
    }

    applyRules();
    await saveState();
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

    const now = Date.now();
    let changed = false;

    for (const domain in state.timers) {
        const activeBefore = state.timers[domain].length;

        const expired = state.timers[domain].filter(t => t.endTime <= now);
        state.timers[domain] = state.timers[domain].filter(t => t.endTime > now);

        if (state.timers[domain].length === 0) {

            delete state.timers[domain];
            removeSource(domain, "timer");
            changed = true;
        } else if (state.timers[domain].length !== activeBefore) {
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
    const allowedFields = ['activeDays', 'activeHours', 'dailyResetTime', 'redirectMessage', 'requireChallenge', 'trackBackgroundAudio', 'draggableTimer', 'pomodoroWidget', 'focusMode', 'allowlistMode', 'inAppBlock', 'theme', 'customTheme', 'todos', 'dailyFocusTarget', 'profileName', 'profileInitial', 'profileAvatar', 'pomodoroSettings', 'habits', 'scratchpad', 'dailyPlanner', 'savedQuotes', 'dashboardLayout', 'weeklyGoalHours', 'proDashboardVisuals', 'temporaryAllows', 'emergencyOverrideSettings', 'pageVersions'];
    for (const field of allowedFields) {
        if (settings[field] !== undefined) {
            state[field] = field === 'inAppBlock'
                ? normalizeInAppBlock(settings.inAppBlock)
                : settings[field];
        }
    }
    // Bump so cloud hydrate / web GET_STATE can't overwrite with a stale remote snapshot.
    state._localMutationAt = Date.now();
    await saveState();
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

    const remoteMutationAt = Number(settings._localMutationAt) || 0;
    const localMutationAt = Number(state._localMutationAt) || 0;
    const preferLocalBlocking = localMutationAt > remoteMutationAt;

    if (settings.blocklist && typeof settings.blocklist === 'object') {
        if (preferLocalBlocking) {
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

    // updateEngineSettings saves and re-applies the rules (covering the blocklist edits above).
    await updateEngineSettings(settings);
}

// =========================================================
// STATE EXPORT
// =========================================================


/** Cheap read for hot paths that need one flag, not a full engine snapshot. */
export function isTrackingBackgroundAudio() {
    return state.trackBackgroundAudio === true;
}

export function getEngineState() {
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
        allowlistMode: state.allowlistMode === true,
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
    pruneTemporaryAllows(state);
    const rules = [];
    let idCounter = 1;

    const isNuclear = state.nuclearState.active;
    const effectiveAllowedSites = isNuclear ? getNuclearAllowedSites() : state.allowedSites;
    const exclusiveAllowlist =
        !isNuclear && state.allowlistMode === true && effectiveAllowedSites.size > 0;

    // Exclusive allowlist mode: block http(s) navigations except allowlisted hosts.
    // NOTE: urlFilter "*" is invalid in Chrome DNR. Prefer *://*/*; keep regex as backup id.
    if (exclusiveAllowlist) {
        const excluded = getAllowlistHostnames(effectiveAllowedSites);
        const excludedDomains = excluded.length ? excluded : ["focuznow.com"];
        rules.push({
            id: idCounter++,
            priority: 1,
            action: {
                type: "redirect",
                redirect: { url: chrome.runtime.getURL(`src/options/index.html?view=blocked&url=ALLOWLIST&source=allowlist`) }
            },
            condition: {
                urlFilter: "*://*/*",
                resourceTypes: ["main_frame"],
                excludedRequestDomains: excludedDomains,
            }
        });
    }

    // 1. Domain Blocking — always apply blocklist too (even in allowlist mode)
    // so category/manual blocks still work if the catch-all rule is rejected.
    for (const domain in state.blocklist) {
        if (isDomainAllowlisted(domain, effectiveAllowedSites)) continue;
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
            priority: exclusiveAllowlist ? 2 : 1,
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
        const nuclearExcluded = getAllowlistHostnames(effectiveAllowedSites);
        rules.push({
            id: idCounter++,
            priority: 2,
            action: {
                type: "redirect",
                redirect: { url: chrome.runtime.getURL(`src/options/index.html?view=blocked&url=LOCKDOWN`) }
            },
            condition: {
                urlFilter: "*://*/*",
                resourceTypes: ["main_frame"],
                excludedRequestDomains: nuclearExcluded.length ? nuclearExcluded : ["focuznow.com"],
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

    if (state.inAppBlock?.instagram) {
        for (const filter of ['||instagram.com', '||www.instagram.com']) {
            rules.push({
                id: idCounter++,
                priority: 2,
                action: { type: 'redirect', redirect: { url: blockedPage('instagram.com') } },
                condition: { urlFilter: filter, resourceTypes: ['main_frame'] },
            });
        }
    } else if (state.inAppBlock?.instagramReels) {
        for (const filter of [
            '||instagram.com/reels',
            '||www.instagram.com/reels',
            '||instagram.com/reel',
            '||www.instagram.com/reel',
        ]) {
            rules.push({
                id: idCounter++,
                priority: 3,
                action: { type: 'redirect', redirect: { url: blockedPage('instagram.com/reels') } },
                condition: { urlFilter: filter, resourceTypes: ['main_frame'] },
            });
        }
    }

    queueRuleUpdate(rules);
}

// Rule updates run one at a time, collapse bursts (only the newest rule set is
// installed — twenty quick toggles mean at most two updates), and are skipped when
// nothing changed: each updateDynamicRules call makes the browser re-index every rule.
let lastAppliedRules = null;
let pendingRules = null;
let ruleUpdateRunning = false;

function queueRuleUpdate(rules) {
    pendingRules = rules;
    if (!ruleUpdateRunning) void drainRuleUpdates();
}

async function drainRuleUpdates() {
    ruleUpdateRunning = true;
    try {
        while (pendingRules) {
            const rules = pendingRules;
            pendingRules = null;
            const signature = JSON.stringify(rules);
            if (signature === lastAppliedRules) continue;
            try {
                // Remove whatever is installed — the old fixed 1..1000 id range missed
                // rules past 1000, and the duplicate ids then made every update fail.
                const existing = await chrome.declarativeNetRequest.getDynamicRules();
                await chrome.declarativeNetRequest.updateDynamicRules({
                    removeRuleIds: existing.map((rule) => rule.id),
                    addRules: rules,
                });
                lastAppliedRules = signature;
            } catch (e) {
                lastAppliedRules = null;
                console.error("[BlockEngine] Error updating rules:", e?.message || e);
            }
        }
    } finally {
        ruleUpdateRunning = false;
    }
}

// =========================================================
// INITIALIZATION
// =========================================================

// One load per service-worker lifetime. MV3 kills the worker after ~30s idle and
// a click can wake it: the message listener is live before storage has loaded,
// so a handler that ran early would edit the empty default state and saveState()
// would overwrite the user's saved blocklist. Every handler awaits this first.
let enginePromise = null;

export function whenEngineReady() {
    if (!enginePromise) {
        enginePromise = startBlockEngine().catch((err) => {
            enginePromise = null;
            throw err;
        });
    }
    return enginePromise;
}

export function initBlockEngine() {
    return whenEngineReady();
}

async function startBlockEngine() {
    await loadState();
    checkSchedules();
    checkTimers();
    checkNuclearOption();

    // MV3 Lifecycle Heartbeat
    chrome.alarms.create('blockEngineHeartbeat', { periodInMinutes: 1 });

}

// Registered at module load (not after an await) so an alarm that wakes the
// worker is delivered to it.
chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== 'blockEngineHeartbeat') return;
    await whenEngineReady();
    checkNuclearOption();
    checkTimers();
    checkSchedules();
    checkDailyReset();
});
