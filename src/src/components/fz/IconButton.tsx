import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Tooltip } from './Tooltip';

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    icon: ReactNode;
    /** Required — doubles as the aria-label. */
    tooltip: string;
    tooltipSide?: 'top' | 'right' | 'bottom' | 'left';
    size?: 28 | 32;
    active?: boolean;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
    { icon, tooltip, tooltipSide = 'top', size = 28, active, className, ...rest },
    ref,
) {
    return (
        <Tooltip content={tooltip} side={tooltipSide}>
            <button
                ref={ref}
                type="button"
                aria-label={tooltip}
                data-active={active ? 'true' : undefined}
                className={cn(
                    'inline-flex shrink-0 items-center justify-center rounded-md',
                    'text-[var(--fz-text-3)] transition-[background-color,color] duration-150',
                    'hover:bg-[var(--fz-bg-hover)] hover:text-[var(--fz-text-1)]',
                    'focus-visible:outline-2 focus-visible:outline-[var(--fz-focus-ring)] focus-visible:outline-offset-1',
                    'disabled:pointer-events-none disabled:opacity-50',
                    active && 'bg-[var(--fz-bg-active)] text-[var(--fz-text-1)]',
                    size === 28 ? 'size-7' : 'size-8',
                    className,
                )}
                {...rest}
            >
                {icon}
            </button>
        </Tooltip>
    );
});
