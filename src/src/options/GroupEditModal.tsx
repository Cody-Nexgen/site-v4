import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { EVENT_COLOR_PRESETS, normalizeHexColor } from '../lib/calendarUtils';
import type { CalendarGroup } from '../lib/schedulingTypes';
import { Dialog } from '../components/fz/Dialog';
import { Button } from '../components/fz/Button';
import { IconButton } from '../components/fz/IconButton';
import { Field, Input } from '../components/fz/Field';

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
        <Dialog
            open
            onClose={onClose}
            title="Edit group"
            size="sm"
            footer={
                <>
                    {onDelete && (
                        <IconButton
                            icon={<Trash2 size={15} />}
                            tooltip="Delete group"
                            className="mr-auto text-[var(--fz-danger)]"
                            onClick={() => {
                                if (onDelete()) onClose();
                            }}
                        />
                    )}
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button
                        variant="primary"
                        onClick={() => {
                            if (!name.trim()) return;
                            onSave({ name: name.trim(), color: normalizeHexColor(color) });
                            onClose();
                        }}
                    >
                        Save
                    </Button>
                </>
            }
        >
            <Field label="Name">
                <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </Field>
            <p className="text-label text-[var(--fz-text-3)] mb-2">Color</p>
            <div className="mb-3 flex flex-wrap gap-2">
                {EVENT_COLOR_PRESETS.map((c) => (
                    <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        className={`h-7 w-7 rounded-md border-2 transition-transform ${color === c ? 'border-[var(--fz-text-1)]' : 'border-transparent'}`}
                        style={{ backgroundColor: c }}
                        aria-label={`Color ${c}`}
                    />
                ))}
            </div>
            <input
                type="color"
                value={color}
                onChange={(e) => setColor(normalizeHexColor(e.target.value))}
                className="h-9 w-full cursor-pointer rounded-lg border border-[var(--fz-border)] bg-[var(--fz-bg-raised)]"
                aria-label="Custom color"
            />
        </Dialog>
    );
}
