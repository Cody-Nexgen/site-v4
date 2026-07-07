import { useState } from 'react';
import { ChevronRight, Pencil, Plus } from 'lucide-react';
import { EVENT_COLOR_PRESETS, normalizeHexColor, randomEventColor } from '../lib/calendarUtils';
import type { CalendarGroup } from '../lib/schedulingTypes';

export default function CalendarGroupsPanel({
    groups,
    openGroupId,
    onOpenGroup,
    onChange,
    onEditGroup,
}: {
    groups: CalendarGroup[];
    openGroupId: string | null;
    onOpenGroup: (id: string | null) => void;
    onChange: (next: CalendarGroup[]) => void;
    onEditGroup: (group: CalendarGroup) => void;
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
        <div className="space-y-3">
            <p className="px-1 text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--cal-hour)' }}>
                Calendar groups
            </p>
            {groups.map((g) => {
                const isOpen = openGroupId === g.id;
                return (
                    <div
                        key={g.id}
                        className={`group/grp overflow-hidden rounded-xl border transition-colors shadow-sm ${
                            isOpen ? 'border-[var(--cal-accent)]/30' : ''
                        }`}
                        style={{
                            borderColor: isOpen ? undefined : 'var(--cal-border)',
                            backgroundColor: 'var(--cal-surface-raised)',
                        }}
                        onDoubleClick={() => onEditGroup(g)}
                        onContextMenu={(e) => {
                            e.preventDefault();
                            setMenuGroupId(g.id);
                        }}
                    >
                        <div className="flex items-center gap-2 px-2 py-2">
                            <button
                                type="button"
                                onClick={() => onOpenGroup(isOpen ? null : g.id)}
                                className="p-0.5 text-neutral-500 hover:text-white"
                            >
                                <ChevronRight
                                    size={14}
                                    className={`transition-transform duration-300 ${isOpen ? 'rotate-90' : ''}`}
                                />
                            </button>
                            <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: g.color }} />
                            <button
                                type="button"
                                onClick={() => onOpenGroup(isOpen ? null : g.id)}
                                className="min-w-0 flex-1 truncate text-left text-[11px] font-bold text-white"
                            >
                                {g.name}
                            </button>
                            <button
                                type="button"
                                onClick={() => onEditGroup(g)}
                                className="p-1 text-neutral-600 opacity-0 transition-opacity hover:text-white group-hover/grp:opacity-100"
                                title="Edit group"
                            >
                                <Pencil size={12} />
                            </button>
                            <input
                                type="checkbox"
                                checked={g.enabled}
                                onChange={(e) => update(g.id, { enabled: e.target.checked })}
                                className="accent-blue-500"
                                title="Show on calendar"
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                        {menuGroupId === g.id && (
                            <div className="border-t border-white/5 px-2 py-1">
                                <button
                                    type="button"
                                    className="w-full rounded px-2 py-1.5 text-left text-[11px] text-neutral-300 hover:bg-white/10"
                                    onClick={() => {
                                        onEditGroup(g);
                                        setMenuGroupId(null);
                                    }}
                                >
                                    Edit group
                                </button>
                            </div>
                        )}
                    </div>
                );
            })}

            {adding ? (
                <div className="space-y-2 rounded-lg border border-white/10 p-2">
                    <input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="Group name"
                        className="w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white outline-none"
                    />
                    <div className="flex flex-wrap gap-1">
                        {EVENT_COLOR_PRESETS.map((c) => (
                            <button
                                key={c}
                                type="button"
                                onClick={() => setNewColor(c)}
                                className={`h-6 w-6 rounded-md border-2 ${
                                    newColor === c ? 'border-white' : 'border-transparent'
                                }`}
                                style={{ backgroundColor: c }}
                            />
                        ))}
                    </div>
                    <input
                        type="color"
                        value={newColor}
                        onChange={(e) => setNewColor(normalizeHexColor(e.target.value))}
                        className="h-8 w-full cursor-pointer rounded border border-white/10 bg-black/40"
                    />
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setAdding(false)}
                            className="flex-1 rounded-lg py-1.5 text-[11px] font-bold text-neutral-500"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={addGroup}
                            className="flex-1 rounded-lg bg-blue-600 py-1.5 text-[11px] font-bold text-white"
                        >
                            Add
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => setAdding(true)}
                    className="glass-edge-btn flex w-full items-center justify-center gap-1 px-3 py-2 text-[11px] font-bold text-neutral-400"
                >
                    <Plus size={14} />
                    Add group
                </button>
            )}
        </div>
    );
}
