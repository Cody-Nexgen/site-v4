import { useCallback, useEffect, useRef, useState } from 'react';
import {
    addDays,
    eachDayOfInterval,
    endOfMonth,
    endOfWeek,
    format,
    isSameDay,
    isSameMonth,
    startOfMonth,
    startOfWeek,
} from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ChevronLeft, ChevronRight, ChevronDown, Link2, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

type CalendarView = 'day' | 'week' | 'month';
import { useAuthStore } from '../lib/store';
import { buildUsHolidays } from '../lib/usHolidays';
import {
    buildDateAvailability,
    syncAllSchedulingLinks,
} from '../lib/schedulingApi';
import { supabase } from '../lib/supabase';
import {
    fetchMyProfile,
    suggestUsername,
    syncProfileWithAvailableUsername,
} from '../lib/profileApi';
import {
    bookingUrl,
    CALENDAR_EVENTS_KEY,
    CALENDAR_GROUPS_KEY,
    DEFAULT_CALENDAR_GROUPS,
    SCHEDULING_LINKS_KEY,
    SHOW_HOLIDAYS_KEY,
    type CalendarEvent,
    type CalendarGroup,
    type SchedulingLink,
    type WeekdayAvailability,
} from '../lib/schedulingTypes';
import { weekHighlightSegments } from '../lib/calendarUtils';
import { applyGroupColorToEvents, colorForEvent } from '../lib/eventColors';
import CalendarGroupsPanel from './CalendarGroupsPanel';
import EventModal, { type EventModalState } from './EventModal';
import GroupDetailPanel from './GroupDetailPanel';
import GroupEditModal from './GroupEditModal';
import { useCalendarGrid } from './schedulingCalendar/useCalendarGrid';
import CalendarWeekStrip from './schedulingCalendar/CalendarWeekStrip';
import { useSmoothWeekCarousel } from './schedulingCalendar/useSmoothWeekCarousel';
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
const HOLIDAYS = buildUsHolidays(2024, 2028);

