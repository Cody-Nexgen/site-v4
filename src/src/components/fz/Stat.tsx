import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** KPI: label (text-3) + stat number + optional delta. */
export function Stat({
    label,
    value,
    delta,
    deltaTone,
    className,
}: {
    label: ReactNode;
    value: ReactNode;
    delta?: ReactNode;
    deltaTone?: 'good' | 'bad' | 'neutral';
    className?: string;
}) {
    return (
        <div className={cn('flex flex-col gap-1', className)}>
            <span className="text-label">{label}</span>
            <span className="flex items-baseline gap-2">
                <span className="text-stat">{value}</span>
                {delta && (
                    <span
                        className={cn(
                            'text-meta',
                            deltaTone === 'good' && 'text-[var(--fz-success)]',
                            deltaTone === 'bad' && 'text-[var(--fz-danger)]',
                            (!deltaTone || deltaTone === 'neutral') && 'text-[var(--fz-text-3)]',
                        )}
                    >
                        {delta}
                    </span>
                )}
            </span>
        </div>
    );
}
