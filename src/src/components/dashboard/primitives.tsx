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
        primary: 'bg-neutral-100 text-neutral-950 border border-neutral-100 hover:bg-white',
        secondary: 'surface-button text-neutral-300 hover:text-neutral-100',
        ghost: 'border border-transparent bg-transparent text-neutral-500 hover:bg-white/[0.04] hover:text-neutral-200',
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
                'h-8 w-full rounded-md border border-white/[0.08] bg-white/[0.025] px-2.5 text-[13px] text-neutral-200 outline-none placeholder:text-neutral-600 hover:border-white/[0.11] focus:border-white/[0.18]',
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
        <p className={join('text-[11px] font-medium text-neutral-600', className)} {...props}>
            {children}
        </p>
    );
}
