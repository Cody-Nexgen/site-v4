import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
    addDays,
    eachDayOfInterval,
    endOfMonth,
    endOfWeek,
    format,
    getDay,
    isSameDay,
    isSameMonth,
    startOfMonth,
    startOfWeek,
} from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowUpRight, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Copy, Link2, Pencil, Plus, Repeat, X } from 'lucide-react';

type CalendarView = 'day' | 'week' | 'month';
import { useAuthStore } from '../lib/store';
import { holidaysForRange } from '../lib/usHolidays';
import {
    buildDateAvailability,
    syncAllSchedulingLinks,
} from '../lib/schedulingApi';
import { supabase } from '../lib/supabase';
import { fetchMyProfileQuiet } from '../lib/profileApi';
import {
    bookingUrl,
    CALENDAR_EVENTS_KEY,
    CALENDAR_GROUP_TOMBSTONES_KEY,
    CALENDAR_GROUPS_KEY,
    DEFAULT_CALENDAR_GROUPS,
    mergeStoredCalendarGroups,
    normalizeCalendarGroupTombstones,
    SCHEDULING_LINKS_KEY,
    SHOW_HOLIDAYS_KEY,
    type CalendarEvent,
    type CalendarGroup,
    type SchedulingLink,
    type WeekdayAvailability,
} from '../lib/schedulingTypes';
import { weekHighlightSegments } from '../lib/calendarUtils';
import {
    expandCalendarEventsInRange,
    isGeneratedOccurrence,
    migrateMaterializedCalendarSeries,
    withOccurrenceException,
    type RecurrenceEditTarget,
} from '../lib/calendarRecurrence';
import { applyGroupColorToEvents, colorForEvent } from '../lib/eventColors';
import CalendarGroupsPanel from './CalendarGroupsPanel';
import EventModal, { type EventModalState } from './EventModal';
import GroupDetailPanel from './GroupDetailPanel';
import GroupEditModal from './GroupEditModal';
import { useCalendarGrid } from './schedulingCalendar/useCalendarGrid';
import CalendarWeekStrip from './schedulingCalendar/CalendarWeekStrip';
import { useSmoothWeekCarousel } from './schedulingCalendar/useSmoothWeekCarousel';
import { Dialog } from '../components/fz/Dialog';
import { Button } from '../components/fz/Button';
import { SegmentedControl } from '../components/fz/SegmentedControl';
import { IconPanelLeftClose, IconPanelLeftOpen } from '../components/fz/icons';
import SchedulingLinkPanel, {
    defaultLinkDraft,
    linkDraftFromSchedulingLink,
    type LinkDraft,
} from './schedulingCalendar/SchedulingLinkPanel';
import {
    CALENDAR_EVENTS_UPDATED_EVENT,
    normalizeCalendarEventDates,
    syncBookingsToCalendar,
} from '../lib/bookingCalendarSync';
import {
    fetchHostBookingsForCalendar,
    isSchedulingSlugAvailable,
    upsertSchedulingLink,
} from '../lib/schedulingApi';
import { newSchedulingLinkId } from '../lib/schedulingLinkId';

type Panel = 'none' | 'schedule-menu' | 'recurring' | 'oneoff';

const LEGACY_LINKS_KEY = 'focuznow_calendar_links';

type AllDayChip = { label: string; color: string };

function prepareStoredEvents(stored: CalendarEvent[]): CalendarEvent[] {
    const normalized = normalizeCalendarEventDates(
        stored.map((event) => ({ ...event, allDay: event.allDay ?? false })),
    );
    return migrateMaterializedCalendarSeries(normalized).events;
}

