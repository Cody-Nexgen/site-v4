import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '../../lib/utils';
import { reducedMotion } from '../../lib/motion';

type Trend = 'up' | 'down' | 'flat';
type Tone = 'default' | 'warm' | 'cool' | 'danger' | 'success';

export type KpiCardProps = {
  label: string;
  value: string | number;
  delta?: number | string;
  trend?: Trend;
  caption?: string;
  icon?: ReactNode;
  tone?: Tone;
  className?: string;
};

// §6.1: KPI values are always text-1 — tone only tinted them before.
const toneValue: Record<Tone, string> = {
  default: 'text-[var(--fz-text-1)]',
  warm: 'text-[var(--fz-text-1)]',
  cool: 'text-[var(--fz-text-1)]',
  danger: 'text-[var(--fz-text-1)]',
  success: 'text-[var(--fz-text-1)]',
};

// §6.1: count up once on mount, 400ms ease-out-expo, tabular numerals.
function easeOutExpo(t: number) {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

function useCountUp(target: number) {
  const [display, setDisplay] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    if (started.current) { setDisplay(target); return; }
    started.current = true;
    if (reducedMotion.matches() || target === 0) { setDisplay(target); return; }
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / 400);
      setDisplay(Math.round(target * easeOutExpo(p)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return display;
}

/** §6.1 KPI card: label (text-3), stat number, delta chip. */
export function KpiCard({
  label,
  value,
  delta,
  trend = 'flat',
  caption,
  icon,
  tone = 'default',
  className,
}: KpiCardProps) {
  const deltaValue =
    typeof delta === 'number' ? `${delta > 0 ? '+' : ''}${delta}%` : delta;
  const isUp = trend === 'up';
  const isDown = trend === 'down';
  const DeltaIcon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;

  const numeric = typeof value === 'number';
  const counted = useCountUp(numeric ? value : 0);

  return (
    <div
      className={cn(
        'relative rounded-[var(--fz-radius-lg)] border border-[var(--fz-border)] bg-[var(--fz-bg-panel)] px-4 py-4',
        'transition-colors duration-150 hover:border-[var(--fz-border-strong)]',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-label text-[var(--fz-text-3)]">{label}</p>
          <p className={cn('text-stat tabular-nums', toneValue[tone])}>
            {numeric ? counted.toLocaleString() : value}
          </p>
          {caption ? (
            <p className="text-meta text-[var(--fz-text-3)]">{caption}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {typeof deltaValue !== 'undefined' && (
            <div
              className={cn(
                'flex items-center gap-1 rounded-full bg-[var(--fz-bg-raised)] px-1.5 py-0.5 text-meta text-[var(--fz-text-3)]',
              )}
            >
              <DeltaIcon
                className={cn(
                  'h-3 w-3',
                  isUp && 'text-emerald-400',
                  isDown && 'text-[var(--fz-danger)]',
                )}
                aria-hidden
              />
              {deltaValue}
            </div>
          )}
          {icon ? (
            <div className="rounded-md bg-[var(--fz-bg-raised)] p-1.5 text-[var(--fz-text-3)]">{icon}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
