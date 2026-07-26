import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { motion } from 'framer-motion';
import { CalendarDays, ChevronDown, Clock3, Globe2, Repeat2, X } from 'lucide-react';
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
        if (!title.trim()) return;
        onSave({
            id: state.editing?.id,
            title: title.trim(),
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
        <div className="fixed inset-0 z-[500] flex items-start justify-center bg-black/55 p-4 pt-[6vh]" onMouseDown={onClose}>
            <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                onMouseDown={(event) => event.stopPropagation()}
                className="relative w-full max-w-[430px] overflow-hidden rounded-[10px] border border-white/[0.09] bg-[#202021] text-neutral-300 shadow-[0_24px_80px_rgba(0,0,0,0.65)]"
            >
                <div className="p-3 pt-4">
                    <input
                        autoFocus
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') save();
                        }}
                        placeholder="Add title"
                        className="mb-3 w-full rounded-md border border-white/[0.05] bg-white/[0.045] px-3 py-2.5 pr-10 text-base font-semibold text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-white/[0.14] focus:bg-white/[0.06]"
                    />
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close event"
                        className="absolute right-4 top-[22px] rounded p-1 text-neutral-600 hover:bg-white/[0.05] hover:text-neutral-300"
                    >
                        <X size={15} />
                    </button>

                    {occurrenceEditing && (
                        <div className="mb-3 grid grid-cols-2 rounded-md bg-black/20 p-0.5 text-[11px]">
                            <button
                                type="button"
                                onClick={() => setEditTarget('occurrence')}
                                className={`rounded px-2 py-1.5 ${editTarget === 'occurrence' ? 'bg-white/10 text-white' : 'text-neutral-500'}`}
                            >
                                This occurrence
                            </button>
                            <button
                                type="button"
                                onClick={() => setEditTarget('series')}
                                className={`rounded px-2 py-1.5 ${editTarget === 'series' ? 'bg-white/10 text-white' : 'text-neutral-500'}`}
                            >
                                Entire series
                            </button>
                        </div>
                    )}

                    <div className="space-y-1 text-xs">
                        <div className="grid grid-cols-[20px_1fr] items-center gap-2 rounded-md px-2 py-1.5 hover:bg-white/[0.025]">
                            <Clock3 size={13} className="text-neutral-600" />
                            {allDay ? (
                                <span className="text-neutral-500">All-day event</span>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <TimeSelect value={startMin} onChange={(value) => {
                                        setStartMin(value);
                                        if (endMin <= value) setEndMin(value + 15);
                                    }} />
                                    <span className="text-neutral-700">→</span>
                                    <TimeSelect value={endMin} min={startMin + 15} onChange={(value) => setEndMin(Math.max(value, startMin + 15))} />
                                    <span className="text-[11px] text-neutral-600">{Math.max(15, endMin - startMin)} min</span>
                                </div>
                            )}
                        </div>

                        <label className="grid grid-cols-[20px_1fr] items-center gap-2 rounded-md px-2 py-1.5 hover:bg-white/[0.025]">
                            <CalendarDays size={13} className="text-neutral-600" />
                            <input
                                type="date"
                                value={format(eventDay, 'yyyy-MM-dd')}
                                onChange={(event) => {
                                    if (event.target.value) setEventDay(parseISO(`${event.target.value}T12:00:00`));
                                }}
                                className="w-fit bg-transparent text-xs text-neutral-300 outline-none [color-scheme:dark]"
                            />
                        </label>

                        <label className="grid grid-cols-[20px_1fr] items-center gap-2 rounded-md px-2 py-1.5 hover:bg-white/[0.025]">
                            <Repeat2 size={13} className="text-neutral-600" />
                            <select
                                value={repeat}
                                onChange={(event) => setRepeat(event.target.value as typeof repeat)}
                                className="w-fit bg-transparent text-xs text-neutral-400 outline-none"
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
                                            className={`h-7 w-7 rounded text-[10px] font-medium ${
                                                selected
                                                    ? 'bg-blue-500/25 text-blue-200'
                                                    : 'bg-white/[0.04] text-neutral-600'
                                            }`}
                                        >
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        <div className="grid grid-cols-[20px_1fr] items-center gap-2 rounded-md px-2 py-1.5 text-neutral-600 hover:bg-white/[0.025]">
                            <Globe2 size={13} />
                            <span>{Intl.DateTimeFormat().resolvedOptions().timeZone.replaceAll('_', ' ')}</span>
                        </div>

                        <button
                            type="button"
                            onClick={() => setAllDay((value) => !value)}
                            className="ml-7 rounded px-2 py-1 text-[11px] text-neutral-600 hover:bg-white/[0.04] hover:text-neutral-300"
                        >
                            {allDay ? 'Use specific times' : 'Make all-day'}
                        </button>
                    </div>

                    <div className="my-3 h-px bg-white/[0.07]" />
                    <textarea
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        placeholder="Description"
                        rows={3}
                        className="w-full resize-none bg-transparent px-2 text-xs leading-5 text-neutral-300 outline-none placeholder:text-neutral-600"
                    />
                    <div className="my-3 h-px bg-white/[0.07]" />

                    <div className="flex items-center gap-2 px-2">
                        <label className="group relative flex min-w-0 items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.035] py-1.5 pl-2 pr-7 transition-colors hover:border-white/[0.14] hover:bg-white/[0.055]">
                            <span
                                className="h-3 w-3 shrink-0 rounded-[3px] shadow-[0_0_0_1px_rgba(255,255,255,0.12)]"
                                style={{ backgroundColor: selectedGroup?.color ?? '#5ea2ff' }}
                            />
                            <select
                                value={groupId}
                                onChange={(event) => setGroupId(event.target.value)}
                                disabled={customGroups.length === 0}
                                aria-label="Calendar group"
                                className="min-w-0 appearance-none bg-transparent text-[11px] text-neutral-300 outline-none disabled:text-neutral-600"
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
                                className="pointer-events-none absolute right-2 text-neutral-600 transition-colors group-hover:text-neutral-400"
                            />
                        </label>
                        {!allDay && (
                            <span className="ml-auto text-[10px] text-neutral-700">
                                {formatMinutes(startMin)}–{formatMinutes(endMin)}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-white/[0.07] px-3 py-2.5">
                    {onDelete && (
                        <button
                            type="button"
                            onClick={() => {
                                onDelete(editTarget);
                                onClose();
                            }}
                            className="mr-auto rounded-md px-3 py-1.5 text-xs text-neutral-500 hover:bg-red-500/10 hover:text-red-400"
                        >
                            Delete
                        </button>
                    )}
                    <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-xs text-neutral-500 hover:bg-white/[0.05]">
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={save}
                        disabled={!title.trim()}
                        className="rounded-md bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-950 disabled:opacity-40"
                    >
                        {state.editing ? 'Save' : 'Create event'}
                    </button>
                </div>
            </motion.div>
        </div>
    );
}

function TimeSelect({ value, onChange, min = 0 }: { value: number; onChange: (value: number) => void; min?: number }) {
    return (
        <select
            value={value}
            onChange={(event) => onChange(Number(event.target.value))}
            className="bg-transparent text-xs text-neutral-300 outline-none"
        >
            {TIME_OPTIONS.filter((option) => option.value >= min && option.value <= 24 * 60 - 15).map((option) => (
                <option key={option.value} value={option.value}>
                    {option.label}
                </option>
            ))}
        </select>
    );
}
