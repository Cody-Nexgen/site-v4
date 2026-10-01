import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { IconCheck } from './icons';

/** Toggleable chip — state shown by icon + text, not color only. */
export const Chip = forwardRef<
    HTMLButtonElement,
    ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean; icon?: ReactNode }
>(function Chip({ selected, icon, className, children, ...rest }, ref) {
    return (
        <button
            ref={ref}
            type="button"
            aria-pressed={selected}
            className={cn(
                'inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-[12px] font-medium transition-colors duration-100',
                'focus-visible:outline-2 focus-visible:outline-[var(--fz-focus-ring)] focus-visible:outline-offset-1',
                selected
                    ? 'border-[var(--fz-border-strong)] bg-[var(--fz-bg-selected)] text-[var(--fz-text-1)]'
                    : 'border-[var(--fz-border)] bg-transparent text-[var(--fz-text-3)] hover:bg-[var(--fz-bg-hover)] hover:text-[var(--fz-text-2)]',
                className,
            )}
            {...rest}
        >
            {selected ? <IconCheck size={11} /> : icon}
            <span className="truncate">{children}</span>
        </button>
    );
});
