export type AvailabilityWindow = {
    days: number[]; // 0=Sun … 6=Sat
    startHour: number;
    startMin: number;
    endHour: number;
    endMin: number;
};

export type WeekdayAvailability = {
    startHour: number;
    startMin: number;
    endHour: number;
    endMin: number;
};

export type LinkLocationType = 'link' | 'phone' | 'in_person' | 'custom';

export type SchedulingLink = {
    id: string;
    type: 'recurring' | 'oneoff';
    title: string;
    slug: string;
    durationMin: number;
    bufferMin: number;
    availability: AvailabilityWindow;
    /** Per-weekday windows for recurring links (0=Sun … 6=Sat). */
    weekdayAvailability?: Record<number, WeekdayAvailability>;
    /** yyyy-MM-dd dates for one-off links. */
    specificDates?: string[];
    /** Per-date hours for one-off links (yyyy-MM-dd → window). */
    dateAvailability?: Record<string, WeekdayAvailability>;
    timezone: string;
    singleUse: boolean;
    expiresAt?: string;
    hostName: string;
    hostEmail: string;
    /** Live profile from DB (merged in get_scheduling_link) */
    hostDisplayName?: string;
    hostUsername?: string;
    hostAvatarUrl?: string | null;
    description?: string;
    locationType?: LinkLocationType;
    locationValue?: string;
    bookingNoticeHours?: number;
    bookingWindowDays?: number;
    createdAt: string;
};

export type CalendarGroup = {
    id: string;
    name: string;
    color: string;
    enabled: boolean;
    expanded: boolean;
    kind: 'holidays' | 'custom';
};

export type CalendarEvent = {
    id: string;
    title: string;
    date: string;
    allDay: boolean;
    startHour: number;
    startMin: number;
    durationMin: number;
    color: string;
    groupId?: string;
    bookingLinkId?: string;
    description?: string;
    /** Stable identifier shared by a recurring series. */
    seriesId?: string;
    repeat?: 'none' | 'daily' | 'weekly';
    /** Selected weekdays for weekly recurrence (0=Sun … 6=Sat). */
    recurrenceWeekdays?: number[];
    /** Local yyyy-MM-dd dates omitted from the series. */
    recurrenceExceptions?: string[];
    /** Present only on an in-memory, generated occurrence. */
    recurrenceMasterId?: string;
    /** Original date of the persisted series master. */
    recurrenceMasterDate?: string;
    /** Local yyyy-MM-dd date represented by a generated occurrence. */
    occurrenceDate?: string;
    sourceListId?: string;
};

export const SCHEDULING_LINKS_KEY = 'focuznow_scheduling_links';
export const CALENDAR_EVENTS_KEY = 'focuznow_calendar_events';
export const CALENDAR_GROUPS_KEY = 'focuznow_calendar_groups';
export const CALENDAR_GROUP_TOMBSTONES_KEY = 'focuznow_calendar_group_tombstones';
export const SHOW_HOLIDAYS_KEY = 'focuznow_show_us_holidays';

export const DEFAULT_CALENDAR_GROUPS = (): CalendarGroup[] => [
    {
        id: 'grp_holidays',
        name: 'Holidays in United States',
        color: '#22c55e',
        enabled: true,
        expanded: false,
        kind: 'holidays',
    },
];

function normalizeCalendarGroup(value: unknown): CalendarGroup | null {
    if (!value || typeof value !== 'object') return null;
    const candidate = value as Partial<CalendarGroup>;
    if (typeof candidate.id !== 'string' || typeof candidate.name !== 'string') return null;
    return {
        id: candidate.id,
        name: candidate.name,
        color: typeof candidate.color === 'string' ? candidate.color : '#3b82f6',
        enabled: typeof candidate.enabled === 'boolean' ? candidate.enabled : true,
        expanded: typeof candidate.expanded === 'boolean' ? candidate.expanded : false,
        kind:
            candidate.kind === 'holidays' || candidate.id === 'grp_holidays'
                ? 'holidays'
                : 'custom',
    };
}

export function normalizeCalendarGroupTombstones(value: unknown): string[] {
    return Array.isArray(value)
        ? [...new Set(value.filter((id): id is string => typeof id === 'string'))]
        : [];
}

/** Merge system groups into legacy storage unless the user explicitly deleted them. */
export function mergeStoredCalendarGroups(
    stored: unknown,
    tombstones: unknown,
    legacyShowHolidays?: unknown,
): CalendarGroup[] {
    const deleted = new Set(normalizeCalendarGroupTombstones(tombstones));
    const normalized = Array.isArray(stored)
        ? stored.map(normalizeCalendarGroup).filter((group): group is CalendarGroup => group !== null)
        : [];
    const byId = new Map(normalized.map((group) => [group.id, group]));

    for (const systemGroup of DEFAULT_CALENDAR_GROUPS()) {
        if (deleted.has(systemGroup.id) || byId.has(systemGroup.id)) continue;
        byId.set(systemGroup.id, {
            ...systemGroup,
            enabled:
                typeof legacyShowHolidays === 'boolean'
                    ? legacyShowHolidays
                    : systemGroup.enabled,
        });
    }

    return [...byId.values()].filter((group) => !deleted.has(group.id));
}

export const defaultAvailability = (): AvailabilityWindow => ({
    days: [1, 2, 3, 4, 5],
    startHour: 9,
    startMin: 0,
    endHour: 17,
    endMin: 0,
});

export function bookingUrl(slug: string): string {
    return `https://focuznow.com/schedule/${slug}`;
}
