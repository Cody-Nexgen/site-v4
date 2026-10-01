// ===============================================
// messageRouter.js
// Routes messages from popup to blocking engine
// ===============================================

import { supabase } from '../lib/supabase';
import { isFocuzPassMessage } from './focuzPassBridge';
import { senderKind } from '../lib/trustedOrigins';
import {
    blockDomainManual,
    unblockDomainManual,
    enableCategory,
    disableCategory,
    getAllCategoryStates,
    addDailySchedule,
    removeDailySchedule,
    getSchedules,
    startTimer,
    cancelTimer,
    removeBlockSource,
    getTimers,
    getEngineState,
    updateEngineSettings,
    applyCloudWorkspaceState,
    addAllowedSite,
    removeAllowedSite,
    startNuclearOption,
    incrementBlockedCount,
    saveState,
    requestEmergencyOverride,
    whenEngineReady,
} from "./blockengine.js";
import { completePomodoroSegment } from "./pomodoro.js";
import {
    onHabitCheckin,
    onAchievementUnlock,
    startChallengeById,
    purchaseShopItem,
    equipShopItem,
    setPublicProfileEnabled,
    setChallengeFocusScore,
    hydrateChallengesFromCloud,
} from '../lib/progressionService';
import { loadProgressionState } from '../lib/focusProgression';
import { classifyYouTubeViaApi } from './youtubeClassify.js';
import {
    finishFutureSelfContract,
    getCurrentWorkDestination,
    getFutureSelfState,
    markFutureSelfMirrorShown,
    recordFutureSelfEvent,
    setFutureSelfModeEnabled,
    startFutureSelfContract,
} from './futureSelfService.js';

let lastSyncTime = 0;
let currentSession = null;

const OPTIONS_PATH = 'src/options/index.html';

function buildOptionsUrl(tab, extra = {}) {
    const url = new URL(chrome.runtime.getURL(OPTIONS_PATH));
    if (tab) url.searchParams.set('tab', tab);
    for (const [k, v] of Object.entries(extra)) {
        if (v != null && v !== '') url.searchParams.set(k, String(v));
    }
    return url.toString();
}

async function openOptionsWithTab(tab, extra = {}) {
    const targetUrl = buildOptionsUrl(tab, extra);
    const extOrigin = chrome.runtime.getURL('');

    try {
        const tabs = await chrome.tabs.query({});
        const existing = tabs.find(
            (t) =>
                t.url &&
                (t.url.includes(`${extOrigin}${OPTIONS_PATH}`) ||
                    t.url.includes('src/options/index.html'))
        );

        let targetTabId = null;

        if (existing?.id != null) {
            targetTabId = existing.id;
            await chrome.tabs.update(existing.id, { active: true, url: targetUrl });
            if (existing.windowId != null) {
                await chrome.windows.update(existing.windowId, { focused: true });
            }
        } else {
            const created = await chrome.tabs.create({ url: targetUrl });
            targetTabId = created.id ?? null;
        }

        const navigate = () => {
            if (tab && targetTabId != null) {
                chrome.tabs.sendMessage(targetTabId, { type: 'NAVIGATE_TAB', tab }).catch(() => {
                    chrome.runtime.sendMessage({ type: 'NAVIGATE_TAB', tab }).catch(() => {});
                });
            }
        };
        setTimeout(navigate, 200);
        setTimeout(navigate, 700);
        return { ok: true };
    } catch (e) {
        console.warn('[MessageRouter] openOptionsWithTab failed, fallback tab create:', e);
        await chrome.tabs.create({ url: targetUrl });
        return { ok: true };
    }
}

// Load session from storage on startup
chrome.storage.local.get(['sb-auth-token'], (result) => {
    if (result['sb-auth-token']) {
        try {
            currentSession = JSON.parse(result['sb-auth-token']);
        } catch (e) {
            console.error('[MessageRouter] Failed to parse stored session');
        }
    }
});

/** Cloud sync for workspace settings. */
const SYNCABLE_KEYS = [
    'blocklist', 'allowedSites', 'regexBlocklist', 'categoriesActive', 'schedules',
    'activeDays', 'activeHours', 'dailyResetTime', 'redirectMessage', 'requireChallenge',
    'trackBackgroundAudio', 'draggableTimer', 'pomodoroWidget', 'focusMode', 'inAppBlock',
    'emergencyOverrideSettings', 'weeklyGoalHours', 'theme', 'customTheme', 'todos',
    'dailyFocusTarget', 'profileName', 'profileInitial', 'profileAvatar', 'pomodoroSettings',
    'habits', 'scratchpad', 'dailyPlanner', 'savedQuotes', 'dashboardLayout',
    'proDashboardVisuals', '_localMutationAt', 'allowlistMode',
    'pageVersions',
];

