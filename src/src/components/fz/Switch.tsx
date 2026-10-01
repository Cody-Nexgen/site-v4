import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/** 32×18 toggle with a sliding thumb. */
export const Switch = forwardRef<
    HTMLButtonElement,
    ButtonHTMLAttributes<HTMLButtonElement> & { checked: boolean; onCheckedChange?: (v: boolean) => void }
>(function Switch({ checked, onCheckedChange, className, ...rest }, ref) {
    return (
        <button
            ref={ref}
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={(e) => {
                rest.onClick?.(e);
                onCheckedChange?.(!checked);
            }}
            className={cn(
                'relative inline-flex h-[18px] w-8 shrink-0 items-center rounded-full border transition-colors duration-150',
                'focus-visible:outline-2 focus-visible:outline-[var(--fz-focus-ring)] focus-visible:outline-offset-2',
                'disabled:pointer-events-none disabled:opacity-50',
                checked
                    ? 'border-transparent bg-[var(--fz-accent)]'
                    : 'border-[var(--fz-border-strong)] bg-[var(--fz-bg-active)]',
                className,
            )}
            {...rest}
        >
            <span
                aria-hidden
                className={cn(
                    'pointer-events-none block size-3.5 rounded-full shadow-sm',
                    'transition-transform duration-150 ease-out',
                    // The accent is near-white in dark mode, so the "on" thumb takes the
                    // accent's foreground color or it vanishes into the track.
                    checked ? 'translate-x-[15px] bg-[var(--fz-accent-fg)]' : 'translate-x-[2px] bg-white',
                )}
            />
        </button>
    );
});
