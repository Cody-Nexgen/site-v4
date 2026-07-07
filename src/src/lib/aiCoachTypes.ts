/** Agent actions the AI Coach can emit (FOCUZNOW_ACTION JSON). */
export type CoachActionType =
    | 'block'
    | 'unblock'
    | 'timer'
    | 'blocks_list'
    | 'change_setting'
    | 'engine_settings'
    | 'theme'
    | 'nuclear_start'
    | 'in_app_block'
    | 'in_app_filter_add'
    | 'in_app_filter_remove'
    | 'habit_add'
    | 'habit_checkin'
    | 'pomodoro_configure'
    | 'pomodoro_start'
    | 'calendar_open'
    | 'scheduling_links_list'
    | 'read_analytics'
    | 'planner_set'
    | 'calendar_add_events'
    | 'daily_goal_set';

export type CoachActionData = {
    domain?: string;
    domains?: string[];
    minutes?: number;
    blocks?: string[];
    setting_name?: string;
    new_value?: boolean | string | number;
    settings?: Record<string, unknown>;
    theme?: string;
    target?: 'blocked' | 'all';
    platform?: 'youtube' | 'instagram' | 'tiktok';
    feature?: 'youtubeShorts' | 'instagramReels' | string;
    enabled?: boolean;
    handle?: string;
    name?: string;
    habit_id?: number;
    focus_min?: number;
    break_min?: number;
    links?: { title: string; slug: string; durationMin?: number }[];
    summary?: string;
    custom_theme?: { primary?: string; accent?: string; highlight?: string };
    message?: string;
    success?: boolean;
    goal?: string;
    planner_items?: { time?: string; task?: string; durationMin?: number; done?: boolean }[];
    events?: {
        title?: string;
        date?: string;
        startHour?: number;
        startMin?: number;
        durationMin?: number;
        color?: string;
    }[];
};

export type CoachAction = {
    action_type: CoachActionType;
    data: CoachActionData;
};