export default function SchedulingCalendarPage({
    fullscreen = false,
    onBack,
}: {
    fullscreen?: boolean;
    onBack?: () => void;
}) {
    const { session, engineState } = useAuthStore();
    const email = session?.user?.email || 'you@focuznow.com';
    const [hostProfile, setHostProfile] = useState<{
        displayName: string;
        username: string;
    } | null>(null);

    const displayName =
        hostProfile?.displayName?.trim() ||
        engineState.profileName?.trim() ||
        session?.user?.user_metadata?.full_name ||
        email.split('@')[0] ||
        'Host';

    useEffect(() => {
        if (!session?.user?.id) return;
        let cancelled = false;
        const tokens =
            session.access_token && session.refresh_token
                ? { access_token: session.access_token, refresh_token: session.refresh_token }
                : null;

        void (async () => {
            // Quiet fetch only — never upsert/sign-out just for opening Calendar.
            const profile = await fetchMyProfileQuiet(supabase, tokens);
            if (cancelled || !profile) return;
            setHostProfile({
                displayName: profile.displayName,
                username: profile.username,
            });
        })();
        return () => {
            cancelled = true;
        };
    }, [session?.user?.id, session?.access_token, session?.refresh_token]);

    const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
    const [dayDate, setDayDate] = useState(() => new Date());
    const [miniMonth, setMiniMonth] = useState(new Date());
    const [leftPanel, setLeftPanel] = useState<Panel>('none');
    const [rightPanel, setRightPanel] = useState<Panel>('none');
    const [calView, setCalView] = useState<CalendarView>('week');
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [miniCalCollapsed, setMiniCalCollapsed] = useState(false);
    const [schedulingCollapsed, setSchedulingCollapsed] = useState(false);
    const scheduleLinkBtnRef = useRef<HTMLButtonElement>(null);
    const [scheduleMenuPos, setScheduleMenuPos] = useState<{ top: number; left: number } | null>(null);
    const [draft, setDraft] = useState<LinkDraft>(() => defaultLinkDraft(displayName));
    const [dirty, setDirty] = useState(false);
    const [pendingPanel, setPendingPanel] = useState<Panel | null>(null);
    const [showDiscard, setShowDiscard] = useState(false);
    const [savedLinks, setSavedLinks] = useState<SchedulingLink[]>([]);
    const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [eventsLoaded, setEventsLoaded] = useState(false);
    const [groups, setGroups] = useState<CalendarGroup[]>(DEFAULT_CALENDAR_GROUPS());
    const [groupsLoaded, setGroupsLoaded] = useState(false);
    const [groupTombstones, setGroupTombstones] = useState<string[]>([]);
    const [copyNotice, setCopyNotice] = useState('');
    const [now, setNow] = useState(new Date());
    const [eventModal, setEventModal] = useState<EventModalState | null>(null);
    const [openGroupId, setOpenGroupId] = useState<string | null>(null);
    const [editingGroup, setEditingGroup] = useState<CalendarGroup | null>(null);
    const eventDragMovedRef = useRef(false);
    const eventPointerPendingRef = useRef<{
        ev: CalendarEvent;
        day: Date;
        dayIndex: number;
        startMin: number;
        startX: number;
        startY: number;
        pointerId: number;
    } | null>(null);
    const EVENT_DRAG_THRESHOLD_PX = 6;
    const grid = useCalendarGrid();
    const { viewportRef: weekPanRef, weeks, slideStyle, commitWeek } = useSmoothWeekCarousel(
        weekStart,
        setWeekStart,
        (ws) => setMiniMonth(ws),
    );
    const rightDragRef = useRef<{
        active: boolean;
        started: boolean;
        day?: Date;
        dayIndex?: number;
        clientY?: number;
    }>({ active: false, started: false });

    const today = new Date();
    const weekDays = useMemo(
        () => eachDayOfInterval({ start: weekStart, end: endOfWeek(weekStart) }),
        [weekStart],
    );
    const weekDaysRef = useRef(weekDays);
    useEffect(() => {
        weekDaysRef.current = weekDays;
    }, [weekDays]);

    // The now-line and its h:mm label only change once a minute, so update on minute
    // boundaries — a 1s tick re-rendered the whole calendar 60× a minute for nothing.
    useEffect(() => {
        let tick = 0;
        const align = window.setTimeout(() => {
            setNow(new Date());
            tick = window.setInterval(() => setNow(new Date()), 60_000);
        }, 60_000 - (Date.now() % 60_000) + 50);
        return () => {
            window.clearTimeout(align);
            window.clearInterval(tick);
        };
    }, []);

    const persistEventsRef = useRef<string>('');
    const applyingRemoteEventsRef = useRef(false);

    const reloadEventsFromStorage = useCallback(() => {
        chrome.storage.local.get([CALENDAR_EVENTS_KEY], (res) => {
            if (!Array.isArray(res[CALENDAR_EVENTS_KEY])) return;
            const loaded = prepareStoredEvents(res[CALENDAR_EVENTS_KEY] as CalendarEvent[]);
            const serialized = JSON.stringify(loaded);
            if (serialized === persistEventsRef.current) {
                setEventsLoaded(true);
                return;
            }
            applyingRemoteEventsRef.current = true;
            persistEventsRef.current = serialized;
            setEvents(loaded);
            setEventsLoaded(true);
        });
    }, []);

    useEffect(() => {
        if (!session?.user?.id) return;
        void (async () => {
            await supabase.auth.setSession({
                access_token: session.access_token,
                refresh_token: session.refresh_token,
            });
            chrome.storage.local.get([SCHEDULING_LINKS_KEY], (res) => {
                const links = res[SCHEDULING_LINKS_KEY] as SchedulingLink[] | undefined;
                if (Array.isArray(links) && links.length > 0) {
                    void syncAllSchedulingLinks(supabase, session.user.id, links);
                }
            });
            const bookings = await fetchHostBookingsForCalendar(supabase);
            if (bookings.length > 0) {
                await syncBookingsToCalendar(bookings);
                reloadEventsFromStorage();
            }
        })();
    }, [session?.user?.id, session?.access_token, session?.refresh_token, reloadEventsFromStorage]);

    useEffect(() => {
        const onStorage = (
            changes: Record<string, chrome.storage.StorageChange>,
            area: string,
        ) => {
            if (area === 'local' && changes[CALENDAR_EVENTS_KEY]) {
                reloadEventsFromStorage();
            }
        };
        const onBookingsSynced = () => reloadEventsFromStorage();
        chrome.storage.onChanged.addListener(onStorage);
        window.addEventListener(CALENDAR_EVENTS_UPDATED_EVENT, onBookingsSynced);
        return () => {
            chrome.storage.onChanged.removeListener(onStorage);
            window.removeEventListener(CALENDAR_EVENTS_UPDATED_EVENT, onBookingsSynced);
        };
    }, [reloadEventsFromStorage]);

    useEffect(() => {
        chrome.storage.local.get(
            [
                SCHEDULING_LINKS_KEY,
                LEGACY_LINKS_KEY,
                CALENDAR_EVENTS_KEY,
                CALENDAR_GROUPS_KEY,
                CALENDAR_GROUP_TOMBSTONES_KEY,
                SHOW_HOLIDAYS_KEY,
            ],
            (res) => {
                if (Array.isArray(res[SCHEDULING_LINKS_KEY])) {
                    setSavedLinks(res[SCHEDULING_LINKS_KEY] as SchedulingLink[]);
                } else if (Array.isArray(res[LEGACY_LINKS_KEY])) {
                    setSavedLinks(res[LEGACY_LINKS_KEY] as SchedulingLink[]);
                }
                if (Array.isArray(res[CALENDAR_EVENTS_KEY])) {
                    const raw = res[CALENDAR_EVENTS_KEY] as CalendarEvent[];
                    const loaded = prepareStoredEvents(raw);
                    const serialized = JSON.stringify(loaded);
                    persistEventsRef.current = serialized;
                    setEvents(loaded);
                    setEventsLoaded(true);
                    // Only rewrite storage when migration actually changed event shapes.
                    if (JSON.stringify(raw) !== serialized) {
                        chrome.storage.local.set({ [CALENDAR_EVENTS_KEY]: loaded });
                    }
                } else {
                    setEventsLoaded(true);
                }
                const tombstones = normalizeCalendarGroupTombstones(
                    res[CALENDAR_GROUP_TOMBSTONES_KEY],
                );
                setGroupTombstones(tombstones);
                setGroups(
                    mergeStoredCalendarGroups(
                        res[CALENDAR_GROUPS_KEY],
                        tombstones,
                        res[SHOW_HOLIDAYS_KEY],
                    ),
                );
                setGroupsLoaded(true);
            },
        );
    }, []);

    useEffect(() => {
        // Avoid wiping stored links with the initial empty state before load finishes.
        if (savedLinks.length === 0) {
            chrome.storage.local.get([SCHEDULING_LINKS_KEY], (res) => {
                if (Array.isArray(res[SCHEDULING_LINKS_KEY]) && res[SCHEDULING_LINKS_KEY].length > 0) return;
                chrome.storage.local.set({ [SCHEDULING_LINKS_KEY]: savedLinks });
            });
            return;
        }
        chrome.storage.local.set({ [SCHEDULING_LINKS_KEY]: savedLinks });
    }, [savedLinks]);

    useEffect(() => {
        if (!eventsLoaded) return;
        if (applyingRemoteEventsRef.current) {
            applyingRemoteEventsRef.current = false;
            return;
        }
        const serialized = JSON.stringify(events);
        if (serialized === persistEventsRef.current) return;
        persistEventsRef.current = serialized;
        chrome.storage.local.set({ [CALENDAR_EVENTS_KEY]: events });
    }, [events, eventsLoaded]);

    useEffect(() => {
        if (!groupsLoaded) return;
        chrome.storage.local.set({
            [CALENDAR_GROUPS_KEY]: groups,
            [CALENDAR_GROUP_TOMBSTONES_KEY]: groupTombstones,
        });
    }, [groupTombstones, groups, groupsLoaded]);

    const monthStart = startOfMonth(miniMonth);
    const miniGridStart = startOfWeek(monthStart);
    const miniGridEnd = endOfWeek(endOfMonth(monthStart));
    const miniDays = eachDayOfInterval({ start: miniGridStart, end: miniGridEnd });

    const { hourHeight, gridHeight } = grid;

    const gridViewportRef = useRef<HTMLDivElement>(null);
    const weekHighlights = weekHighlightSegments(miniDays, weekDays);

    const isGroupEnabled = (groupId?: string) => {
        if (!groupId) return true;
        return groups.find((g) => g.id === groupId)?.enabled ?? true;
    };

    const holidaysGroup = groups.find((g) => g.kind === 'holidays');
    const holidaysOn = holidaysGroup?.enabled ?? false;
    const holidaysColor = holidaysGroup?.color ?? '#22c55e';

    const visibleRange = useMemo(() => {
        if (calView === 'month') {
            return {
                start: startOfWeek(startOfMonth(miniMonth)),
                end: endOfWeek(endOfMonth(miniMonth)),
            };
        }
        const anchor = calView === 'day' ? startOfWeek(dayDate) : weekStart;
        return { start: addDays(anchor, -7), end: addDays(endOfWeek(anchor), 7) };
    }, [calView, dayDate, miniMonth, weekStart]);
    const visibleEvents = useMemo(
        () => expandCalendarEventsInRange(events, visibleRange.start, visibleRange.end),
        [events, visibleRange],
    );
    const visibleHolidays = useMemo(
        () => holidaysForRange(visibleRange.start, visibleRange.end),
        [visibleRange],
    );

    const timedEventsForDay = (day: Date) => {
        const ds = day.toDateString();
        return visibleEvents.filter((e) => e.date === ds && !e.allDay && isGroupEnabled(e.groupId));
    };

    // Week/day grid scrolls (fixed hour height). Open it on the working day —
    // from 8 AM, or earlier if it's early now or an event this week starts sooner.
    useEffect(() => {
        if (calView === 'month') return;
        const el = gridViewportRef.current;
        if (!el) return;
        const d = new Date();
        const h = d.getHours() + d.getMinutes() / 60;
        const days = calView === 'day' ? [dayDate] : weekDays;
        const earliest = Math.min(24, ...days.flatMap((day) => timedEventsForDay(day).map((ev) => ev.startHour)));
        const focusHour = Math.max(0, Math.min(h - 2, 8, earliest));
        // Leave a little headroom so the first hour label isn't clipped by the sticky header.
        el.scrollTop = Math.max(0, focusHour * hourHeight - 12);
        // Only on open, view switch and first load — never while events are edited or dragged.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [calView, hourHeight, eventsLoaded]);

    const allDayChipsForDay = (day: Date): AllDayChip[] => {
        const chips: AllDayChip[] = [];
        if (holidaysOn) {
            const hk = format(day, 'yyyy-MM-dd');
            const name = visibleHolidays[hk];
            if (name) chips.push({ label: name, color: holidaysColor });
        }
        const ds = day.toDateString();
        visibleEvents
            .filter((e) => e.date === ds && e.allDay && isGroupEnabled(e.groupId))
            .forEach((e) => chips.push({ label: e.title, color: colorForEvent(e, groups) }));
        return chips;
    };

    const openModalFromRange = (day: Date, startMin: number, endMin: number, editing?: CalendarEvent) => {
        const a = Math.min(startMin, endMin);
        const b = Math.max(startMin, endMin);
        const end = b <= a ? a + 30 : b;
        setEventModal({
            day,
            startHour: Math.floor(a / 60),
            startMin: a % 60,
            endHour: Math.floor(end / 60),
            endMin: end % 60,
            editing,
        });
    };

    const saveEvent = (
        ev: Omit<CalendarEvent, 'id'> & { id?: string },
        target: RecurrenceEditTarget = 'series',
    ) => {
        const color = colorForEvent({ ...ev, id: ev.id ?? '' } as CalendarEvent, groups);
        const generated = Boolean(ev.recurrenceMasterId && ev.occurrenceDate);
        const patch = {
            ...ev,
            color,
            id: ev.id ?? String(Date.now()),
            seriesId: ev.repeat && ev.repeat !== 'none'
                ? ev.seriesId ?? `series_${ev.id ?? Date.now()}`
                : undefined,
        } as CalendarEvent;

        if (generated && target === 'occurrence') {
            setEvents((prev) => {
                const masterIndex = prev.findIndex((event) => event.id === ev.recurrenceMasterId);
                if (masterIndex < 0) return prev;
                const master = prev[masterIndex];
                const next = [...prev];
                next[masterIndex] = withOccurrenceException(master, patch);
                next.push({
                    ...patch,
                    id: `event_${Date.now()}`,
                    repeat: 'none',
                    seriesId: undefined,
                    recurrenceWeekdays: undefined,
                    recurrenceExceptions: undefined,
                    recurrenceMasterId: undefined,
                    recurrenceMasterDate: undefined,
                    occurrenceDate: undefined,
                });
                return next;
            });
        } else if (ev.id) {
            const masterId = ev.recurrenceMasterId ?? ev.id;
            setEvents((prev) =>
                prev.map((event) => {
                    if (event.id === masterId) {
                        return {
                            ...event,
                            title: patch.title,
                            allDay: patch.allDay,
                            startHour: patch.startHour,
                            startMin: patch.startMin,
                            durationMin: patch.durationMin,
                            color: patch.color,
                            groupId: patch.groupId,
                            description: patch.description,
                            repeat: patch.repeat,
                            seriesId: patch.repeat && patch.repeat !== 'none'
                                ? event.seriesId ?? patch.seriesId ?? `series_${event.id}`
                                : undefined,
                            recurrenceWeekdays: patch.repeat === 'weekly'
                                ? patch.recurrenceWeekdays
                                : undefined,
                            recurrenceExceptions: patch.repeat && patch.repeat !== 'none'
                                ? event.recurrenceExceptions
                                : undefined,
                        };
                    }
                    return event;
                }),
            );
        } else {
            setEvents((prev) => [...prev, patch]);
        }
    };

    const deleteEvent = (event: CalendarEvent, target: RecurrenceEditTarget = 'occurrence') => {
        setEvents((prev) => {
            if (isGeneratedOccurrence(event) && target === 'occurrence') {
                return prev.map((candidate) =>
                    candidate.id === event.recurrenceMasterId
                        ? withOccurrenceException(candidate, event)
                        : candidate,
                );
            }
            const id = event.recurrenceMasterId ?? event.id;
            return prev.filter((candidate) => candidate.id !== id);
        });
        setEventModal((modal) => (modal?.editing?.id === event.id ? null : modal));
    };

    const dragSelectRef = useRef(grid.dragSelect);
    useEffect(() => {
        dragSelectRef.current = grid.dragSelect;
    }, [grid.dragSelect]);

    useEffect(() => {
        const onMove = (e: PointerEvent) => {
            if (rightDragRef.current.active && !rightDragRef.current.started) {
                const { day, dayIndex } = rightDragRef.current;
                if (day != null && dayIndex != null) {
                    grid.startDragSelect(day, dayIndex, e.clientY);
                    rightDragRef.current.started = true;
                }
            }
            const pending = eventPointerPendingRef.current;
            if (pending && !grid.dragEventRef.current) {
                const dx = e.clientX - pending.startX;
                const dy = e.clientY - pending.startY;
                if (
                    !isGeneratedOccurrence(pending.ev) &&
                    dx * dx + dy * dy >= EVENT_DRAG_THRESHOLD_PX * EVENT_DRAG_THRESHOLD_PX
                ) {
                    grid.startDragEvent(
                        pending.ev,
                        pending.dayIndex,
                        pending.startY,
                        pending.pointerId,
                    );
                    eventPointerPendingRef.current = null;
                }
            }
            if (dragSelectRef.current) {
                const idx = grid.dayIndexFromClientX(e.clientX);
                const dayIndex = idx >= 0 ? idx : dragSelectRef.current.dayIndex;
                const days = weekDaysRef.current;
                grid.updateDragSelect(dayIndex, e.clientY, days[dayIndex]);
            }
            if (grid.dragEventRef.current) {
                eventDragMovedRef.current = true;
                const move = grid.moveDragEvent(e.clientX, e.clientY);
                if (move) {
                    const days = weekDaysRef.current;
                    const day = days[move.dayIndex];
                    if (day) {
                        setEvents((prev) =>
                            prev.map((ev) =>
                                ev.id === move.eventId
                                    ? {
                                          ...ev,
                                          date: day.toDateString(),
                                          startHour: Math.floor(move.startMin / 60),
                                          startMin: move.startMin % 60,
                                      }
                                    : ev,
                            ),
                        );
                    }
                }
            }
        };
        const onUp = () => {
            if (rightDragRef.current.active) {
                const sel = dragSelectRef.current;
                grid.setDragSelect(null);
                if (
                    rightDragRef.current.started &&
                    sel &&
                    Math.abs(sel.endMin - sel.startMin) >= 10
                ) {
                    openModalFromRange(sel.day, sel.startMin, sel.endMin);
                }
                rightDragRef.current = { active: false, started: false };
                grid.endDragEvent();
                return;
            }
            const pending = eventPointerPendingRef.current;
            if (pending && !grid.dragEventRef.current && !eventDragMovedRef.current) {
                openModalFromRange(
                    pending.day,
                    pending.startMin,
                    pending.startMin + pending.ev.durationMin,
                    pending.ev,
                );
            }
            eventPointerPendingRef.current = null;
            eventDragMovedRef.current = false;

            const sel = dragSelectRef.current;
            if (sel) {
                grid.setDragSelect(null);
                openModalFromRange(sel.day, sel.startMin, sel.endMin);
            }
            grid.endDragEvent();
        };
        const onCtx = (e: Event) => {
            e.preventDefault();
            e.stopPropagation();
            grid.setDragSelect(null);
            rightDragRef.current = { active: false, started: false };
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('contextmenu', onCtx, true);
        return () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('contextmenu', onCtx, true);
        };
    }, [grid]);

    const updateGroup = (id: string, patch: Partial<CalendarGroup>) => {
        setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));
        if (patch.color) {
            setEvents((prev) => applyGroupColorToEvents(prev, id, patch.color!));
        }
    };

    const deleteGroup = (group: CalendarGroup) => {
        const eventCount = events.filter((event) => event.groupId === group.id).length;
        const detail = eventCount === 1 ? '1 event' : `${eventCount} events`;
        const message =
            group.kind === 'holidays'
                ? `Delete "${group.name}"? You can restore it only by resetting calendar settings.`
                : `Delete "${group.name}" and ${detail}? This cannot be undone.`;
        if (!window.confirm(message)) return false;
        setEvents((prev) => prev.filter((event) => event.groupId !== group.id));
        setGroups((prev) => prev.filter((candidate) => candidate.id !== group.id));
        if (group.kind === 'holidays') {
            setGroupTombstones((current) =>
                current.includes(group.id) ? current : [...current, group.id],
            );
        }
        setOpenGroupId((id) => (id === group.id ? null : id));
        setEditingGroup((editing) => (editing?.id === group.id ? null : editing));
        return true;
    };

    const openGroup = groups.find((g) => g.id === openGroupId);

    const openRight = (panel: 'recurring' | 'oneoff') => {
        if (dirty && rightPanel !== 'none' && rightPanel !== panel) {
            setPendingPanel(panel);
            setShowDiscard(true);
            return;
        }
        setEditingLinkId(null);
        setRightPanel(panel);
        const fresh = defaultLinkDraft(displayName);
        // Second link onward: suggest name-2, name-3… instead of a URL we already own.
        const taken = new Set(savedLinks.map((l) => l.slug));
        let slug = fresh.slug;
        for (let n = 2; taken.has(slug); n++) slug = `${fresh.slug}-${n}`;
        setDraft({ ...fresh, slug });
        setDirty(false);
    };

    const editSchedulingLink = (link: SchedulingLink) => {
        if (dirty) {
            setPendingPanel(link.type === 'recurring' ? 'recurring' : 'oneoff');
            setShowDiscard(true);
            return;
        }
        setEditingLinkId(link.id);
        setDraft(linkDraftFromSchedulingLink(link));
        setRightPanel(link.type === 'recurring' ? 'recurring' : 'oneoff');
        setDirty(false);
        setLeftPanel('none');
    };

    const requestCloseRight = () => {
        if (dirty) {
            setPendingPanel('none');
            setShowDiscard(true);
            return;
        }
        setRightPanel('none');
    };

    const confirmDiscard = () => {
        setShowDiscard(false);
        setEditingLinkId(null);
        setDirty(false);
        setDraft(defaultLinkDraft(displayName));
        if (pendingPanel === 'none') {
            setRightPanel('none');
            setLeftPanel('none');
        } else if (pendingPanel === 'recurring' || pendingPanel === 'oneoff') {
            setRightPanel(pendingPanel);
        }
        setPendingPanel(null);
    };

    const saveLink = async () => {
        if (!draft.title.trim()) return;
        const type = rightPanel === 'recurring' ? 'recurring' : 'oneoff';
        const existing = editingLinkId ? savedLinks.find((l) => l.id === editingLinkId) : undefined;
        const slug = (
            draft.slug.trim() ||
            existing?.slug ||
            `${draft.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Date.now().toString(36).slice(-4)}` ||
            'link'
        ).toLowerCase();

        if (session?.user?.id) {
            const slugCheck = await isSchedulingSlugAvailable(supabase, slug, existing?.id);
            if (!slugCheck.available) {
                setCopyNotice(slugCheck.error || `Slug "${slug}" is already taken. Choose another in Customize link.`);
                return;
            }
        }
        const expiresAt =
            draft.linkExpires && draft.expiresAt
                ? new Date(draft.expiresAt).toISOString()
                : undefined;

        const weekdayAvailability: Record<number, WeekdayAvailability> = {};
        Object.entries(draft.weekdaySlots).forEach(([dow, slot]) => {
            const [startH, startM] = slot.start.split(':').map((n) => parseInt(n, 10) || 0);
            const [endH, endM] = slot.end.split(':').map((n) => parseInt(n, 10) || 0);
            weekdayAvailability[parseInt(dow, 10)] = {
                startHour: startH,
                startMin: startM,
                endHour: endH,
                endMin: endM,
            };
        });

        const activeDays = Object.keys(draft.weekdaySlots).map((k) => parseInt(k, 10));
        const recurringDays =
            activeDays.length > 0
                ? activeDays
                : draft.repeatWeekdays.length
                  ? draft.repeatWeekdays
                  : [1, 2, 3, 4, 5];

        const oneoffDays = new Set<number>(recurringDays);
        draft.pickedDates.forEach((key) => {
            oneoffDays.add(new Date(`${key}T12:00:00`).getDay());
        });

        const first = recurringDays[0] ?? 1;
        const slot = draft.weekdaySlots[first] ?? { start: '09:00', end: '17:00' };
        const [startH, startM] = slot.start.split(':').map((n) => parseInt(n, 10) || 0);
        const [endH, endM] = slot.end.split(':').map((n) => parseInt(n, 10) || 0);

        const dateSlotsComplete: Record<string, { start: string; end: string }> = { ...draft.dateSlots };
        draft.pickedDates.forEach((key) => {
            if (!dateSlotsComplete[key]) {
                dateSlotsComplete[key] = draft.weekdaySlots[new Date(`${key}T12:00:00`).getDay()] ?? {
                    start: '09:00',
                    end: '17:00',
                };
            }
        });

        const link: SchedulingLink = {
            id: existing?.id ?? newSchedulingLinkId(),
            type,
            title: draft.title.trim(),
            slug,
            durationMin: draft.durationMin || 30,
            bufferMin: 0,
            availability: {
                days: type === 'recurring' ? recurringDays : [...oneoffDays],
                startHour: startH,
                startMin: startM,
                endHour: endH,
                endMin: endM,
            },
            weekdayAvailability:
                Object.keys(weekdayAvailability).length > 0 ? weekdayAvailability : undefined,
            specificDates: type === 'oneoff' && draft.pickedDates.length ? draft.pickedDates : undefined,
            dateAvailability:
                type === 'oneoff' && draft.pickedDates.length
                    ? buildDateAvailability(dateSlotsComplete)
                    : undefined,
            timezone: draft.timezone,
            singleUse: draft.singleUse,
            expiresAt,
            hostName: displayName,
            hostEmail: email,
            description: draft.description.trim() || undefined,
            locationType: draft.locationType,
            locationValue: draft.locationValue.trim() || undefined,
            bookingNoticeHours: draft.bookingNoticeHours,
            bookingWindowDays: draft.bookingWindowDays,
            createdAt: existing?.createdAt ?? new Date().toISOString(),
        };

        setSavedLinks((prev) =>
            existing ? prev.map((l) => (l.id === existing.id ? link : l)) : [...prev, link],
        );
        setEditingLinkId(null);
        setDirty(false);
        setDraft(defaultLinkDraft(displayName));
        setRightPanel('none');

        const url = bookingUrl(link.slug);
        void navigator.clipboard.writeText(url);

        if (session?.user?.id) {
            await supabase.auth.setSession({
                access_token: session.access_token,
                refresh_token: session.refresh_token,
            });
            const sync = await upsertSchedulingLink(supabase, session.user.id, link);
            if (sync.ok) {
                if (sync.linkId && sync.linkId !== link.id) {
                    setSavedLinks((prev) =>
                        prev.map((l) => (l.id === link.id ? { ...l, id: sync.linkId! } : l)),
                    );
                }
                setCopyNotice(
                    `${existing ? 'Updated' : 'Created'} link — copied ${bookingUrl(slug)}`,
                );
            } else {
                setCopyNotice(
                    `Link saved locally. Copy: ${url} (cloud sync failed: ${sync.error ?? 'unknown'})`,
                );
            }
        } else {
            setCopyNotice(`Created link locally — sign in to share: ${url}`);
        }
    };

    const copySchedulingUrl = (link: SchedulingLink) => {
        const url = bookingUrl(link.slug);
        void navigator.clipboard.writeText(url).then(() => setCopyNotice('Link copied to clipboard'));
    };

    const previewSchedulingUrl = (link: SchedulingLink) => {
        const base = chrome.runtime.getURL('src/booking/index.html');
        window.open(`${base}?slug=${encodeURIComponent(link.slug)}`, '_blank');
    };

    const goToday = () => {
        const t = new Date();
        setWeekStart(startOfWeek(t));
        setDayDate(t);
        setMiniMonth(t);
    };

    const shiftDay = (dir: 1 | -1) => {
        setDayDate((d) => {
            const next = addDays(d, dir);
            setWeekStart(startOfWeek(next));
            setMiniMonth(next);
            return next;
        });
    };

    const navBack = () => (calView === 'day' ? shiftDay(-1) : commitWeek(-1));
    const navForward = () => (calView === 'day' ? shiftDay(1) : commitWeek(1));

    const openScheduleMenu = () => {
        const el = scheduleLinkBtnRef.current;
        if (!el) {
            setLeftPanel((p) => (p === 'schedule-menu' ? 'none' : 'schedule-menu'));
            return;
        }
        if (leftPanel === 'schedule-menu') {
            setLeftPanel('none');
            setScheduleMenuPos(null);
            return;
        }
        const rect = el.getBoundingClientRect();
        setScheduleMenuPos({
            top: rect.top,
            left: Math.min(rect.right + 8, window.innerWidth - 252),
        });
        setLeftPanel('schedule-menu');
    };

    const openSlotAtY = (day: Date, dayIndex: number, clientY: number, durationMin = 30) => {
        const startMin = grid.minFromClientY(dayIndex, clientY);
        const snapped = Math.floor(startMin / 15) * 15;
        openModalFromRange(day, snapped, snapped + durationMin);
    };

    const iconBtn =
        'flex size-7 shrink-0 items-center justify-center rounded-md text-[var(--fz-text-3)] transition-colors hover:bg-[var(--fz-bg-hover)] hover:text-[var(--fz-text-1)] focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--fz-focus-ring)]';
    const eyebrow = 'text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--fz-text-4)]';

    /** Toolbar "New event": next full hour today, else 9:00 on the first visible day. */
    const createEventNow = () => {
        const base =
            calView === 'day'
                ? dayDate
                : weekDays.some((d) => isSameDay(d, today))
                  ? today
                  : weekStart;
        const startMin = isSameDay(base, today) ? Math.min(23 * 60, (today.getHours() + 1) * 60) : 9 * 60;
        openModalFromRange(base, startMin, startMin + 60);
    };

    const weekEnd = addDays(weekStart, 6);
    const headerEyebrow =
        calView === 'week'
            ? `Week ${format(addDays(weekStart, 1), 'I')} · ${format(weekStart, 'MMM d')} – ${format(weekEnd, isSameMonth(weekStart, weekEnd) ? 'd' : 'MMM d')}`
            : calView === 'day'
              ? isSameDay(dayDate, today)
                  ? 'Today'
                  : format(dayDate, 'yyyy')
              : format(miniMonth, 'yyyy');
    const headerTitle =
        calView === 'day'
            ? format(dayDate, 'EEEE, MMMM d')
            : calView === 'month'
              ? format(miniMonth, 'MMMM')
              : format(weekStart, 'MMMM yyyy');
    const card =
        'rounded-[10px] border border-[var(--fz-border)] bg-[var(--fz-bg-raised)] shadow-[var(--fz-elev-card)]';

    return (
        <div
            className={`focuznow-calendar @container/cal relative flex flex-col ${
                fullscreen ? 'h-full w-full gap-5 px-6 pb-6 pt-5' : 'h-[calc(100vh-8rem)] min-h-[640px] gap-4'
            }`}
        >
            {/* Page header — same rhythm as PageShell (eyebrow + title-1, actions level with it). */}
            <header className="flex shrink-0 items-center justify-between gap-x-4 gap-y-3">
                <div className="flex min-w-0 items-center gap-3">
                    {onBack && (
                        <button
                            type="button"
                            onClick={onBack}
                            className="flex h-8 items-center gap-1.5 rounded-md px-2 text-[13px] font-medium text-[var(--fz-text-3)] transition-colors hover:bg-[var(--fz-bg-hover)] hover:text-[var(--fz-text-1)]"
                        >
                            <ArrowLeft size={14} strokeWidth={1.75} />
                            Back
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => setSidebarCollapsed((v) => !v)}
                        className="sb-icon-btn"
                        aria-label={sidebarCollapsed ? 'Show calendars panel' : 'Hide calendars panel'}
                        title={sidebarCollapsed ? 'Show calendars panel' : 'Hide calendars panel'}
                    >
                        {sidebarCollapsed ? <IconPanelLeftOpen /> : <IconPanelLeftClose />}
                    </button>
                    <div className="min-w-0">
                        <p className="text-meta truncate text-[var(--fz-text-3)]">{headerEyebrow}</p>
                        <h1 className="text-title-1 mt-0.5 truncate text-[var(--fz-text-1)]">{headerTitle}</h1>
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <div className="flex h-8 items-center rounded-lg border border-[var(--fz-border)] bg-[var(--fz-bg-raised)] p-0.5" style={{ boxShadow: 'var(--fz-edge)' }}>
                        <button type="button" onClick={navBack} className={`${iconBtn} size-7`} aria-label="Previous">
                            <ChevronLeft size={15} strokeWidth={1.75} />
                        </button>
                        <button
                            type="button"
                            onClick={goToday}
                            className="h-7 rounded-md px-2.5 text-[12.5px] font-medium text-[var(--fz-text-2)] transition-colors hover:bg-[var(--fz-bg-hover)] hover:text-[var(--fz-text-1)]"
                        >
                            Today
                        </button>
                        <button type="button" onClick={navForward} className={`${iconBtn} size-7`} aria-label="Next">
                            <ChevronRight size={15} strokeWidth={1.75} />
                        </button>
                    </div>
                    <SegmentedControl
                        size="sm"
                        idPrefix="cal-view"
                        value={calView}
                        onChange={(v) => {
                            setCalView(v);
                            if (v === 'day') {
                                const inCurrentWeek = weekDays.some((d) => isSameDay(d, today));
                                const target = inCurrentWeek ? today : weekStart;
                                setDayDate(target);
                                setWeekStart(startOfWeek(target));
                            }
                        }}
                        options={[
                            { value: 'day', label: 'Day' },
                            { value: 'week', label: 'Week' },
                            { value: 'month', label: 'Month' },
                        ]}
                    />
                    <Button
                        variant="primary"
                        size="sm"
                        iconLeft={<Plus size={14} strokeWidth={2} />}
                        onClick={createEventNow}
                        aria-label="New event"
                        title="New event"
                    >
                        <span className="@max-[760px]/cal:hidden">New event</span>
                    </Button>
                </div>
            </header>

            <div className="flex min-h-0 flex-1">
                {/* Calendars panel */}
                <aside
                    className={`flex shrink-0 flex-col overflow-hidden transition-[width,margin,opacity] duration-200 ${card} ${
                        sidebarCollapsed ? 'mr-0 w-0 border-0 opacity-0' : 'mr-4 w-[260px] opacity-100'
                    }`}
                    aria-hidden={sidebarCollapsed || undefined}
                >
                    <div className="flex h-full w-[258px] flex-col">
                        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-hide pb-3">
                            {/* Mini month */}
                            <div className="px-3 pb-3 pt-3">
                                <div className="mb-1.5 flex items-center justify-between pl-1">
                                    <button
                                        type="button"
                                        onClick={() => setMiniCalCollapsed((v) => !v)}
                                        className="flex items-center gap-1 text-[13px] font-medium text-[var(--fz-text-1)]"
                                        aria-expanded={!miniCalCollapsed}
                                    >
                                        {format(miniMonth, 'MMMM yyyy')}
                                        <ChevronDown
                                            size={13}
                                            strokeWidth={1.75}
                                            className={`text-[var(--fz-text-4)] transition-transform ${miniCalCollapsed ? '-rotate-90' : ''}`}
                                        />
                                    </button>
                                    {!miniCalCollapsed && (
                                        <div className="flex items-center">
                                            <button
                                                type="button"
                                                onClick={() => setMiniMonth((m) => addDays(startOfMonth(m), -1))}
                                                className={iconBtn}
                                                aria-label="Previous month"
                                            >
                                                <ChevronLeft size={14} strokeWidth={1.75} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setMiniMonth((m) => addDays(endOfMonth(m), 1))}
                                                className={iconBtn}
                                                aria-label="Next month"
                                            >
                                                <ChevronRight size={14} strokeWidth={1.75} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                                {!miniCalCollapsed && (
                                    <>
                                        <div className="mb-0.5 grid grid-cols-7 gap-0.5 text-center text-[10.5px] font-medium text-[var(--fz-text-4)]">
                                            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                                                <span key={i} className="py-1">
                                                    {d}
                                                </span>
                                            ))}
                                        </div>
                                        <div className="relative grid grid-cols-7 gap-0.5">
                                            {calView !== 'month' &&
                                                weekHighlights.map((seg, i) => (
                                                    <div
                                                        key={`wh-${i}`}
                                                        className="pointer-events-none absolute rounded-lg bg-[var(--fz-bg-active)]"
                                                        style={{
                                                            top: `calc(${seg.row} * (1.75rem + 2px))`,
                                                            left: `calc(${(seg.colStart / 7) * 100}% + 1px)`,
                                                            width: `calc(${(seg.colSpan / 7) * 100}% - 2px)`,
                                                            height: '1.75rem',
                                                        }}
                                                    />
                                                ))}
                                            {miniDays.map((day) => {
                                                const inMonth = isSameMonth(day, miniMonth);
                                                const isToday = isSameDay(day, today);
                                                const inWeek = weekDays.some((w) => isSameDay(w, day));
                                                return (
                                                    <button
                                                        key={day.toISOString()}
                                                        type="button"
                                                        onClick={() => {
                                                            setWeekStart(startOfWeek(day));
                                                            setMiniMonth(day);
                                                            setDayDate(day);
                                                        }}
                                                        className={`relative z-[1] flex h-7 items-center justify-center rounded-lg text-[12px] tabular-nums transition-colors ${
                                                            isToday
                                                                ? 'bg-[var(--fz-accent)] font-semibold text-[var(--fz-accent-fg)]'
                                                                : `hover:bg-[var(--fz-bg-hover)] ${
                                                                      !inMonth
                                                                          ? 'text-[var(--fz-text-4)] opacity-60'
                                                                          : inWeek && calView !== 'month'
                                                                            ? 'font-medium text-[var(--fz-text-1)]'
                                                                            : 'text-[var(--fz-text-2)]'
                                                                  }`
                                                        }`}
                                                    >
                                                        {format(day, 'd')}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="mx-3 h-px bg-[var(--fz-border)]" />

                            {/* Scheduling links */}
                            <div className="px-2 py-2">
                                <div className="flex h-8 items-center justify-between pl-2 pr-1">
                                    <button
                                        type="button"
                                        onClick={() => setSchedulingCollapsed((v) => !v)}
                                        className={`flex items-center gap-1 ${eyebrow} hover:text-[var(--fz-text-2)]`}
                                        aria-expanded={!schedulingCollapsed}
                                    >
                                        Scheduling links
                                        <ChevronDown
                                            size={12}
                                            strokeWidth={1.75}
                                            className={`transition-transform ${schedulingCollapsed ? '-rotate-90' : ''}`}
                                        />
                                    </button>
                                    <button
                                        ref={scheduleLinkBtnRef}
                                        type="button"
                                        onClick={openScheduleMenu}
                                        className={iconBtn}
                                        aria-label="New scheduling link"
                                        title="New scheduling link"
                                    >
                                        <Plus size={14} strokeWidth={1.75} />
                                    </button>
                                </div>
                                {!schedulingCollapsed &&
                                    (savedLinks.length === 0 ? (
                                        <button
                                            type="button"
                                            onClick={openScheduleMenu}
                                            className="flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] text-[var(--fz-text-3)] hover:bg-[var(--fz-bg-hover)] hover:text-[var(--fz-text-1)]"
                                        >
                                            <Link2 size={14} strokeWidth={1.75} className="text-[var(--fz-text-4)]" />
                                            Create a booking link
                                        </button>
                                    ) : (
                                        <div className="space-y-px">
                                            {savedLinks.map((l) => (
                                                <div
                                                    key={l.id}
                                                    className="group/link flex h-8 items-center gap-2 rounded-lg pl-2 pr-1 transition-colors hover:bg-[var(--fz-bg-hover)]"
                                                >
                                                    <Link2 size={14} strokeWidth={1.75} className="shrink-0 text-[var(--fz-text-4)]" />
                                                    <button
                                                        type="button"
                                                        onClick={() => copySchedulingUrl(l)}
                                                        className="min-w-0 flex-1 truncate text-left text-[13px] text-[var(--fz-text-2)] group-hover/link:text-[var(--fz-text-1)]"
                                                        title="Copy link"
                                                    >
                                                        {l.title}
                                                    </button>
                                                    <span className="flex shrink-0 items-center opacity-0 transition-opacity group-hover/link:opacity-100 focus-within:opacity-100">
                                                        <button type="button" onClick={() => copySchedulingUrl(l)} className={iconBtn} aria-label="Copy link" title="Copy link">
                                                            <Copy size={12.5} strokeWidth={1.75} />
                                                        </button>
                                                        <button type="button" onClick={() => editSchedulingLink(l)} className={iconBtn} aria-label="Edit link" title="Edit">
                                                            <Pencil size={12.5} strokeWidth={1.75} />
                                                        </button>
                                                        <button type="button" onClick={() => previewSchedulingUrl(l)} className={iconBtn} aria-label="Open booking page" title="Open booking page">
                                                            <ArrowUpRight size={13} strokeWidth={1.75} />
                                                        </button>
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                            </div>

                            <div className="mx-3 h-px bg-[var(--fz-border)]" />

                            <div className="px-2 py-2">
                                <CalendarGroupsPanel
                                    groups={groups}
                                    openGroupId={openGroupId}
                                    onOpenGroup={setOpenGroupId}
                                    onChange={setGroups}
                                    onEditGroup={setEditingGroup}
                                    onDeleteGroup={deleteGroup}
                                />
                            </div>
                        </div>

                        <div className="shrink-0 border-t border-[var(--fz-border)] px-4 py-2.5">
                            <p className="truncate text-[11.5px] text-[var(--fz-text-4)]" title={email}>
                                {email}
                            </p>
                        </div>
                    </div>
                </aside>

                <AnimatePresence>
                    {openGroup && (
                        <GroupDetailPanel
                            group={openGroup}
                            events={events}
                            holidayRange={visibleRange}
                            onClose={() => setOpenGroupId(null)}
                            onEdit={() => setEditingGroup(openGroup)}
                            onDeleteGroup={() => deleteGroup(openGroup)}
                            onAddEvent={() => {
                                setEventModal({
                                    day: new Date(),
                                    startHour: 9,
                                    startMin: 0,
                                    endHour: 10,
                                    endMin: 0,
                                    defaultGroupId: openGroup.kind === 'custom' ? openGroup.id : undefined,
                                });
                            }}
                            onEditEvent={(ev) => {
                                openModalFromRange(
                                    new Date(ev.date),
                                    ev.startHour * 60 + ev.startMin,
                                    ev.startHour * 60 + ev.startMin + ev.durationMin,
                                    ev,
                                );
                            }}
                            onDeleteEvent={(ev) => deleteEvent(ev, 'series')}
                        />
                    )}
                </AnimatePresence>

                <section
                    ref={weekPanRef}
                    className={`relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${card}`}
                >

                    {copyNotice && (
                        <div
                            className="pointer-events-none absolute bottom-5 left-1/2 z-40 -translate-x-1/2 rounded-lg border border-[var(--fz-border)] bg-[var(--fz-bg-overlay)] px-3 py-1.5 text-[12.5px] text-[var(--fz-text-1)]"
                            style={{ boxShadow: 'var(--fz-shadow-overlay)' }}
                            role="status"
                        >
                            {copyNotice}
                        </div>
                    )}

                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                        {calView === 'month' ? (
                            /* Month view */
                            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                                <div className="grid shrink-0 grid-cols-7 border-b border-[var(--fz-border)]">
                                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                                        <div key={d} className={`px-2.5 py-2 ${eyebrow}`}>
                                            {d}
                                        </div>
                                    ))}
                                </div>
                                <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-7">
                                    {eachDayOfInterval({
                                        start: startOfWeek(startOfMonth(miniMonth)),
                                        end: endOfWeek(endOfMonth(miniMonth)),
                                    }).map((day, i) => {
                                        const inMonth = isSameMonth(day, miniMonth);
                                        const isToday = isSameDay(day, today);
                                        const dayEvents = timedEventsForDay(day);
                                        const allDayChips = allDayChipsForDay(day);
                                        const total = dayEvents.length + allDayChips.length;
                                        const shownChips = allDayChips.slice(0, 3);
                                        const shownEvents = dayEvents.slice(0, Math.max(0, 3 - shownChips.length));
                                        return (
                                            <div
                                                key={day.toISOString()}
                                                onClick={() => {
                                                    setWeekStart(startOfWeek(day));
                                                    setMiniMonth(day);
                                                    setDayDate(day);
                                                    setCalView('day');
                                                }}
                                                onDoubleClick={() => {
                                                    setWeekStart(startOfWeek(day));
                                                    setMiniMonth(day);
                                                    openModalFromRange(day, 9 * 60, 10 * 60);
                                                }}
                                                className={`group/cell min-h-[104px] cursor-pointer border-b border-[var(--fz-border)] p-1.5 transition-colors hover:bg-[var(--fz-bg-hover)] ${
                                                    i % 7 === 0 ? '' : 'border-l'
                                                }`}
                                                style={
                                                    inMonth
                                                        ? undefined
                                                        : { backgroundColor: 'color-mix(in oklch, var(--fz-text-1) 1.5%, transparent)' }
                                                }
                                            >
                                                <span
                                                    className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[12px] font-medium tabular-nums ${
                                                        isToday
                                                            ? 'bg-[var(--fz-accent)] text-[var(--fz-accent-fg)]'
                                                            : inMonth
                                                              ? 'text-[var(--fz-text-2)]'
                                                              : 'text-[var(--fz-text-4)]'
                                                    }`}
                                                >
                                                    {format(day, day.getDate() === 1 ? 'MMM d' : 'd')}
                                                </span>
                                                <div className={`mt-1 space-y-0.5 ${inMonth ? '' : 'opacity-60'}`}>
                                                    {shownChips.map((chip, ci) => (
                                                        <div
                                                            key={ci}
                                                            className="cal-chip flex h-5 items-center gap-1.5 overflow-hidden rounded-md pr-1.5"
                                                            style={{ '--ev': chip.color } as CSSProperties}
                                                        >
                                                            <span className="h-full w-[3px] shrink-0" style={{ backgroundColor: chip.color }} />
                                                            <span className="truncate text-[11.5px] font-medium text-[var(--fz-text-1)]">{chip.label}</span>
                                                        </div>
                                                    ))}
                                                    {shownEvents.map((ev) => {
                                                        const c = colorForEvent(ev, groups);
                                                        return (
                                                            <div
                                                                key={ev.id}
                                                                className="flex h-5 items-center gap-1.5 rounded-md px-1 text-[11.5px] hover:bg-[var(--fz-bg-active)]"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    openModalFromRange(
                                                                        new Date(ev.date),
                                                                        ev.startHour * 60 + ev.startMin,
                                                                        ev.startHour * 60 + ev.startMin + ev.durationMin,
                                                                        ev,
                                                                    );
                                                                }}
                                                            >
                                                                <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: c }} />
                                                                <span className="shrink-0 tabular-nums text-[var(--fz-text-3)]">
                                                                    {format(new Date(2000, 0, 1, ev.startHour, ev.startMin), ev.startMin ? 'h:mma' : 'ha').toLowerCase()}
                                                                </span>
                                                                <span className="truncate text-[var(--fz-text-1)]">{ev.title}</span>
                                                            </div>
                                                        );
                                                    })}
                                                    {total > shownChips.length + shownEvents.length && (
                                                        <div className="px-1 text-[11px] font-medium text-[var(--fz-text-3)]">
                                                            +{total - shownChips.length - shownEvents.length} more
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            /* Week / day view — one vertical scroller; day headers stick inside it */
                            <div ref={gridViewportRef} className="cal-scroll relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
                                <div style={{ ...slideStyle, height: 'auto', minHeight: '100%' }}>
                                    {weeks.map((ws, weekIdx) => (
                                        <CalendarWeekStrip
                                            key={ws.toISOString()}
                                            weekStart={ws}
                                            interactive={weekIdx === 1}
                                            today={today}
                                            now={now}
                                            hourHeight={hourHeight}
                                            gridHeight={gridHeight}
                                            grid={grid}
                                            groups={groups}
                                            timedEventsForDay={timedEventsForDay}
                                            allDayChipsForDay={allDayChipsForDay}
                                            singleDayMode={calView === 'day' ? addDays(ws, getDay(dayDate)) : undefined}
                                            onRightPointerDown={(day, dayIndex, clientY) => {
                                                rightDragRef.current = { active: true, started: false, day, dayIndex, clientY };
                                            }}
                                            onEmptyDoubleClick={(day, dayIndex, clientY) => {
                                                openSlotAtY(day, dayIndex, clientY, 30);
                                            }}
                                            onDeleteEvent={(ev) => deleteEvent(ev)}
                                            onEventPointerDown={(ev, day, dayIndex, startMin, e) => {
                                                eventDragMovedRef.current = false;
                                                eventPointerPendingRef.current = {
                                                    ev,
                                                    day,
                                                    dayIndex,
                                                    startMin,
                                                    startX: e.clientX,
                                                    startY: e.clientY,
                                                    pointerId: e.pointerId,
                                                };
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </section>
            </div>

            <AnimatePresence>
                {leftPanel === 'schedule-menu' && scheduleMenuPos && (
                    <motion.div
                        key="schedule-link-chooser-portal"
                        className="fixed inset-0 z-[40]"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.12 }}
                    >
                        <button
                            type="button"
                            aria-label="Close"
                            className="absolute inset-0 cursor-default"
                            onClick={() => {
                                setLeftPanel('none');
                                setScheduleMenuPos(null);
                            }}
                        />
                        <motion.div
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="schedule-link-type-title"
                            initial={{ opacity: 0, x: -6, scale: 0.98 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, x: -4, scale: 0.98 }}
                            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                            className="absolute w-[256px] rounded-xl border border-[var(--fz-border)] bg-[var(--fz-bg-overlay)] p-1.5"
                            style={{
                                top: scheduleMenuPos.top,
                                left: scheduleMenuPos.left,
                                boxShadow: 'var(--fz-shadow-overlay)',
                            }}
                        >
                            <div className="flex items-center justify-between pb-2 pl-1.5">
                                <h2 id="schedule-link-type-title" className="text-[13px] font-semibold text-[var(--fz-text-1)]">
                                    New booking link
                                </h2>
                                <button
                                    type="button"
                                    aria-label="Close"
                                    onClick={() => {
                                        setLeftPanel('none');
                                        setScheduleMenuPos(null);
                                    }}
                                    className={iconBtn}
                                >
                                    <X size={14} />
                                </button>
                            </div>
                            {(
                                [
                                    { panel: 'recurring', icon: Repeat, label: 'Recurring', hint: 'Same hours every week' },
                                    { panel: 'oneoff', icon: CalendarDays, label: 'One-off', hint: 'Only on dates you pick' },
                                ] as const
                            ).map(({ panel, icon: Icon, label, hint }) => (
                                <button
                                    key={panel}
                                    type="button"
                                    onClick={() => {
                                        openRight(panel);
                                        setLeftPanel('none');
                                        setScheduleMenuPos(null);
                                    }}
                                    className="flex w-full items-center gap-3 rounded-lg px-1.5 py-2 text-left transition-colors hover:bg-[var(--fz-bg-hover)]"
                                >
                                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-[var(--fz-border)] bg-[var(--fz-bg-raised)] text-[var(--fz-text-2)]">
                                        <Icon size={15} strokeWidth={1.75} />
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block text-[13px] font-medium text-[var(--fz-text-1)]">{label}</span>
                                        <span className="text-meta block">{hint}</span>
                                    </span>
                                </button>
                            ))}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {(rightPanel === 'recurring' || rightPanel === 'oneoff') && (
                <SchedulingLinkPanel
                    mode={rightPanel}
                    draft={draft}
                    onChange={(d) => {
                        setDraft(d);
                        setDirty(true);
                    }}
                    onClose={requestCloseRight}
                    onCreate={saveLink}
                    hostEmail={email}
                    previewSlug={`${draft.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'meeting'}-preview`}
                    groups={groups}
                    editingLinkId={editingLinkId}
                />
            )}

            {eventModal && (
                <EventModal
                    state={eventModal}
                    groups={groups}
                    onClose={() => setEventModal(null)}
                    onSave={saveEvent}
                    onDelete={
                        eventModal.editing
                            ? (target) => deleteEvent(eventModal.editing!, target)
                            : undefined
                    }
                />
            )}

            {editingGroup && (
                <GroupEditModal
                    group={editingGroup}
                    onClose={() => setEditingGroup(null)}
                    onSave={(patch) => updateGroup(editingGroup.id, patch)}
                    onDelete={
                        () => deleteGroup(editingGroup)
                    }
                />
            )}

            <Dialog
                open={showDiscard}
                onClose={() => setShowDiscard(false)}
                title="Discard changes?"
                size="sm"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setShowDiscard(false)}>Keep editing</Button>
                        <Button variant="danger-solid" onClick={confirmDiscard}>Discard</Button>
                    </>
                }
            >
                <p className="text-body-sm text-[var(--fz-text-2)]">You have unsaved edits. Discard them and continue?</p>
            </Dialog>
        </div>
    );
}

