import { useCallback, useEffect, useMemo, useState } from 'react';
import { Trees, Sprout, Clock, Gauge, ArrowLeft } from 'lucide-react';
import {
    type ForestState,
    computeDisplay,
    emptyForest,
    loadForest,
    FOREST_STORAGE_KEY,
} from '../lib/forest';

type Props = {
    onBack?: () => void;
};

export default function ForestStatsTab({ onBack }: Props) {
    const [state, setState] = useState<ForestState>(() => emptyForest());
    const [now, setNow] = useState(() => Date.now());

    const refresh = useCallback(async () => {
        setState(await loadForest());
    }, []);

    useEffect(() => {
        void refresh();
        const tick = setInterval(() => setNow(Date.now()), 5000);
        const onChanged = (changes: Record<string, chrome.storage.StorageChange>) => {
            if (changes[FOREST_STORAGE_KEY]?.newValue) {
                setState(changes[FOREST_STORAGE_KEY].newValue as ForestState);
            }
        };
        chrome.storage.onChanged.addListener(onChanged);
        return () => {
            clearInterval(tick);
            chrome.storage.onChanged.removeListener(onChanged);
        };
    }, [refresh]);

    const display = useMemo(() => computeDisplay(state, now), [state, now]);
    const recovering = display.recoveryRemainingMin > 0;
    const growthPct = Math.round(display.multiplier * 100);

    const fmtClean = (min: number) => {
        if (min < 60) return `${Math.round(min)}m`;
        const h = Math.floor(min / 60);
        if (h < 48) return `${h}h ${Math.round(min % 60)}m`;
        return `${Math.floor(h / 24)}d ${h % 24}h`;
    };

    return (
        <div className="space-y-8 pt-6 animate-fade-in-up max-w-4xl pb-20">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="focuz-section-label mb-1">Progress</p>
                    <h1 className="text-4xl font-black text-white tracking-tighter">Forest Stats</h1>
                    <p className="text-neutral-400 mt-2 text-sm">Growth metrics from your infinite forest.</p>
                </div>
                {onBack && (
                    <button type="button" onClick={onBack} className="focuz-btn-ghost flex items-center gap-1.5">
                        <ArrowLeft size={14} /> Forest
                    </button>
                )}
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatTile icon={<Trees size={14} className="text-emerald-400" />} label="Trees planted" value={display.trees.length} sub="1 per focus session" />
                <StatTile icon={<Sprout size={14} className="text-lime-400" />} label="Mature trees" value={display.matureCount} sub="fully grown" />
                <StatTile icon={<Clock size={14} className="text-sky-400" />} label="Clean growth" value={fmtClean(display.totalCleanMinutes)} sub="total forest time" />
                <StatTile
                    icon={<Gauge size={14} className={recovering ? 'text-amber-400' : 'text-emerald-400'} />}
                    label="Growth rate"
                    value={`${growthPct}%`}
                    sub={recovering ? `Recovering · ${Math.ceil(display.recoveryRemainingMin)}m left` : 'Full speed'}
                    highlight={recovering}
                />
            </div>

            <div className="focuz-surface-card p-6">
                <h2 className="text-sm font-bold text-white mb-4">How growth works</h2>
                <ul className="space-y-3 text-sm text-neutral-400">
                    <li>Every completed focus session plants a tree at your chosen spot.</li>
                    <li>Trees grow while you stay clean — no blocked sites, Shorts, or doom-scrolling.</li>
                    <li>Slip-ups never destroy trees; they slow growth for about 90 minutes.</li>
                    <li>Explore forever in the 3D forest — WASD to walk, mouse to look.</li>
                </ul>
            </div>
        </div>
    );
}

function StatTile({
    icon,
    label,
    value,
    sub,
    highlight,
}: {
    icon: React.ReactNode;
    label: string;
    value: string | number;
    sub: string;
    highlight?: boolean;
}) {
    return (
        <div className={`focuz-surface-card p-4 ${highlight ? 'border-amber-500/25' : ''}`}>
            <div className="flex items-center gap-2 text-neutral-500 text-[10px] font-bold uppercase tracking-widest">
                {icon} {label}
            </div>
            <div className="text-2xl font-bold text-white mt-2">{value}</div>
            <div className="text-[11px] text-neutral-500 mt-0.5">{sub}</div>
        </div>
    );
}
