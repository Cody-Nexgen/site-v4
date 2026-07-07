import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
    Trees, Sprout, Leaf, BarChart3,
} from 'lucide-react';
import { GlassCard } from './OptionsApp';
import ForestStatsModal from '../components/ForestStatsModal';
import {
    type DisplayTree,
    type ForestState,
    type TreeSpecies,
    FOREST_STORAGE_KEY,
    GROWTH_STAGES,
    boardRadius,
    computeDisplay,
    devClearSlip,
    devGrowAll,
    devPlantTrees,
    devResetForest,
    emptyForest,
    loadForest,
    plantTreeFromSession,
    registerSlip,
    setNextPlantPos,
} from '../lib/forest';
import { DEV_MODE_EVENT, isDevModeEnabled } from '../lib/devMode';

const FOREST_TIP_KEY = 'focuznow-forest-tip-dismissed';
const FOREST_SPLASH_KEY = 'focuznow-forest-splash-v2';
const VIEW_RADIUS_BASE = 16;

// ---------------------------------------------------------
// Isometric projection
// ---------------------------------------------------------

const TILE_W = 100;
const TILE_H = 50;

function rotateCoord(gx: number, gy: number, rot: number): { rx: number; ry: number } {
    let x = gx;
    let y = gy;
    for (let i = 0; i < rot % 4; i++) {
        const t = x;
        x = y;
        y = -t;
    }
    return { rx: x, ry: y };
}

function project(rx: number, ry: number): { x: number; y: number } {
    return { x: ((rx - ry) * TILE_W) / 2, y: ((rx + ry) * TILE_H) / 2 };
}

function hashSeed(id: string): number {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
    return Math.abs(h);
}

// ---------------------------------------------------------
// Species palettes
// ---------------------------------------------------------

const SPECIES_COLORS: Record<TreeSpecies, { hi: string; lo: string; trunk: string }> = {
    pine: { hi: '#3f9d6e', lo: '#1d5c3e', trunk: '#6b4a32' },
    oak: { hi: '#6cb464', lo: '#39743f', trunk: '#7a5236' },
    birch: { hi: '#a3cf7a', lo: '#6da34f', trunk: '#e0dbc9' },
    cherry: { hi: '#ef9db4', lo: '#c9647f', trunk: '#74504a' },
};

// ---------------------------------------------------------
// Tree sprite — continuous growth: size blends stage + progress
// ---------------------------------------------------------

