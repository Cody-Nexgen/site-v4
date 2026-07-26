import type { CoachAction } from './aiCoachTypes';

export function describeCoachAction(action: CoachAction): { title: string; detail: string } {
    const d = action.data;
    switch (action.action_type) {
        case 'block':
            return {
                title: 'Block sites',
                detail: (d.domains || []).join(', ') || 'No domains listed',
            };
        case 'unblock':
            return {
                title: 'Unblock sites',
                detail: (d.domains || []).join(', ') || 'No domains listed',
            };
        case 'timer':
            return {
                title: 'Focus timer',
                detail: `${d.domain || 'site'} · ${d.minutes ?? 25} minutes`,
            };
        case 'blocks_list':
            return { title: 'List blocked sites', detail: 'Read your current blocklist' };
        case 'nuclear_start':
            return {
                title: 'Nuclear lockdown',
                detail: `${d.target === 'all' ? 'All sites' : 'Blocked sites only'} · ${d.minutes ?? 60} min`,
            };
        case 'theme':
            return { title: 'Change theme', detail: String(d.theme || 'default') };
        case 'in_app_block':
            return {
                title: 'In-app blocking',
                detail: `${d.platform || 'platform'}${d.feature ? ` · ${d.feature}` : ''} → ${d.enabled !== false ? 'on' : 'off'}`,
            };
        case 'in_app_filter_add':
            return { title: 'Block creator', detail: `@${(d.handle || '').replace(/^@/, '')}` };
        case 'in_app_filter_remove':
            return { title: 'Unblock creator', detail: `@${(d.handle || '').replace(/^@/, '')}` };
        case 'habit_add':
            return { title: 'Add habit', detail: d.name || '' };
        case 'habit_checkin':
            return { title: 'Check in habit', detail: d.name || String(d.habit_id || '') };
        case 'pomodoro_configure':
            return {
                title: 'Pomodoro settings',
                detail: `Focus ${d.focus_min ?? '?'} min · Break ${d.break_min ?? '?'} min`,
            };
        case 'pomodoro_start':
            return {
                title: 'Start pomodoro',
                detail: `${d.focus_min ?? 'default'} minute focus session`,
            };
        case 'calendar_open':
            return { title: 'Open calendar', detail: 'Scheduling & events tab' };
        case 'scheduling_links_list':
            return { title: 'List booking links', detail: 'Show your scheduling links' };
        case 'read_analytics':
            return {
                title: 'Share analytics',
                detail: 'Last 7 days of screen time (sites & minutes, summarized)',
            };
        case 'daily_goal_set':
            return { title: 'Set daily goal', detail: d.goal || '' };
        case 'planner_set':
            return {
                title: 'Update planner',
                detail: `${d.planner_items?.length ?? 0} scheduled item(s)`,
            };
        case 'calendar_add_events':
            return {
                title: 'Add calendar events',
                detail: `${d.events?.length ?? 0} focus block(s)`,
            };
        case 'change_setting':
            return {
                title: 'Change setting',
                detail: `${d.setting_name} → ${String(d.new_value)}`,
            };
        case 'engine_settings':
            return {
                title: 'Update settings',
                detail: Object.keys(d.settings || {}).join(', ') || 'Multiple options',
            };
        default:
            return { title: action.action_type, detail: '' };
    }
}
