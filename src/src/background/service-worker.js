// =========================================================
// service-worker.js — Master Boot File
// Loads engine + router + applies rules on startup
// =========================================================

// focuzPassBridge is intentionally the FIRST import: it registers the dedicated
// FocuzPass onMessage listener as a module-eval side effect (§5.1), before the
// rest of the background graph even evaluates — FOCUZPASS_STATUS /
// FOCUZPASS_PAGE_CONTEXT answer immediately on a cold service-worker start.
// The bundled MV3 service worker is a classic script (no dynamic import()), so
// ordering is achieved via module evaluation order instead.
import { initFocuzPassVault } from "./focuzPassBridge";
import { initMessageRouter } from "./messagerouter.js";
import { initBlockEngine, incrementBlockedCount } from "./blockengine.js";
import { initAnalytics } from "./analytics.js";
import { initPomodoro } from "./pomodoro.js";
import { initFutureSelfService } from "./futureSelfService.js";
import { registerSlip } from "../lib/forest";
import { setFocuzPassCloudStore, setFocuzPassRealtime } from "./focuzPassBridge";
import { supabase } from "../lib/supabase";
import { supabaseCloudStore } from "../lib/focuzPass/cloud/store";

// FocuzPass Cloud goes through the same signed-in Supabase client as the rest of the extension.
setFocuzPassCloudStore(() => supabaseCloudStore(supabase));
setFocuzPassRealtime(() => supabase);

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
    void reconnectDashboardTabs();
    await initBlockEngine();
});

// After an install/update/reload, open dashboard tabs still run the previous,
// now-orphaned content script, so the website can't reach the extension until
// it's refreshed. Inject the fresh site script so they reconnect on their own.
async function reconnectDashboardTabs() {
    try {
        const scripts = chrome.runtime.getManifest().content_scripts || [];
        const site = scripts.find((entry) => (entry.matches || []).some((match) => match.includes("focuznow.com")));
        if (!site?.js?.length || !site.matches?.length) return;
        const tabs = await chrome.tabs.query({ url: site.matches });
        for (const tab of tabs) {
            if (tab.id == null || tab.discarded) continue;
            chrome.scripting.executeScript({ target: { tabId: tab.id }, files: site.js }).catch(() => undefined);
        }
    } catch (e) {
        console.warn("[FocuzNow] Could not reconnect dashboard tabs:", e);
    }
}

// ---------------------------------------------------------
// On browser startup → reapply rules
// ---------------------------------------------------------

chrome.runtime.onStartup.addListener(async () => {
    await initBlockEngine();
});

// ---------------------------------------------------------
// Initialize background systems — FocuzPass first (§5.1)
// ---------------------------------------------------------

initFocuzPassVault();
initMessageRouter();
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

