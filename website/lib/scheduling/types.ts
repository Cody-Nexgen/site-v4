export type AvailabilityWindow = {
    days: number[];
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
    weekdayAvailability?: Record<number, WeekdayAvailability>;
    specificDates?: string[];
    dateAvailability?: Record<string, WeekdayAvailability>;
    timezone: string;
    singleUse: boolean;
    expiresAt?: string;
    hostName: string;
    hostEmail: string;
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
