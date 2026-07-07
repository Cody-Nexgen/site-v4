// ===============================================
// analytics.js
// Tracks screen time and imports history (MV3 Safe)
// ===============================================

let activeTabId = null;
let activeTabStartTime = Date.now();
let audibleTabs = {}; // tabId -> timestamp
let screenTimeData = {}; // domain -> ms
let todayStr = new Date().toDateString();

// Load today's data from storage on startup
chrome.storage.local.get([`screenTime_${todayStr}`], (result) => {
    if (result[`screenTime_${todayStr}`]) {
        screenTimeData = result[`screenTime_${todayStr}`];
    }
});

function isValidUrl(url) {
    return url && !url.startsWith('chrome://') && !url.startsWith('chrome-extension://') && !url.startsWith('about:');
}

async function addDuration(domain, duration) {
    if (duration <= 0) return;
    const nowStr = new Date().toDateString();
    const MAX_DAY_MS = 24 * 60 * 60 * 1000;

    if (nowStr !== todayStr) {
        todayStr = nowStr;
        screenTimeData = {};
    }

    domain = domain.replace(/^www\./i, '').toLowerCase();

    const dayTotal = Object.values(screenTimeData).reduce((a, b) => a + b, 0);
    if (dayTotal >= MAX_DAY_MS) return;

    duration = Math.min(duration, MAX_DAY_MS - dayTotal);
    if (duration <= 0) return;

    screenTimeData[domain] = (screenTimeData[domain] || 0) + duration;
    await chrome.storage.local.set({ [`screenTime_${todayStr}`]: screenTimeData });
}

async function flushActivity() {
    const now = Date.now();

    // 1. Process active tab
    if (activeTabId) {
        try {
            const tab = await chrome.tabs.get(activeTabId);
            if (isValidUrl(tab?.url)) {
                const domain = new URL(tab.url).hostname;
                const duration = now - activeTabStartTime;
                await addDuration(domain, duration);
            }
        } catch (e) {
            // Tab might have been closed
        }
    }
    activeTabStartTime = now;
    await chrome.storage.session.set({ activeTabStartTime, activeTabId });

    // 2. Process audible tabs
    chrome.storage.local.get(['blockEngineState'], async (res) => {
        const engineState = res.blockEngineState || {};
        if (engineState.trackBackgroundAudio) {
            for (const tabIdStr in audibleTabs) {
                const tabId = parseInt(tabIdStr);
                if (tabId === activeTabId) continue; // Already processed as active tab

                try {
                    const t = await chrome.tabs.get(tabId);
                    if (t?.audible && isValidUrl(t?.url)) {
                        const domain = new URL(t.url).hostname;
                        const duration = now - audibleTabs[tabId];
                        await addDuration(domain, duration);
                        audibleTabs[tabId] = now; // reset start time
                    } else {
                        delete audibleTabs[tabId];
                    }
                } catch (e) {
                    delete audibleTabs[tabId];
                }
            }
            await chrome.storage.session.set({ audibleTabs });
        }
    });
}

