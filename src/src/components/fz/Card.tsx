import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/** Raised surface card — 10px radius, hairline border, no shadow. */
export const Card = forwardRef<
    HTMLDivElement,
    HTMLAttributes<HTMLDivElement> & { pad?: 'sm' | 'md' | 'none'; interactive?: boolean }
>(function Card({ pad = 'md', interactive, className, ...rest }, ref) {
    return (
        <div
            ref={ref}
            className={cn(
                'rounded-[10px] border border-[var(--fz-border)] bg-[var(--fz-bg-raised)] bg-[image:var(--fz-sheen)] shadow-[var(--fz-elev-card)]',
                pad === 'sm' && 'p-4',
                pad === 'md' && 'p-5',
                interactive &&
                    'cursor-pointer transition-[border-color,background-color] duration-150 hover:border-[var(--fz-border-strong)]',
                className,
            )}
            {...rest}
        />
    );
});
