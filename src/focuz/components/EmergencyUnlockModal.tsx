import { useState } from 'react';

type Props = {
    open: boolean;
    domain: string;
    minReasonLength: number;
    onClose: () => void;
    onSubmit: (reason: string) => Promise<void>;
};

export function EmergencyUnlockModal({ open, domain, minReasonLength, onClose, onSubmit }: Props) {
    const [reason, setReason] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    if (!open) return null;

    const handleSubmit = async () => {
        setError('');
        if (reason.trim().length < minReasonLength) {
            setError(`Please write at least ${minReasonLength} characters explaining why.`);
            return;
        }
        setSubmitting(true);
        try {
            await onSubmit(reason.trim());
            setReason('');
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Request failed');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <div className="w-full max-w-lg p-8 space-y-5 border border-amber-500/30 rounded-3xl bg-[#111] shadow-2xl">
                <div className="text-center space-y-2">
                    <h3 className="text-2xl font-black text-white tracking-tight">Emergency Unlock</h3>
                    <p className="text-neutral-400 text-sm leading-relaxed">
                        This grants temporary access to <span className="text-amber-300 font-bold">{domain}</span>.
                        You must explain why — this is logged for accountability.
                    </p>
                </div>

                <textarea
                    autoFocus
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Why do you need access right now? Be honest — patterns are tracked."
                    rows={4}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-neutral-600 outline-none focus:border-amber-500 transition-all text-sm resize-none"
                />

                {error && <p className="text-sm text-red-400 font-medium">{error}</p>}

                <div className="flex space-x-3">
                    <button
                        type="button"
                        onClick={() => {
                            setReason('');
                            setError('');
                            onClose();
                        }}
                        className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-neutral-400 font-bold rounded-2xl transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        disabled={submitting || reason.trim().length < minReasonLength}
                        onClick={handleSubmit}
                        className="flex-1 py-4 font-black rounded-2xl transition-all bg-amber-600 text-white hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {submitting ? 'Requesting…' : 'Grant access'}
                    </button>
                </div>

                <p className="text-[10px] text-neutral-600 text-center">
                    Not available during Nuclear Lockdown. Limited uses per day.
                </p>
            </div>
        </div>
    );
}
