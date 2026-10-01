import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { IconCheck, IconMinus } from './icons';

export const Checkbox = forwardRef<
    HTMLButtonElement,
    ButtonHTMLAttributes<HTMLButtonElement> & {
        checked: boolean | 'indeterminate';
        onCheckedChange?: (v: boolean) => void;
    }
>(function Checkbox({ checked, onCheckedChange, className, ...rest }, ref) {
    const on = checked === true;
    return (
        <button
            ref={ref}
            type="button"
            role="checkbox"
            aria-checked={checked === 'indeterminate' ? 'mixed' : on}
            onClick={(e) => {
                rest.onClick?.(e);
                onCheckedChange?.(!on);
            }}
            className={cn(
                'flex size-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors duration-100',
                'focus-visible:outline-2 focus-visible:outline-[var(--fz-focus-ring)] focus-visible:outline-offset-2',
                'disabled:pointer-events-none disabled:opacity-50',
                checked
                    ? 'border-transparent bg-[var(--fz-accent)] text-[var(--fz-accent-fg)]'
                    : 'border-[var(--fz-border-strong)] bg-[var(--fz-bg-raised)] hover:bg-[var(--fz-bg-hover)]',
                className,
            )}
            {...rest}
        >
            {checked === 'indeterminate' ? <IconMinus size={11} /> : on ? <IconCheck size={11} /> : null}
        </button>
    );
});