function TreeSprite({ tree }: { tree: DisplayTree }) {
    const seed = hashSeed(tree.id);
    const c = SPECIES_COLORS[tree.species];
    const swayDelay = -(seed % 47) / 10;
    const swayDur = 5 + (seed % 30) / 10;
    const growth = Math.min(4, tree.stageIndex + tree.progress); // 0..4 continuous

    // Seed: a small mound of soil with a glint
    if (tree.stageIndex === 0) {
        return (
            <g>
                <ellipse cx="0" cy="-1" rx="11" ry="5" fill="#241a12" />
                <ellipse cx="0" cy="-3" rx="8" ry="4" fill="#38281a" />
                <circle cx="0" cy="-5" r="1.6" fill="#c9e4a5" opacity={0.5 + tree.progress * 0.5} />
            </g>
        );
    }

    // Sprout: stem with two leaves
    if (tree.stageIndex === 1) {
        const s = 0.75 + tree.progress * 0.5;
        return (
            <g transform={`scale(${s})`}>
                <ellipse cx="0" cy="-1" rx="10" ry="4" fill="rgba(0,0,0,0.28)" />
                <g className="forest-sway" style={{ animationDelay: `${swayDelay}s`, animationDuration: `${swayDur}s` }}>
                    <path d="M0,-2 C0,-8 0,-12 0,-16" stroke="#5f8f4e" strokeWidth="2.4" fill="none" strokeLinecap="round" />
                    <path d="M0,-11 C-6,-13 -9,-18 -8,-22 C-3,-20 -1,-16 0,-11 Z" fill={c.hi} />
                    <path d="M0,-13 C5,-15 8,-20 7,-24 C3,-22 1,-18 0,-13 Z" fill={c.lo} />
                </g>
            </g>
        );
    }

    // Sapling → mature: full tree, scaled continuously
    const s = 0.5 + ((growth - 2) / 2) * 0.62; // 0.5 at sapling start → 1.12 mature
    const mature = tree.stageIndex >= GROWTH_STAGES.length - 1;

    return (
        <g transform={`scale(${Math.max(0.45, s)})`}>
            <ellipse cx="0" cy="-1" rx={24} ry={9} fill="rgba(0,0,0,0.32)" />
            <g className="forest-sway" style={{ animationDelay: `${swayDelay}s`, animationDuration: `${swayDur}s` }}>
                {/* trunk */}
                <path d="M-3.2,0 C-2.4,-14 -2,-24 -1.4,-32 L1.4,-32 C2,-24 2.4,-14 3.2,0 Z" fill={c.trunk} />
                {tree.species === 'birch' && (
                    <>
                        <rect x="-2.4" y="-12" width="4.8" height="1.6" fill="#8a8676" opacity="0.7" />
                        <rect x="-2.1" y="-22" width="4.2" height="1.4" fill="#8a8676" opacity="0.6" />
                    </>
                )}
                {/* canopy */}
                {tree.species === 'pine' ? (
                    <g>
                        <path d="M0,-88 L20,-52 L-20,-52 Z" fill={c.hi} />
                        <path d="M0,-72 L26,-38 L-26,-38 Z" fill={c.lo} />
                        <path d="M0,-56 L32,-24 L-32,-24 Z" fill={c.lo} opacity="0.92" />
                        <path d="M0,-88 L20,-52 L0,-52 Z" fill="rgba(255,255,255,0.10)" />
                    </g>
                ) : (
                    <g>
                        <circle cx="-14" cy="-42" r="17" fill={c.lo} />
                        <circle cx="14" cy="-44" r="16" fill={c.lo} />
                        <circle cx="0" cy="-58" r="19" fill={c.hi} />
                        <circle cx="-6" cy="-63" r="8" fill="rgba(255,255,255,0.14)" />
                    </g>
                )}
                {mature && (
                    <g className="forest-twinkle">
                        <circle cx="-18" cy="-70" r="1.5" fill="#fff7c9" />
                        <circle cx="16" cy="-78" r="1.2" fill="#fff7c9" />
                        <circle cx="4" cy="-92" r="1.3" fill="#fff7c9" />
                    </g>
                )}
            </g>
        </g>
    );
}

// ---------------------------------------------------------
// Time-of-day ambience
// ---------------------------------------------------------

function skyGradient(hour: number): string {
    if (hour >= 5 && hour < 9) return 'radial-gradient(120% 90% at 50% 0%, #2b2033 0%, #171320 45%, #0c0a12 100%)'; // dawn
    if (hour >= 9 && hour < 17) return 'radial-gradient(120% 90% at 50% 0%, #16283040 0%, #10181f 45%, #0a0e13 100%)'; // day
    if (hour >= 17 && hour < 21) return 'radial-gradient(120% 90% at 50% 0%, #33203b 0%, #1b1426 45%, #0d0a14 100%)'; // dusk
    return 'radial-gradient(120% 90% at 50% 0%, #131a33 0%, #0e1122 45%, #080a14 100%)'; // night
}

// ---------------------------------------------------------
// Main tab
// ---------------------------------------------------------

