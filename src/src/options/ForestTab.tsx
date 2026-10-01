import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Crosshair, FlaskConical, Sprout, X } from 'lucide-react';
import { GlassCard } from './OptionsApp';
import { Banner } from '../components/fz/Banner';
import { Button } from '../components/fz/Button';
import { IconButton } from '../components/fz/IconButton';
import { Menu, type MenuItem } from '../components/fz/Menu';
import {
    type DisplayTree,
    type ForestState,
    FOREST_STORAGE_KEY,
    GROWTH_STAGES,
    SLIP_MULTIPLIER_FLOOR,
    SLIP_RECOVERY_MINUTES,
    computeDisplay,
    devClearSlip,
    devGrowAll,
    devPlantTrees,
    devResetForest,
    emptyForest,
    loadForest,
    minutesUntilGrowth,
    plantTreeFromSession,
    registerSlip,
    setNextPlantPos,
} from '../lib/forest';
import { DEV_MODE_EVENT, isDevModeEnabled } from '../lib/devMode';
import { useIsLightDashboard } from './lists/editorUtils';
import { ForestCanvas, TreePreview, type ForestCanvasHandle } from './forest/ForestCanvas';
import { SPECIES_LABEL } from './forest/forestArt';

const FOREST_TIP_KEY = 'focuznow-forest-tip-dismissed';
const DAY = 86_400_000;
/** Growth is measured in minutes, so a slow clock is plenty. */
const TICK_MS = 30_000;

function fmtDuration(min: number): string {
    if (min <= 0) return '0m';
    if (min < 1) return '<1m';
    const total = Math.round(min);
    if (total < 60) return `${total}m`;
    const h = Math.floor(total / 60);
    const m = total % 60;
    if (h < 48) return m ? `${h}h ${m}m` : `${h}h`;
    const d = Math.floor(h / 24);
    return h % 24 ? `${d}d ${h % 24}h` : `${d}d`;
}

function daysAgo(ts: number, now: number): string {
    const start = (t: number) => new Date(t).setHours(0, 0, 0, 0);
    const d = Math.round((start(now) - start(ts)) / DAY);
    if (d <= 0) return 'today';
    if (d === 1) return 'yesterday';
    return `${d} days ago`;
}

