// =========================================================
// scheduler.js — Runs every minute
// Handles:
//   • Daily Schedules  (9:00 → block ON, 17:00 → block OFF)
//   • Timers           (Block now for X minutes)
// NO FOCUS MODE ANYWHERE.
// Uses blockengine functions to add/remove "schedule"/"timer" sources.
// =========================================================

import {
    addDomainSchedule,
    removeDomainSchedule,
    addDomainTimer,
    removeDomainTimer
} from "./blockengine.js";

// =========================================================
// INTERNAL STATE
// =========================================================

/*
Structure:
state.schedules = {
   "discord.com": {
       daily: [
           { startHour, startMinute, endHour, endMinute }
       ],
       timers: [
           { id, endTimestamp }
       ]
   }
}
*/
export const state = {
    schedules: {}
};

// Persist schedules in chrome.storage for extension restarts
chrome.storage.local.get(["schedules"], (res) => {
    if (res.schedules) {
        state.schedules = res.schedules;
    }
});

// Save helper
function saveSchedules() {
    chrome.storage.local.set({ schedules: state.schedules });
}

// =========================================================
// ADD / REMOVE DAILY SCHEDULE WINDOWS
// =========================================================

export function addDailySchedule(domain, startHour, startMinute, endHour, endMinute, days, specificDate) {
    if (!state.schedules[domain]) {
        state.schedules[domain] = { daily: [], timers: [] };
    }

    // Generate a unique ID so we can remove it later from the Calendar View
    const id = Date.now().toString(36) + Math.random().toString(36).substr(2);

    state.schedules[domain].daily.push({
        id,
        startHour,
        startMinute,
        endHour,
        endMinute,
        days: days || [],
        specificDate: specificDate || null
    });

    saveSchedules();
}

export function removeDailySchedule(domain, scheduleId) {
    if (!state.schedules[domain]) return;

    const index = state.schedules[domain].daily.findIndex(s => s.id === scheduleId);
    if (index !== -1) {
        state.schedules[domain].daily.splice(index, 1);
        saveSchedules();
    }
}

// =========================================================
// TIMERS
// =========================================================

export function addTimer(domain, minutes) {
    if (!state.schedules[domain]) {
        state.schedules[domain] = { daily: [], timers: [] };
    }

    const endTimestamp = Date.now() + minutes * 60 * 1000;
    const id = Math.random().toString(36).slice(2, 10);

    state.schedules[domain].timers.push({
        id,
        endTimestamp
    });

    // Immediately block via timer source
    addDomainTimer(domain);

    saveSchedules();
}

export function cancelTimer(domain, timerId) {
    if (!state.schedules[domain]) return;

    const timers = state.schedules[domain].timers;
    const index = timers.findIndex(t => t.id === timerId);

    if (index !== -1) {
        timers.splice(index, 1);
        saveSchedules();
    }
}

// =========================================================
// CHECK DAILY SCHEDULES
// =========================================================

function checkDailyWindow(domain, window) {
    const now = new Date();

    // First, verify Date context
    if (window.specificDate) {
        const todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
        if (window.specificDate !== todayStr) return false;
    } else {
        if (window.days && window.days.length > 0 && !window.days.includes(now.getDay())) return false;
    }

    const current = now.getHours() * 60 + now.getMinutes();
    const start = window.startHour * 60 + window.startMinute;
    const end = window.endHour * 60 + window.endMinute;

    // If schedule crosses midnight:
    if (end < start) {
        return current >= start || current <= end;
    }

    return current >= start && current <= end;
}

function runDailySchedules() {
    for (const domain in state.schedules) {
        const entry = state.schedules[domain];
        const windows = entry.daily;

        let shouldBlock = false;

        for (const win of windows) {
            if (checkDailyWindow(domain, win)) {
                shouldBlock = true;
                break;
            }
        }

        if (shouldBlock) {
            addDomainSchedule(domain);
        } else {
            removeDomainSchedule(domain);
        }
    }
}

// =========================================================
// CHECK TIMERS
// =========================================================

function runTimers() {
    const now = Date.now();

    for (const domain in state.schedules) {
        const entry = state.schedules[domain];
        const timers = entry.timers;

        for (let i = timers.length - 1; i >= 0; i--) {
            const t = timers[i];

            if (now >= t.endTimestamp) {
                // Time's up → un-block timer source
                removeDomainTimer(domain);

                // delete the timer
                timers.splice(i, 1);
                saveSchedules();
            }
        }
    }
}

// =========================================================
// START SCHEDULER LOOP
// =========================================================

export function initScheduler() {
    console.log("Scheduler initialized (no focus mode).");

    // Every minute
    setInterval(() => {
        runDailySchedules();
        runTimers();
    }, 60 * 1000);

    // Run once on startup
    runDailySchedules();
    runTimers();
}