const EXTRA_STORAGE_SYNC_KEYS = [
    'focuznow_calendar_events_v1',
    'focuznow_calendar_groups_v1',
    'focuznow_scheduling_links_v2',
    'focuznow_lists_v1',
    'activeChallenges',
    'challengeProgress',
    'completedChallenges',
];

function pickSyncableState(state) {
    const payload = {};
    for (const key of SYNCABLE_KEYS) {
        if (state?.[key] !== undefined) payload[key] = state[key];
    }
    return payload;
}

async function syncSettingsToSupabase() {
    if (!currentSession?.user) return;
    try {
        const state = getEngineState();
        const payload = pickSyncableState(state);
        const extra = await chrome.storage.local.get(EXTRA_STORAGE_SYNC_KEYS);
        for (const key of EXTRA_STORAGE_SYNC_KEYS) {
            if (extra?.[key] !== undefined) payload[key] = extra[key];
        }
        const { error } = await supabase.rpc('upsert_my_workspace_state', { p_state: payload });
        if (error) {
            console.error('[MessageRouter] upsert_my_workspace_state failed:', error);
            return;
        }
    } catch (e) {
        console.error('[MessageRouter] syncSettingsToSupabase exception:', e?.message || e);
    }
}

let syncTimer = null;
let syncInFlight = null;
let syncAgain = false;

/**
 * Cloud push that never holds up a reply, batched: a burst of changes (typing,
 * toggling several things) becomes one upload of the workspace instead of one per
 * change, with at most one request in flight.
 */
function syncSettingsInBackground() {
    if (!currentSession?.user) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(runQueuedSync, 1500);
}

function runQueuedSync() {
    syncTimer = null;
    if (syncInFlight) {
        syncAgain = true;
        return;
    }
    syncInFlight = syncSettingsToSupabase().finally(() => {
        syncInFlight = null;
        if (syncAgain) {
            syncAgain = false;
            syncSettingsInBackground();
        }
    });
}

async function fetchSettingsFromSupabase() {
    if (!currentSession?.user) return;
    try {
        const localBefore = getEngineState();
        const localMutationAt = Number(localBefore?._localMutationAt) || 0;
        const { data, error } = await supabase.rpc('get_my_workspace_state');
        if (error) {
            console.error('[MessageRouter] get_my_workspace_state failed:', error);
            return;
        }
        const row = Array.isArray(data) ? data[0] : data;
        const remote = row?.state;
        if (!remote || typeof remote !== 'object') {
            await syncSettingsToSupabase();
            return;
        }
        const remoteMutationAt = Number(remote._localMutationAt) || 0;
        // Stale / in-flight cloud read lost a race with a local unblock/block.
        if (localMutationAt > remoteMutationAt) {
            await syncSettingsToSupabase();
            return;
        }
        await applyCloudWorkspaceState(remote);
    } catch (e) {
        console.error('[MessageRouter] fetchSettingsFromSupabase exception:', e?.message || e);
    }
}

async function syncNuclearWithSupabase() {
    if (!currentSession?.user) return;
    try {
        const { data: blocks, error } = await supabase
            .from('active_blocks')
            .select('*')
            .eq('user_id', currentSession.user.id)
            .eq('domain', 'NUCLEAR_LOCKDOWN')
            .maybeSingle();

        if (error) {
            console.error('[MessageRouter] Error fetching nuclear state from Supabase:', JSON.stringify(error));
            return;
        }

        if (blocks && new Date(blocks.expires_at) > new Date()) {
            const durationMs = new Date(blocks.expires_at).getTime() - Date.now();
            const durationMinutes = Math.ceil(durationMs / 60000);
            await startNuclearOption(blocks.source, durationMinutes);
        }
    } catch (e) {
        console.error('[MessageRouter] syncNuclearWithSupabase exception:', e.message || e);
    }
}

