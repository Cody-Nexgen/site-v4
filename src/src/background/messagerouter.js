// ===============================================
// messageRouter.js
// Routes messages from popup to blocking engine
// ===============================================

import { supabase } from '../lib/supabase';
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
    getTimers,
    getEngineState,
    updateEngineSettings,
    addAllowedSite,
    removeAllowedSite,
    startNuclearOption,
    incrementBlockedCount,
    saveState,
    setTimerExpiredCallback,
    requestEmergencyOverride,
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
} from '../lib/progressionService';
import { loadProgressionState } from '../lib/focusProgression';
import { classifyYouTubeViaApi } from './youtubeClassify.js';

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
            console.log('[MessageRouter] Loaded session into memory');
        } catch (e) {
            console.error('[MessageRouter] Failed to parse stored session');
        }
    }
});

// --- Focus Session Logging (Notion) ---
setTimerExpiredCallback(async (domain, durationMs) => {
    const state = getEngineState();
    if (!state.notionConnected || !state.notionToken || !state.notionDatabaseId || !state.notionJournalingEnabled) {
        console.log('[MessageRouter] Notion journaling not enabled/connected, skipping focus log.');
        return;
    }

    if (!currentSession?.user) {
        console.warn('[MessageRouter] No user session found for Notion log.');
        return;
    }

    try {
        console.log(`[MessageRouter] Logging focus session to Notion: ${domain} (${durationMs}ms)`);

        // Convert to minutes for readable logs
        const minutes = Math.round(durationMs / 60000);

        await supabase.functions.invoke('notion-log-session', {
            body: {
                token: state.notionToken,
                databaseId: state.notionDatabaseId,
                title: `Focus: ${domain}`,
                durationMinutes: minutes,
                domain: domain,
                userId: currentSession.user.id
            }
        });
    } catch (e) {
        console.error('[MessageRouter] Failed to log focus session to Notion:', e);
    }
});

/** Integrations stay in extension local storage only — not the scheduling `profiles` table. */
async function syncSettingsToSupabase() {
    return;
}

async function fetchSettingsFromSupabase() {
    return;
}

