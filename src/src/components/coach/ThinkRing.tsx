import { useEffect, useRef, useState } from 'react';

/**
 * Think mode, drawn as a focus ring around the composer:
 *
 *   on        a line traces the card's outline from the bottom-left
 *             (where the Think chip sits) and stays as a steady ring
 *   off       the line un-draws back to where it started
 *   working   a short bright segment travels around the ring while the
 *             model reasons, so "armed" and "busy" read differently
 *
 * Pure SVG + CSS (see .fz-think-* in focuzDesign.css): nothing runs while
 * idle, and reduced motion snaps straight to each end state.
 */
export function ThinkRing({
    active,
    working,
    radius = 16,
    squareTop = false,
}: {
    active: boolean;
    working: boolean;
    radius?: number;
    /** Attachment strip sits on top: straight top corners. */
    squareTop?: boolean;
}) {
    const svgRef = useRef<SVGSVGElement>(null);
    const [box, setBox] = useState({ w: 0, h: 0 });

    useEffect(() => {
        const el = svgRef.current?.parentElement;
        if (!el) return;
        const ro = new ResizeObserver(([entry]) => {
            const b = entry.borderBoxSize?.[0];
            const w = b ? b.inlineSize : el.offsetWidth;
            const h = b ? b.blockSize : el.offsetHeight;
            setBox((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
        });
        ro.observe(el, { box: 'border-box' });
        return () => ro.disconnect();
    }, []);

    const d = outline(box.w, box.h, squareTop ? 0 : radius, radius);

    return (
        <svg
            ref={svgRef}
            aria-hidden
            width={box.w}
            height={box.h}
            className="pointer-events-none absolute -left-px -top-px overflow-visible"
            style={{ width: box.w, height: box.h }}
        >
            {d && (
                <>
                    <path
                        d={d}
                        className="fz-think-trace"
                        data-on={active}
                        data-working={working}
                        fill="none"
                        stroke="var(--fz-accent)"
                        strokeWidth={1.5}
                        pathLength={100}
                        strokeDasharray="100"
                        strokeDashoffset={active ? 0 : 100}
                    />
                    <path
                        d={d}
                        className="fz-think-comet"
                        data-on={active && working}
                        fill="none"
                        stroke="var(--fz-accent)"
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        pathLength={100}
                        strokeDasharray="9 91"
                    />
                </>
            )}
        </svg>
    );
}

/**
 * Rounded-rect outline starting on the bottom edge by the bottom-left corner
 * and running clockwise, so the trace leaves from the Think chip.
 */
function outline(w: number, h: number, rt: number, rb: number): string {
    if (w < 4 || h < 4) return '';
    const i = 0.75; // half the stroke, so the ring sits on the card's border
    const x0 = i;
    const y0 = i;
    const x1 = w - i;
    const y1 = h - i;
    const t = Math.max(0, Math.min(rt - i, (x1 - x0) / 2, (y1 - y0) / 2));
    const b = Math.max(0, Math.min(rb - i, (x1 - x0) / 2, (y1 - y0) / 2));
    return [
        `M ${x0 + b} ${y1}`,
        `A ${b} ${b} 0 0 1 ${x0} ${y1 - b}`,
        `L ${x0} ${y0 + t}`,
        `A ${t} ${t} 0 0 1 ${x0 + t} ${y0}`,
        `L ${x1 - t} ${y0}`,
        `A ${t} ${t} 0 0 1 ${x1} ${y0 + t}`,
        `L ${x1} ${y1 - b}`,
        `A ${b} ${b} 0 0 1 ${x1 - b} ${y1}`,
        'Z',
    ].join(' ');
}

/** The lens next to "Thinking…": an open arc that spins, then closes into a check. */
export function ThinkAperture({ done, size = 16 }: { done: boolean; size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden className="shrink-0 overflow-visible">
            <circle
                className="fz-think-aperture"
                data-spin={!done}
                cx="8"
                cy="8"
                r="6.25"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                pathLength={100}
                strokeDasharray={done ? '100 0' : '70 30'}
            />
            <path
                className="fz-think-check"
                d="M5.3 8.3l1.8 1.8 3.6-4"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength={10}
                strokeDasharray="10"
                strokeDashoffset={done ? 0 : 10}
            />
        </svg>
    );
}

/** Think chip / model icon: a lens whose pupil widens while Think is on. */
export function ThinkLensIcon({ open, size = 14 }: { open: boolean; size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden className="shrink-0">
            <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth={1.4} />
            <circle className="fz-think-pupil" cx="8" cy="8" r={open ? 3.4 : 2} fill="currentColor" />
        </svg>
    );
}
