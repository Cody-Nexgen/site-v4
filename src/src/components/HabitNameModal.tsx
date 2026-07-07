import { useEffect, useState } from 'react';
import SimpleModal from './SimpleModal';

type Props = {
    open: boolean;
    onClose: () => void;
    onSubmit: (name: string) => void | Promise<void>;
};

export default function HabitNameModal({ open, onClose, onSubmit }: Props) {
    const [name, setName] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open) setName('');
    }, [open]);

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
        <SimpleModal
            open={open}
            title="New habit"
            description="Name something you want to do every day — meditate, deep work, exercise, etc."
            onClose={onClose}
        >
            <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') void submit();
                }}
                placeholder="e.g. Meditate, Deep Work"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-neutral-600 outline-none focus:border-purple-500 text-sm"
            />
            <div className="flex gap-2 pt-1">
                <button
                    type="button"
                    onClick={onClose}
                    disabled={saving}
                    className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 text-sm font-bold"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={() => void submit()}
                    disabled={!name.trim() || saving}
                    className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    {saving ? 'Adding…' : 'Add habit'}
                </button>
            </div>
        </SimpleModal>
    );
}
