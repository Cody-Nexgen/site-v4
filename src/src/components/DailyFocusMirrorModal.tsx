import type { FutureSelfMirror } from '../lib/futureSelfTypes';

export function DailyFocusMirrorModal({
    mirror,
    onClose,
}: {
    mirror: FutureSelfMirror | null;
    onClose: () => void;
}) {
    if (!mirror) return null;
    const percent = mirror.plannedMinutes > 0
        ? Math.min(100, Math.round((mirror.completedMinutes / mirror.plannedMinutes) * 100))
        : 0;
    return (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
            <div className="w-full max-w-lg rounded-2xl border border-purple-500/25 bg-[#111114] p-7 text-white shadow-2xl">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-purple-400">Daily Focus Mirror · {mirror.date}</p>
                <h2 className="mt-2 text-2xl font-semibold">Yesterday, reflected honestly.</h2>
                <p className="mt-2 text-sm text-neutral-400">{mirror.contractGoal}</p>
                <div className="mt-6 grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                        <div className="text-2xl font-semibold">{mirror.completedMinutes}<span className="text-sm text-neutral-500"> / {mirror.plannedMinutes} min</span></div>
                        <div className="mt-1 text-[10px] uppercase tracking-wide text-neutral-500">Focus completed · {percent}%</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                        <div className="text-2xl font-semibold">{mirror.projectedDelayDays}</div>
                        <div className="mt-1 text-[10px] uppercase tracking-wide text-neutral-500">Projected pace delay days</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                        <div className="truncate text-lg font-semibold">{mirror.biggestDistraction || 'None'}</div>
                        <div className="mt-1 text-[10px] uppercase tracking-wide text-neutral-500">Biggest distraction</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                        <div className="text-lg font-semibold">{mirror.overrideCount} overrides · {mirror.blockCount} blocks</div>
                        <div className="mt-1 text-[10px] uppercase tracking-wide text-neutral-500">{mirror.promiseCount} broken promises</div>
                    </div>
                </div>
                <button onClick={onClose} className="mt-6 w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black">Carry the lesson forward</button>
            </div>
        </div>
    );
}
