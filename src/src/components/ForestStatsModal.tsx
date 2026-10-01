import { Trees, Sprout, Clock, Gauge } from 'lucide-react';
import { Dialog } from './fz/Dialog';
import type { ForestDisplay } from '../lib/forest';

type Props = {
    open: boolean;
    onClose: () => void;
    display: ForestDisplay;
    fmtClean: (min: number) => string;
};

export default function ForestStatsModal({ open, onClose, display, fmtClean }: Props) {
    const recovering = display.recoveryRemainingMin > 0;
    const growthPct = Math.round(display.multiplier * 100);

    return (
        <Dialog open={open} onClose={onClose} title="Forest stats" size="md">
            <div className="grid grid-cols-2 gap-3">
                <Stat icon={<Trees size={14} className="text-[var(--fz-success)]" />} label="Trees" value={display.trees.length} />
                <Stat icon={<Sprout size={14} className="text-lime-400" />} label="Mature" value={display.matureCount} />
                <Stat icon={<Clock size={14} className="text-[var(--fz-accent)]" />} label="Clean growth" value={fmtClean(display.totalCleanMinutes)} />
                <Stat
                    icon={<Gauge size={14} className={recovering ? 'text-[var(--fz-warning)]' : 'text-[var(--fz-success)]'} />}
                    label="Growth rate"
                    value={`${growthPct}%`}
                    sub={recovering ? `Recovering · ${Math.ceil(display.recoveryRemainingMin)}m` : 'Full speed'}
                />
            </div>
            <p className="mt-4 text-body-sm text-[var(--fz-text-3)]">
                Every focus session plants a tree. Slip-ups slow growth — they never destroy your forest.
            </p>
        </Dialog>
    );
}

function Stat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string | number; sub?: string }) {
    return (
        <div className="rounded-lg border border-[var(--fz-border)] bg-[var(--fz-bg-raised)] p-3">
            <div className="flex items-center gap-1.5 text-meta text-[var(--fz-text-3)]">
                {icon} {label}
            </div>
            <div className="text-stat mt-1 text-[var(--fz-text-1)]">{value}</div>
            {sub && <div className="mt-0.5 text-[11px] text-[var(--fz-text-4)]">{sub}</div>}
        </div>
    );
}