export async function initAnalytics() {
    // 0. Recover State on SW Wake-up
    const sessionVars = await chrome.storage.session.get(['activeTabId', 'activeTabStartTime', 'audibleTabs']);

    if (sessionVars.activeTabId && sessionVars.activeTabStartTime) {
        activeTabId = sessionVars.activeTabId;
        activeTabStartTime = sessionVars.activeTabStartTime;
    } else {
        chrome.tabs.query({ active: true, lastFocusedWindow: true }, async (tabs) => {
            if (tabs[0]) {
                activeTabId = tabs[0].id;
                activeTabStartTime = Date.now();
                await chrome.storage.session.set({ activeTabId, activeTabStartTime });
            }
        });
    }

    if (sessionVars.audibleTabs) {
        audibleTabs = sessionVars.audibleTabs;
    } else {
        chrome.tabs.query({ audible: true }, async (tabs) => {
            const now = Date.now();
            for (const tab of tabs) {
                if (!audibleTabs[tab.id]) audibleTabs[tab.id] = now;
            }
            await chrome.storage.session.set({ audibleTabs });
        });
    }

    // 1. Tab Listeners
    chrome.tabs.onActivated.addListener(async (activeInfo) => {
        await flushActivity();
        activeTabId = activeInfo.tabId;
        await chrome.storage.session.set({ activeTabId, activeTabStartTime });
    });

    chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
        if (tabId === activeTabId && changeInfo.status === 'complete') {
            await flushActivity();
        }

        if (changeInfo.hasOwnProperty('audible')) {
            if (changeInfo.audible) {
                if (!audibleTabs[tabId]) {
                    audibleTabs[tabId] = Date.now();
                    await chrome.storage.session.set({ audibleTabs });
                }
            } else {
                if (audibleTabs[tabId]) {
                    const now = Date.now();
                    try {
                        const t = await chrome.tabs.get(tabId);
                        if (isValidUrl(t?.url) && tabId !== activeTabId) {
                            const domain = new URL(t.url).hostname;
                            const duration = now - audibleTabs[tabId];
                            await addDuration(domain, duration);
                        }
                    } catch (e) { }
                    delete audibleTabs[tabId];
                    await chrome.storage.session.set({ audibleTabs });
                }
            }
        }
    });

    chrome.tabs.onRemoved.addListener(async (tabId) => {
        if (tabId === activeTabId) {
            await flushActivity();
            activeTabId = null;
            await chrome.storage.session.set({ activeTabId });
        }
        if (audibleTabs[tabId]) {
            delete audibleTabs[tabId];
            await chrome.storage.session.set({ audibleTabs });
        }
    });

    chrome.windows.onFocusChanged.addListener(async (windowId) => {
        await flushActivity();
        if (windowId === chrome.windows.WINDOW_ID_NONE) {
            activeTabId = null;
            await chrome.storage.session.set({ activeTabId });
        } else {
            const [tab] = await chrome.tabs.query({ active: true, windowId });
            if (tab) {
                activeTabId = tab.id;
                activeTabStartTime = Date.now();
                await chrome.storage.session.set({ activeTabId, activeTabStartTime });
            }
        }
    });

    // 2. Message Listeners
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'IMPORT_HISTORY') {
            importBrowsingHistory()
                .then(stats => sendResponse({ ok: true, stats }))
                .catch(err => sendResponse({ ok: false, error: err.message }));
            return true;
        }
        // Expose current session duration for dragging timer overlay sync
        if (message.type === 'GET_CURRENT_URL_TIME') {
            (async () => {
                await flushActivity();
                const domain = message.domain;
                sendResponse({ timeSpent: screenTimeData[domain] || 0 });
            })();
            return true;
        }
    });

    // 3. Heartbeat for reliable MV3 updates
    chrome.alarms.create('analytics_sync', { periodInMinutes: 1 });
    chrome.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === 'analytics_sync') {
            flushActivity();
        }
    });
}

async function importBrowsingHistory() {
    console.log("[Analytics] Starting history ingestion...");
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

    // We get history items for the last 7 days
    const items = await chrome.history.search({
        text: '',
        startTime: sevenDaysAgo,
        maxResults: 10000
    });

    const dailyStats = {}; // dateStr -> { domain -> duration }
    let allVisits = [];

    // Fetch absolute individual visits for each URL discovered
    for (const item of items) {
        if (!item.url || item.url.startsWith('chrome://')) continue;

        try {
            const domain = new URL(item.url).hostname;
            const visits = await chrome.history.getVisits({ url: item.url });

            // Filter only visits that occurred within our 7-day window
            const recentVisits = visits.filter(v => v.visitTime && v.visitTime >= sevenDaysAgo);

            for (const v of recentVisits) {
                allVisits.push({ visitTime: v.visitTime, domain });
            }
        } catch (e) { }
    }

    // Sort all individual visits chronologically to figure out gaps
    allVisits.sort((a, b) => a.visitTime - b.visitTime);

    // Algorithm: Heuristic - Duration = time until NEXT action, capped at 10 minutes to prevent idle skewing
    for (let i = 0; i < allVisits.length - 1; i++) {
        const current = allVisits[i];
        const next = allVisits[i + 1];

        const dateStr = new Date(current.visitTime).toDateString();
        if (!dailyStats[dateStr]) dailyStats[dateStr] = {};

        const duration = Math.min(next.visitTime - current.visitTime, 10 * 60 * 1000);

        dailyStats[dateStr][current.domain] = (dailyStats[dateStr][current.domain] || 0) + duration;
    }

    // Save all to storage — use MAX of existing vs computed to prevent stacking on re-import
    for (const date in dailyStats) {
        const key = `screenTime_${date}`;
        var existingResult = await chrome.storage.local.get([key]);
        const existing = existingResult[key] || {};

        for (const domain in dailyStats[date]) {
            // Use the LARGER of the two values, not additive, to prevent duplication
            existing[domain] = Math.max(existing[domain] || 0, dailyStats[date][domain]);
        }

        await chrome.storage.local.set({ [key]: existing });
        if (date === todayStr) {
            screenTimeData = existing; // Resync memory cache to prevent obliteration on next flush
        }
    }

    console.log("[Analytics] History ingestion complete.");
    return dailyStats;
}
