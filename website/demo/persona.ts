/**
 * Demo persona and state on top of the test harness seed (@focuz/mockChrome): a neutral
 * name instead of the developer account, blocking switched on, no "what's new" card, and
 * optionally a Pomodoro session already running.
 */
import { WHATS_NEW, WHATS_NEW_DISMISSED_KEY } from '@focuz/lib/whatsNew';
import { CALENDAR_EVENTS_KEY, type CalendarEvent } from '@focuz/lib/schedulingTypes';

const PERSONA = { name: 'Maya Chen', first: 'Maya', email: 'maya@focuznow.com' };
const SEED_HANDLE = /compooteriolyt/gi;

/** Beam Z tile for chrome.runtime.getURL('…icons/…') (the extension's PNGs aren't on the website). */
const MARK =
    'data:image/svg+xml,' +
    encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#0A0B0D"/><path d="M20 17.8H47.2V22.2L22.8 41.8H47.2L44 46.2H16.8V41.8L29.2 22.2H16.8Z" fill="#F4F2EE"/></svg>',
    );

/** A believable week around today (the seed only has a handful of events). */
function demoWeek(): CalendarEvent[] {
    const plan: [number, number, number, number, string, string][] = [
        // [day offset, hour, minute, minutes, title, colour]
        [-3, 9, 0, 120, 'Deep work', '#7aa2f7'],
        [-2, 10, 0, 90, 'Deep work', '#7aa2f7'],
        [-2, 14, 0, 45, 'Design review', '#52d58e'],
        [-1, 9, 30, 120, 'Deep work', '#7aa2f7'],
        [0, 9, 0, 120, 'Deep work: launch post', '#7aa2f7'],
        [0, 11, 30, 30, 'Standup', '#bb9af7'],
        [0, 13, 30, 45, 'Design review', '#52d58e'],
        [0, 15, 0, 30, 'Intro call with Priya', '#e0af68'],
        [1, 9, 30, 90, 'Deep work', '#7aa2f7'],
        [1, 12, 0, 60, 'Lunch with Sam', '#52d58e'],
        [1, 14, 0, 90, 'Write onboarding copy', '#7aa2f7'],
        [2, 10, 0, 120, 'Deep work', '#7aa2f7'],
        [2, 13, 0, 30, '1:1 with Jordan', '#bb9af7'],
        [2, 15, 30, 30, 'Intro call', '#e0af68'],
        [3, 9, 0, 120, 'Deep work', '#7aa2f7'],
        [3, 12, 30, 60, 'Gym', '#52d58e'],
        [3, 15, 0, 45, 'Weekly review', '#bb9af7'],
        [4, 10, 0, 60, 'Planning', '#bb9af7'],
        [4, 11, 30, 120, 'Deep work', '#7aa2f7'],
        [5, 10, 0, 60, 'Long run', '#52d58e'],
    ];
    return plan.map(([offset, startHour, startMin, durationMin, title, color], i) => {
        const day = new Date();
        day.setDate(day.getDate() + offset);
        return {
            id: `demo-ev-${i}`,
            title,
            date: day.toDateString(),
            allDay: false,
            startHour,
            startMin,
            durationMin,
            color,
            ...(title.startsWith('Intro call') ? { bookingLinkId: 'sl-1' } : {}),
        };
    });
}

type MockSupabase = {
    auth: Record<string, (...args: unknown[]) => Promise<unknown>>;
};

/** Swap the seed's developer handle for the persona in anything the mock returns. */
function personalise<T>(value: T): T {
    return JSON.parse(JSON.stringify(value).replace(SEED_HANDLE, (m) => (m[0] === 'C' ? PERSONA.first : PERSONA.first.toLowerCase())));
}

export async function applyPersona() {
    const runtime = chrome.runtime as unknown as {
        getURL: (path: string) => string;
        sendMessage: (msg: unknown, cb?: (r: unknown) => void) => Promise<unknown>;
    };
    runtime.getURL = (path: string) => (path.includes('icons/') ? MARK : path.endsWith('.html') ? 'about:blank' : path);
    const send = runtime.sendMessage.bind(runtime);
    runtime.sendMessage = (msg, cb) => {
        const out = send(msg).then(personalise);
        if (cb) void out.then(cb);
        return out;
    };

    const sb = (window as unknown as { __FOCUZ_SITE_SUPABASE__?: MockSupabase }).__FOCUZ_SITE_SUPABASE__;
    const { data } = ((await sb?.auth.getSession()) ?? { data: null }) as { data: { session: Record<string, any> } | null };
    const base = data?.session;
    if (sb && base) {
        const session = {
            ...base,
            user: { ...base.user, email: PERSONA.email, user_metadata: { full_name: PERSONA.name } },
        };
        sb.auth.getSession = async () => ({ data: { session }, error: null });
        sb.auth.setSession = async () => ({ data: { session }, error: null });
        sb.auth.refreshSession = async () => ({ data: { session }, error: null });
        sb.auth.getUser = async () => ({ data: { user: session.user }, error: null });
        await chrome.storage.local.set({
            focuznow_session_backup: { session },
            focuznow_session_cache_v1: { session },
        });
    }

    const stored = await chrome.storage.local.get(['focuznow_scheduling_links']);
    await chrome.storage.local.set({
        ...personalise(stored),
        [CALENDAR_EVENTS_KEY]: demoWeek(),
        [WHATS_NEW_DISMISSED_KEY]: WHATS_NEW.map((entry) => entry.id),
    });
    await chrome.runtime.sendMessage({
        type: 'UPDATE_ENGINE_SETTINGS',
        settings: { profileName: PERSONA.first, focusMode: true },
    });
}

/** 24½ minutes left in a 25-minute focus block. */
export async function startPomodoro() {
    const segmentTotalSec = 25 * 60;
    await chrome.storage.local.set({
        pomodoroRuntimeV1: {
            running: true,
            paused: false,
            endAt: Date.now() + (segmentTotalSec - 26) * 1000,
            timeLeftSec: segmentTotalSec - 26,
            isBreak: false,
            segmentTotalSec,
            focusMin: 25,
            breakMin: 5,
            segmentId: 'demo-segment',
        },
    });
}
