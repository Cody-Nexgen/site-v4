import { useEffect, useMemo, useRef, useState } from 'react';
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

function niceCeiling(value: number): number {
  if (value <= 0) return 60 * 60 * 1000; // 1h default scale
  const hour = 60 * 60 * 1000;
  if (value <= hour) {
    const step = 15 * 60 * 1000;
    return Math.ceil(value / step) * step;
  }
  const hours = value / hour;
  const step = hours <= 4 ? 1 : hours <= 12 ? 2 : 4;
  return Math.ceil(hours / step) * step * hour;
}

/** Compact analytics card with an interactive sparkline that fills the card body. */
export function SparkMetricCard({
  title,
  value,
  caption,
  deltaLabel,
  points,
  formatPointValue,
  className,
}: SparkMetricCardProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 400, height: 220 });
  const [hovered, setHovered] = useState<number | null>(null);

  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setSize({
        width: Math.max(Math.floor(rect.width), 120),
        height: Math.max(Math.floor(rect.height), 120),
      });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { width, height } = size;
  const pad = {
    top: 16,
    bottom: 28,
    left: 48,
    right: 12,
  };

  const fmt = formatPointValue ?? ((n: number) => n.toLocaleString());

  const { path, area, coords, ticks, chartBottom } = useMemo(() => {
    if (!points.length) {
      return {
        path: '',
        area: '',
        coords: [] as { x: number; y: number }[],
        ticks: [] as { y: number; label: string }[],
        chartBottom: height - pad.bottom,
      };
    }
    const values = points.map((p) => p.value);
    const maxV = niceCeiling(Math.max(...values, 0));
    const minV = 0;
    const range = Math.max(maxV - minV, 1);
    const chartBottom = height - pad.bottom;
    const chartTop = pad.top;
    const plotH = Math.max(chartBottom - chartTop, 1);
    const plotW = Math.max(width - pad.left - pad.right, 1);

    const coords = points.map((p, i) => {
      const x = pad.left + (i / Math.max(points.length - 1, 1)) * plotW;
      const y = chartBottom - ((p.value - minV) / range) * plotH;
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
    const area = `${d} L ${last.x} ${chartBottom} L ${coords[0].x} ${chartBottom} Z`;

    const tickValues = [0, maxV / 2, maxV];
    const ticks = tickValues.map((v) => ({
      y: chartBottom - ((v - minV) / range) * plotH,
      label: fmt(v),
    }));

    return { path: d, area, coords, ticks, chartBottom };
  }, [points, fmt, width, height, pad.top, pad.bottom, pad.left, pad.right]);

  const active = hovered ?? Math.max(points.length - 1, 0);
  const activeCoord = coords[active];

  return (
    <div
      className={cn(
        'relative flex h-full min-h-[280px] flex-col overflow-hidden rounded-[var(--radius)] border border-border bg-card p-5 shadow-[var(--dashboard-shadow)]',
        className,
      )}
    >
      <div className="flex shrink-0 items-start justify-between gap-3">
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
        <div ref={chartRef} className="relative mt-4 min-h-0 flex-1">
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className="absolute inset-0 h-full w-full"
            onMouseLeave={() => setHovered(null)}
          >
            <defs>
              <linearGradient id="fzSparkArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-2)" stopOpacity="0.35" />
                <stop offset="100%" stopColor="var(--chart-2)" stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {ticks.map((tick) => (
              <g key={`tick-${tick.label}-${tick.y}`}>
                <line
                  x1={pad.left}
                  y1={tick.y}
                  x2={width - pad.right}
                  y2={tick.y}
                  stroke="var(--border)"
                  strokeWidth="1"
                  opacity={0.7}
                />
                <text
                  x={pad.left - 8}
                  y={tick.y + 3}
                  textAnchor="end"
                  className="fill-muted-foreground"
                  style={{ fontSize: 10, fontWeight: 500 }}
                >
                  {tick.label}
                </text>
              </g>
            ))}

            {coords.map((c, i) => (
              <line
                key={`v-${i}`}
                x1={c.x}
                y1={pad.top}
                x2={c.x}
                y2={chartBottom}
                stroke="var(--border)"
                strokeWidth="1"
                strokeDasharray="3 5"
                opacity={active === i ? 0.9 : 0.35}
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

            {activeCoord && (
              <circle
                cx={activeCoord.x}
                cy={activeCoord.y}
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
              >
                {p.label}
              </text>
            ))}

            {coords.map((c, i) => (
              <rect
                key={`hit-${i}`}
                x={c.x - (width - pad.left - pad.right) / Math.max(points.length * 2, 2)}
                y={pad.top}
                width={(width - pad.left - pad.right) / Math.max(points.length, 1)}
                height={Math.max(chartBottom - pad.top, 1)}
                fill="transparent"
                onMouseEnter={() => setHovered(i)}
              />
            ))}
          </svg>

          {points[active] && activeCoord && (
            <div
              className="pointer-events-none absolute rounded-lg bg-foreground/90 px-3 py-1 text-xs font-semibold text-background"
              style={{
                left: activeCoord.x,
                top: activeCoord.y,
                transform: 'translate(-50%, calc(-100% - 10px))',
              }}
            >
              {points[active].label}: {fmt(points[active].value)}
            </div>
          )}
        </div>
      ) : (
        <p className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Not enough data yet.
        </p>
      )}
    </div>
  );
}