export const ForestTab = () => {
    const [state, setState] = useState<ForestState>(() => emptyForest());
    const [loaded, setLoaded] = useState(false);
    const [now, setNow] = useState(() => Date.now());
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [showTip, setShowTip] = useState(() => !localStorage.getItem(FOREST_TIP_KEY));
    const [devMode, setDevMode] = useState(() => isDevModeEnabled());
    const [devOpen, setDevOpen] = useState(false);
    const devRef = useRef<HTMLButtonElement>(null);
    const sceneRef = useRef<ForestCanvasHandle>(null);
    const isLight = useIsLightDashboard();

    const refresh = useCallback(async () => {
        const s = await loadForest();
        setState(s);
        setNow(Date.now());
        setLoaded(true);
    }, []);

    useEffect(() => {
        void loadForest().then((s) => {
            setState(s);
            setNow(Date.now());
            setLoaded(true);
        });
        const tick = setInterval(() => setNow(Date.now()), TICK_MS);
        let onChanged: ((changes: Record<string, chrome.storage.StorageChange>) => void) | null = null;
        if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
            onChanged = (changes) => {
                if (changes[FOREST_STORAGE_KEY]?.newValue) {
                    setState(changes[FOREST_STORAGE_KEY].newValue as ForestState);
                    setNow(Date.now());
                }
            };
            chrome.storage.onChanged.addListener(onChanged);
        }
        const onDevMode = () => setDevMode(isDevModeEnabled());
        window.addEventListener(DEV_MODE_EVENT, onDevMode);
        return () => {
            clearInterval(tick);
            window.removeEventListener(DEV_MODE_EVENT, onDevMode);
            if (onChanged) chrome.storage.onChanged.removeListener(onChanged);
        };
    }, []);

    const display = useMemo(() => computeDisplay(state, now), [state, now]);
    const selected = display.trees.find((t) => t.id === selectedId) ?? null;
    const recovering = display.recoveryRemainingMin > 0;
    const growthPct = Math.round(display.multiplier * 100);
    const plantedThisWeek = display.trees.filter((t) => t.plantedAt >= now - 7 * DAY).length;
    const stageCounts = GROWTH_STAGES.map((_, i) => display.trees.filter((t) => t.stageIndex === i).length);

    const pickCell = (gx: number, gy: number) => {
        const same = state.nextPlantPos?.gx === gx && state.nextPlantPos?.gy === gy;
        const next = same ? null : { gx, gy };
        setState((s) => ({ ...s, nextPlantPos: next }));
        void setNextPlantPos(next);
    };

    const clearSpot = () => {
        setState((s) => ({ ...s, nextPlantPos: null }));
        void setNextPlantPos(null);
    };

    const dev = (fn: () => Promise<unknown>) => () => void fn().then(refresh);
    const devItems: MenuItem[] = [
        { type: 'label', id: 'dev-label', label: 'Forest dev tools' },
        { id: 'plant', label: 'Plant a tree', onSelect: dev(() => plantTreeFromSession()) },
        { id: 'plant10', label: 'Plant 10 trees', onSelect: dev(() => devPlantTrees(10)) },
        { type: 'separator', id: 'sep-1' },
        { id: 'grow6', label: 'Grow everything 6h', onSelect: dev(() => devGrowAll(360)) },
        { id: 'grow24', label: 'Grow everything 24h', onSelect: dev(() => devGrowAll(1440)) },
        { type: 'separator', id: 'sep-2' },
        { id: 'slip', label: 'Simulate a slip', onSelect: dev(() => registerSlip('other')) },
        { id: 'recover', label: 'Clear slip penalty', onSelect: dev(() => devClearSlip()) },
        { type: 'separator', id: 'sep-3' },
        { id: 'reset', label: 'Reset forest', danger: true, onSelect: dev(() => devResetForest()) },
    ];
    const showDev = import.meta.env.DEV || devMode;

    return (
        <div className="space-y-6 animate-fade-in-up">
            {showTip && (
                <Banner
                    tone="info"
                    title="How your forest grows"
                    onDismiss={() => {
                        localStorage.setItem(FOREST_TIP_KEY, '1');
                        setShowTip(false);
                    }}
                >
                    Every finished focus session plants a tree, and trees keep growing while you stay off
                    distractions. Slip-ups only slow growth for a while — nothing is ever destroyed.
                </Banner>
            )}

            {/* Summary */}
            <GlassCard>
                <div className="grid grid-cols-2 sm:grid-cols-4 sm:divide-x sm:divide-[var(--fz-border)]">
                    {[
                        {
                            label: 'Trees',
                            value: display.trees.length,
                            sub: display.trees.length ? `${plantedThisWeek} planted this week` : 'None planted yet',
                        },
                        {
                            label: 'Fully grown',
                            value: display.matureCount,
                            sub: display.trees.length
                                ? `${display.trees.length - display.matureCount} still growing`
                                : 'Takes 24h of clean time',
                        },
                        {
                            label: 'Total growth',
                            value: fmtDuration(display.totalCleanMinutes),
                            sub: 'Clean time across all trees',
                        },
                        {
                            label: 'Growth rate',
                            value: `${growthPct}%`,
                            sub: recovering
                                ? `Full speed in ${fmtDuration(display.recoveryRemainingMin)}`
                                : display.slipsToday
                                    ? `${display.slipsToday} slip${display.slipsToday === 1 ? '' : 's'} today, recovered`
                                    : 'No slips today',
                        },
                    ].map((s) => (
                        <div key={s.label} className="px-5 py-4">
                            <p className="text-meta">{s.label}</p>
                            <p className="mt-0.5 text-[22px] font-semibold leading-7 tabular-nums text-[var(--fz-text-1)]">{s.value}</p>
                            <p className="text-meta mt-0.5 truncate">{s.sub}</p>
                        </div>
                    ))}
                </div>
            </GlassCard>

            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
                {/* Scene */}
                <GlassCard className="p-0">
                    <div className="h-[clamp(440px,calc(100vh-19rem),800px)]">
                        <ForestCanvas
                            ref={sceneRef}
                            trees={display.trees}
                            loaded={loaded}
                            nextPos={state.nextPlantPos}
                            selectedId={selectedId}
                            isLight={isLight}
                            onSelectTree={setSelectedId}
                            onPickCell={pickCell}
                            toolbarExtra={showDev && (
                                <>
                                    <span className="mx-1 h-4 w-px bg-[var(--fz-border)]" />
                                    <IconButton
                                        ref={devRef}
                                        icon={<FlaskConical size={14} />}
                                        tooltip="Dev tools"
                                        active={devOpen}
                                        onClick={() => setDevOpen((o) => !o)}
                                    />
                                    <Menu open={devOpen} onClose={() => setDevOpen(false)} anchor={devRef} side="top" items={devItems} />
                                </>
                            )}
                        >
                            {display.trees.length > 0 && (
                                <div className="pointer-events-none absolute left-3 top-3 z-10 flex items-center gap-2 rounded-full border border-[var(--fz-border)] bg-[var(--fz-bg-overlay)] px-3 py-1.5 text-[12px] font-medium text-[var(--fz-text-2)] shadow-sm">
                                    <span className={`size-1.5 rounded-full ${recovering ? 'bg-[var(--fz-warning)]' : 'bg-[var(--fz-success)]'}`} />
                                    {recovering
                                        ? `Growing at ${growthPct}% · full speed in ${fmtDuration(display.recoveryRemainingMin)}`
                                        : 'Growing at full speed'}
                                </div>
                            )}
                            {loaded && display.trees.length === 0 && (
                                <div className="pointer-events-none absolute inset-x-0 top-[14%] z-10 flex justify-center px-4">
                                    <div className="flex max-w-sm flex-col items-center rounded-xl border border-[var(--fz-border)] bg-[var(--fz-bg-overlay)] px-6 py-5 text-center shadow-lg">
                                        <TreePreview species="oak" stageIndex={1} progress={0.6} width={44} height={40} isLight={isLight} />
                                        <p className="mt-2 text-[15px] font-semibold text-[var(--fz-text-1)]">Plant your first tree</p>
                                        <p className="mt-1 text-body-sm text-[var(--fz-text-3)]">
                                            Finish a Pomodoro or Deep Work session and a seed lands here. Click a tile
                                            first if you want to choose the spot.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </ForestCanvas>
                    </div>
                </GlassCard>

                {/* Side panel */}
                <div className="space-y-6">
                    {selected ? (
                        <SelectedTree
                            tree={selected}
                            state={state}
                            now={now}
                            recoveryRemainingMin={display.recoveryRemainingMin}
                            isLight={isLight}
                            onClose={() => setSelectedId(null)}
                            onFocus={() => sceneRef.current?.focusCell(selected.gx, selected.gy)}
                        />
                    ) : (
                        <GlassCard>
                            <div className="p-4">
                                <div className="flex items-center gap-2">
                                    <Sprout size={15} className="text-[var(--fz-text-3)]" />
                                    <p className="text-[14px] font-semibold text-[var(--fz-text-1)]">Next tree</p>
                                </div>
                                <p className="mt-1.5 text-body-sm text-[var(--fz-text-3)]">
                                    {state.nextPlantPos
                                        ? 'It will grow on the spot you picked — the dashed tile in your forest.'
                                        : 'It will grow in the next open spot near the middle. Click any empty tile to pick a spot yourself.'}
                                </p>
                                {state.nextPlantPos && (
                                    <div className="mt-3 flex gap-2">
                                        <Button
                                            size="sm"
                                            iconLeft={<Crosshair size={13} />}
                                            onClick={() => sceneRef.current?.focusCell(state.nextPlantPos!.gx, state.nextPlantPos!.gy)}
                                        >
                                            Show spot
                                        </Button>
                                        <Button size="sm" variant="ghost" onClick={clearSpot}>
                                            Clear
                                        </Button>
                                    </div>
                                )}
                                <p className="text-meta mt-3">Plants when you finish a Pomodoro or Deep Work session.</p>
                            </div>
                        </GlassCard>
                    )}

                    <GlassCard>
                        <div className="px-4 pb-1 pt-4">
                            <p className="text-[14px] font-semibold text-[var(--fz-text-1)]">Growth stages</p>
                            <p className="text-meta mt-0.5">Clean time a tree needs to reach each stage</p>
                        </div>
                        <ul className="px-2 pb-2">
                            {GROWTH_STAGES.map((s, i) => (
                                <li key={s.key} className="flex items-center gap-3 rounded-lg px-2 py-1">
                                    <span className="flex h-11 w-10 shrink-0 items-end justify-center">
                                        <TreePreview
                                            species={i === 4 ? 'pine' : 'oak'}
                                            stageIndex={i}
                                            progress={i === 4 ? 1 : 0}
                                            id={`legend-${i}`}
                                            width={40}
                                            height={44}
                                            scale={i < 2 ? 0.9 : 0.36}
                                            isLight={isLight}
                                        />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-[13px] font-medium text-[var(--fz-text-1)]">{s.label}</span>
                                        <span className="text-meta block">{s.atMinutes ? `After ${fmtDuration(s.atMinutes)}` : 'When planted'}</span>
                                    </span>
                                    <span className="text-[13px] font-medium tabular-nums text-[var(--fz-text-2)]" title={`${stageCounts[i]} ${s.label.toLowerCase()}`}>
                                        {stageCounts[i]}
                                    </span>
                                </li>
                            ))}
                        </ul>
                        <p className="border-t border-[var(--fz-border)] px-4 py-3 text-meta leading-relaxed">
                            Visiting a blocked site drops growth to {Math.round(SLIP_MULTIPLIER_FLOOR * 100)}%, and it
                            climbs back to full speed over {SLIP_RECOVERY_MINUTES} minutes. Trees are never lost.
                        </p>
                    </GlassCard>
                </div>
            </div>
        </div>
    );
};

function SelectedTree({
    tree,
    state,
    now,
    recoveryRemainingMin,
    isLight,
    onClose,
    onFocus,
}: {
    tree: DisplayTree;
    state: ForestState;
    now: number;
    recoveryRemainingMin: number;
    isLight: boolean;
    onClose: () => void;
    onFocus: () => void;
}) {
    const stage = GROWTH_STAGES[tree.stageIndex];
    const next = GROWTH_STAGES[tree.stageIndex + 1];
    const eta = next ? minutesUntilGrowth(state.lastSlipAt, now, next.atMinutes - tree.displayMinutes) : 0;
    const planted = new Date(tree.plantedAt);

    return (
        <GlassCard>
            <div className="flex items-start gap-3 p-4">
                <button
                    type="button"
                    onClick={onFocus}
                    title="Show in forest"
                    className="flex size-16 shrink-0 items-end justify-center overflow-hidden rounded-lg bg-[color-mix(in_srgb,var(--fz-success)_14%,transparent)] pb-0.5 transition-opacity hover:opacity-80"
                >
                    <TreePreview
                        species={tree.species}
                        stageIndex={tree.stageIndex}
                        progress={tree.progress}
                        id={tree.id}
                        width={60}
                        height={62}
                        isLight={isLight}
                    />
                </button>
                <div className="min-w-0 flex-1 pt-0.5">
                    <p className="text-meta">{SPECIES_LABEL[tree.species]}</p>
                    <p className="text-[15px] font-semibold text-[var(--fz-text-1)]">{stage.label}</p>
                    <p className="text-meta mt-0.5">
                        Planted {planted.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {daysAgo(tree.plantedAt, now)}
                    </p>
                </div>
                <IconButton icon={<X size={14} />} tooltip="Close" onClick={onClose} />
            </div>

            <div className="border-t border-[var(--fz-border)] px-4 py-3.5">
                <div className="flex gap-1" aria-label={`Stage ${tree.stageIndex + 1} of ${GROWTH_STAGES.length}`}>
                    {GROWTH_STAGES.slice(1).map((s, i) => {
                        const fill = tree.stageIndex > i ? 1 : tree.stageIndex === i ? tree.progress : 0;
                        return (
                            <span key={s.key} className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--fz-bg-active)]">
                                <span className="block h-full rounded-full bg-[var(--fz-accent)]" style={{ width: `${fill * 100}%` }} />
                            </span>
                        );
                    })}
                </div>
                <p className="mt-2.5 text-body-sm text-[var(--fz-text-2)]">
                    {next
                        ? `${Math.round(tree.progress * 100)}% of the way to ${next.label.toLowerCase()}. ${eta < 1 ? 'Almost there.' : `About ${fmtDuration(eta)} of clean time to go.`}`
                        : 'Fully grown. It stays in your forest for good.'}
                </p>
                {next && recoveryRemainingMin > 0 && (
                    <p className="text-meta mt-1">Growing slower for {fmtDuration(recoveryRemainingMin)} after a recent slip.</p>
                )}
            </div>

            <div className="grid grid-cols-2 divide-x divide-[var(--fz-border)] border-t border-[var(--fz-border)]">
                <div className="px-4 py-3">
                    <p className="text-meta">Clean growth</p>
                    <p className="mt-0.5 text-[15px] font-semibold tabular-nums text-[var(--fz-text-1)]">{fmtDuration(tree.displayMinutes)}</p>
                </div>
                <div className="px-4 py-3">
                    <p className="text-meta">Stage</p>
                    <p className="mt-0.5 text-[15px] font-semibold tabular-nums text-[var(--fz-text-1)]">
                        {tree.stageIndex + 1} of {GROWTH_STAGES.length}
                    </p>
                </div>
            </div>
        </GlassCard>
    );
}

export default ForestTab;
