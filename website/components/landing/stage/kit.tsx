import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Lock, Puzzle, RotateCw } from 'lucide-react';
import { Mark } from '../Mark';

/** Browser windows are drawn at this size and scaled to fit, so they look the same at every width. */
export const CANVAS_W = 1200;
export const CANVAS_H = 760;
export const TOOLBAR_H = 44;
export const VIEWPORT_H = CANVAS_H - TOOLBAR_H;

export function Toolbar({ url }: { url: string }) {
    return (
        <div
            className="relative flex items-center gap-3 px-4"
            style={{ height: TOOLBAR_H, background: 'oklch(0.185 0.004 275)', boxShadow: 'inset 0 -1px 0 var(--c-border)' }}
        >
            <div className="flex gap-[7px]">
                {[0, 1, 2].map((i) => (
                    <span key={i} className="h-[11px] w-[11px] rounded-full" style={{ background: 'oklch(1 0 0 / 0.13)' }} />
                ))}
            </div>
            <div className="ml-2 flex items-center gap-3 text-[var(--c-text-4)]">
                <ArrowLeft size={15} />
                <ArrowRight size={15} className="opacity-50" />
                <RotateCw size={14} />
            </div>
            <div
                className="mx-auto flex h-[28px] w-[520px] items-center gap-2 rounded-full px-3.5 text-[13px]"
                style={{ background: 'oklch(0.135 0.003 275)', boxShadow: 'inset 0 0 0 1px var(--c-border)' }}
            >
                <Lock size={12} className="shrink-0 text-[var(--c-text-4)]" />
                <span className="truncate text-[var(--c-text-2)]">{url}</span>
            </div>
            <div className="flex items-center gap-3 text-[var(--c-text-4)]">
                <Puzzle size={15} />
                <Mark size={20} />
            </div>
        </div>
    );
}

/** A frame whose content is laid out at `width` × `height` and scaled to the available width. */
export function ScaledCanvas({
    children,
    width = CANVAS_W,
    height = CANVAS_H,
    className = '',
}: {
    children: ReactNode;
    width?: number;
    height?: number;
    className?: string;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(0);

    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        const update = () => setScale(el.clientWidth / width);
        update();
        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => ro.disconnect();
    }, [width]);

    return (
        <div ref={ref} className={`fzl-frame w-full ${className}`} style={{ aspectRatio: `${width} / ${height}` }}>
            {/* Absolutely positioned so the full-size layout never widens the page's grid. */}
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width,
                    height,
                    transform: `scale(${scale})`,
                    transformOrigin: '0 0',
                    visibility: scale ? 'visible' : 'hidden',
                }}
            >
                {children}
            </div>
        </div>
    );
}

/** A browser window whose page is the real extension UI. */
export function BrowserWindow({ url, children }: { url: string; children: ReactNode }) {
    return (
        <>
            <Toolbar url={url} />
            <div className="relative overflow-hidden" style={{ height: VIEWPORT_H, background: 'var(--c-bg)' }}>
                {children}
            </div>
        </>
    );
}
