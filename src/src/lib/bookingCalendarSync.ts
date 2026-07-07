import {
    CALENDAR_EVENTS_KEY,
    type CalendarEvent,
} from './schedulingTypes';
import type { HostBookingNotification } from './schedulingApi';
import { formatSlotLabel } from './schedulingSlots';

export const CALENDAR_EVENTS_UPDATED_EVENT = 'focuznow-calendar-events-updated';

/** Calendar grid stores event.date as Date.toDateString(); bookings use yyyy-MM-dd from DB. */
export function bookingDateToCalendarDate(bookingDate: string): string {
    const raw = bookingDate.trim();
    const normalized = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T12:00:00` : raw;
    const d = new Date(normalized);
    if (Number.isNaN(d.getTime())) return raw;
    return d.toDateString();
}

export function normalizeCalendarEventDates(events: CalendarEvent[]): CalendarEvent[] {
    return events.map((e) => {
        if (!e.id.startsWith('booking_')) return e;
        if (/^\d{4}-\d{2}-\d{2}$/.test(e.date)) {
            return { ...e, date: bookingDateToCalendarDate(e.date) };
        }
        return e;
    });
}

function buildEventDescription(b: HostBookingNotification): string {
    const payload = b.link_payload as {
        locationType?: string;
        locationValue?: string;
        description?: string;
    };
    const lines = [
        `Booking: ${b.link_title}`,
        `Guest: ${b.guest_name}`,
    ];
    if (b.guest_email) lines.push(`Email: ${b.guest_email}`);
    if (b.guest_phone) lines.push(`Phone: ${b.guest_phone}`);
    if (b.guest_details) lines.push(`Details: ${b.guest_details}`);
    if (payload.locationType === 'phone') {
        lines.push('Location: Phone call');
    } else if (payload.locationValue) {
        lines.push(`Location: ${payload.locationValue}`);
    }
    if (payload.description) lines.push(`Notes: ${payload.description}`);
    return lines.join('\n');
}

export async function syncBookingsToCalendar(
    bookings: HostBookingNotification[],
): Promise<void> {
    if (typeof chrome === 'undefined' || !chrome.storage?.local || bookings.length === 0) {
        return;
    }

    const existing = await new Promise<CalendarEvent[]>((resolve) => {
        chrome.storage.local.get([CALENDAR_EVENTS_KEY], (res) => {
            resolve((res[CALENDAR_EVENTS_KEY] as CalendarEvent[]) || []);
        });
    });

    const bookingIds = new Set(bookings.map((b) => b.id));
    const withoutDupes = existing.filter((e) => !e.id.startsWith('booking_') || !bookingIds.has(e.id.replace('booking_', '')));

    const newEvents: CalendarEvent[] = bookings.map((b) => ({
        id: `booking_${b.id}`,
        title: `${b.link_title} · ${b.guest_name}`,
        date: bookingDateToCalendarDate(b.booking_date),
        allDay: false,
        startHour: Math.floor(b.start_min / 60),
        startMin: b.start_min % 60,
        durationMin: b.duration_min,
        color: '#3b82f6',
        description: buildEventDescription(b),
    }));

    const merged = [...withoutDupes];
    for (const ev of newEvents) {
        if (!merged.some((e) => e.id === ev.id)) {
            merged.push(ev);
        }
    }

    await chrome.storage.local.set({ [CALENDAR_EVENTS_KEY]: merged });

    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(CALENDAR_EVENTS_UPDATED_EVENT));
    }
}

export function formatBookingWhen(b: HostBookingNotification): string {
    return `${b.booking_date} at ${formatSlotLabel(b.start_min)}`;
}
