import { useEffect, useState } from 'react';
import type { FutureSelfMirror } from '../lib/futureSelfTypes';
import { Dialog } from './fz/Dialog';
import { Button } from './fz/Button';

function CountUp({ value }: { value: number }) {
    const [n, setN] = useState(0);
    useEffect(() => {
        let raf = 0;
        const start = performance.now();
        const dur = 600;
        const tick = (t: number) => {
            const p = Math.min(1, (t - start) / dur);
            setN(Math.round(value * (1 - Math.pow(1 - p, 3))));
            if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [value]);
    return <>{n}</>;
}

export function DailyFocusMirrorModal({
    mirror,
    onClose,
}: {
    mirror: FutureSelfMirror | null;
    onClose: () => void;
}) {
    const percent = mirror && mirror.plannedMinutes > 0
        ? Math.min(100, Math.round((mirror.completedMinutes / mirror.plannedMinutes) * 100))
        : 0;
    return (
        <Dialog
            open={mirror !== null}
            onClose={onClose}
            title="Daily focus mirror"
            size="md"
            footer={<Button variant="primary" onClick={onClose} className="w-full">Close</Button>}
        >
            {mirror && (
                <div>
                    <p className="text-meta text-[var(--fz-text-3)]">{mirror.date}</p>
                    <p className="mt-1 text-title-2">Yesterday, reflected honestly.</p>
                    <p className="mt-2 text-body-sm text-[var(--fz-text-3)]">{mirror.contractGoal}</p>
                    <div className="mt-5 grid grid-cols-3 gap-3">
                        <div className="rounded-lg border border-[var(--fz-border)] bg-[var(--fz-bg-raised)] p-3.5">
                            <div className="text-stat text-[var(--fz-text-1)]">
                                <CountUp value={mirror.completedMinutes} />
                                <span className="text-meta"> / {mirror.plannedMinutes}m</span>
                            </div>
                            <div className="mt-1 text-meta text-[var(--fz-text-4)]">Focus completed · {percent}%</div>
                        </div>
                        <div className="rounded-lg border border-[var(--fz-border)] bg-[var(--fz-bg-raised)] p-3.5">
                            <div className="text-stat text-[var(--fz-text-1)]"><CountUp value={mirror.projectedDelayDays} /></div>
                            <div className="mt-1 text-meta text-[var(--fz-text-4)]">Projected delay days</div>
                        </div>
                        <div className="rounded-lg border border-[var(--fz-border)] bg-[var(--fz-bg-raised)] p-3.5">
                            <div className="truncate text-stat text-[var(--fz-text-1)]" style={{ fontSize: 20 }}>{mirror.biggestDistraction || 'None'}</div>
                            <div className="mt-1 text-meta text-[var(--fz-text-4)]">Biggest distraction</div>
                        </div>
                    </div>
                    <p className="mt-3 text-meta text-[var(--fz-text-4)]">
                        {mirror.overrideCount} overrides · {mirror.blockCount} blocks · {mirror.promiseCount} broken promises
                    </p>
                </div>
            )}
        </Dialog>
    );
}
