import { useEffect, useState } from 'react';
import { Dialog } from './fz/Dialog';
import { Button } from './fz/Button';

type Props = {
    open: boolean;
    onClose: () => void;
    onSubmit: (name: string) => void | Promise<void>;
    /** Pre-fills the field — used for renaming. */
    initialName?: string;
    title?: string;
    submitLabel?: string;
};

export default function HabitNameModal({
    open,
    onClose,
    onSubmit,
    initialName = '',
    title = 'New habit',
    submitLabel = 'Add habit',
}: Props) {
    const [name, setName] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open) setName(initialName);
    }, [open, initialName]);

    const submit = async () => {
        const trimmed = name.trim();
        if (!trimmed || saving) return;
        setSaving(true);
        try {
            await onSubmit(trimmed);
            onClose();
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            size="sm"
            title={title}
            description={initialName ? undefined : 'Something small you want to do every day — meditate, deep work, exercise.'}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
                    <Button variant="primary" onClick={() => void submit()} disabled={!name.trim() || saving}>
                        {saving ? 'Saving…' : submitLabel}
                    </Button>
                </>
            }
        >
            <input
                autoFocus
                data-autofocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') void submit();
                }}
                placeholder="e.g. Meditate, Deep Work"
                className="w-full h-9 rounded-lg border border-[var(--fz-border)] bg-[var(--fz-bg-panel)] px-3 text-[13px] text-[var(--fz-text-1)] placeholder:text-[var(--fz-text-4)] outline-none focus:border-[var(--fz-accent)] focus-visible:outline-2 focus-visible:outline-[var(--fz-focus-ring)]"
            />
        </Dialog>
    );
}
