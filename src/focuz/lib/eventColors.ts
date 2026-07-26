import type { CalendarEvent, CalendarGroup } from './schedulingTypes';

export function colorForEvent(ev: CalendarEvent, groups: CalendarGroup[]): string {
    if (ev.groupId) {
        const g = groups.find((x) => x.id === ev.groupId);
        if (g) return g.color;
    }
    return ev.color;
}

export function applyGroupColorToEvents(
    events: CalendarEvent[],
    groupId: string,
    color: string,
): CalendarEvent[] {
    return events.map((e) => (e.groupId === groupId ? { ...e, color } : e));
}
