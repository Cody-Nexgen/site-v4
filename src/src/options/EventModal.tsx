import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { motion } from 'framer-motion';
import { ChevronDown, X } from 'lucide-react';
import type { CalendarEvent, CalendarGroup } from '../lib/schedulingTypes';
import {
    durationFromRange,
    EVENT_COLOR_PRESETS,
    eventEndMinutes,
    formatMinutes,
    normalizeHexColor,
    TIME_OPTIONS,
} from '../lib/calendarUtils';

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
    onSave: (ev: Omit<CalendarEvent, 'id'> & { id?: string }) => void;
    onDelete?: () => void;
}) {
    const initialStart = state.editing
        ? state.editing.startHour * 60 + state.editing.startMin
        : state.startHour * 60 + state.startMin;
    const initialEnd = state.editing
        ? eventEndMinutes(state.editing)
        : state.endHour !== undefined && state.endMin !== undefined
          ? state.endHour * 60 + state.endMin
          : initialStart + (state.durationMin ?? 30);

    const [title, setTitle] = useState(state.editing?.title ?? '');
    const [eventDay, setEventDay] = useState<Date>(state.day);
    const [allDay, setAllDay] = useState(state.editing?.allDay ?? false);
    const [startMinVal, setStartMinVal] = useState(initialStart);
    const [endMinVal, setEndMinVal] = useState(Math.max(initialStart + 15, initialEnd));
    const [groupId, setGroupId] = useState(
        state.editing?.groupId ?? state.defaultGroupId ?? groups.find((g) => g.kind === 'custom')?.id,
    );
    const linkedGroup = groups.find((g) => g.id === groupId);
    const [color, setColor] = useState(
        normalizeHexColor(
            linkedGroup?.color ?? state.editing?.color ?? groups.find((g) => g.kind === 'custom')?.color ?? '#38bdf8',
        ),
    );
    const [description, setDescription] = useState(state.editing?.description ?? '');

    const customGroups = useMemo(() => groups.filter((g) => g.kind === 'custom'), [groups]);

    const save = () => {
        if (!title.trim()) return;
        const startHour = Math.floor(startMinVal / 60);
        const startMin = startMinVal % 60;
        const durationMin = allDay ? 0 : durationFromRange(startMinVal, endMinVal);
        onSave({
            id: state.editing?.id,
            title: title.trim(),
            date: eventDay.toDateString(),
            allDay,
            startHour,
            startMin,
            durationMin,
            color,
            groupId,
            bookingLinkId: state.editing?.bookingLinkId,
            description: description.trim() || undefined,
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[500] flex items-start justify-center bg-[#0a0a0a]/92 p-4 pt-[8vh]">
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#1a1a1a] shadow-2xl"
            >
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                    <span className="text-xs font-bold text-neutral-400">Event</span>
                    <button type="button" onClick={onClose} className="p-1 text-neutral-500 hover:text-white">
                        <X size={18} />
                    </button>
                </div>
                <div className="max-h-[70vh] space-y-4 overflow-y-auto p-4">
                    <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Title"
                        className="w-full bg-transparent text-xl font-black text-white outline-none placeholder:text-neutral-600"
                        autoFocus
                    />

                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <label className="block flex-1 space-y-1">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Date</span>
                                <input
                                    type="date"
                                    value={format(eventDay, 'yyyy-MM-dd')}
                                    onChange={(e) => {
                                        if (!e.target.value) return;
                                        try {
                                            setEventDay(parseISO(e.target.value + 'T12:00:00'));
                                        } catch {
                                            // ignore invalid dates
                                        }
                                    }}
                                    className="w-full appearance-none rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm font-bold text-white outline-none focus:border-blue-500/50 [color-scheme:dark]"
                                />
                            </label>
                        </div>
                        <button
                            type="button"
                            onClick={() => setAllDay((v) => !v)}
                            className="text-xs font-bold text-blue-400 hover:text-blue-300"
                        >
                            {allDay ? 'Set times' : 'All-day'}
                        </button>
                    </div>

                    {!allDay && (
                        <div className="flex items-center gap-2">
                            <TimeSelect
                                label="Start"
                                value={startMinVal}
                                onChange={(v) => {
                                    setStartMinVal(v);
                                    if (endMinVal <= v) setEndMinVal(v + 15);
                                }}
                            />
                            <span className="pt-5 text-neutral-500">→</span>
                            <TimeSelect
                                label="End"
                                value={endMinVal}
                                onChange={(v) => setEndMinVal(Math.max(v, startMinVal + 15))}
                                min={startMinVal + 15}
                            />
                        </div>
                    )}

                    {customGroups.length > 0 && (
                        <label className="block space-y-1">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                                Group
                            </span>
                            <div className="relative">
                                <select
                                    value={groupId ?? ''}
                                    onChange={(e) => {
                                        const id = e.target.value || undefined;
                                        setGroupId(id);
                                        const g = groups.find((x) => x.id === id);
                                        if (g) setColor(g.color);
                                    }}
                                    className="w-full appearance-none rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
                                >
                                    <option value="">None</option>
                                    {customGroups.map((g) => (
                                        <option key={g.id} value={g.id}>
                                            {g.name}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown
                                    size={14}
                                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500"
                                />
                            </div>
                        </label>
                    )}

                    <div className="space-y-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                            Color
                        </span>
                        {linkedGroup && (
                            <p className="text-xs text-neutral-400">
                                Uses group color: <span className="font-bold text-white">{linkedGroup.name}</span>
                            </p>
                        )}
                        {!linkedGroup && (
                        <>
                        <div className="flex flex-wrap gap-2">
                            {EVENT_COLOR_PRESETS.map((c) => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => setColor(c)}
                                    className={`h-7 w-7 rounded-lg border-2 ${
                                        color === c ? 'border-white' : 'border-transparent'
                                    }`}
                                    style={{ backgroundColor: c }}
                                />
                            ))}
                        </div>
                        <input
                            type="color"
                            value={color}
                            onChange={(e) => setColor(normalizeHexColor(e.target.value))}
                            className="h-9 w-full cursor-pointer rounded-lg border border-white/10 bg-black/40"
                        />
                        </>
                        )}
                        <div
                            className="flex overflow-hidden rounded-md"
                            style={{
                                backgroundColor: `color-mix(in srgb, ${linkedGroup?.color ?? color} 22%, #0a0a0a)`,
                            }}
                        >
                            <span className="w-1" style={{ backgroundColor: linkedGroup?.color ?? color }} />
                            <span className="px-2 py-1.5 text-[10px] font-bold text-white">
                                {title || 'Preview'} · {allDay ? 'All day' : `${formatMinutes(startMinVal)} – ${formatMinutes(endMinVal)}`}
                            </span>
                        </div>
                    </div>

                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Description"
                        rows={3}
                        className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-neutral-600"
                    />
                </div>
                <div className="flex gap-2 border-t border-white/10 p-4">
                    {onDelete && (
                        <button
                            type="button"
                            onClick={() => {
                                onDelete();
                                onClose();
                            }}
                            className="glass-edge-btn px-4 py-2.5 text-sm font-bold text-red-400 hover:bg-red-500/10"
                        >
                            Delete
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onClose}
                        className="glass-edge-btn flex-1 py-2.5 text-sm font-bold text-neutral-400"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={save}
                        className="glass-edge-btn flex-1 bg-blue-600 py-2.5 text-sm font-bold text-white"
                    >
                        Save
                    </button>
                </div>
            </motion.div>
        </div>
    );
}

function TimeSelect({
    label,
    value,
    onChange,
    min = 0,
}: {
    label: string;
    value: number;
    onChange: (v: number) => void;
    min?: number;
}) {
    const options = TIME_OPTIONS.filter((o) => o.value >= min && o.value <= 24 * 60 - 15);
    return (
        <label className="block flex-1 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">{label}</span>
            <div className="relative">
                <select
                    value={value}
                    onChange={(e) => onChange(Number(e.target.value))}
                    className="w-full appearance-none rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm font-bold text-white outline-none focus:border-blue-500/50"
                >
                    {options.map((o) => (
                        <option key={o.value} value={o.value}>
                            {o.label}
                        </option>
                    ))}
                </select>
                <ChevronDown
                    size={14}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500"
                />
            </div>
        </label>
    );
}