type AllDayChip = { label: string; color: string };

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
            let profile = await fetchMyProfile(supabase, tokens);
            if (cancelled) return;
            if (!profile && tokens) {
                await syncProfileWithAvailableUsername(
                    supabase,
                    session.user.id,
                    {
                        preferredUsername: suggestUsername(session.user.email),
                        displayName:
                            engineState.profileName?.trim() ||
                            session.user.user_metadata?.full_name ||
                            suggestUsername(session.user.email),
                        profileAvatar: engineState.profileAvatar,
                    },
                    tokens,
                );
                profile = await fetchMyProfile(supabase, tokens);
            }
            if (cancelled || !profile) return;
            setHostProfile({
                displayName: profile.displayName,
                username: profile.username,
            });
        })();
        return () => {
            cancelled = true;
        };
    }, [
        session?.user?.id,
        session?.user?.email,
        session?.access_token,
        engineState.profileName,
        engineState.profileAvatar,
    ]);

    const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
    const [miniMonth, setMiniMonth] = useState(new Date());
    const [leftPanel, setLeftPanel] = useState<Panel>('none');
    const [rightPanel, setRightPanel] = useState<Panel>('none');
    const [calView, setCalView] = useState<CalendarView>('week');
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [miniCalCollapsed, setMiniCalCollapsed] = useState(false);
    const [schedulingCollapsed, setSchedulingCollapsed] = useState(false);
    const [draft, setDraft] = useState<LinkDraft>(() => defaultLinkDraft(displayName));
    const [dirty, setDirty] = useState(false);
    const [pendingPanel, setPendingPanel] = useState<Panel | null>(null);
    const [showDiscard, setShowDiscard] = useState(false);
    const [savedLinks, setSavedLinks] = useState<SchedulingLink[]>([]);
    const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [groups, setGroups] = useState<CalendarGroup[]>(DEFAULT_CALENDAR_GROUPS());
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
    }>({ active: false, started: false });

    const today = new Date();
    const weekEnd = endOfWeek(weekStart);
    const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
    const weekDaysRef = useRef(weekDays);
    weekDaysRef.current = weekDays;

    useEffect(() => {
        const tick = window.setInterval(() => setNow(new Date()), 30_000);
        return () => window.clearInterval(tick);
    }, []);

    const reloadEventsFromStorage = useCallback(() => {
        chrome.storage.local.get([CALENDAR_EVENTS_KEY], (res) => {
            if (!Array.isArray(res[CALENDAR_EVENTS_KEY])) return;
            const loaded = normalizeCalendarEventDates(
                (res[CALENDAR_EVENTS_KEY] as CalendarEvent[]).map((e) => ({
                    ...e,
                    allDay: e.allDay ?? false,
                })),
            );
            setEvents(loaded);
            chrome.storage.local.set({ [CALENDAR_EVENTS_KEY]: loaded });
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
            [SCHEDULING_LINKS_KEY, LEGACY_LINKS_KEY, CALENDAR_EVENTS_KEY, CALENDAR_GROUPS_KEY, SHOW_HOLIDAYS_KEY],
            (res) => {
                if (Array.isArray(res[SCHEDULING_LINKS_KEY])) {
                    setSavedLinks(res[SCHEDULING_LINKS_KEY] as SchedulingLink[]);
                } else if (Array.isArray(res[LEGACY_LINKS_KEY])) {
                    setSavedLinks(res[LEGACY_LINKS_KEY] as SchedulingLink[]);
                }
                if (Array.isArray(res[CALENDAR_EVENTS_KEY])) {
                    const loaded = normalizeCalendarEventDates(
                        (res[CALENDAR_EVENTS_KEY] as CalendarEvent[]).map((e) => ({
                            ...e,
                            allDay: e.allDay ?? false,
                        })),
                    );
                    setEvents(loaded);
                }
                if (Array.isArray(res[CALENDAR_GROUPS_KEY])) {
                    setGroups(res[CALENDAR_GROUPS_KEY] as CalendarGroup[]);
                } else if (typeof res[SHOW_HOLIDAYS_KEY] === 'boolean') {
                    setGroups((g) =>
                        g.map((x) => (x.kind === 'holidays' ? { ...x, enabled: res[SHOW_HOLIDAYS_KEY] as boolean } : x)),
                    );
                }
            },
        );
    }, []);

    useEffect(() => {
        chrome.storage.local.set({ [SCHEDULING_LINKS_KEY]: savedLinks });
    }, [savedLinks]);

    useEffect(() => {
        chrome.storage.local.set({ [CALENDAR_EVENTS_KEY]: events });
    }, [events]);

    useEffect(() => {
        chrome.storage.local.set({ [CALENDAR_GROUPS_KEY]: groups });
    }, [groups]);

    const monthStart = startOfMonth(miniMonth);
    const miniGridStart = startOfWeek(monthStart);
    const miniGridEnd = endOfWeek(endOfMonth(monthStart));
    const miniDays = eachDayOfInterval({ start: miniGridStart, end: miniGridEnd });

    const { hourHeight, gridHeight } = grid;
    const weekHighlights = weekHighlightSegments(miniDays, weekDays);

    const isGroupEnabled = (groupId?: string) => {
        if (!groupId) return true;
        return groups.find((g) => g.id === groupId)?.enabled ?? true;
    };

    const holidaysGroup = groups.find((g) => g.kind === 'holidays');
    const holidaysOn = holidaysGroup?.enabled ?? false;
    const holidaysColor = holidaysGroup?.color ?? '#22c55e';

    const timedEventsForDay = (day: Date) => {
        const ds = day.toDateString();
        return events.filter((e) => e.date === ds && !e.allDay && isGroupEnabled(e.groupId));
    };

    const allDayChipsForDay = (day: Date): AllDayChip[] => {
        const chips: AllDayChip[] = [];
        if (holidaysOn) {
            const hk = format(day, 'yyyy-MM-dd');
            const name = HOLIDAYS[hk];
            if (name) chips.push({ label: name, color: holidaysColor });
        }
        const ds = day.toDateString();
        events
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

    const saveEvent = (ev: Omit<CalendarEvent, 'id'> & { id?: string }) => {
        const color = colorForEvent({ ...ev, id: ev.id ?? '' } as CalendarEvent, groups);
        const patch = { ...ev, color, id: ev.id ?? String(Date.now()) } as CalendarEvent;
        if (ev.id) {
            setEvents((prev) => prev.map((e) => (e.id === ev.id ? { ...e, ...patch } : e)));
        } else {
            setEvents((prev) => [...prev, patch]);
        }
    };

    const deleteEvent = (id: string) => {
        setEvents((prev) => prev.filter((e) => e.id !== id));
        setEventModal((modal) => (modal?.editing?.id === id ? null : modal));
    };

    const dragSelectRef = useRef(grid.dragSelect);
    dragSelectRef.current = grid.dragSelect;

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
                if (dx * dx + dy * dy >= EVENT_DRAG_THRESHOLD_PX * EVENT_DRAG_THRESHOLD_PX) {
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
        const onUp = (_e: PointerEvent) => {
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

    const openGroup = groups.find((g) => g.id === openGroupId);

    const openRight = (panel: 'recurring' | 'oneoff') => {
        if (dirty && rightPanel !== 'none' && rightPanel !== panel) {
            setPendingPanel(panel);
            setShowDiscard(true);
            return;
        }
        setEditingLinkId(null);
        setRightPanel(panel);
        setDraft(defaultLinkDraft(displayName));
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
        setMiniMonth(t);
    };

    return (
        <div
            className={`focuznow-calendar flex overflow-hidden text-white ${
                fullscreen ? 'h-full w-full' : 'h-[calc(100vh-8rem)] min-h-[640px] rounded-[20px] border shadow-xl'
            }`}
            style={{
                backgroundColor: 'var(--cal-bg)',
                borderColor: 'var(--cal-border)',
            }}
        >
            {/* Left sidebar */}
            <aside
                className={`flex-shrink-0 border-r flex flex-col transition-all duration-200 ${sidebarCollapsed ? 'w-10' : 'w-[260px]'}`}
                style={{ backgroundColor: 'var(--cal-surface)', borderColor: 'var(--cal-border)' }}
            >
                {/* Sidebar toggle */}
                <div className={`flex items-center border-b border-white/10 ${sidebarCollapsed ? 'justify-center px-0 py-3' : 'justify-between px-3 py-2'}`}>
                    {!sidebarCollapsed && onBack && (
                        <button
                            type="button"
                            onClick={onBack}
                            className="flex items-center gap-1.5 text-xs font-bold text-neutral-500 hover:text-white transition-colors"
                        >
                            <ArrowLeft size={14} />
                            Back
                        </button>
                    )}
                    {!sidebarCollapsed && !onBack && <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest">Calendar</span>}
                    <button
                        type="button"
                        onClick={() => setSidebarCollapsed((v) => !v)}
                        className="p-1.5 text-neutral-500 hover:text-white transition-colors rounded-md hover:bg-white/5"
                        title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    >
                        {sidebarCollapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
                    </button>
                </div>

                {!sidebarCollapsed && (
                    <>
                        <div className="px-4 py-2 border-b border-white/10">
                            <p className="text-xs font-bold text-white truncate" title={email}>{email}</p>
                        </div>

                        {/* Mini month — collapsible */}
                        <div className="border-b border-white/10">
                            <button
                                type="button"
                                onClick={() => setMiniCalCollapsed((v) => !v)}
                                className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-bold text-neutral-500 hover:text-white transition-colors"
                            >
                                <span className="uppercase tracking-widest">{format(miniMonth, 'MMM yyyy')}</span>
                                <ChevronDown size={12} className={`transition-transform ${miniCalCollapsed ? '-rotate-90' : ''}`} />
                            </button>
                            {!miniCalCollapsed && (
                                <div className="px-3 pb-3">
                                    <div className="flex items-center justify-between mb-1">
                                        <button type="button" onClick={() => setMiniMonth((m) => addDays(startOfMonth(m), -1))} className="p-1 text-neutral-500 hover:text-white">
                                            <ChevronLeft size={12} />
                                        </button>
                                        <div className="flex items-center justify-between mb-2">
                                            <button
                                                type="button"
                                                onClick={() => setMiniMonth((m) => addDays(endOfMonth(m), 1))}
                                                className="p-1 text-neutral-500 hover:text-white"
                                            >
                                                <ChevronRight size={12} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-7 gap-0.5 text-[9px] text-neutral-600 font-bold text-center mb-1">
                                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                                            <span key={i}>{d}</span>
                                        ))}
                                    </div>
                                    <div className="relative grid grid-cols-7 gap-0.5">
                                        {weekHighlights.map((seg, i) => (
                                            <div
                                                key={`wh-${i}`}
                                                className="pointer-events-none absolute rounded-lg bg-white/12"
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
                                                    }}
                                                    className={`relative z-[1] h-7 text-[10px] font-bold rounded-md transition-colors ${
                                                        !inMonth ? 'text-neutral-700' : inWeek ? 'text-white' : 'text-neutral-400'
                                                    } ${isToday ? 'ring-2 ring-red-500 ring-offset-1 ring-offset-[#0f0f0f]' : ''} hover:bg-white/15`}
                                                >
                                                    {format(day, 'd')}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Scheduling links — collapsible */}
                        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
                            <div className="border-b border-white/10">
                                <button
                                    type="button"
                                    onClick={() => setSchedulingCollapsed((v) => !v)}
                                    className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-bold text-neutral-500 hover:text-white transition-colors"
                                >
                                    <span className="uppercase tracking-widest">Scheduling</span>
                                    <ChevronDown size={12} className={`transition-transform ${schedulingCollapsed ? '-rotate-90' : ''}`} />
                                </button>
                                {!schedulingCollapsed && (
                                    <div className="px-3 pb-3 space-y-2">
                                        <button
                                            type="button"
                                            onClick={() => setLeftPanel((p) => (p === 'schedule-menu' ? 'none' : 'schedule-menu'))}
                                            className="glass-edge-btn w-full px-3 py-2 text-left text-xs font-bold text-white"
                                        >
                                            + New scheduling link
                                        </button>
                                        {savedLinks.length > 0 && (
                                            <div className="space-y-1 pt-1">
                                                {savedLinks.map((l) => (
                                                    <div key={l.id} className="flex gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => copySchedulingUrl(l)}
                                                            className="flex-1 min-w-0 px-2 py-1.5 text-left text-[11px] text-neutral-400 hover:text-white truncate rounded-lg hover:bg-white/5"
                                                            title="Copy link"
                                                        >
                                                            {l.title}
                                                        </button>
                                                        <button type="button" onClick={() => editSchedulingLink(l)} className="px-2 py-1.5 text-[10px] font-bold text-purple-400 hover:text-white shrink-0">Edit</button>
                                                        <button type="button" onClick={() => previewSchedulingUrl(l)} className="px-2 py-1.5 text-[10px] font-bold text-blue-400 shrink-0">↗</button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="p-3">
                                <CalendarGroupsPanel
                                    groups={groups}
                                    openGroupId={openGroupId}
                                    onOpenGroup={setOpenGroupId}
                                    onChange={setGroups}
                                    onEditGroup={setEditingGroup}
                                />
                            </div>
                        </div>
                    </>
                )}
            </aside>

            <AnimatePresence>
                {leftPanel === 'schedule-menu' && (
                    <motion.aside
                        initial={{ width: 0 }}
                        animate={{ width: 220 }}
                        exit={{ width: 0 }}
                        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                        className="flex-shrink-0 border-r border-white/10 bg-[#111] overflow-hidden"
                    >
                        <div className="w-[220px] p-3 space-y-2">
                            <button
                                type="button"
                                onClick={() => openRight('recurring')}
                                className="glass-edge-btn w-full px-3 py-2.5 text-left text-xs font-medium text-white flex items-center gap-2"
                            >
                                <Link2 size={14} className="text-purple-400" />
                                Recurring link
                            </button>
                            <button
                                type="button"
                                onClick={() => openRight('oneoff')}
                                className="glass-edge-btn w-full px-3 py-2.5 text-left text-xs font-medium text-white flex items-center gap-2"
                            >
                                <Link2 size={14} className="text-blue-400" />
                                One-off link
                            </button>
                        </div>
                    </motion.aside>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {openGroup && (
                    <GroupDetailPanel
                        group={openGroup}
                        events={events}
                        onClose={() => setOpenGroupId(null)}
                        onEdit={() => setEditingGroup(openGroup)}
                        onAddEvent={() => {
                            setEventModal({
                                day: new Date(),
                                startHour: 9,
                                startMin: 0,
                                endHour: 10,
                                endMin: 0,
                                defaultGroupId:
                                    openGroup.kind === 'custom' ? openGroup.id : undefined,
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
                        onDeleteEvent={(ev) => deleteEvent(ev.id)}
                    />
                )}
            </AnimatePresence>

            <div ref={weekPanRef} className="flex min-h-0 min-w-0 flex-1 flex-col">
                <header className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#0a0a0a] flex-shrink-0 gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                        <button type="button" onClick={() => commitWeek(-1 as -1)} className="p-2 rounded-lg hover:bg-white/10 text-neutral-400">
                            <ChevronLeft size={18} />
                        </button>
                        <button type="button" onClick={() => commitWeek(1)} className="p-2 rounded-lg hover:bg-white/10 text-neutral-400">
                            <ChevronRight size={18} />
                        </button>
                        <h1 className="text-base font-black ml-1">{format(weekStart, 'MMMM yyyy')}</h1>
                        <button type="button" onClick={goToday} className="ml-2 px-3 py-1 rounded-lg text-[11px] font-bold border border-white/10 text-neutral-400 hover:text-white hover:bg-white/5">
                            Today
                        </button>
                    </div>
                    <div className="flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/8">
                        {(['day', 'week', 'month'] as CalendarView[]).map((v) => (
                            <button
                                key={v}
                                type="button"
                                onClick={() => setCalView(v)}
                                className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all capitalize ${
                                    calView === v ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/25' : 'text-neutral-500 hover:text-white hover:bg-white/8'
                                }`}
                            >
                                {v}
                            </button>
                        ))}
                    </div>
                    <span className="text-[11px] font-bold text-neutral-600 px-2 py-1 rounded-lg border border-white/8">
                        Shift+scroll
                    </span>
                </header>

                {copyNotice && (
                    <p className="text-[11px] text-purple-400 font-bold px-4 py-1">{copyNotice}</p>
                )}

                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    {calView === 'month' ? (
                        /* Month View */
                        <div className="flex-1 overflow-y-auto p-3">
                            <div className="grid grid-cols-7 gap-0.5 mb-1">
                                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                                    <div key={d} className="text-center text-[10px] font-bold text-neutral-500 uppercase py-1">{d}</div>
                                ))}
                            </div>
                            <div className="grid grid-cols-7 gap-0.5">
                                {eachDayOfInterval({
                                    start: startOfWeek(startOfMonth(miniMonth)),
                                    end: endOfWeek(endOfMonth(miniMonth)),
                                }).map((day) => {
                                    const inMonth = isSameMonth(day, miniMonth);
                                    const isToday = isSameDay(day, today);
                                    const dayEvents = timedEventsForDay(day);
                                    const allDayChips = allDayChipsForDay(day);
                                    return (
                                        <div
                                            key={day.toISOString()}
                                            onClick={() => {
                                                setWeekStart(startOfWeek(day));
                                                setMiniMonth(day);
                                                openModalFromRange(day, 9 * 60, 10 * 60);
                                            }}
                                            className={`min-h-[80px] p-1.5 rounded-lg border cursor-pointer transition-colors ${
                                                inMonth ? 'border-white/5 hover:bg-white/5' : 'border-transparent opacity-40'
                                            } ${isToday ? 'border-red-500/40 bg-red-500/5' : ''}`}
                                        >
                                            <span className={`text-[11px] font-bold w-6 h-6 inline-flex items-center justify-center rounded-full ${isToday ? 'bg-red-600 text-white' : inMonth ? 'text-neutral-300' : 'text-neutral-700'}`}>
                                                {format(day, 'd')}
                                            </span>
                                            <div className="mt-1 space-y-0.5">
                                                {allDayChips.slice(0, 2).map((chip, i) => (
                                                    <div key={i} className="text-[9px] font-bold px-1 py-0.5 rounded truncate" style={{ backgroundColor: `${chip.color}33`, color: chip.color }}>
                                                        {chip.label}
                                                    </div>
                                                ))}
                                                {dayEvents.slice(0, 2).map((ev) => (
                                                    <div key={ev.id} className="text-[9px] font-bold px-1 py-0.5 rounded truncate" style={{ backgroundColor: `${ev.color || '#a855f7'}33`, color: ev.color || '#a855f7' }}
                                                        onClick={(e) => { e.stopPropagation(); openModalFromRange(new Date(ev.date), ev.startHour * 60 + ev.startMin, ev.startHour * 60 + ev.startMin + ev.durationMin, ev); }}>
                                                        {ev.title}
                                                    </div>
                                                ))}
                                                {(dayEvents.length + allDayChips.length) > 2 && (
                                                    <div className="text-[9px] text-neutral-500 px-1">+{dayEvents.length + allDayChips.length - 2} more</div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : calView === 'day' ? (
                        /* Day View — single day column using same CalendarWeekStrip but showing only today */
                        <div style={slideStyle} className="h-full min-h-0">
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
                                    singleDayMode={weekStart}
                                    onRightPointerDown={(day, dayIndex) => {
                                        rightDragRef.current = { active: true, started: false, day, dayIndex };
                                    }}
                                    onDeleteEvent={(ev) => deleteEvent(ev.id)}
                                    onEventPointerDown={(ev, day, dayIndex, startMin, e) => {
                                        eventDragMovedRef.current = false;
                                        eventPointerPendingRef.current = { ev, day, dayIndex, startMin, startX: e.clientX, startY: e.clientY, pointerId: e.pointerId };
                                    }}
                                />
                            ))}
                        </div>
                    ) : (
                        /* Week View (default) */
                        <div style={slideStyle} className="h-full min-h-0">
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
                                    onRightPointerDown={(day, dayIndex) => {
                                        rightDragRef.current = { active: true, started: false, day, dayIndex };
                                    }}
                                    onDeleteEvent={(ev) => deleteEvent(ev.id)}
                                    onEventPointerDown={(ev, day, dayIndex, startMin, e) => {
                                        eventDragMovedRef.current = false;
                                        eventPointerPendingRef.current = { ev, day, dayIndex, startMin, startX: e.clientX, startY: e.clientY, pointerId: e.pointerId };
                                    }}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

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
                    onDelete={eventModal.editing ? () => deleteEvent(eventModal.editing!.id) : undefined}
                />
            )}

            {editingGroup && (
                <GroupEditModal
                    group={editingGroup}
                    onClose={() => setEditingGroup(null)}
                    onSave={(patch) => updateGroup(editingGroup.id, patch)}
                />
            )}

            {showDiscard && (
                <div className="fixed inset-0 z-[400] flex items-center justify-center bg-[#0a0a0a]/90 p-4">
                    <div className="glass-edge-card max-w-sm w-full p-6 space-y-4">
                        <h4 className="text-lg font-bold text-white">Discard changes?</h4>
                        <p className="text-sm text-neutral-400">You have unsaved edits. Discard them and continue?</p>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setShowDiscard(false)}
                                className="glass-edge-btn flex-1 py-2.5 text-sm font-bold text-white"
                            >
                                Keep editing
                            </button>
                            <button
                                type="button"
                                onClick={confirmDiscard}
                                className="glass-edge-btn flex-1 py-2.5 text-sm font-bold bg-red-600/80 text-white"
                            >
                                Discard
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

