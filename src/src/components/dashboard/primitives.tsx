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
                'inline-flex h-8 items-center justify-center gap-2 rounded-lg px-3 text-xs font-medium disabled:pointer-events-none disabled:opacity-40',
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
                'h-8 w-full rounded-lg border border-input bg-input/30 px-2.5 text-xs text-foreground outline-none placeholder:text-muted-foreground hover:border-ring/50 focus:border-ring',
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

/**
 * The one empty state. Icon, a sentence that says why it's empty, and at most
 * one action. Replaces the bare grey sentences that used to sit where content
 * should be — an unhandled empty state is the loudest "unfinished" signal a
 * dashboard has.
 */
export function EmptyState({
    icon,
    title,
    description,
    action,
    className,
}: {
    icon?: ReactNode;
    title: string;
    description?: string;
    action?: ReactNode;
    className?: string;
}) {
    return (
        <div
            className={join(
                'flex flex-col items-center justify-center gap-2 px-6 py-10 text-center',
                className,
            )}
        >
            {icon && (
                <span className="mb-1 flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
                    {icon}
                </span>
            )}
            <p className="text-sm font-medium text-foreground">{title}</p>
            {description && (
                <p className="max-w-[38ch] text-xs leading-relaxed text-muted-foreground">{description}</p>
            )}
            {action && <div className="mt-2">{action}</div>}
        </div>
    );
}

/** Loading placeholder. Use instead of rendering a bare "…" in a value slot. */
export function Skeleton({ className }: { className?: string }) {
    return (
        <span
            aria-hidden="true"
            className={join('block animate-pulse rounded-sm bg-white/6', className)}
        />
    );
}
