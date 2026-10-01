import { useState } from 'react';
import { Check, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { EVENT_COLOR_PRESETS, normalizeHexColor, randomEventColor } from '../lib/calendarUtils';
import type { CalendarGroup } from '../lib/schedulingTypes';
import { Button } from '../components/fz/Button';

const iconBtn =
    'flex size-6 shrink-0 items-center justify-center rounded-md text-[var(--fz-text-4)] transition-colors hover:bg-[var(--fz-bg-active)] hover:text-[var(--fz-text-1)] focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--fz-focus-ring)]';

export default function CalendarGroupsPanel({
    groups,
    openGroupId,
    onOpenGroup,
    onChange,
    onEditGroup,
    onDeleteGroup,
}: {
    groups: CalendarGroup[];
    openGroupId: string | null;
    onOpenGroup: (id: string | null) => void;
    onChange: (next: CalendarGroup[]) => void;
    onEditGroup: (group: CalendarGroup) => void;
    onDeleteGroup: (group: CalendarGroup) => void;
}) {
    const [adding, setAdding] = useState(false);
    const [newName, setNewName] = useState('');
    const [newColor, setNewColor] = useState(randomEventColor());
    const [menuGroupId, setMenuGroupId] = useState<string | null>(null);

    const update = (id: string, patch: Partial<CalendarGroup>) => {
        onChange(groups.map((g) => (g.id === id ? { ...g, ...patch } : g)));
    };

    const addGroup = () => {
        if (!newName.trim()) return;
        const g: CalendarGroup = {
            id: `grp_${Date.now()}`,
            name: newName.trim(),
            color: normalizeHexColor(newColor),
            enabled: true,
            expanded: false,
            kind: 'custom',
        };
        onChange([...groups, g]);
        setNewName('');
        setNewColor(randomEventColor());
        setAdding(false);
    };

    return (
        <div>
            <div className="flex h-8 items-center justify-between pl-2 pr-1">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--fz-text-4)]">Calendars</p>
                <button type="button" onClick={() => setAdding((v) => !v)} className={iconBtn} aria-label="Add calendar" title="Add calendar">
                    <Plus size={14} strokeWidth={1.75} />
                </button>
            </div>

            <div className="space-y-px">
                {groups.map((g) => {
                    const isOpen = openGroupId === g.id;
                    return (
                        <div key={g.id}>
                            <div
                                data-open={isOpen || undefined}
                                className="group/grp flex h-8 items-center gap-2 rounded-lg pl-2 pr-1 transition-colors hover:bg-[var(--fz-bg-hover)] data-[open]:bg-[var(--fz-bg-active)]"
                                onDoubleClick={() => onEditGroup(g)}
                                onContextMenu={(e) => {
                                    e.preventDefault();
                                    setMenuGroupId(menuGroupId === g.id ? null : g.id);
                                }}
                            >
                                <button
                                    type="button"
                                    role="checkbox"
                                    aria-checked={g.enabled}
                                    aria-label={`Show ${g.name}`}
                                    title={g.enabled ? 'Hide from calendar' : 'Show on calendar'}
                                    onClick={() => update(g.id, { enabled: !g.enabled })}
                                    className="flex size-[15px] shrink-0 items-center justify-center rounded-[4px] border-[1.5px] transition-colors focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--fz-focus-ring)]"
                                    style={{
                                        borderColor: g.color,
                                        backgroundColor: g.enabled ? g.color : 'transparent',
                                    }}
                                >
                                    {g.enabled && <Check size={10} strokeWidth={3} className="text-white" />}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onOpenGroup(isOpen ? null : g.id)}
                                    className="min-w-0 flex-1 truncate text-left text-[13px] text-[var(--fz-text-2)] transition-colors group-hover/grp:text-[var(--fz-text-1)]"
                                    title={g.name}
                                >
                                    {g.name}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onEditGroup(g)}
                                    className={`${iconBtn} hidden group-hover/grp:flex`}
                                    aria-label={`Edit ${g.name}`}
                                    title="Edit"
                                >
                                    <Pencil size={12} strokeWidth={1.75} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onOpenGroup(isOpen ? null : g.id)}
                                    className={`${iconBtn} ${isOpen ? '' : 'hidden group-hover/grp:flex'}`}
                                    aria-label={isOpen ? 'Close details' : 'Show details'}
                                >
                                    <ChevronRight size={13} strokeWidth={1.75} className={`transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} />
                                </button>
                            </div>
                            {menuGroupId === g.id && (
                                <div
                                    className="mx-1 mb-1 rounded-lg border border-[var(--fz-border)] bg-[var(--fz-bg-overlay)] p-1"
                                    style={{ boxShadow: 'var(--fz-elev-card)' }}
                                >
                                    <button
                                        type="button"
                                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] text-[var(--fz-text-2)] hover:bg-[var(--fz-bg-hover)] hover:text-[var(--fz-text-1)]"
                                        onClick={() => {
                                            onEditGroup(g);
                                            setMenuGroupId(null);
                                        }}
                                    >
                                        <Pencil size={12} strokeWidth={1.75} />
                                        Edit calendar
                                    </button>
                                    <button
                                        type="button"
                                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] text-[var(--fz-danger)] hover:bg-[var(--fz-danger-soft)]"
                                        onClick={() => {
                                            setMenuGroupId(null);
                                            onDeleteGroup(g);
                                        }}
                                    >
                                        <Trash2 size={12} strokeWidth={1.75} />
                                        Delete calendar
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {adding ? (
                <div
                    className="mt-2 space-y-2.5 rounded-xl border border-[var(--fz-border)] bg-[var(--fz-bg-raised)] p-2.5"
                    style={{ boxShadow: 'var(--fz-edge)' }}
                >
                    <input
                        autoFocus
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') addGroup();
                            if (e.key === 'Escape') setAdding(false);
                        }}
                        placeholder="Calendar name"
                        className="h-8 w-full rounded-lg border border-[var(--fz-border)] bg-[var(--fz-bg-panel)] px-2.5 text-[13px] text-[var(--fz-text-1)] outline-none placeholder:text-[var(--fz-text-4)] focus:border-[var(--fz-border-strong)]"
                    />
                    <div className="flex flex-wrap items-center gap-1.5">
                        {EVENT_COLOR_PRESETS.map((c) => (
                            <button
                                key={c}
                                type="button"
                                onClick={() => setNewColor(c)}
                                aria-label={`Color ${c}`}
                                className="size-5 rounded-full transition-transform hover:scale-110"
                                style={{
                                    backgroundColor: c,
                                    boxShadow: newColor === c ? `0 0 0 2px var(--fz-bg-raised), 0 0 0 3.5px ${c}` : undefined,
                                }}
                            />
                        ))}
                        <label
                            className="relative size-5 cursor-pointer overflow-hidden rounded-full border border-dashed border-[var(--fz-border-strong)]"
                            title="Custom color"
                            style={(EVENT_COLOR_PRESETS as readonly string[]).includes(newColor) ? undefined : { backgroundColor: newColor, borderStyle: 'solid' }}
                        >
                            <input
                                type="color"
                                value={newColor}
                                onChange={(e) => setNewColor(normalizeHexColor(e.target.value))}
                                className="absolute inset-0 cursor-pointer opacity-0"
                            />
                        </label>
                    </div>
                    <div className="flex justify-end gap-1.5">
                        <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>
                            Cancel
                        </Button>
                        <Button variant="primary" size="sm" onClick={addGroup} disabled={!newName.trim()}>
                            Add
                        </Button>
                    </div>
                </div>
            ) : (
                groups.length === 0 && (
                    <button
                        type="button"
                        onClick={() => setAdding(true)}
                        className="mt-1 flex h-8 w-full items-center gap-2 rounded-lg px-2 text-[13px] text-[var(--fz-text-3)] hover:bg-[var(--fz-bg-hover)] hover:text-[var(--fz-text-1)]"
                    >
                        <Plus size={14} strokeWidth={1.75} />
                        Add calendar
                    </button>
                )
            )}
        </div>
    );
}
