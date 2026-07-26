import type {
    ButtonHTMLAttributes,
    HTMLAttributes,
    InputHTMLAttributes,
    ReactNode,
} from 'react';

const join = (...classes: Array<string | false | null | undefined>) =>
    classes.filter(Boolean).join(' ');

export function SurfaceCard({
    children,
    className,
    ...props
}: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }) {
    return (
        <div className={join('surface-card', className)} {...props}>
            {children}
        </div>
    );
}

type SurfaceButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function SurfaceButton({
    children,
    className,
    variant = 'secondary',
    ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
    children?: ReactNode;
    variant?: SurfaceButtonVariant;
}) {
    const variants: Record<SurfaceButtonVariant, string> = {
        primary: 'bg-primary text-primary-foreground border border-primary hover:bg-primary/90',
        secondary: 'surface-button text-secondary-foreground hover:text-foreground',
        ghost: 'border border-transparent bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        danger: 'border border-red-400/15 bg-red-400/[0.07] text-red-300 hover:bg-red-400/[0.11]',
    };

    return (
        <button
            type="button"
            className={join(
                'inline-flex h-8 items-center justify-center gap-2 rounded-md px-3 text-xs font-medium disabled:pointer-events-none disabled:opacity-40',
                variants[variant],
                className,
            )}
            {...props}
        >
            {children}
        </button>
    );
}

export function DashboardInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
    return (
        <input
            className={join(
                'h-8 w-full rounded-md border border-input bg-input/30 px-2.5 text-[13px] text-foreground outline-none placeholder:text-muted-foreground hover:border-ring/50 focus:border-ring',
                className,
            )}
            {...props}
        />
    );
}

export function SectionLabel({
    children,
    className,
    ...props
}: HTMLAttributes<HTMLParagraphElement> & { children?: ReactNode }) {
    return (
        <p className={join('text-[11px] font-medium text-muted-foreground', className)} {...props}>
            {children}
        </p>
    );
}