async function syncNuclearWithSupabase() {
    if (!currentSession?.user) return;
    try {
        console.log('[MessageRouter] Checking Supabase for active Nuclear Lockdown...');
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
            console.log('[MessageRouter] Found active Nuclear Lockdown in Supabase');
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

    console.log('[MessageRouter] Syncing session...');
    currentSession = session;

    // Supabase client sync (this will use the adapter to save to storage)
    try {
        await supabase.auth.setSession({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
        });
        console.log('[MessageRouter] Supabase session synced');
    } catch (e) {
        console.error('[MessageRouter] Supabase setSession failed:', e);
    }

    // Sync Nuclear state
    try {
        await syncNuclearWithSupabase();
        await fetchSettingsFromSupabase();
    } catch (e) {
        console.error('[MessageRouter] Critical failure during nuclear/settings sync:', e);
    }

    // Broadcast to extension UI
    try {
        await chrome.runtime.sendMessage({ type: 'SESSION_UPDATED', session });
    } catch (e) { }

    return { success: true };
}

export function initMessageRouter() {
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        (async () => {
            try {
                switch (msg.type) {
                    case 'SYNC_SESSION':
                    case 'SB_SESSION_SYNC':
                        const res = await handleSessionSync(msg.session);
                        sendResponse(res);
                        break;

                    case 'GET_SESSION':
                        sendResponse({ session: currentSession });
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
                        sendResponse({ ok: true });
                        break;

                    case "REMOVE_BLOCK":
                        await unblockDomainManual(msg.domain);
                        sendResponse({ ok: true });
                        break;

                    case "CATEGORY_TOGGLE":
                        if (msg.enabled) await enableCategory(msg.category);
                        else await disableCategory(msg.category);
                        sendResponse({ ok: true });
                        break;

                    case "GET_CATEGORY_STATES":
                        sendResponse({ ok: true, states: getAllCategoryStates() });
                        break;

                    case "SCHEDULE_ADD":
                        const sId = await addDailySchedule(msg.domain, msg.startHour, msg.startMin, msg.endHour, msg.endMin, msg.days, msg.specificDate);
                        sendResponse({ ok: true, scheduleId: sId });
                        break;

                    case "SCHEDULE_REMOVE":
                        await removeDailySchedule(msg.domain, msg.scheduleId);
                        sendResponse({ ok: true });
                        break;

                    case "GET_SCHEDULES":
                        sendResponse({ ok: true, schedules: getSchedules(msg.domain) });
                        break;

                    case "TIMER_START":
                        const tId = await startTimer(msg.domain, msg.durationMinutes);
                        sendResponse({ ok: true, timerId: tId });
                        break;

                    case "TIMER_CANCEL":
                        await cancelTimer(msg.domain, msg.timerId);
                        sendResponse({ ok: true });
                        break;

                    case "GET_TIMERS":
                        sendResponse({ ok: true, timers: getTimers(msg.domain) });
                        break;

                    case "ADD_ALLOWED_SITE":
                        await addAllowedSite(msg.domain);
                        sendResponse({ ok: true });
                        break;

                    case "REMOVE_ALLOWED_SITE":
                        await removeAllowedSite(msg.domain);
                        sendResponse({ ok: true });
                        break;

                    case "START_NUCLEAR":
                        await startNuclearOption(msg.target, msg.duration);
                        if (currentSession?.user) {
                            const expiresAt = new Date(Date.now() + msg.duration * 60000).toISOString();
                            await supabase
                                .from('active_blocks')
                                .upsert({
                                    user_id: currentSession.user.id,
                                    domain: 'NUCLEAR_LOCKDOWN',
                                    source: msg.target,
                                    expires_at: expiresAt
                                });
                        }
                        sendResponse({ ok: true });
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

                    case "UPDATE_ENGINE_SETTINGS":
                        await updateEngineSettings(msg.settings);
                        if (currentSession?.user) {
                            await syncSettingsToSupabase();
                        }
                        sendResponse({ ok: true });
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
                        const duration = msg.duration || 25;
                        if (domain) {
                            await blockDomainManual(domain);
                            await startTimer(domain, duration);
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
                        await startChallengeById(msg.challengeId, msg.challenge);
                        sendResponse({ ok: true, progression: await loadProgressionState() });
                        break;

                    case "SET_CHALLENGE_FOCUS_SCORE":
                        setChallengeFocusScore(Number(msg.focusScore) || 0);
                        sendResponse({ ok: true });
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

                    case "SYNC_NOTION_TASKS":
                    case "UPDATE_NOTION_TASK":
                        (async () => {
                            try {
                                if (currentSession?.user) {
                                    const engineState = getEngineState();
                                    const body = {
                                        token: engineState.notionToken,
                                        databaseId: engineState.notionDatabaseId,
                                        action: msg.type === "SYNC_NOTION_TASKS" ? 'FETCH' : 'UPDATE_STATUS',
                                        taskId: msg.taskId,
                                        done: msg.done
                                    };

                                    const { data, error } = await supabase.functions.invoke('notion-sync-tasks', { body });
                                    if (error) throw error;
                                    sendResponse({ ok: true, tasks: data?.tasks });
                                } else {
                                    sendResponse({ ok: false, error: "No session" });
                                }
                            } catch (e) {
                                sendResponse({ ok: false, error: e.message });
                            }
                        })();
                        return true; // Keep channel open for async response
                }
            } catch (err) {
                console.error("[MessageRouter] Error:", err);
                sendResponse({ ok: false, error: err.message });
            }
        })();
        return true;
    });

    // Startup sync
    if (currentSession?.user) {
        syncNuclearWithSupabase();
    }
}
