import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function EmptyState({
    icon,
    title,
    description,
    action,
    className,
}: {
    icon: ReactNode;
    title: ReactNode;
    description?: ReactNode;
    action?: ReactNode;
    className?: string;
}) {
    return (
        <div className={cn('flex flex-col items-center justify-center gap-3 py-12 text-center', className)}>
            <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--fz-bg-hover)] text-[var(--fz-text-3)]">
                {icon}
            </span>
            <div className="space-y-1">
                <p className="text-title-3">{title}</p>
                {description && <p className="text-body-sm max-w-[320px] text-[var(--fz-text-3)]">{description}</p>}
            </div>
            {action}
        </div>
    );
}
