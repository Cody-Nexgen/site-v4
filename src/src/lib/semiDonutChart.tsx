import { useRef } from 'react';

/** Half-donut (semi-circular ring) segment path for SVG. Angles span π (left) → 0 (right) along the top arc. */
function polar(cx: number, cy: number, r: number, angleRad: number) {
    return {
        x: cx + r * Math.cos(angleRad),
        y: cy - r * Math.sin(angleRad),
    };
}

function ringSlicePath(
    cx: number,
    cy: number,
    outerR: number,
    innerR: number,
    startPct: number,
    endPct: number,
): string {
    const a0 = Math.PI * (1 - startPct / 100);
    const a1 = Math.PI * (1 - endPct / 100);
    if (endPct - startPct < 0.01) return '';

    const o0 = polar(cx, cy, outerR, a0);
    const o1 = polar(cx, cy, outerR, a1);
    const i1 = polar(cx, cy, innerR, a1);
    const i0 = polar(cx, cy, innerR, a0);
    const angleSpan = Math.PI * ((endPct - startPct) / 100);
    const large = angleSpan > Math.PI ? 1 : 0;

    return [
        `M ${o0.x} ${o0.y}`,
        `A ${outerR} ${outerR} 0 ${large} 1 ${o1.x} ${o1.y}`,
        `L ${i1.x} ${i1.y}`,
        `A ${innerR} ${innerR} 0 ${large} 0 ${i0.x} ${i0.y}`,
        'Z',
    ].join(' ');
}

export type DonutSlice = {
    site: string;
    time: number;
    pct: number;
    startPct: number;
    endPct: number;
    color: string;
};

type SemiDonutChartProps = {
    slices: DonutSlice[];
    totalLabel: string;
    subLabel?: string;
    onSliceClick?: (site: string) => void;
    onSliceHover?: (slice: DonutSlice | null, clientX: number, clientY: number) => void;
    className?: string;
};

const SCALE = 1.75;
const VB_W = Math.round(200 * SCALE);
const VB_H = Math.round(110 * SCALE);
const CX = VB_W / 2;
const CY = VB_H - Math.round(4 * SCALE);
const OUTER = Math.round(72 * SCALE);
const INNER = Math.round(46 * SCALE);
const MID_R = (OUTER + INNER) / 2;
const LABEL_Y_CAVITY = (CY - INNER + CY) / 2;
const LABEL_Y = LABEL_Y_CAVITY;

export const semiDonutMetrics = {
    vbW: VB_W,
    vbH: VB_H,
    cx: CX,
    labelY: LABEL_Y,
    labelYCrown: CY - MID_R,
    labelYCavity: LABEL_Y_CAVITY,
    outerTop: CY - OUTER,
    innerTop: CY - INNER,
};

export function SemiDonutChart({
    slices,
    totalLabel,
    subLabel = 'TOTAL TIME',
    onSliceClick,
    onSliceHover,
    className = '',
}: SemiDonutChartProps) {
    const trackPath = ringSlicePath(CX, CY, OUTER, INNER, 0, 100);
    const hoveredSliceRef = useRef<DonutSlice | null>(null);

    const emitHover = (clientX: number, clientY: number) => {
        const slice = hoveredSliceRef.current;
        if (slice) onSliceHover?.(slice, clientX, clientY);
    };

    return (
        <div className={className}>
            <div
                className="relative mx-auto shrink-0"
                style={{ width: VB_W, height: VB_H }}
                onMouseMove={(e) => emitHover(e.clientX, e.clientY)}
                onMouseLeave={() => {
                    hoveredSliceRef.current = null;
                    onSliceHover?.(null, 0, 0);
                }}
            >
                <svg
                    width={VB_W}
                    height={VB_H}
                    viewBox={`0 0 ${VB_W} ${VB_H}`}
                    className="block"
                    role="img"
                    aria-label="Usage breakdown"
                >
                    {trackPath && (
                        <path
                            d={trackPath}
                            fill="rgba(255,255,255,0.08)"
                            stroke="rgba(255,255,255,0.12)"
                            strokeWidth={1.5}
                        />
                    )}
                    {slices.map((slice) => {
                        const d = ringSlicePath(CX, CY, OUTER, INNER, slice.startPct, slice.endPct);
                        if (!d) return null;
                        return (
                            <path
                                key={`${slice.site}-${slice.startPct}`}
                                d={d}
                                fill={slice.color}
                                className="cursor-pointer transition-opacity hover:opacity-90"
                                onClick={() => onSliceClick?.(slice.site)}
                                onMouseEnter={(e) => {
                                    hoveredSliceRef.current = slice;
                                    onSliceHover?.(slice, e.clientX, e.clientY);
                                }}
                                onMouseLeave={() => {
                                    if (hoveredSliceRef.current?.site === slice.site) {
                                        hoveredSliceRef.current = null;
                                    }
                                }}
                            >
                                <title>{`${slice.site} — ${slice.pct}%`}</title>
                            </path>
                        );
                    })}
                </svg>
                {totalLabel ? (
                    <div
                        data-donut-label
                        className="absolute left-0 right-0 flex flex-col items-center pointer-events-none"
                        style={{ top: LABEL_Y, transform: 'translateY(-50%)' }}
                    >
                        <span className="text-4xl font-black text-white leading-none tracking-tight">{totalLabel}</span>
                        <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-[0.2em] mt-2">
                            {subLabel}
                        </span>
                    </div>
                ) : (
                    <div data-donut-label className="hidden" aria-hidden />
                )}
            </div>
        </div>
    );
}
