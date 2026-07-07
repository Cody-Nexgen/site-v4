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
};

export const SCHEDULING_LINKS_KEY = 'focuznow_scheduling_links';
export const CALENDAR_EVENTS_KEY = 'focuznow_calendar_events';
export const CALENDAR_GROUPS_KEY = 'focuznow_calendar_groups';
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