async function handleSessionSync(session) {
    if (!session) return { success: false, error: 'No session' };

    const now = Date.now();
    if (now - lastSyncTime < 10000) {
        return { success: true, debounced: true };
    }
    lastSyncTime = now;

    currentSession = session;

    // Supabase client sync (this will use the adapter to save to storage)
    try {
        await supabase.auth.setSession({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
        });
    } catch (e) {
        console.error('[MessageRouter] Supabase setSession failed:', e);
    }

    // Sync Nuclear state
    try {
        await syncNuclearWithSupabase();
        await fetchSettingsFromSupabase();
        await hydrateChallengesFromCloud();
    } catch (e) {
        console.error('[MessageRouter] Critical failure during nuclear/settings sync:', e);
    }

    // Broadcast to extension UI
    try {
        await chrome.runtime.sendMessage({ type: 'SESSION_UPDATED', session });
    } catch (e) { }

    return { success: true };
}

/**
 * Message types this router answers (keep in step with the switch below). Anything
 * else — FocuzPass, analytics, broadcasts — returns false straight away instead of
 * holding the channel open and waiting for the engine to load for nothing.
 */
const ROUTER_MESSAGE_TYPES = new Set([
    'ADD_ALLOWED_SITE',
    'ADD_BLOCK',
    'ADD_TODO',
    'BLOCK_DOMAIN',
    'CATEGORY_TOGGLE',
    'CLASSIFY_YOUTUBE_VIDEO',
    'EMERGENCY_OVERRIDE',
    'EQUIP_COSMETIC',
    'EXPORT_LOCAL_STATS',
    'FUTURE_SELF_ACTIVE_TAB',
    'FUTURE_SELF_BLOCKED',
    'FUTURE_SELF_FINISH',
    'FUTURE_SELF_GET',
    'FUTURE_SELF_MIRROR_SHOWN',
    'FUTURE_SELF_OVERRIDE',
    'FUTURE_SELF_SET_MODE',
    'FUTURE_SELF_START',
    'GET_CATEGORY_STATES',
    'GET_OVERRIDE_LOG',
    'GET_PROGRESSION',
    'GET_SCHEDULES',
    'GET_SESSION',
    'GET_STATE',
    'GET_TIMERS',
    'INCREMENT_BLOCKED_COUNT',
    'OPEN_AI_CHAT',
    'OPEN_OPTIONS',
    'PAYMENT_SUCCESS',
    'POMODORO_SEGMENT_COMPLETE',
    'PROGRESSION_ACHIEVEMENT',
    'PROGRESSION_HABIT_CHECKIN',
    'PURCHASE_SHOP_ITEM',
    'REMOVE_ALLOWED_SITE',
    'REMOVE_BLOCK',
    'REMOVE_BLOCK_SOURCE',
    'SB_SESSION_SYNC',
    'SCHEDULE_ADD',
    'SCHEDULE_REMOVE',
    'SET_CHALLENGE_FOCUS_SCORE',
    'SET_PUBLIC_PROFILE',
    'SOCIAL_HEARTBEAT',
    'START_CHALLENGE',
    'START_NUCLEAR',
    'START_SESSION',
    'SYNC_SESSION',
    'TIMER_CANCEL',
    'TIMER_START',
    'UPDATE_ENGINE_SETTINGS',
]);

