// =========================================================
// service-worker.js — Master Boot File
// Loads engine + router + applies rules on startup
// =========================================================

import { initMessageRouter } from "./messagerouter.js";
import { initBlockEngine, incrementBlockedCount } from "./blockengine.js";
import { initAnalytics } from "./analytics.js";
import { initPomodoro } from "./pomodoro.js";
import { initFutureSelfService } from "./futureSelfService.js";
import { initFocuzPassVault } from "./focuzPassBridge";
import { registerSlip } from "../lib/forest";

const blockedPagePath = "view=blocked";

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status !== "complete" || !tab.url) return;
    if (!tab.url.includes(blockedPagePath)) return;
    void incrementBlockedCount();
    // Forest: a blocked-site visit (incl. Shorts/Reels/TikTok redirects) slows growth
    const isInApp = tab.url.includes("source=in_app");
    void registerSlip(isInApp ? "shorts" : "blocklist");
});

// ---------------------------------------------------------
// On install → apply rules so extension works IMMEDIATELY
// ---------------------------------------------------------

chrome.runtime.onInstalled.addListener(async () => {
    console.log("[FocuzNow] Installed → initializing engine...");
    await initBlockEngine();
});

// ---------------------------------------------------------
// On browser startup → reapply rules
// ---------------------------------------------------------

chrome.runtime.onStartup.addListener(async () => {
    console.log("[FocuzNow] Browser started → initializing engine...");
    await initBlockEngine();
});

// ---------------------------------------------------------
// Initialize background systems
// ---------------------------------------------------------

initMessageRouter();
initFocuzPassVault();
initBlockEngine();
initAnalytics();
void initPomodoro();
void initFutureSelfService();

// When default_popup is set, Chrome shows the popup and does not fire onClicked.
// Keep a fallback only if the popup is cleared at runtime.
chrome.action.onClicked.addListener(() => {
    chrome.runtime.openOptionsPage().catch(() => {
        chrome.tabs.create({ url: chrome.runtime.getURL('src/options/index.html') });
    });
});

chrome.commands.onCommand.addListener(async (command) => {
    if (command !== "toggle-command-palette") return;

    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab?.id || !tab.url) return;

    const url = tab.url;
    if (url.startsWith("chrome://") || url.startsWith("edge://") || url.startsWith("about:")) return;

    if (url.startsWith("chrome-extension://") && url.includes(chrome.runtime.id)) {
        chrome.runtime.openOptionsPage();
        return;
    }

    if (/focuznow\.com/i.test(url)) return;

    try {
        await chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_COMMAND_PALETTE" });
    } catch {
        try {
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => window.dispatchEvent(new CustomEvent("focuznow-toggle-palette")),
            });
        } catch (e) {
            console.warn("[FocuzNow] Could not toggle palette on tab:", e);
        }
    }
});

console.log("FocuzNow Service Worker Loaded.");
