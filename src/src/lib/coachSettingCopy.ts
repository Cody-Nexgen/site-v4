import type { CoachAction } from './aiCoachTypes';

function compact(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function asBool(value: unknown, fallback = true): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
        const key = compact(value);
        if (['false', 'off', 'no', '0', 'disable', 'disabled'].includes(key)) return false;
        if (['true', 'on', 'yes', '1', 'enable', 'enabled'].includes(key)) return true;
    }
    return fallback;
}

const SETTING_KEYS: Record<string, string> = {
    focusmode: 'focusMode',
    focus: 'focusMode',
    requirechallenge: 'requireChallenge',
    unblockingchallenge: 'requireChallenge',
    typingchallenge: 'requireChallenge',
    challenge: 'requireChallenge',
    trackbackgroundaudio: 'trackBackgroundAudio',
    backgroundaudio: 'trackBackgroundAudio',
    draggabletimer: 'draggableTimer',
    siteclock: 'draggableTimer',
    pomodorowidget: 'pomodoroWidget',
    floatingtimer: 'pomodoroWidget',
    redirectmessage: 'redirectMessage',
    customblockingmessage: 'redirectMessage',
    blockedpagemessage: 'redirectMessage',
    allowlistmode: 'allowlistMode',
    whitelistmode: 'allowlistMode',
};

const SETTING_QUESTIONS: Record<string, { on: string; off: string }> = {
    focusMode: {
        on: 'Would you like to allow FocuzAI to turn on Focus Mode?',
        off: 'Would you like to allow FocuzAI to turn off Focus Mode?',
    },
    requireChallenge: {
        on: 'Would you like to allow FocuzAI to require a typing challenge before sites can be unblocked?',
        off: 'Would you like to allow FocuzAI to turn off the unblocking typing challenge?',
    },
    trackBackgroundAudio: {
        on: 'Would you like to allow FocuzAI to count time on tabs playing audio in the background?',
        off: 'Would you like to allow FocuzAI to stop tracking background audio?',
    },
    draggableTimer: {
        on: 'Would you like to allow FocuzAI to show the floating site clock on pages?',
        off: 'Would you like to allow FocuzAI to hide the floating site clock?',
    },
    pomodoroWidget: {
        on: 'Would you like to allow FocuzAI to show the floating pomodoro timer on pages?',
        off: 'Would you like to allow FocuzAI to hide the floating pomodoro timer?',
    },
    allowlistMode: {
        on: 'Would you like to allow FocuzAI to only allow sites on your allowlist?',
        off: 'Would you like to allow FocuzAI to turn off allowlist-only mode?',
    },
};

function splitInlineAssignment(raw: string): { name: string; value?: string } {
    const match = raw.match(/^(.+?)\s*(?:==|=|:)\s*(.+)$/);
    if (!match) return { name: raw.trim() };
    return { name: match[1].trim(), value: match[2].trim() };
}

function inAppIntent(name: string): {
    platform?: CoachAction['data']['platform'];
    feature?: string;
} | null {
    const key = compact(name);
    if (!key) return null;
    if (['inappblocking', 'inappblock', 'inapp', 'appblocking', 'inappblocks'].includes(key)) {
        return {};
    }
    if (key.includes('youtubeshort') || key === 'shorts') {
        return { platform: 'youtube', feature: 'youtubeShorts' };
    }
    if (key.includes('instagramreel') || key === 'reels') {
        return { platform: 'instagram', feature: 'instagramReels' };
    }
    if (key.includes('youtube') && !key.includes('short')) {
        return { platform: 'youtube' };
    }
    if (key.includes('instagram')) {
        return { platform: 'instagram' };
    }
    if (key.includes('tiktok')) {
        return { platform: 'tiktok' };
    }
    return null;
}

export function canonicalizeCoachAction(action: CoachAction): CoachAction {
    if (action.action_type === 'change_setting') {
        const rawName = String(action.data.setting_name || action.data.name || '');
        const split = splitInlineAssignment(rawName);
        const value = action.data.new_value ?? split.value;
        const inApp = inAppIntent(split.name);
        if (inApp) {
            return {
                action_type: 'in_app_block',
                data: {
                    ...action.data,
                    ...inApp,
                    enabled: asBool(value, true),
                    setting_name: undefined,
                    new_value: undefined,
                },
            };
        }
        const mapped = SETTING_KEYS[compact(split.name)];
        if (mapped) {
            return {
                ...action,
                data: {
                    ...action.data,
                    setting_name: mapped,
                    new_value: mapped === 'redirectMessage' ? String(value ?? action.data.new_value ?? '') : asBool(value, true),
                },
            };
        }
        if (split.value != null && action.data.new_value == null) {
            return { ...action, data: { ...action.data, setting_name: split.name, new_value: split.value } };
        }
    }

    if (action.action_type === 'engine_settings' && action.data.settings) {
        const next: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(action.data.settings)) {
            const mapped = SETTING_KEYS[compact(key)] || key;
            next[mapped] = value;
        }
        return { ...action, data: { ...action.data, settings: next } };
    }

    return action;
}