export function initMessageRouter() {
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        if (!ROUTER_MESSAGE_TYPES.has(msg?.type) || isFocuzPassMessage(msg?.type)) return false;
        (async () => {
            try {
                // A message can be what woke the worker — never touch block state
                // before it has loaded from storage.
                await whenEngineReady();
                switch (msg.type) {
                    case 'SYNC_SESSION':
                    case 'SB_SESSION_SYNC':
                        // Signing the extension in: only the FocuzNow site (after its own login) or our pages.
                        if (senderKind(sender) === 'other') {
                            sendResponse({ success: false, error: 'Not available here' });
                            break;
                        }
                        const res = await handleSessionSync(msg.session);
                        sendResponse(res);
                        break;

                    case 'GET_SESSION':
                        // The session holds the account's tokens: our own pages only.
                        sendResponse(senderKind(sender) === 'extension-page' ? { session: currentSession } : { session: null });
                        break;

                    case 'PAYMENT_SUCCESS':
                        chrome.notifications.create({
                            type: 'basic',
                            iconUrl: chrome.runtime.getURL('public/icons/icon-128.png'),
                            title: '🎉 Upgrade Successful!',
                            message: 'You are now a Pro member!',
                            priority: 2
                        });
                        sendResponse({ success: true });
                        break;

                    case "ADD_BLOCK":
                        await blockDomainManual(msg.domain);
                        sendResponse({ ok: true, state: getEngineState() });
                        syncSettingsInBackground();
                        break;

                    case "REMOVE_BLOCK":
                        await unblockDomainManual(msg.domain);
                        sendResponse({ ok: true, state: getEngineState() });
                        syncSettingsInBackground();
                        break;

                    case "CATEGORY_TOGGLE":
                        if (msg.enabled) await enableCategory(msg.category);
                        else await disableCategory(msg.category);
                        sendResponse({ ok: true, state: getEngineState() });
                        syncSettingsInBackground();
                        break;

                    case "GET_CATEGORY_STATES":
                        sendResponse({ ok: true, states: getAllCategoryStates() });
                        break;

                    case "SCHEDULE_ADD":
                        const sId = await addDailySchedule(msg.domain, msg.startHour, msg.startMin, msg.endHour, msg.endMin, msg.days, msg.specificDate);
                        sendResponse({ ok: true, scheduleId: sId });
                        syncSettingsInBackground();
                        break;

                    case "SCHEDULE_REMOVE":
                        await removeDailySchedule(msg.domain, msg.scheduleId);
                        sendResponse({ ok: true });
                        syncSettingsInBackground();
                        break;

                    case "GET_SCHEDULES":
                        sendResponse({ ok: true, schedules: getSchedules(msg.domain) });
                        break;

                    case "TIMER_START":
                        const tId = await startTimer(msg.domain, msg.durationMinutes);
                        sendResponse({ ok: true, timerId: tId });
                        syncSettingsInBackground();
                        break;

                    case "TIMER_CANCEL":
                        await cancelTimer(msg.domain, msg.timerId);
                        sendResponse({ ok: true });
                        syncSettingsInBackground();
                        break;

                    case "REMOVE_BLOCK_SOURCE":
                        await removeBlockSource(msg.domain, msg.source, msg.sourceId || null);
                        sendResponse({ ok: true, state: getEngineState() });
                        syncSettingsInBackground();
                        break;

                    case "GET_TIMERS":
                        sendResponse({ ok: true, timers: getTimers(msg.domain) });
                        break;

                    case "ADD_ALLOWED_SITE":
                        await addAllowedSite(msg.domain);
                        sendResponse({ ok: true, state: getEngineState() });
                        syncSettingsInBackground();
                        break;

                    case "REMOVE_ALLOWED_SITE":
                        await removeAllowedSite(msg.domain);
                        sendResponse({ ok: true, state: getEngineState() });
                        syncSettingsInBackground();
                        break;

                    case "START_NUCLEAR":
                        if (!Number.isFinite(Number(msg.duration)) || Number(msg.duration) <= 0) {
                            sendResponse({ ok: false, error: 'Choose a valid lockdown duration.' });
                            break;
                        }
                        await startNuclearOption(msg.target, msg.duration);
                        sendResponse({ ok: true });
                        if (currentSession?.user) {
                            // Cross-device record — after the reply, never in front of it.
                            const expiresAt = new Date(Date.now() + msg.duration * 60000).toISOString();
                            void supabase
                                .from('active_blocks')
                                .upsert({
                                    user_id: currentSession.user.id,
                                    domain: 'NUCLEAR_LOCKDOWN',
                                    source: msg.target,
                                    expires_at: expiresAt
                                })
                                .then(({ error }) => {
                                    if (error) console.error('[MessageRouter] nuclear cloud record failed:', error);
                                });
                        }
                        break;

                    case "INCREMENT_BLOCKED_COUNT":
                        await incrementBlockedCount();
                        sendResponse({ ok: true });
                        break;

                    case "POMODORO_SEGMENT_COMPLETE": {
                        const result = await completePomodoroSegment();
                        sendResponse(result);
                        break;
                    }

                    case "EXPORT_LOCAL_STATS": {
                        // Only the screen/focus-time keys (+ pomodoro runtime), not the whole
                        // store (vault, calendar, lists…). getKeys() is Chromium 130+.
                        let all;
                        if (typeof chrome.storage.local.getKeys === 'function') {
                            const keys = (await chrome.storage.local.getKeys())
                                .filter((key) => key.startsWith('screenTime_') || key.startsWith('focusTime_'));
                            all = await chrome.storage.local.get([...keys, 'pomodoroRuntimeV1']);
                        } else {
                            all = await chrome.storage.local.get(null);
                        }
                        const screenTime = {};
                        const focusTime = {};
                        for (const [key, value] of Object.entries(all)) {
                            if (key.startsWith('screenTime_')) screenTime[key] = value;
                            if (key.startsWith('focusTime_')) focusTime[key] = value;
                        }
                        const engine = getEngineState();
                        sendResponse({
                            ok: true,
                            screenTime,
                            focusTime,
                            pomodoroSettings: engine.pomodoroSettings || null,
                            pomodoroRuntime: all.pomodoroRuntimeV1 || null,
                            blockedToday: engine.blockedToday || 0,
                        });
                        break;
                    }

                    case "FUTURE_SELF_ACTIVE_TAB": {
                        sendResponse({ ok: true, destination: await getCurrentWorkDestination() });
                        break;
                    }

                    case "FUTURE_SELF_START": {
                        sendResponse(await startFutureSelfContract(msg.contract || {}));
                        break;
                    }

                    case "FUTURE_SELF_GET": {
                        sendResponse({ ok: true, ...(await getFutureSelfState({ dashboardOpen: !!msg.dashboardOpen })) });
                        break;
                    }

                    case "FUTURE_SELF_BLOCKED": {
                        let domain = msg.url || '';
                        try { domain = new URL(msg.url).hostname.replace(/^www\./, ''); } catch {}
                        await recordFutureSelfEvent('blocked', { domain });
                        sendResponse({ ok: true, ...(await getFutureSelfState()) });
                        break;
                    }

                    case "FUTURE_SELF_OVERRIDE": {
                        if (!msg.confirmed || String(msg.reason || '').trim().length < 10) {
                            sendResponse({ ok: false, error: 'Confirm the broken promise and provide a reason.' });
                            break;
                        }
                        const result = await requestEmergencyOverride(msg.url, msg.reason);
                        if (result.ok) {
                            let domain = msg.url || '';
                            try { domain = new URL(msg.url).hostname.replace(/^www\./, ''); } catch {}
                            await recordFutureSelfEvent('override', { domain, reason: msg.reason });
                        }
                        sendResponse(result);
                        break;
                    }

                    case "FUTURE_SELF_FINISH": {
                        await finishFutureSelfContract(msg.status === 'cancelled' ? 'cancelled' : 'completed');
                        sendResponse({ ok: true });
                        break;
                    }

                    case "FUTURE_SELF_MIRROR_SHOWN": {
                        sendResponse(await markFutureSelfMirrorShown(msg.id));
                        break;
                    }

                    case "FUTURE_SELF_SET_MODE": {
                        sendResponse(await setFutureSelfModeEnabled(!!msg.enabled));
                        break;
                    }

                    case "UPDATE_ENGINE_SETTINGS":
                        await updateEngineSettings(msg.settings);
                        // Respond immediately — cloud sync must not block UI toggles (was ~30s).
                        sendResponse({ ok: true, state: getEngineState() });
                        syncSettingsInBackground();
                        break;

                    case "GET_STATE":
                        sendResponse({ ok: true, state: getEngineState() });
                        break;

                    case "CLASSIFY_YOUTUBE_VIDEO": {
                        const result = await classifyYouTubeViaApi({
                            videoId: msg.videoId,
                            channel: msg.channel || '',
                            blockedCategoryIds: msg.blockedCategoryIds || [],
                            allowedChannels: msg.allowedChannels || [],
                        });
                        sendResponse(result);
                        break;
                    }

                    case "OPEN_OPTIONS":
                        await openOptionsWithTab(msg.tab || null, {
                            toast: msg.toast || '',
                            coachPrompt: msg.coachPrompt || '',
                        });
                        sendResponse({ ok: true });
                        break;

                    case "START_SESSION": {
                        const mins = msg.duration || 25;
                        const domain = msg.domain || "focus";
                        await startTimer(domain, mins);
                        sendResponse({ ok: true });
                        syncSettingsInBackground();
                        break;
                    }

                    case "ADD_TODO": {
                        const state = getEngineState();
                        const title = (msg.title || "").trim();
                        if (title) {
                            const planner = state.dailyPlanner || [];
                            await updateEngineSettings({
                                dailyPlanner: [
                                    ...planner,
                                    {
                                        id: Date.now(),
                                        time: 'Anytime',
                                        task: title,
                                        done: false,
                                    },
                                ],
                            });
                            syncSettingsInBackground();
                        }
                        if (msg.openDashboard) {
                            await openOptionsWithTab('overview', {
                                toast: title ? `Added to-do: ${title}` : 'To-do added',
                            });
                        }
                        sendResponse({ ok: true, title });
                        break;
                    }

                    case "BLOCK_DOMAIN": {
                        const domain = (msg.domain || "").trim();
                        const duration = Number(msg.duration) || 25;
                        if (domain) {
                            await startTimer(domain, duration);
                            syncSettingsInBackground();
                        }
                        if (msg.openDashboard) {
                            await openOptionsWithTab('blocklist', {
                                toast: domain
                                    ? `Blocked ${domain} for ${duration} min`
                                    : 'Site blocked',
                            });
                        }
                        sendResponse({ ok: true, domain, duration });
                        break;
                    }

                    case "OPEN_AI_CHAT":
                        await openOptionsWithTab('ai_coach');
                        sendResponse({ ok: true });
                        break;

                    case "GET_PROGRESSION": {
                        const progression = await loadProgressionState();
                        sendResponse({ ok: true, progression });
                        break;
                    }

                    case "PROGRESSION_HABIT_CHECKIN":
                        await onHabitCheckin(msg.habitId);
                        sendResponse({ ok: true, progression: await loadProgressionState() });
                        break;

                    case "PROGRESSION_ACHIEVEMENT":
                        await onAchievementUnlock(msg.achievementId);
                        sendResponse({ ok: true, progression: await loadProgressionState() });
                        break;

                    case "START_CHALLENGE":
                        {
                            try {
                                const result = await startChallengeById(msg.challengeId, msg.challenge);
                                sendResponse({
                                    // `ok` reports that the handler completed. Challenge lifecycle
                                    // state is carried separately so completed/not-found are not
                                    // mistaken for transport failures.
                                    ok: true,
                                    started: result.started,
                                    active: result.active,
                                    persisted: result.persisted,
                                    cloudPersisted: result.cloudPersisted,
                                    reason: result.reason,
                                    progression: result.state,
                                });
                            } catch (error) {
                                console.error('[MessageRouter] START_CHALLENGE failed:', {
                                    challengeId: msg.challengeId,
                                    error,
                                });
                                sendResponse({
                                    ok: false,
                                    started: false,
                                    active: false,
                                    persisted: false,
                                    reason: 'handler_error',
                                    error: error?.message || String(error),
                                });
                            }
                        }
                        break;

                    case "SET_CHALLENGE_FOCUS_SCORE":
                        sendResponse({
                            ok: true,
                            progression: await setChallengeFocusScore(Number(msg.focusScore) || 0),
                        });
                        break;

                    case "PURCHASE_SHOP_ITEM": {
                        const result = await purchaseShopItem(msg.itemId, msg.cost);
                        sendResponse({ ...result, progression: await loadProgressionState() });
                        break;
                    }

                    case "EQUIP_COSMETIC":
                        await equipShopItem(msg.cosmeticType, msg.itemId ?? null);
                        sendResponse({ ok: true, progression: await loadProgressionState() });
                        break;

                    case "SET_PUBLIC_PROFILE":
                        await setPublicProfileEnabled(!!msg.enabled);
                        sendResponse({ ok: true, progression: await loadProgressionState() });
                        break;

                    case "EMERGENCY_OVERRIDE": {
                        const result = await requestEmergencyOverride(msg.url, msg.reason);
                        sendResponse(result);
                        break;
                    }

                    case "GET_OVERRIDE_LOG": {
                        const { getOverrideLogForUi } = await import('../lib/emergencyOverrideService');
                        const log = await getOverrideLogForUi();
                        sendResponse({ ok: true, log });
                        break;
                    }

                    case "SOCIAL_HEARTBEAT": {
                        const { sendSocialHeartbeat } = await import('../lib/socialHeartbeat.js');
                        await sendSocialHeartbeat({
                            focusing: !!msg.focusing,
                            endsAt: msg.endsAt ?? null,
                            focusMinutesDelta: msg.focusMinutesDelta ?? 0,
                        });
                        sendResponse({ ok: true });
                        break;
                    }

                }
            } catch (err) {
                console.error("[MessageRouter] Error:", err);
                sendResponse({ ok: false, error: err.message, code: err.code });
            }
        })();
        return true;
    });

    // Startup sync
    if (currentSession?.user) {
        syncNuclearWithSupabase();
    }
}
