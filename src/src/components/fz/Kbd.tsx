import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Keyboard hint — sans, not mono. */
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <kbd
            className={cn(
                'inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-[var(--fz-border)]',
                'bg-[var(--fz-bg-raised)] px-1 font-sans text-[11px] font-medium text-[var(--fz-text-3)]',
                className,
            )}
        >
            {children}
        </kbd>
    );
}
