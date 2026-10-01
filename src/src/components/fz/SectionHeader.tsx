import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Section label (sentence case, no tracking) + optional right action. */
export function SectionHeader({
    label,
    action,
    className,
}: {
    label: ReactNode;
    action?: ReactNode;
    className?: string;
}) {
    return (
        <div className={cn('flex items-center justify-between gap-3 px-1 pb-1.5', className)}>
            <h3 className="text-label">{label}</h3>
            {action}
        </div>
    );
}