export const ForestTab = () => {
    const [state, setState] = useState<ForestState>(() => emptyForest());
    const [loaded, setLoaded] = useState(false);
    const [now, setNow] = useState(() => Date.now());
    const [rot] = useState(0);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 30 });
    const [hoverCell, setHoverCell] = useState<{ gx: number; gy: number } | null>(null);
    const [hoverTree, setHoverTree] = useState<DisplayTree | null>(null);
    const [showTip, setShowTip] = useState(() => !localStorage.getItem(FOREST_TIP_KEY));
    const [showSplash, setShowSplash] = useState(() => !localStorage.getItem(FOREST_SPLASH_KEY));
    const [showStats, setShowStats] = useState(false);
    const [devMode, setDevMode] = useState(() => isDevModeEnabled());
    const sceneRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number; moved: boolean } | null>(null);

    const refresh = useCallback(async () => {
        const s = await loadForest();
        setState(s);
        setLoaded(true);
    }, []);

    useEffect(() => {
        void refresh();
        const tick = setInterval(() => setNow(Date.now()), 5000);
        let onChanged: ((changes: Record<string, chrome.storage.StorageChange>) => void) | null = null;
        if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
            onChanged = (changes) => {
                if (changes[FOREST_STORAGE_KEY]?.newValue) {
                    setState(changes[FOREST_STORAGE_KEY].newValue as ForestState);
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
    }, [refresh]);

    // Non-passive wheel zoom (prevents page scroll inside the scene)
    useEffect(() => {
        const el = sceneRef.current;
        if (!el) return;
        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            setZoom((z) => Math.min(2.2, Math.max(0.5, z * (e.deltaY > 0 ? 0.9 : 1.1))));
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, []);

    const display = useMemo(() => computeDisplay(state, now), [state, now]);
    const radius = boardRadius(state.trees);

    const viewCenter = useMemo(() => {
        const gx = Math.round(-pan.x / ((TILE_W / 2) * Math.max(zoom, 0.5) * 0.9));
        const gy = Math.round(-pan.y / ((TILE_H / 2) * Math.max(zoom, 0.5) * 0.9));
        return { gx, gy };
    }, [pan, zoom]);

    const cells = useMemo(() => {
        const treeR = radius;
        const panR = Math.ceil(Math.max(Math.abs(viewCenter.gx), Math.abs(viewCenter.gy)) / 6);
        const R = Math.max(VIEW_RADIUS_BASE, treeR + 8, panR + VIEW_RADIUS_BASE);
        const out: { gx: number; gy: number }[] = [];
        for (let gx = viewCenter.gx - R; gx <= viewCenter.gx + R; gx++) {
            for (let gy = viewCenter.gy - R; gy <= viewCenter.gy + R; gy++) {
                out.push({ gx, gy });
            }
        }
        return out;
    }, [viewCenter, radius]);

    const occupied = useMemo(() => {
        const m = new Map<string, DisplayTree>();
        for (const t of display.trees) m.set(`${t.gx},${t.gy}`, t);
        return m;
    }, [display.trees]);

    // Depth-sorted render list (painter's algorithm after rotation)
    const sortedCells = useMemo(() => {
        return cells
            .map((cell) => {
                const { rx, ry } = rotateCoord(cell.gx, cell.gy, rot);
                return { ...cell, ...project(rx, ry), depth: rx + ry };
            })
            .sort((a, b) => a.depth - b.depth);
    }, [cells, rot]);

    // ---- interactions ------------------------------------

    const onPointerDown = (e: React.PointerEvent) => {
        dragRef.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y, moved: false };
        (e.target as Element).setPointerCapture?.(e.pointerId);
    };
    const onPointerMove = (e: React.PointerEvent) => {
        const d = dragRef.current;
        if (!d) return;
        const dx = e.clientX - d.startX;
        const dy = e.clientY - d.startY;
        if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
        if (d.moved) setPan({ x: d.panX + dx, y: d.panY + dy });
    };
    const onPointerUp = () => {
        // keep `moved` readable in the click handler for one tick
        setTimeout(() => { dragRef.current = null; }, 0);
    };

    const onCellClick = async (gx: number, gy: number) => {
        if (dragRef.current?.moved) return;
        if (occupied.has(`${gx},${gy}`)) return;
        const isSelected = state.nextPlantPos?.gx === gx && state.nextPlantPos?.gy === gy;
        const next = isSelected ? null : { gx, gy };
        setState((s) => ({ ...s, nextPlantPos: next }));
        await setNextPlantPos(next);
    };

    const fmtClean = (min: number) => {
        if (min < 60) return `${Math.round(min)}m`;
        const h = Math.floor(min / 60);
        if (h < 48) return `${h}h ${Math.round(min % 60)}m`;
        return `${Math.floor(h / 24)}d ${h % 24}h`;
    };

    const hour = new Date(now).getHours();

    return (
        <div className="space-y-4 animate-fade-in-up w-full pb-12">
            <style>{`
                @keyframes forest-sway-kf {
                    0%, 100% { transform: rotate(-1.4deg); }
                    50% { transform: rotate(1.4deg); }
                }
                .forest-sway {
                    animation: forest-sway-kf 6s ease-in-out infinite;
                    transform-box: fill-box;
                    transform-origin: 50% 100%;
                }
                @keyframes forest-twinkle-kf {
                    0%, 100% { opacity: 0.15; }
                    50% { opacity: 0.9; }
                }
                .forest-twinkle { animation: forest-twinkle-kf 3.2s ease-in-out infinite; }
                @keyframes forest-firefly {
                    0%, 100% { transform: translate(0, 0); opacity: 0.15; }
                    25% { opacity: 0.85; }
                    50% { transform: translate(14px, -22px); opacity: 0.35; }
                    75% { opacity: 0.75; }
                }
                .forest-firefly {
                    position: absolute;
                    width: 4px; height: 4px; border-radius: 9999px;
                    background: #d7f2a0;
                    box-shadow: 0 0 8px 2px rgba(215, 242, 160, 0.45);
                    animation: forest-firefly 9s ease-in-out infinite;
                    pointer-events: none;
                }
                @keyframes forest-pulse-kf {
                    0% { opacity: 0.85; transform: scale(0.9); }
                    70% { opacity: 0; transform: scale(1.5); }
                    100% { opacity: 0; transform: scale(1.5); }
                }
                .forest-pulse {
                    animation: forest-pulse-kf 2s ease-out infinite;
                    transform-box: fill-box;
                    transform-origin: center;
                }
            `}</style>

            {showTip && (
                <GlassCard className="p-4 border-emerald-500/20 bg-emerald-950/20 relative">
                    <button
                        type="button"
                        onClick={() => {
                            localStorage.setItem(FOREST_TIP_KEY, '1');
                            setShowTip(false);
                        }}
                        className="absolute top-3 right-3 w-7 h-7 rounded-lg text-neutral-500 hover:text-white hover:bg-white/10 text-sm font-bold"
                        aria-label="Dismiss tip"
                    >
                        ×
                    </button>
                    <p className="text-sm text-neutral-300 leading-relaxed pr-8">
                        <span className="font-bold text-white">How your forest grows:</span> every completed
                        focus session plants a tree. Trees grow on their own while you stay clean — no blocked
                        sites, no Shorts, no doom-scrolling. Slip-ups never destroy anything; they just slow
                        growth for a little while. Click an empty tile to choose where your next tree goes.
                    </p>
                </GlassCard>
            )}

            <div className="flex items-center justify-between gap-3">
                <div>
                    <h2 className="text-2xl font-bold text-white">Forest</h2>
                    <p className="text-xs text-neutral-500 uppercase tracking-widest mt-1">
                        Drag to explore · scroll to zoom
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setShowStats(true)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-neutral-300"
                    >
                        <BarChart3 size={14} className="text-emerald-400" />
                        Stats
                    </button>
                {(import.meta.env.DEV || devMode) && (
                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-fuchsia-600/15 border border-fuchsia-500/30 text-fuchsia-300 text-[10px] font-black uppercase tracking-widest">
                            Dev mode
                        </span>
                        {([
                            { label: 'Plant', cls: 'emerald', fn: () => plantTreeFromSession().then(() => undefined) },
                            { label: '×10', cls: 'emerald', fn: () => devPlantTrees(10) },
                            { label: '+6h grow', cls: 'sky', fn: () => devGrowAll(360) },
                            { label: '+24h grow', cls: 'sky', fn: () => devGrowAll(1440) },
                            { label: 'Slip', cls: 'amber', fn: () => registerSlip('other') },
                            { label: 'Recover', cls: 'amber', fn: () => devClearSlip() },
                            { label: 'Reset', cls: 'red', fn: () => devResetForest() },
                        ] as const).map((b) => (
                            <button
                                key={b.label}
                                type="button"
                                onClick={() => void b.fn().then(refresh)}
                                className={{
                                    emerald: 'px-2.5 py-1.5 rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold hover:bg-emerald-600/30',
                                    sky: 'px-2.5 py-1.5 rounded-lg bg-sky-600/20 border border-sky-500/30 text-sky-300 text-[11px] font-bold hover:bg-sky-600/30',
                                    amber: 'px-2.5 py-1.5 rounded-lg bg-amber-600/20 border border-amber-500/30 text-amber-300 text-[11px] font-bold hover:bg-amber-600/30',
                                    red: 'px-2.5 py-1.5 rounded-lg bg-red-600/20 border border-red-500/30 text-red-300 text-[11px] font-bold hover:bg-red-600/30',
                                }[b.cls]}
                            >
                                {b.label}
                            </button>
                        ))}
                    </div>
                )}
                </div>
            </div>

            {/* Scene — fills content area */}
            <GlassCard className="p-0 overflow-hidden relative">
                <div
                    ref={sceneRef}
                    className="relative min-h-[calc(100vh-14rem)] h-[calc(100vh-14rem)] select-none touch-none cursor-grab active:cursor-grabbing"
                    style={{ background: skyGradient(hour) }}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerLeave={() => { onPointerUp(); setHoverCell(null); setHoverTree(null); }}
                >
                    {/* fireflies */}
                    <div className="forest-firefly" style={{ left: '18%', top: '58%', animationDelay: '0s' }} />
                    <div className="forest-firefly" style={{ left: '72%', top: '44%', animationDelay: '-3s' }} />
                    <div className="forest-firefly" style={{ left: '46%', top: '68%', animationDelay: '-6s' }} />
                    <div className="forest-firefly" style={{ left: '60%', top: '30%', animationDelay: '-1.5s' }} />

                    <svg className="w-full h-full" viewBox="-450 -280 900 560">
                        <defs>
                            <linearGradient id="forest-tile" x1="0" y1="0" x2="0.4" y2="1">
                                <stop offset="0%" stopColor="#2d5a3d" />
                                <stop offset="45%" stopColor="#244a32" />
                                <stop offset="100%" stopColor="#1a3826" />
                            </linearGradient>
                            <linearGradient id="forest-tile-alt" x1="0.2" y1="0" x2="0.8" y2="1">
                                <stop offset="0%" stopColor="#285236" />
                                <stop offset="50%" stopColor="#1f422c" />
                                <stop offset="100%" stopColor="#173222" />
                            </linearGradient>
                            <linearGradient id="forest-tile-side" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#0f2015" />
                                <stop offset="100%" stopColor="#0a150d" />
                            </linearGradient>
                        </defs>
                        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                            {sortedCells.map((cell) => {
                                const key = `${cell.gx},${cell.gy}`;
                                const tree = occupied.get(key);
                                const isHover = hoverCell?.gx === cell.gx && hoverCell?.gy === cell.gy;
                                const isNext = state.nextPlantPos?.gx === cell.gx && state.nextPlantPos?.gy === cell.gy;
                                const alt = (((cell.gx + cell.gy) % 2) + 2) % 2 === 0;
                                return (
                                    <g key={key} transform={`translate(${cell.x}, ${cell.y})`}>
                                        <polygon
                                            points={`0,${-TILE_H / 2} ${TILE_W / 2},0 0,${TILE_H / 2} ${-TILE_W / 2},0`}
                                            fill={alt ? 'url(#forest-tile)' : 'url(#forest-tile-alt)'}
                                            stroke={isHover && !tree ? 'rgba(163, 230, 53, 0.65)' : 'rgba(255,255,255,0.05)'}
                                            strokeWidth={isHover && !tree ? 1.5 : 1}
                                            className={tree ? '' : 'cursor-pointer'}
                                            onMouseEnter={() => { setHoverCell(cell); setHoverTree(tree ?? null); }}
                                            onMouseLeave={() => { setHoverCell(null); setHoverTree(null); }}
                                            onClick={() => void onCellClick(cell.gx, cell.gy)}
                                        />
                                        {isNext && !tree && (
                                            <g pointerEvents="none">
                                                <polygon
                                                    points={`0,${-TILE_H / 2 + 6} ${TILE_W / 2 - 12},0 0,${TILE_H / 2 - 6} ${-TILE_W / 2 + 12},0`}
                                                    fill="none" stroke="#a3e635" strokeWidth="2" className="forest-pulse"
                                                />
                                                <circle cx="0" cy="0" r="3" fill="#a3e635" />
                                            </g>
                                        )}
                                        {tree && (
                                            <motion.g
                                                initial={{ opacity: 0, scale: 0.3, y: -46 }}
                                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                                transition={{ type: 'spring', stiffness: 210, damping: 16 }}
                                                style={{ pointerEvents: 'none' }}
                                            >
                                                <TreeSprite tree={tree} />
                                            </motion.g>
                                        )}
                                    </g>
                                );
                            })}
                        </g>
                    </svg>

                    {/* Empty state */}
                    <AnimatePresence>
                        {loaded && display.trees.length === 0 && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                            >
                                <div className="text-center bg-black/45 backdrop-blur-sm border border-white/10 rounded-2xl px-8 py-6 max-w-sm">
                                    <Sprout size={28} className="text-emerald-400 mx-auto mb-3" />
                                    <p className="text-white font-bold text-sm">Your forest is waiting</p>
                                    <p className="text-neutral-400 text-xs mt-1.5 leading-relaxed">
                                        Complete a Pomodoro or Deep Work session to plant your first tree.
                                        It will keep growing as long as you stay focused.
                                    </p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Hovered tree tooltip */}
                    {hoverTree && (
                        <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md border border-white/10 rounded-xl px-4 py-3 pointer-events-none">
                            <div className="flex items-center gap-2">
                                <Leaf size={13} className="text-emerald-400" />
                                <span className="text-white text-xs font-bold capitalize">
                                    {hoverTree.species} · {GROWTH_STAGES[hoverTree.stageIndex].label}
                                </span>
                            </div>
                            <div className="text-[11px] text-neutral-400 mt-1">
                                Planted {new Date(hoverTree.plantedAt).toLocaleDateString()}
                            </div>
                            {hoverTree.stageIndex < GROWTH_STAGES.length - 1 && (
                                <div className="mt-2 w-36">
                                    <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                                        <div
                                            className="h-full bg-emerald-400 rounded-full"
                                            style={{ width: `${Math.round(hoverTree.progress * 100)}%` }}
                                        />
                                    </div>
                                    <div className="text-[10px] text-neutral-500 mt-1">
                                        {Math.round(hoverTree.progress * 100)}% to {GROWTH_STAGES[hoverTree.stageIndex + 1].label.toLowerCase()}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <AnimatePresence>
                        {showSplash && (
                            <motion.div
                                initial={{ opacity: 1 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 backdrop-blur-sm"
                            >
                                <motion.div
                                    initial={{ scale: 0.9, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className="text-center max-w-md px-8 py-10 rounded-2xl border border-emerald-500/30 bg-[#0d1410]/90"
                                >
                                    <Trees size={48} className="text-emerald-400 mx-auto mb-4" />
                                    <h3 className="text-2xl font-black text-white mb-2">Welcome to your forest</h3>
                                    <p className="text-sm text-neutral-400 leading-relaxed mb-6">
                                        Every focus session plants a tree. Pan and scroll to explore an endless meadow — your progress grows with you.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            localStorage.setItem(FOREST_SPLASH_KEY, '1');
                                            setShowSplash(false);
                                        }}
                                        className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm"
                                    >
                                        Enter forest
                                    </button>
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="absolute bottom-3 left-4 text-[10px] text-white/25 pointer-events-none">
                        drag to pan · scroll to zoom · click a tile to choose the next planting spot
                    </div>
                </div>
            </GlassCard>

            <ForestStatsModal
                open={showStats}
                onClose={() => setShowStats(false)}
                display={display}
                fmtClean={fmtClean}
            />
        </div>
    );
};

export default ForestTab;
