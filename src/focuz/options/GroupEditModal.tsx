import { useState } from 'react';
import { motion } from 'framer-motion';
import { Trash2, X } from 'lucide-react';
import { EVENT_COLOR_PRESETS, normalizeHexColor } from '../lib/calendarUtils';
import type { CalendarGroup } from '../lib/schedulingTypes';

export default function GroupEditModal({
    group,
    onClose,
    onSave,
    onDelete,
}: {
    group: CalendarGroup;
    onClose: () => void;
    onSave: (patch: Pick<CalendarGroup, 'name' | 'color'>) => void;
    onDelete?: () => boolean;
}) {
    const [name, setName] = useState(group.name);
    const [color, setColor] = useState(group.color);

    return (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#1a1a1a] p-5 shadow-2xl"
            >
                <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-sm font-black text-white">Edit group</h3>
                    <button type="button" onClick={onClose} className="text-neutral-500 hover:text-white">
                        <X size={18} />
                    </button>
                </div>
                <label className="mb-3 block space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Name</span>
                    <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
                    />
                </label>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-neutral-500">Color</p>
                <motion.div className="mb-3 flex flex-wrap gap-2">
                    {EVENT_COLOR_PRESETS.map((c) => (
                        <button
                            key={c}
                            type="button"
                            onClick={() => setColor(c)}
                            className={`h-7 w-7 rounded-lg border-2 ${color === c ? 'border-white' : 'border-transparent'}`}
                            style={{ backgroundColor: c }}
                        />
                    ))}
                </motion.div>
                <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(normalizeHexColor(e.target.value))}
                    className="mb-4 h-9 w-full cursor-pointer rounded-lg border border-white/10 bg-black/40"
                />
                <motion.div className="flex gap-2">
                    {onDelete && (
                        <button
                            type="button"
                            onClick={() => {
                                if (onDelete()) onClose();
                            }}
                            className="rounded-xl px-3 py-2.5 text-red-400 hover:bg-red-500/10"
                            title="Delete group"
                        >
                            <Trash2 size={16} />
                        </button>
                    )}
                    <button type="button" onClick={onClose} className="flex-1 rounded-xl py-2.5 text-sm font-bold text-neutral-400">
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            if (!name.trim()) return;
                            onSave({ name: name.trim(), color: normalizeHexColor(color) });
                            onClose();
                        }}
                        className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white"
                    >
                        Save
                    </button>
                </motion.div>
            </motion.div>
        </div>
    );
}
