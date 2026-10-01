import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-solid';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
    primary:
        'bg-[var(--fz-accent)] text-[var(--fz-accent-fg)] hover:brightness-110 border border-transparent disabled:opacity-100 disabled:bg-[var(--fz-bg-active)] disabled:text-[var(--fz-text-4)] disabled:border-[var(--fz-border)]',
    secondary:
        'bg-[var(--fz-bg-raised)] text-[var(--fz-text-1)] border border-[var(--fz-border)] hover:bg-[var(--fz-bg-hover)] hover:border-[var(--fz-border-strong)]',
    ghost:
        'bg-transparent text-[var(--fz-text-3)] border border-transparent hover:bg-[var(--fz-bg-hover)] hover:text-[var(--fz-text-1)]',
    danger:
        'bg-[var(--fz-danger-soft)] text-[var(--fz-danger)] border border-transparent hover:brightness-110',
    'danger-solid':
        'bg-[var(--fz-danger)] text-[var(--fz-danger-fg)] hover:brightness-110 border border-transparent',
};

const SIZES: Record<Size, string> = {
    sm: 'h-7 px-2.5 text-[13px] gap-1.5 rounded-md',
    md: 'h-8 px-3 text-[13px] gap-2 rounded-lg',
    lg: 'h-9 px-3.5 text-[14px] gap-2 rounded-lg',
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: Variant;
    size?: Size;
    loading?: boolean;
    iconLeft?: ReactNode;
    iconRight?: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
    { variant = 'secondary', size = 'md', loading = false, iconLeft, iconRight, className, children, disabled, ...rest },
    ref,
) {
    return (
        <button
            ref={ref}
            type="button"
            disabled={disabled || loading}
            className={cn(
                'relative inline-flex shrink-0 items-center justify-center whitespace-nowrap font-medium select-none',
                'transition-[background-color,border-color,color,filter,transform] duration-150',
                'focus-visible:outline-2 focus-visible:outline-[var(--fz-focus-ring)] focus-visible:outline-offset-2',
                'active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
                '[&_svg]:pointer-events-none [&_svg]:shrink-0',
                VARIANTS[variant],
                SIZES[size],
                className,
            )}
            {...rest}
        >
            {loading ? (
                <span
                    aria-hidden
                    className="absolute inset-0 m-auto inline-block size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent opacity-80"
                />
            ) : (
                iconLeft
            )}
            <span className={cn('truncate', loading && 'invisible')}>{children}</span>
            {loading ? null : iconRight}
        </button>
    );
});
