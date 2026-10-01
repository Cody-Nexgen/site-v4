import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { CalendarDays, ChevronDown, Clock3, Globe2, Repeat2 } from 'lucide-react';
import { Dialog } from '../components/fz/Dialog';
import { Button } from '../components/fz/Button';
import type { CalendarEvent, CalendarGroup } from '../lib/schedulingTypes';
import { durationFromRange, eventEndMinutes, formatMinutes, TIME_OPTIONS } from '../lib/calendarUtils';
import {
    isGeneratedOccurrence,
    type RecurrenceEditTarget,
} from '../lib/calendarRecurrence';

export type EventModalState = {
    day: Date;
    startHour: number;
    startMin: number;
    endHour?: number;
    endMin?: number;
    durationMin?: number;
    editing?: CalendarEvent;
    defaultGroupId?: string;
};

export default function EventModal({
    state,
    groups,
    onClose,
    onSave,
    onDelete,
}: {
    state: EventModalState;
    groups: CalendarGroup[];
    onClose: () => void;
    onSave: (
        event: Omit<CalendarEvent, 'id'> & { id?: string },
        target: RecurrenceEditTarget,
    ) => void;
    onDelete?: (target: RecurrenceEditTarget) => void;
}) {
    const initialStart = state.editing
        ? state.editing.startHour * 60 + state.editing.startMin
        : state.startHour * 60 + state.startMin;
    const initialEnd = state.editing
        ? eventEndMinutes(state.editing)
        : state.endHour !== undefined && state.endMin !== undefined
          ? state.endHour * 60 + state.endMin
          : initialStart + (state.durationMin ?? 30);
    const customGroups = groups.filter((group) => group.kind === 'custom');
    const initialGroup = customGroups.find((group) => group.id === state.editing?.groupId)
        ?? customGroups.find((group) => group.id === state.defaultGroupId)
        ?? customGroups[0];

    const [title, setTitle] = useState(state.editing?.title ?? '');
    const [groupId, setGroupId] = useState(initialGroup?.id ?? '');
    const [eventDay, setEventDay] = useState(state.day);
    const [allDay, setAllDay] = useState(state.editing?.allDay ?? false);
    const [startMin, setStartMin] = useState(initialStart);
    const [endMin, setEndMin] = useState(Math.max(initialStart + 15, initialEnd));
    const [repeat, setRepeat] = useState<NonNullable<CalendarEvent['repeat']>>(state.editing?.repeat ?? 'none');
    const [recurrenceWeekdays, setRecurrenceWeekdays] = useState<number[]>(
        state.editing?.recurrenceWeekdays?.length
            ? state.editing.recurrenceWeekdays
            : [state.day.getDay()],
    );
    const occurrenceEditing = Boolean(state.editing && isGeneratedOccurrence(state.editing));
    const [editTarget, setEditTarget] = useState<RecurrenceEditTarget>(
        occurrenceEditing ? 'occurrence' : 'series',
    );
    const [description, setDescription] = useState(state.editing?.description ?? '');
    const selectedGroup = customGroups.find((group) => group.id === groupId);

    const save = () => {
        onSave({
            id: state.editing?.id,
            title: title.trim() || 'Untitled event',
            date: eventDay.toDateString(),
            allDay,
            startHour: Math.floor(startMin / 60),
            startMin: startMin % 60,
            durationMin: allDay ? 0 : durationFromRange(startMin, endMin),
            color: selectedGroup?.color ?? state.editing?.color ?? '#5ea2ff',
            groupId: selectedGroup?.id,
            bookingLinkId: state.editing?.bookingLinkId,
            description: description.trim() || undefined,
            repeat,
            seriesId: repeat === 'none' ? undefined : state.editing?.seriesId,
            recurrenceWeekdays: repeat === 'weekly' ? recurrenceWeekdays : undefined,
            recurrenceExceptions: state.editing?.recurrenceExceptions,
            recurrenceMasterId: state.editing?.recurrenceMasterId,
            recurrenceMasterDate: state.editing?.recurrenceMasterDate,
            occurrenceDate: state.editing?.occurrenceDate,
            sourceListId: state.editing?.sourceListId,
        }, editTarget);
        onClose();
    };

    return (
        <Dialog
            open
            onClose={onClose}
            title={state.editing ? 'Edit event' : 'New event'}
            size="md"
            footer={
                <>
                    {onDelete && (
                        <Button
                            variant="danger"
                            className="mr-auto"
                            onClick={() => {
                                onDelete(editTarget);
                                onClose();
                            }}
                        >
                            Delete
                        </Button>
                    )}
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button variant="primary" onClick={save}>
                        {state.editing ? 'Save' : 'Create event'}
                    </Button>
                </>
            }
        >
            <div className="p-1 pt-0">
                    <input
                        autoFocus
                        data-autofocus
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') save();
                        }}
                        placeholder="Add title"
                        className="mb-3 w-full rounded-lg border border-[var(--fz-border)] bg-[var(--fz-bg-raised)] px-3 py-2.5 text-base font-semibold text-[var(--fz-text-1)] outline-none placeholder:text-[var(--fz-text-3)] focus:border-[var(--fz-border-strong)]"
                    />

                    {occurrenceEditing && (
                        <div className="mb-3 grid grid-cols-2 rounded-lg bg-[var(--fz-bg-panel)] p-0.5 text-[11px]">
                            <button
                                type="button"
                                onClick={() => setEditTarget('occurrence')}
                                className={`rounded px-2 py-1.5 ${editTarget === 'occurrence' ? 'bg-[var(--fz-bg-active)] text-[var(--fz-text-1)]' : 'text-[var(--fz-text-3)]'}`}
                            >
                                This occurrence
                            </button>
                            <button
                                type="button"
                                onClick={() => setEditTarget('series')}
                                className={`rounded px-2 py-1.5 ${editTarget === 'series' ? 'bg-[var(--fz-bg-active)] text-[var(--fz-text-1)]' : 'text-[var(--fz-text-3)]'}`}
                            >
                                Entire series
                            </button>
                        </div>
                    )}

                    <div className="space-y-1 text-xs">
                        <div className="grid grid-cols-[20px_1fr] items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[var(--fz-bg-hover)]">
                            <Clock3 size={13} className="text-[var(--fz-text-4)]" />
                            {allDay ? (
                                <span className="text-[var(--fz-text-3)]">All-day event</span>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <TimeSelect value={startMin} onChange={(value) => {
                                        setStartMin(value);
                                        if (endMin <= value) setEndMin(value + 15);
                                    }} />
                                    <span className="text-[var(--fz-text-4)]">→</span>
                                    <TimeSelect value={endMin} min={startMin + 15} onChange={(value) => setEndMin(Math.max(value, startMin + 15))} />
                                    <span className="text-[11px] text-[var(--fz-text-4)]">{Math.max(15, endMin - startMin)} min</span>
                                </div>
                            )}
                        </div>

                        <label className="grid grid-cols-[20px_1fr] items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[var(--fz-bg-hover)]">
                            <CalendarDays size={13} className="text-[var(--fz-text-4)]" />
                            <input
                                type="date"
                                value={format(eventDay, 'yyyy-MM-dd')}
                                onChange={(event) => {
                                    if (event.target.value) setEventDay(parseISO(`${event.target.value}T12:00:00`));
                                }}
                                className="w-fit bg-transparent text-xs text-[var(--fz-text-2)] outline-none"
                            />
                        </label>

                        <label className="grid grid-cols-[20px_1fr] items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[var(--fz-bg-hover)]">
                            <Repeat2 size={13} className="text-[var(--fz-text-4)]" />
                            <select
                                value={repeat}
                                onChange={(event) => setRepeat(event.target.value as typeof repeat)}
                                className="w-fit bg-transparent text-xs text-[var(--fz-text-3)] outline-none"
                            >
                                <option value="none">Does not repeat</option>
                                <option value="daily">Every day</option>
                                <option value="weekly">Selected weekdays</option>
                            </select>
                        </label>
                        {repeat === 'weekly' && editTarget === 'series' && (
                            <div className="ml-7 flex gap-1 py-1">
                                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, day) => {
                                    const selected = recurrenceWeekdays.includes(day);
                                    return (
                                        <button
                                            key={day}
                                            type="button"
                                            onClick={() =>
                                                setRecurrenceWeekdays((current) =>
                                                    selected
                                                        ? current.length > 1
                                                            ? current.filter((value) => value !== day)
                                                            : current
                                                        : [...current, day].sort(),
                                                )
                                            }
                                            className={`h-7 w-7 rounded text-[11px] font-medium ${
                                                selected
                                                    ? 'bg-[var(--fz-accent-soft)] text-[var(--fz-text-1)]'
                                                    : 'bg-[var(--fz-bg-hover)] text-[var(--fz-text-4)]'
                                            }`}
                                        >
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        <div className="grid grid-cols-[20px_1fr] items-center gap-2 rounded-lg px-2 py-1.5 text-[var(--fz-text-4)] hover:bg-[var(--fz-bg-hover)]">
                            <Globe2 size={13} />
                            <span>{Intl.DateTimeFormat().resolvedOptions().timeZone.replaceAll('_', ' ')}</span>
                        </div>

                        <button
                            type="button"
                            onClick={() => setAllDay((value) => !value)}
                            className="ml-7 rounded px-2 py-1 text-[11px] text-[var(--fz-text-4)] hover:bg-[var(--fz-bg-hover)] hover:text-[var(--fz-text-2)]"
                        >
                            {allDay ? 'Use specific times' : 'Make all-day'}
                        </button>
                    </div>

                    <div className="my-3 h-px bg-[var(--fz-bg-hover)]" />
                    <textarea
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        placeholder="Description"
                        rows={3}
                        className="w-full resize-none bg-transparent px-2 text-xs leading-5 text-[var(--fz-text-2)] outline-none placeholder:text-[var(--fz-text-4)]"
                    />
                    <div className="my-3 h-px bg-[var(--fz-bg-hover)]" />

                    <div className="flex items-center gap-2 px-2">
                        <label className="group relative flex min-w-0 items-center gap-2 rounded-lg border border-[var(--fz-border)] bg-[var(--fz-bg-hover)] py-1.5 pl-2 pr-7 transition-colors hover:border-[var(--fz-border-strong)] hover:bg-[var(--fz-bg-hover)]">
                            <span
                                className="h-3 w-3 shrink-0 rounded-sm shadow-[0_0_0_1px_var(--fz-border)]"
                                style={{ backgroundColor: selectedGroup?.color ?? '#5ea2ff' }}
                            />
                            <select
                                value={groupId}
                                onChange={(event) => setGroupId(event.target.value)}
                                disabled={customGroups.length === 0}
                                aria-label="Calendar group"
                                className="min-w-0 appearance-none bg-transparent text-[11px] text-[var(--fz-text-2)] outline-none disabled:text-[var(--fz-text-4)]"
                            >
                                {customGroups.length === 0 ? (
                                    <option value="">FocuzNow calendar</option>
                                ) : (
                                    customGroups.map((group) => (
                                        <option key={group.id} value={group.id}>
                                            {group.name}
                                        </option>
                                    ))
                                )}
                            </select>
                            <ChevronDown
                                size={12}
                                className="pointer-events-none absolute right-2 text-[var(--fz-text-4)] transition-colors group-hover:text-[var(--fz-text-3)]"
                            />
                        </label>
                        {!allDay && (
                            <span className="ml-auto text-[11px] text-[var(--fz-text-4)]">
                                {formatMinutes(startMin)}–{formatMinutes(endMin)}
                            </span>
                        )}
                    </div>
                </div>
        </Dialog>
    );
}

function TimeSelect({ value, onChange, min = 0 }: { value: number; onChange: (value: number) => void; min?: number }) {
    return (
        <select
            value={value}
            onChange={(event) => onChange(Number(event.target.value))}
            className="bg-transparent text-xs text-[var(--fz-text-2)] outline-none"
        >
            {TIME_OPTIONS.filter((option) => option.value >= min && option.value <= 24 * 60 - 15).map((option) => (
                <option key={option.value} value={option.value}>
                    {option.label}
                </option>
            ))}
        </select>
    );
}
