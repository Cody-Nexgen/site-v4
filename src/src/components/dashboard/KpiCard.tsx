import type { ReactNode } from 'react';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '../../lib/utils';

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

const toneValue: Record<Tone, string> = {
  default: 'text-foreground',
  warm: 'text-[var(--chart-1)]',
  cool: 'text-[var(--chart-2)]',
  danger: 'text-destructive',
  success: 'text-emerald-500',
};

/** Minimal KPI card adapted from 21st.dev patterns for the Focuz dashboard theme. */
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

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[var(--radius)] border border-border bg-card px-5 py-5 shadow-[var(--dashboard-shadow)]',
        className,
      )}
    >
      <span className="pointer-events-none absolute -right-6 -top-6 inline-flex h-16 w-16 rounded-full bg-foreground/[0.04]" />
      <span className="pointer-events-none absolute -right-2 -top-2 inline-flex h-8 w-8 rounded-full bg-foreground/[0.04]" />

      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p
            className={cn(
              'text-2xl font-semibold tracking-tight tabular-nums',
              toneValue[tone],
            )}
          >
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          {caption ? (
            <p className="text-[11px] text-muted-foreground">{caption}</p>
          ) : null}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {typeof deltaValue !== 'undefined' && (
            <div
              className={cn(
                'flex items-center gap-1 text-xs font-medium',
                isUp && 'text-emerald-500',
                isDown && 'text-destructive',
                !isUp && !isDown && 'text-muted-foreground',
              )}
            >
              <DeltaIcon className="h-3.5 w-3.5" aria-hidden />
              {deltaValue}
            </div>
          )}
          {icon ? (
            <div className="rounded-full bg-muted p-1.5 text-muted-foreground">{icon}</div>
          ) : null}
        </div>
      </div>

      <div
        className="mt-3 h-0.5 w-14 rounded-full opacity-70"
        style={{ background: 'var(--chart-1)' }}
      />
    </div>
  );
}
