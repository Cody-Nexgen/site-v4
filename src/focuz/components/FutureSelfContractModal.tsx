import { useEffect, useState } from 'react';
import type { FutureSelfContract, FutureSelfDestination } from '../lib/futureSelfTypes';

type Props = {
    open: boolean;
    isPro: boolean;
    focusMinutes: number;
    onClose: () => void;
    onUpgrade: () => void;
    onStarted: (contract: FutureSelfContract) => void;
};

export function FutureSelfContractModal({
    open,
    isPro,
    focusMinutes,
    onClose,
    onUpgrade,
    onStarted,
}: Props) {
    const [mission, setMission] = useState('');
    const [goal, setGoal] = useState('');
    const [targetDate, setTargetDate] = useState('');
    const [plannedMinutes, setPlannedMinutes] = useState(focusMinutes);
    const [destination, setDestination] = useState<FutureSelfDestination | null>(null);
    const [url, setUrl] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open || !isPro) return;
        void chrome.runtime.sendMessage({ type: 'FUTURE_SELF_ACTIVE_TAB' }).then((response) => {
            if (response?.destination) {
                setDestination(response.destination);
                setUrl(response.destination.url);
            }
        });
    }, [open, isPro]);

    if (!open) return null;

    if (!isPro) {
        return (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
                <div className="w-full max-w-md rounded-2xl border border-purple-500/30 bg-[#111114] p-7 text-center shadow-2xl">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-purple-400">Pro feature</p>
                    <h2 className="mt-3 text-2xl font-semibold text-white">Meet your Future Self</h2>
                    <p className="mt-3 text-sm leading-relaxed text-neutral-400">
                        Build a focus contract, count deliberate overrides, and receive a private daily Focus Mirror.
                    </p>
                    <div className="mt-6 flex gap-2">
                        <button onClick={onClose} className="flex-1 rounded-lg border border-white/10 px-4 py-2.5 text-sm text-neutral-300">Not now</button>
                        <button onClick={onUpgrade} className="flex-1 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white">Upgrade to Pro</button>
                    </div>
                </div>
            </div>
        );
    }

    const submit = async () => {
        setSaving(true);
        setError('');
        const response = await chrome.runtime.sendMessage({
            type: 'FUTURE_SELF_START',
            contract: {
                mission,
                overarchingGoal: goal,
                futureTargetDate: targetDate,
                plannedMinutesPerDay: plannedMinutes,
                destination: { ...(destination || {}), url },
            },
        });
        setSaving(false);
        if (!response?.ok) {
            setError(response?.error || 'Could not create the contract.');
            return;
        }
        onStarted(response.contract);
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-md">
            <div className="my-6 w-full max-w-xl rounded-2xl border border-purple-500/25 bg-[#111114] p-6 shadow-2xl">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-purple-400">Future Self contract</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">What will this focus protect?</h2>
                <div className="mt-5 grid gap-4">
                    <label className="text-xs text-neutral-400">Mission for this focus
                        <input value={mission} onChange={(event) => setMission(event.target.value)} placeholder="Finish the launch proposal" className="mt-1.5 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-purple-500/60" />
                    </label>
                    <label className="text-xs text-neutral-400">Overarching goal
                        <textarea value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="Build a sustainable independent business" className="mt-1.5 min-h-20 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-purple-500/60" />
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                        <label className="text-xs text-neutral-400">Future target date
                            <input type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} className="mt-1.5 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white" />
                        </label>
                        <label className="text-xs text-neutral-400">Planned minutes / day
                            <input type="number" min={1} max={720} value={plannedMinutes} onChange={(event) => setPlannedMinutes(Number(event.target.value))} className="mt-1.5 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white" />
                        </label>
                    </div>
                    <label className="text-xs text-neutral-400">Allowed work destination
                        <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3">
                            {destination?.faviconUrl && <img src={destination.faviconUrl} alt="" className="h-4 w-4 rounded" />}
                            <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://docs.example.com" className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-white outline-none" />
                        </div>
                        <span className="mt-1 block text-[10px] text-neutral-600">Uses your current active tab when available, or enter another URL.</span>
                    </label>
                </div>
                {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
                <div className="mt-6 flex gap-2">
                    <button onClick={onClose} className="flex-1 rounded-lg border border-white/10 px-4 py-2.5 text-sm text-neutral-300">Cancel</button>
                    <button disabled={saving} onClick={() => void submit()} className="flex-1 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Creating…' : 'Commit & start'}</button>
                </div>
            </div>
        </div>
    );
}
