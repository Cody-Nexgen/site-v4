import type { CoachAction, CoachActionType } from './aiCoachTypes';
import { getAnalyticsConsent, setAnalyticsConsent } from './aiCoachContext';
import { sendEngineMessage } from './engineMessage';
import { SCHEDULING_LINKS_KEY, CALENDAR_EVENTS_KEY, type CalendarEvent } from './schedulingTypes';
import { useAuthStore } from './store';
import { canUseTheme, setCustomThemeColors, setEngineTheme, type ThemeId } from './themes';

export type { CoachAction, CoachActionType } from './aiCoachTypes';

export type CoachActionHandlers = {
    fetchEngineState?: () => void;
};

function domainFromEntry(entry: unknown): string {
    if (typeof entry === 'string') return entry;
    if (entry && typeof entry === 'object') {
        const o = entry as Record<string, unknown>;
        if (typeof o.name === 'string') return o.name;
        if (typeof o.host === 'string') return o.host;
        if (typeof o.domain === 'string') return o.domain;
    }
    return '';
}

function coerceCoachAction(raw: unknown): CoachAction | null {
    if (!raw || typeof raw !== 'object') return null;
    const row = raw as Record<string, unknown>;
    const action_type = (row.action_type ?? row.type) as CoachActionType | undefined;
    if (!action_type) return null;

    const nested =
        row.data && typeof row.data === 'object'
            ? { ...(row.data as Record<string, unknown>) }
            : {};
    const data: CoachAction['data'] = { ...nested };

    if (action_type === 'block' || action_type === 'unblock') {
        const rawDomains = nested.domains ?? row.domains ?? [];
        const list = Array.isArray(rawDomains) ? rawDomains : [rawDomains];
        data.domains = list.map(domainFromEntry).filter(Boolean);
    }
    if (action_type === 'timer') {
        data.domain = (nested.domain ?? row.domain) as string | undefined;
        data.minutes = Number(nested.minutes ?? row.minutes) || undefined;
    }
    if (action_type === 'change_setting') {
        const setting_name = (nested.setting_name ?? nested.name ?? row.name) as string | undefined;
        if (setting_name) data.setting_name = setting_name;
        if (nested.new_value !== undefined) data.new_value = nested.new_value as boolean | string | number;
    }
    if (action_type === 'engine_settings' && nested.settings) {
        data.settings = nested.settings as Record<string, unknown>;
    }
    if (action_type === 'theme') {
        data.theme = (nested.theme ?? row.theme) as string | undefined;
        if (nested.custom_theme && typeof nested.custom_theme === 'object') {
            data.custom_theme = nested.custom_theme as {
                primary?: string;
                accent?: string;
                highlight?: string;
            };
        }
    }
    if (action_type === 'nuclear_start') {
        data.target = (nested.target ?? row.target ?? 'blocked') as 'blocked' | 'all';
        data.minutes = Number(nested.minutes ?? row.minutes ?? 60);
    }
    if (action_type === 'in_app_block') {
        data.platform = nested.platform as CoachAction['data']['platform'];
        data.feature = nested.feature as string | undefined;
        data.enabled = nested.enabled as boolean | undefined;
    }
    if (action_type === 'in_app_filter_add' || action_type === 'in_app_filter_remove') {
        data.handle = (nested.handle ?? row.handle) as string | undefined;
    }
    if (action_type === 'habit_add' || action_type === 'habit_checkin') {
        data.name = (nested.name ?? row.name) as string | undefined;
        data.habit_id = Number(nested.habit_id ?? row.habit_id) || undefined;
    }
    if (action_type === 'pomodoro_configure' || action_type === 'pomodoro_start') {
        data.focus_min = Number(nested.focus_min ?? row.focus_min) || undefined;
        data.break_min = Number(nested.break_min ?? row.break_min) || undefined;
    }
    if (action_type === 'daily_goal_set') {
        data.goal = (nested.goal ?? row.goal) as string | undefined;
    }
    if (action_type === 'planner_set') {
        data.planner_items = (nested.planner_items ?? row.planner_items) as CoachAction['data']['planner_items'];
    }
    if (action_type === 'calendar_add_events') {
        data.events = (nested.events ?? row.events) as CoachAction['data']['events'];
    }

    return { action_type, data };
}

