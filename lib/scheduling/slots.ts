import { addDays, format, isBefore, startOfDay } from 'date-fns';
import type { SchedulingLink } from './types';

export type TimeSlot = {
    label: string;
    startMin: number;
};

export type BookedSlot = {
    bookingDate: string;
    startMin: number;
};

export function formatSlotLabel(startMin: number): string {
    const h = Math.floor(startMin / 60);
    const m = startMin % 60;
    const ap = h >= 12 ? 'PM' : 'AM';
    const hr = h % 12 || 12;
    return `${hr}:${String(m).padStart(2, '0')} ${ap}`;
}

function defaultWindow(link: SchedulingLink): { start: number; end: number } {
    const { startHour, startMin, endHour, endMin } = link.availability;
    return {
        start: startHour * 60 + startMin,
        end: endHour * 60 + endMin,
    };
}

/** Resolve bookable hours for a calendar day (per-date overrides, then weekday, then defaults). */
export function windowForDay(link: SchedulingLink, day: Date): { start: number; end: number } | null {
    const dow = day.getDay();
    const dateKey = format(day, 'yyyy-MM-dd');

    if (link.dateAvailability?.[dateKey]) {
        const d = link.dateAvailability[dateKey];
        return {
            start: d.startHour * 60 + d.startMin,
            end: d.endHour * 60 + d.endMin,
        };
    }

    if (link.type === 'oneoff' && link.specificDates?.length) {
        if (!link.specificDates.includes(dateKey)) {
            if (!link.weekdayAvailability?.[dow] && !link.availability.days.includes(dow)) {
                return null;
            }
        }
    }

    if (link.weekdayAvailability?.[dow]) {
        const w = link.weekdayAvailability[dow];
        return {
            start: w.startHour * 60 + w.startMin,
            end: w.endHour * 60 + w.endMin,
        };
    }

    if (!link.availability.days.includes(dow)) return null;

    return defaultWindow(link);
}

export function isDayBookable(link: SchedulingLink, day: Date, now = new Date()): boolean {
    const dayStart = startOfDay(day);
    const today = startOfDay(now);

    if (isBefore(dayStart, today)) return false;

    const maxDay = addDays(today, link.bookingWindowDays ?? 30);
    if (dayStart > maxDay) return false;

    if (link.expiresAt && dayStart > startOfDay(new Date(link.expiresAt))) return false;

    return windowForDay(link, day) !== null;
}

/** Only returns slots that are actually bookable (not taken, past notice, within window). */
export function slotsForDay(
    link: SchedulingLink,
    day: Date,
    booked: BookedSlot[] = [],
    now = new Date(),
): TimeSlot[] {
    if (!isDayBookable(link, day, now)) return [];

    const window = windowForDay(link, day);
    if (!window || window.end <= window.start) return [];

    const dateKey = format(day, 'yyyy-MM-dd');
    const bookedSet = new Set(
        booked.filter((b) => b.bookingDate === dateKey).map((b) => b.startMin),
    );

    const noticeMin = (link.bookingNoticeHours ?? 1) * 60;
    const earliest =
        format(day, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd')
            ? now.getHours() * 60 + now.getMinutes() + noticeMin
            : 0;

    const step = Math.max(link.durationMin + (link.bufferMin ?? 0), link.durationMin);
    const out: TimeSlot[] = [];

    for (let t = window.start; t + link.durationMin <= window.end; t += step) {
        if (t < earliest) continue;
        if (bookedSet.has(t)) continue;
        out.push({ label: formatSlotLabel(t), startMin: t });
    }
    return out;
}

export function daysWithSlots(
    link: SchedulingLink,
    days: Date[],
    booked: BookedSlot[] = [],
    now = new Date(),
): Date[] {
    return days.filter((d) => slotsForDay(link, d, booked, now).length > 0);
}
