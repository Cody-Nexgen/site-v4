import { useMemo, useState } from 'react';
import { cn } from '../../lib/utils';

export type SparkPoint = {
  label: string;
  value: number;
};

type SparkMetricCardProps = {
  title: string;
  value: string;
  caption?: string;
  deltaLabel?: string;
  points: SparkPoint[];
  formatPointValue?: (value: number) => string;
  className?: string;
};

/** Compact analytics card with an interactive monochrome sparkline (21st-inspired). */
export function SparkMetricCard({
  title,
  value,
  caption,
  deltaLabel,
  points,
  formatPointValue,
  className,
}: SparkMetricCardProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const width = 360;
  const height = 120;
  const pad = { top: 16, bottom: 28, left: 8, right: 8 };

  const { path, area, coords } = useMemo(() => {
    if (!points.length) {
      return { path: '', area: '', coords: [] as { x: number; y: number }[] };
    }
    const values = points.map((p) => p.value);
    const maxV = Math.max(...values, 1);
    const minV = Math.min(...values, 0);
    const range = Math.max(maxV - minV, 1);
    const coords = points.map((p, i) => {
      const x =
        pad.left + (i / Math.max(points.length - 1, 1)) * (width - pad.left - pad.right);
      const y =
        height -
        pad.bottom -
        ((p.value - minV) / range) * (height - pad.top - pad.bottom);
      return { x, y };
    });
    let d = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const p0 = coords[i - 1] || coords[i];
      const p1 = coords[i];
      const p2 = coords[i + 1];
      const p3 = coords[i + 2] || p2;
      const t = 0.35;
      d += ` C ${p1.x + (p2.x - p0.x) * t} ${p1.y + (p2.y - p0.y) * t}, ${
        p2.x - (p3.x - p1.x) * t
      } ${p2.y - (p3.y - p1.y) * t}, ${p2.x} ${p2.y}`;
    }
    const last = coords[coords.length - 1];
    const area = `${d} L ${last.x} ${height - pad.bottom} L ${coords[0].x} ${
      height - pad.bottom
    } Z`;
    return { path: d, area, coords };
  }, [points]);

  const active = hovered ?? Math.max(points.length - 1, 0);

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[var(--radius)] border border-border bg-card p-5 shadow-[var(--dashboard-shadow)]',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="text-[11px] font-medium text-muted-foreground">{title}</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight text-foreground tabular-nums">
            {value}
          </p>
          {caption ? (
            <p className="mt-1 text-[11px] text-muted-foreground">{caption}</p>
          ) : null}
        </div>
        {deltaLabel ? (
          <span className="inline-flex items-center rounded-full border border-border bg-background/40 px-3 py-1.5 text-xs font-semibold text-foreground">
            {deltaLabel}
          </span>
        ) : null}
      </div>

      {points.length > 1 ? (
        <div className="relative mt-1">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-28"
            onMouseLeave={() => setHovered(null)}
          >
            <defs>
              <linearGradient id="fzSparkArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-2)" stopOpacity="0.35" />
                <stop offset="100%" stopColor="var(--chart-2)" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            {coords.map((c, i) => (
              <line
                key={i}
                x1={c.x}
                y1={pad.top}
                x2={c.x}
                y2={height - pad.bottom}
                stroke="var(--border)"
                strokeWidth="1"
                strokeDasharray="3 5"
                opacity={active === i ? 0.9 : 0.45}
                onMouseEnter={() => setHovered(i)}
              />
            ))}
            <path d={area} fill="url(#fzSparkArea)" />
            <path
              d={path}
              fill="none"
              stroke="var(--chart-2)"
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {coords[active] && (
              <circle
                cx={coords[active].x}
                cy={coords[active].y}
                r="5"
                fill="var(--card)"
                stroke="var(--chart-2)"
                strokeWidth="2.5"
              />
            )}
            {points.map((p, i) => (
              <text
                key={p.label}
                x={coords[i]?.x ?? 0}
                y={height - 8}
                textAnchor="middle"
                className="fill-muted-foreground"
                style={{ fontSize: 11, fontWeight: 500 }}
                onMouseEnter={() => setHovered(i)}
              >
                {p.label}
              </text>
            ))}
            {/* invisible hit targets */}
            {coords.map((c, i) => (
              <rect
                key={`hit-${i}`}
                x={c.x - 18}
                y={pad.top}
                width={36}
                height={height - pad.top - pad.bottom}
                fill="transparent"
                onMouseEnter={() => setHovered(i)}
              />
            ))}
          </svg>
          {points[active] && (
            <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-lg bg-foreground/90 px-3 py-1 text-xs font-semibold text-background">
              {points[active].label}:{' '}
              {formatPointValue
                ? formatPointValue(points[active].value)
                : points[active].value.toLocaleString()}
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground py-8 text-center">Not enough data yet.</p>
      )}
    </div>
  );
}