export function normalizeActions(action_data: unknown): CoachAction[] {
    if (!action_data) return [];

    let parsed: unknown = action_data;
    if (typeof action_data === 'string') {
        try {
            parsed = JSON.parse(action_data);
        } catch {
            return [];
        }
    }

    const list = Array.isArray(parsed) ? parsed : [parsed];
    return list
        .map((item) => coerceCoachAction(item))
        .filter((a): a is CoachAction => a !== null);
}

async function getState(): Promise<Record<string, unknown>> {
    const r = await sendEngineMessage({ type: 'GET_STATE' });
    return r.ok && r.state ? (r.state as Record<string, unknown>) : {};
}

async function requireEngineOk(
    message: Record<string, unknown>,
    label: string,
): Promise<void> {
    const r = await sendEngineMessage(message);
    if (r.ok === false && r.error) {
        throw new Error(`${label}: ${r.error}`);
    }
    if (r.ok === false) {
        throw new Error(`${label}: extension did not confirm the change`);
    }
}

/** Run one coach action (caller handles user confirmation). */
export async function executeSingleCoachAction(
    action: CoachAction,
    handlers?: CoachActionHandlers,
): Promise<CoachAction> {
    if (!action?.action_type) throw new Error('Invalid action');

    switch (action.action_type) {
        case 'timer':
            await requireEngineOk(
                {
                    type: 'TIMER_START',
                    domain: action.data.domain || '*',
                    durationMinutes: action.data.minutes ?? 25,
                },
                'Timer',
            );
            action.data.message = `Timer set · ${action.data.minutes ?? 25} min`;
            break;

        case 'block':
            for (const domain of action.data.domains || []) {
                const host = domain.replace(/^https?:\/\//, '').split('/')[0];
                if (!host) continue;
                await requireEngineOk(
                    { type: 'ADD_BLOCK', domain: host, source: 'ai' },
                    `Block ${host}`,
                );
            }
            action.data.message = `Blocked ${(action.data.domains || []).length} site(s)`;
            break;

        case 'unblock':
            for (const domain of action.data.domains || []) {
                const host = domain.replace(/^https?:\/\//, '').split('/')[0];
                if (!host) continue;
                await requireEngineOk({ type: 'REMOVE_BLOCK', domain: host }, `Unblock ${host}`);
            }
            action.data.message = `Unblocked ${(action.data.domains || []).length} site(s)`;
            break;

        case 'blocks_list': {
            const response = await sendEngineMessage({ type: 'GET_STATE' });
            if (response.ok && response.state?.blocklist) {
                action.data.blocks = Object.keys(
                    response.state.blocklist as Record<string, unknown>,
                );
            }
            action.data.message = `${action.data.blocks?.length ?? 0} blocked site(s)`;
            break;
        }

        case 'change_setting':
            if (action.data.setting_name) {
                await requireEngineOk(
                    {
                        type: 'UPDATE_ENGINE_SETTINGS',
                        settings: { [action.data.setting_name]: action.data.new_value },
                    },
                    'Setting',
                );
                action.data.message = `${action.data.setting_name} updated`;
                handlers?.fetchEngineState?.();
            }
            break;

        case 'engine_settings':
            if (action.data.settings) {
                await requireEngineOk(
                    { type: 'UPDATE_ENGINE_SETTINGS', settings: action.data.settings },
                    'Settings',
                );
                action.data.message = 'Settings updated';
                handlers?.fetchEngineState?.();
            }
            break;

        case 'theme': {
            const t = action.data.theme as ThemeId | undefined;
            const isPro = useAuthStore.getState().subscriptionTier === 'pro';
            if (t && !canUseTheme(t, isPro)) {
                throw new Error('Pro subscription required for Gold and Custom themes');
            }
            if (t) {
                if (t === 'custom' && action.data.custom_theme) {
                    const colors = action.data.custom_theme;
                    if (colors.primary && colors.accent && colors.highlight) {
                        await setCustomThemeColors({
                            primary: colors.primary,
                            accent: colors.accent,
                            highlight: colors.highlight,
                        });
                        action.data.message = `Theme → custom (${colors.primary}, ${colors.accent}, ${colors.highlight})`;
                    } else {
                        await setEngineTheme(t);
                        action.data.message = 'Theme → custom';
                    }
                } else {
                    await setEngineTheme(t);
                    action.data.message = `Theme → ${t}`;
                }
                handlers?.fetchEngineState?.();
            }
            break;
        }

        case 'nuclear_start':
            await requireEngineOk(
                {
                    type: 'START_NUCLEAR',
                    target: action.data.target || 'blocked',
                    duration: action.data.minutes ?? 60,
                },
                'Nuclear lockdown',
            );
            action.data.message = `Nuclear lockdown · ${action.data.minutes ?? 60} min`;
            handlers?.fetchEngineState?.();
            break;

        case 'in_app_block': {
            const st = await getState();
            const inApp = { ...((st.inAppBlock as object) || {}) } as Record<string, unknown>;
            const platform = action.data.platform;
            if (platform === 'youtube') {
                const enabled = action.data.enabled ?? true;
                inApp.youtubeShorts = enabled;
                inApp.youtube = enabled;
            } else if (platform === 'instagram') {
                if (action.data.feature === 'instagramReels') {
                    inApp.instagramReels = action.data.enabled ?? true;
                } else {
                    inApp.instagram = action.data.enabled ?? true;
                }
            } else if (platform === 'tiktok') {
                inApp.tiktok = action.data.enabled ?? true;
            }
            await requireEngineOk(
                { type: 'UPDATE_ENGINE_SETTINGS', settings: { inAppBlock: inApp } },
                'In-app block',
            );
            action.data.message = `In-app · ${platform}`;
            handlers?.fetchEngineState?.();
            break;
        }

        case 'in_app_filter_add': {
            const handle = (action.data.handle || '').replace(/^@/, '').trim();
            if (!handle) throw new Error('Missing creator handle');
            const st = await getState();
            const inApp = { ...((st.inAppBlock as object) || {}) } as { filters?: string[] };
            const filters = [...(inApp.filters || [])];
            if (!filters.includes(handle)) filters.push(handle);
            await requireEngineOk(
                {
                    type: 'UPDATE_ENGINE_SETTINGS',
                    settings: { inAppBlock: { ...inApp, filters } },
                },
                'Creator block',
            );
            action.data.message = `Blocked @${handle}`;
            handlers?.fetchEngineState?.();
            break;
        }

        case 'in_app_filter_remove': {
            const handle = (action.data.handle || '').replace(/^@/, '').trim();
            const st = await getState();
            const inApp = { ...((st.inAppBlock as object) || {}) } as { filters?: string[] };
            const filters = (inApp.filters || []).filter((f) => f !== handle);
            await requireEngineOk(
                {
                    type: 'UPDATE_ENGINE_SETTINGS',
                    settings: { inAppBlock: { ...inApp, filters } },
                },
                'Creator unblock',
            );
            action.data.message = `Unblocked @${handle}`;
            handlers?.fetchEngineState?.();
            break;
        }

        case 'habit_add': {
            const name = (action.data.name || '').trim();
            if (!name) throw new Error('Missing habit name');
            const st = await getState();
            const habits = [
                ...((st.habits as object[]) || []),
                { id: Date.now(), name, streak: 0, checkins: [] },
            ];
            await requireEngineOk(
                { type: 'UPDATE_ENGINE_SETTINGS', settings: { habits } },
                'Habit',
            );
            action.data.message = `Added habit · ${name}`;
            handlers?.fetchEngineState?.();
            break;
        }

        case 'habit_checkin': {
            const st = await getState();
            const today = new Date().toDateString();
            const habits = (
                (st.habits as { id: number; name: string; checkins: string[] }[]) || []
            ).map((h) => {
                const match =
                    (action.data.habit_id && h.id === action.data.habit_id) ||
                    (action.data.name &&
                        h.name.toLowerCase() === action.data.name!.toLowerCase());
                if (!match) return h;
                const checkins = h.checkins?.includes(today)
                    ? h.checkins
                    : [...(h.checkins || []), today];
                return { ...h, checkins };
            });
            await requireEngineOk(
                { type: 'UPDATE_ENGINE_SETTINGS', settings: { habits } },
                'Habit check-in',
            );
            action.data.message = 'Habit checked in';
            handlers?.fetchEngineState?.();
            break;
        }

        case 'pomodoro_configure': {
            const st = await getState();
            const cur = (st.pomodoroSettings as object) || {};
            await requireEngineOk(
                {
                    type: 'UPDATE_ENGINE_SETTINGS',
                    settings: {
                        pomodoroSettings: {
                            ...cur,
                            focusMin:
                                action.data.focus_min ??
                                (cur as { focusMin?: number }).focusMin,
                            breakMin:
                                action.data.break_min ??
                                (cur as { breakMin?: number }).breakMin,
                        },
                    },
                },
                'Pomodoro',
            );
            action.data.message = 'Pomodoro settings saved';
            handlers?.fetchEngineState?.();
            break;
        }

        case 'pomodoro_start': {
            const st = await getState();
            const pomo = (st.pomodoroSettings as { focusMin?: number }) || {};
            const mins = action.data.focus_min ?? pomo.focusMin ?? 25;
            await requireEngineOk(
                { type: 'START_SESSION', domain: 'focus', duration: mins },
                'Pomodoro session',
            );
            action.data.message = `Pomodoro started · ${mins} min`;
            break;
        }

        case 'calendar_open':
            await requireEngineOk({ type: 'OPEN_OPTIONS', tab: 'calendar' }, 'Calendar');
            action.data.message = 'Calendar opened';
            break;

        case 'scheduling_links_list': {
            const stored = await chrome.storage.local.get(SCHEDULING_LINKS_KEY);
            const links =
                (stored[SCHEDULING_LINKS_KEY] as {
                    title: string;
                    slug: string;
                    durationMin?: number;
                }[]) || [];
            action.data.links = links.map((l) => ({
                title: l.title,
                slug: l.slug,
                durationMin: l.durationMin,
            }));
            action.data.message = links.length
                ? `Found ${links.length} booking link(s).`
                : 'No scheduling links yet.';
            break;
        }

        case 'read_analytics': {
            const approved = await getAnalyticsConsent();
            if (!approved) {
                throw new Error('Analytics not approved');
            }
            action.data.success = true;
            action.data.message = 'Approved';
            action.data.summary = '';
            break;
        }

        case 'daily_goal_set': {
            const goal = (action.data.goal || '').trim();
            if (goal) {
                const { setDailyGoal } = await import('./dailyGoal');
                setDailyGoal(goal);
            }
            action.data.message = goal ? `Daily goal → ${goal.slice(0, 60)}` : 'No goal provided';
            break;
        }

        case 'planner_set': {
            const items = action.data.planner_items || [];
            const planner = items.map((item, i) => ({
                id: Date.now() + i,
                time: item.time || 'Anytime',
                task: item.task || 'Focus block',
                done: !!item.done,
            }));
            await requireEngineOk(
                { type: 'UPDATE_ENGINE_SETTINGS', settings: { dailyPlanner: planner } },
                'Planner',
            );
            action.data.message = `Planner updated · ${planner.length} item(s)`;
            handlers?.fetchEngineState?.();
            break;
        }

        case 'calendar_add_events': {
            const stored = await chrome.storage.local.get(CALENDAR_EVENTS_KEY);
            const existing = (stored[CALENDAR_EVENTS_KEY] as CalendarEvent[]) || [];
            const today = new Date().toISOString().slice(0, 10);
            const newEvents = (action.data.events || []).map((e, i) => ({
                id: `ai_${Date.now()}_${i}`,
                title: e.title || 'Focus block',
                date: e.date || today,
                allDay: false,
                startHour: e.startHour ?? 9,
                startMin: e.startMin ?? 0,
                durationMin: e.durationMin ?? 25,
                color: e.color || '#a855f7',
            }));
            await chrome.storage.local.set({
                [CALENDAR_EVENTS_KEY]: [...existing, ...newEvents],
            });
            action.data.message = `Added ${newEvents.length} calendar event(s)`;
            break;
        }

        default:
            throw new Error(`Unknown action: ${action.action_type}`);
    }

    return action;
}

export async function executeCoachActions(
    actions: CoachAction[],
    handlers?: CoachActionHandlers,
): Promise<CoachAction[]> {
    const out: CoachAction[] = [];
    for (const action of actions) {
        out.push(await executeSingleCoachAction(action, handlers));
    }
    return out;
}

/** Persist analytics consent when user approves in-chat. */
export async function approveCoachAnalytics(): Promise<void> {
    await setAnalyticsConsent(true);
}