function inAppQuestion(action: CoachAction): string {
    const on = action.data.enabled !== false;
    const verb = on ? 'turn on' : 'turn off';
    const feature = compact(String(action.data.feature || ''));
    if (feature === 'youtubeshorts') return `Would you like to allow FocuzAI to ${on ? 'block' : 'unblock'} YouTube Shorts?`;
    if (feature === 'instagramreels') return `Would you like to allow FocuzAI to ${on ? 'block' : 'unblock'} Instagram Reels?`;
    if (action.data.platform === 'youtube') return `Would you like to allow FocuzAI to ${on ? 'block' : 'unblock'} YouTube in-app?`;
    if (action.data.platform === 'instagram') return `Would you like to allow FocuzAI to ${on ? 'block' : 'unblock'} Instagram in-app?`;
    if (action.data.platform === 'tiktok') return `Would you like to allow FocuzAI to ${on ? 'block' : 'unblock'} TikTok in-app?`;
    return `Would you like to allow FocuzAI to ${verb} in-app blocking?`;
}

function settingQuestion(name: string, value: unknown): string {
    const copy = SETTING_QUESTIONS[name];
    if (copy) return asBool(value, true) ? copy.on : copy.off;
    if (name === 'redirectMessage') {
        return `Would you like to allow FocuzAI to change the blocked-page message to “${String(value || '')}”?`;
    }
    return `Would you like to allow FocuzAI to update ${name}?`;
}

export function describeCoachAction(action: CoachAction): { title: string; detail: string } {
    const resolved = canonicalizeCoachAction(action);
    const d = resolved.data;

    switch (resolved.action_type) {
        case 'block':
            return {
                title: `Would you like to allow FocuzAI to block ${(d.domains || []).join(', ') || 'these sites'}?`,
                detail: '',
            };
        case 'unblock':
            return {
                title: `Would you like to allow FocuzAI to unblock ${(d.domains || []).join(', ') || 'these sites'}?`,
                detail: '',
            };
        case 'timer':
            return {
                title: `Would you like to allow FocuzAI to start a ${d.minutes ?? 25}-minute focus timer${d.domain ? ` on ${d.domain}` : ''}?`,
                detail: '',
            };
        case 'blocks_list':
            return { title: 'Would you like to allow FocuzAI to read your blocklist?', detail: '' };
        case 'nuclear_start':
            return {
                title: `Would you like to allow FocuzAI to start a ${d.minutes ?? 60}-minute nuclear lockdown?`,
                detail: d.target === 'all' ? 'This locks the entire web until the timer ends.' : 'This locks your blocklist until the timer ends.',
            };
        case 'theme':
            return {
                title: `Would you like to allow FocuzAI to switch your theme to ${String(d.theme || 'a new look')}?`,
                detail: '',
            };
        case 'in_app_block':
            return { title: inAppQuestion(resolved), detail: '' };
        case 'in_app_filter_add':
            return {
                title: `Would you like to allow FocuzAI to block @${(d.handle || '').replace(/^@/, '')}?`,
                detail: '',
            };
        case 'in_app_filter_remove':
            return {
                title: `Would you like to allow FocuzAI to unblock @${(d.handle || '').replace(/^@/, '')}?`,
                detail: '',
            };
        case 'habit_add':
            return { title: `Would you like to allow FocuzAI to add the habit “${d.name || 'this habit'}”?`, detail: '' };
        case 'habit_checkin':
            return { title: `Would you like to allow FocuzAI to check in “${d.name || 'this habit'}”?`, detail: '' };
        case 'pomodoro_configure':
            return {
                title: `Would you like to allow FocuzAI to set pomodoro to ${d.focus_min ?? 25} minutes focus and ${d.break_min ?? 5} minutes break?`,
                detail: '',
            };
        case 'pomodoro_start':
            return {
                title: `Would you like to allow FocuzAI to start a ${d.focus_min ?? 25}-minute pomodoro?`,
                detail: '',
            };
        case 'calendar_open':
            return { title: 'Would you like to allow FocuzAI to open your calendar?', detail: '' };
        case 'scheduling_links_list':
            return { title: 'Would you like to allow FocuzAI to read your booking links?', detail: '' };
        case 'read_analytics':
            return {
                title: 'Would you like to allow FocuzAI to use your last 7 days of screen time?',
                detail: 'Only summarized sites and minutes are shared for this chat.',
            };
        case 'daily_goal_set':
            return { title: `Would you like to allow FocuzAI to set today’s goal to “${d.goal || ''}”?`, detail: '' };
        case 'planner_set':
            return {
                title: `Would you like to allow FocuzAI to update today’s planner with ${d.planner_items?.length ?? 0} item(s)?`,
                detail: '',
            };
        case 'calendar_add_events':
            return {
                title: `Would you like to allow FocuzAI to add ${d.events?.length ?? 0} event(s) to your calendar?`,
                detail: '',
            };
        case 'change_setting':
            return {
                title: settingQuestion(String(d.setting_name || ''), d.new_value),
                detail: '',
            };
        case 'engine_settings': {
            const keys = Object.keys(d.settings || {});
            if (keys.length === 1) {
                return { title: settingQuestion(keys[0], d.settings?.[keys[0]]), detail: '' };
            }
            return {
                title: 'Would you like to allow FocuzAI to update these settings?',
                detail: keys.map((key) => settingQuestion(key, d.settings?.[key])).join(' '),
            };
        }
        default:
            return { title: 'Would you like to allow FocuzAI to make this change?', detail: '' };
    }
}
