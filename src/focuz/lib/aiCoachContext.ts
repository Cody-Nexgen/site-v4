import { SCHEDULING_LINKS_KEY, CALENDAR_EVENTS_KEY, type CalendarEvent } from './schedulingTypes';
import { getDailyGoal } from './dailyGoal';

export const AI_COACH_ANALYTICS_CONSENT_KEY = 'aiCoachAnalyticsApproved';

export function chatAnalyticsSessionKey(sessionId: string | null): string {
    return sessionId ? `aiCoachAnalytics:${sessionId}` : '';
}

export function getChatAnalyticsApproved(sessionId: string | null): boolean {
    const key = chatAnalyticsSessionKey(sessionId);
    if (!key) return false;
    try {
        return sessionStorage.getItem(key) === '1';
    } catch {
        return false;
    }
}

export function setChatAnalyticsApproved(sessionId: string | null, approved: boolean): void {
    const key = chatAnalyticsSessionKey(sessionId);
    if (!key) return;
    try {
        if (approved) sessionStorage.setItem(key, '1');
        else sessionStorage.removeItem(key);
    } catch {
        /* ignore */
    }
}

export async function getAnalyticsConsent(): Promise<boolean> {
    const r = await chrome.storage.local.get(AI_COACH_ANALYTICS_CONSENT_KEY);
    return r[AI_COACH_ANALYTICS_CONSENT_KEY] === true;
}

export async function setAnalyticsConsent(approved: boolean): Promise<void> {
    await chrome.storage.local.set({ [AI_COACH_ANALYTICS_CONSENT_KEY]: approved });
}

async function getEngineState(): Promise<Record<string, unknown>> {
    const r = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
    return (r?.ok && r.state) ? (r.state as Record<string, unknown>) : {};
}

function todayStr(): string {
    return new Date().toDateString();
}

/** Screen time for last N days (requires analytics consent for detail). */
export async function gatherAnalyticsSummary(days = 7): Promise<{
    days: { date: string; total_minutes: number; top_sites: { host: string; minutes: number }[] }[];
}> {
    const out: { date: string; total_minutes: number; top_sites: { host: string; minutes: number }[] }[] = [];
    const today = new Date();
    const keys: string[] = [];
    const dates: string[] = [];

    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const ds = d.toDateString();
        dates.push(ds);
        keys.push(`screenTime_${ds}`);
    }

    const stored = await chrome.storage.local.get(keys);
    for (const ds of dates) {
        const sites = (stored[`screenTime_${ds}`] as Record<string, number>) || {};
        const totalMs = Object.values(sites).reduce((a, b) => a + b, 0);
        const top = Object.entries(sites)
            .map(([host, ms]) => ({ host, minutes: Math.round(ms / 60000) }))
            .sort((a, b) => b.minutes - a.minutes)
            .slice(0, 8);
        out.push({ date: ds, total_minutes: Math.round(totalMs / 60000), top_sites: top });
    }
    return { days: out };
}

export async function buildCoachContext(analyticsApproved: boolean): Promise<Record<string, unknown>> {
    const state = await getEngineState();
    const blocklist = (state.blocklist as Record<string, unknown>) || {};
    const habits = (state.habits as { id: number; name: string; streak: number; checkins: string[] }[]) || [];
    const planner = (state.dailyPlanner as { id: number; time: string; task: string; done: boolean }[]) || [];
    const todos = (state.todos as { id: number; text: string; done: boolean }[]) || [];
    const today = todayStr();

    const ctx: Record<string, unknown> = {
        daily_goal: getDailyGoal(),
        daily_planner: planner.map((p) => ({
            time: p.time,
            task: p.task,
            done: p.done,
        })),
        todos: todos.filter((t) => !t.done).slice(0, 12).map((t) => t.text),
        theme: state.theme,
        nuclear_active: !!(state.nuclearState as { active?: boolean })?.active,
        focus_mode: state.focusMode,
        blocklist_count: Object.keys(blocklist).length,
        blocklist_sample: Object.keys(blocklist).slice(0, 20),
        habits: habits.map((h) => ({
            id: h.id,
            name: h.name,
            streak: h.streak,
            checked_today: h.checkins?.includes(today),
        })),
        pomodoro: state.pomodoroSettings,
        in_app_block: state.inAppBlock,
        draggable_timer: state.draggableTimer,
        track_background_audio: state.trackBackgroundAudio,
        require_challenge: state.requireChallenge,
        redirect_message: state.redirectMessage,
    };

    const linksStored = await chrome.storage.local.get([SCHEDULING_LINKS_KEY, CALENDAR_EVENTS_KEY]);
    const links = (linksStored[SCHEDULING_LINKS_KEY] as { title: string; slug: string; durationMin?: number }[]) || [];
    const events = (linksStored[CALENDAR_EVENTS_KEY] as CalendarEvent[]) || [];
    ctx.scheduling_links_count = links.length;
    ctx.calendar_events_next_7 = events
        .filter((e) => {
            const d = new Date(e.date);
            const diff = (d.getTime() - Date.now()) / 86400000;
            return diff >= -1 && diff <= 7;
        })
        .slice(0, 15)
        .map((e) => ({
            title: e.title,
            date: e.date,
            start: `${e.startHour}:${String(e.startMin).padStart(2, '0')}`,
            duration_min: e.durationMin,
        }));

    ctx.analytics_approved = analyticsApproved;
    if (analyticsApproved) {
        ctx.analytics = await gatherAnalyticsSummary(7);
    } else {
        ctx.analytics =
            'Not approved yet. Emit read_analytics when they ask for screen-time insights; the UI will show an in-chat Yes/No card.';
    }

    return ctx;
}
