import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** 28–40px list row: leading icon/avatar, title, meta, trailing. */
export const Row = forwardRef<
    HTMLButtonElement,
    ButtonHTMLAttributes<HTMLButtonElement> & {
        leading?: ReactNode;
        title: ReactNode;
        meta?: ReactNode;
        trailing?: ReactNode;
        size?: 'sm' | 'md' | 'lg';
        active?: boolean;
    }
>(function Row({ leading, title, meta, trailing, size = 'md', active, className, ...rest }, ref) {
    return (
        <button
            ref={ref}
            type="button"
            className={cn(
                'flex w-full items-center gap-2.5 rounded-lg px-2 text-left transition-colors duration-100',
                'hover:bg-[var(--fz-bg-hover)] focus-visible:outline-2 focus-visible:outline-[var(--fz-focus-ring)]',
                active && 'bg-[var(--fz-bg-selected)]',
                size === 'sm' && 'h-7',
                size === 'md' && 'h-9',
                size === 'lg' && 'h-10',
                className,
            )}
            {...rest}
        >
            {leading && (
                <span className="flex shrink-0 items-center justify-center text-[var(--fz-text-3)]">{leading}</span>
            )}
            <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-[var(--fz-text-1)]">{title}</span>
                {meta && <span className="text-meta block truncate">{meta}</span>}
            </span>
            {trailing && <span className="flex shrink-0 items-center gap-1.5">{trailing}</span>}
        </button>
    );
});
