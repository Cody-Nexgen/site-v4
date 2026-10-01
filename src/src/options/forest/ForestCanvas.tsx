import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from 'react';
import { Maximize2, Minus, Plus } from 'lucide-react';
import { IconButton } from '../../components/fz/IconButton';
import { GROWTH_STAGES, type DisplayTree, type TreeSpecies } from '../../lib/forest';
import { ForestEngine, type EngineCallbacks, type ForestHover } from './ForestEngine';
import { DARK_PALETTE, LIGHT_PALETTE, SPECIES_LABEL, drawTree, treeBounds } from './forestArt';

export type ForestCanvasHandle = {
    focusCell: (gx: number, gy: number) => void;
    fit: () => void;
};

type Props = {
    trees: DisplayTree[];
    loaded: boolean;
    nextPos: { gx: number; gy: number } | null;
    selectedId: string | null;
    isLight: boolean;
    onSelectTree: (id: string | null) => void;
    onPickCell: (gx: number, gy: number) => void;
    /** Extra controls appended to the zoom toolbar. */
    toolbarExtra?: ReactNode;
    /** Overlays drawn above the scene (status chips, empty state). */
    children?: ReactNode;
};

export const ForestCanvas = forwardRef<ForestCanvasHandle, Props>(function ForestCanvas(
    { trees, loaded, nextPos, selectedId, isLight, onSelectTree, onPickCell, toolbarExtra, children },
    ref,
) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<ForestEngine | null>(null);
    const callbacks = useRef<EngineCallbacks | null>(null);
    const fitted = useRef(false);
    const [zoomPct, setZoomPct] = useState(100);
    const [hover, setHover] = useState<ForestHover | null>(null);

    useEffect(() => {
        callbacks.current = {
            onSelectTree,
            onPickCell,
            onHover: setHover,
            onZoom: (z) => setZoomPct(Math.round(z * 100)),
        };
    }, [onSelectTree, onPickCell]);

    useEffect(() => {
        const engine = new ForestEngine(canvasRef.current!, () => callbacks.current!);
        engineRef.current = engine;
        return () => {
            engine.destroy();
            engineRef.current = null;
        };
    }, []);

    useEffect(() => {
        engineRef.current?.setData(trees, nextPos, selectedId);
    }, [trees, nextPos, selectedId]);

    useEffect(() => {
        engineRef.current?.setTheme(isLight);
    }, [isLight]);

    useEffect(() => {
        if (!loaded || fitted.current) return;
        fitted.current = true;
        engineRef.current?.fit(true);
    }, [loaded]);

    useImperativeHandle(ref, () => ({
        focusCell: (gx, gy) => engineRef.current?.focusCell(gx, gy),
        fit: () => engineRef.current?.fit(),
    }), []);

    const next = hover && hover.tree.stageIndex < GROWTH_STAGES.length - 1 ? GROWTH_STAGES[hover.tree.stageIndex + 1] : null;

    return (
        <div className="relative h-full w-full overflow-hidden">
            <canvas
                ref={canvasRef}
                tabIndex={0}
                aria-label="Your forest. Drag to move, scroll to zoom, click a tree for details or an empty tile to choose where the next tree grows."
                className="absolute inset-0 block size-full cursor-grab touch-none select-none outline-none"
            />
            {/* Soft falloff into the card so the endless meadow doesn't end on a hard edge */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                    background:
                        'radial-gradient(130% 110% at 50% 45%, transparent 58%, color-mix(in srgb, var(--dashboard-surface-raised) 70%, transparent) 100%)',
                }}
            />

            {hover && (
                <div
                    className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-[var(--fz-border)] bg-[var(--fz-bg-overlay)] px-2.5 py-1.5 shadow-lg"
                    style={{ left: hover.x, top: hover.y - 8 }}
                >
                    <p className="whitespace-nowrap text-[12px] font-medium text-[var(--fz-text-1)]">
                        {SPECIES_LABEL[hover.tree.species]} · {GROWTH_STAGES[hover.tree.stageIndex].label}
                    </p>
                    <p className="whitespace-nowrap text-[11px] tabular-nums text-[var(--fz-text-3)]">
                        {next ? `${Math.round(hover.tree.progress * 100)}% to ${next.label.toLowerCase()}` : 'Fully grown'}
                    </p>
                </div>
            )}

            {children}

            <div className="absolute bottom-3 left-3 z-10 flex items-center gap-0.5 rounded-xl border border-[var(--fz-border)] bg-[var(--fz-bg-overlay)] p-1 shadow-lg">
                <IconButton icon={<Minus size={14} />} tooltip="Zoom out  −" onClick={() => engineRef.current?.zoomBy(0.8)} />
                <span className="w-11 text-center text-[11px] tabular-nums text-[var(--fz-text-3)]">{zoomPct}%</span>
                <IconButton icon={<Plus size={14} />} tooltip="Zoom in  +" onClick={() => engineRef.current?.zoomBy(1.25)} />
                <IconButton icon={<Maximize2 size={13} />} tooltip="Fit forest  0" onClick={() => engineRef.current?.fit()} />
                {toolbarExtra}
            </div>
        </div>
    );
});

/** Still, single-frame render of a tree — for side panels and legends. */
export function TreePreview({
    species,
    stageIndex,
    progress = 0.5,
    id = 'preview',
    width = 56,
    height = 64,
    scale,
    isLight,
}: {
    species: TreeSpecies;
    stageIndex: number;
    progress?: number;
    id?: string;
    width?: number;
    height?: number;
    /** Fixed world→px scale (keeps sizes comparable); default fits this tree. */
    scale?: number;
    isLight: boolean;
}) {
    const ref = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const canvas = ref.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        const tree = { id, species, stageIndex, progress };
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        const b = treeBounds(tree);
        const s = scale ?? Math.min(width / (b.w + 14), (height - 10) / (b.h + 6), 1.6);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.setTransform(dpr * s, 0, 0, dpr * s, (dpr * width) / 2, dpr * (height - 7));
        drawTree(ctx, tree, 0, 0, isLight ? LIGHT_PALETTE : DARK_PALETTE, null);
    }, [species, stageIndex, progress, id, width, height, scale, isLight]);
    return <canvas ref={ref} aria-hidden style={{ width, height }} className="block" />;
}
