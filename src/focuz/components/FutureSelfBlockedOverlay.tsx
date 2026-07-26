import { useState } from 'react';
import type { FutureSelfBlockedSummary } from '../lib/futureSelfTypes';

export function FutureSelfBlockedOverlay({
    url,
    summary,
}: {
    url: string;
    summary: FutureSelfBlockedSummary;
}) {
    const [overrideOpen, setOverrideOpen] = useState(false);
    const [confirmed, setConfirmed] = useState(false);
    const [reason, setReason] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const override = async () => {
        setSaving(true);
        setError('');
        const response = await chrome.runtime.sendMessage({
            type: 'FUTURE_SELF_OVERRIDE',
            url,
            reason,
            confirmed,
        });
        setSaving(false);
        if (!response?.ok) {
            setError(response?.error || 'Override denied.');
            return;
        }
        window.location.href = url;
    };

    return (
        <div className="relative z-10 w-full max-w-2xl rounded-3xl border border-purple-500/30 bg-[#0d0d11] p-7 text-white shadow-2xl sm:p-9">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-purple-400">A message from your Future Self</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">Protect the promise you made.</h1>
            <p className="mt-3 text-sm leading-relaxed text-neutral-400">{summary.contract.overarchingGoal}</p>
            <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.035] p-4">
                <div className="flex items-center justify-between text-xs text-neutral-400">
                    <span>{summary.completedMinutes} min focused</span>
                    <span>{summary.remainingMinutes} min remaining</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-purple-500" style={{ width: `${summary.progressPercent}%` }} />
                </div>
                <p className="mt-3 text-sm font-medium text-white">Current mission: {summary.contract.mission}</p>
                <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                    {[
                        ['Promises', summary.pastPromises],
                        ['Overrides', summary.overrides],
                        ['Blocks', summary.blocks],
                        ['Breaks', summary.breaks],
                    ].map(([label, value]) => (
                        <div key={label} className="rounded-lg bg-black/30 p-2">
                            <div className="text-lg font-semibold">{value}</div>
                            <div className="text-[9px] uppercase tracking-wide text-neutral-500">{label}</div>
                        </div>
                    ))}
                </div>
            </div>
            {!overrideOpen ? (
                <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                    <button onClick={() => window.history.back()} className="flex-1 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black">Return to the work</button>
                    <button onClick={() => setOverrideOpen(true)} className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-300">Counted override</button>
                </div>
            ) : (
                <div className="mt-6 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-4">
                    <p className="text-sm font-semibold text-amber-200">Break this promise deliberately?</p>
                    <textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain why this is worth delaying your goal…" className="mt-3 min-h-20 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none" />
                    <label className="mt-3 flex items-start gap-2 text-xs text-neutral-300">
                        <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5" />
                        I understand this is counted as a broken promise in my Focus Mirror.
                    </label>
                    {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
                    <div className="mt-4 flex gap-2">
                        <button onClick={() => setOverrideOpen(false)} className="flex-1 rounded-lg border border-white/10 px-3 py-2 text-xs">Keep promise</button>
                        <button disabled={saving || !confirmed || reason.trim().length < 10} onClick={() => void override()} className="flex-1 rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-black disabled:opacity-40">{saving ? 'Unlocking…' : 'Override & count it'}</button>
                    </div>
                </div>
            )}
        </div>
    );
}
