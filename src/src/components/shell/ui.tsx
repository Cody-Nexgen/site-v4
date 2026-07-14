import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

type ShellButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    fullWidth?: boolean;
    icon?: ReactNode;
};

const VARIANTS: Record<ButtonVariant, string> = {
    primary:
        'bg-neutral-100 text-neutral-950 hover:bg-white border border-neutral-100',
    secondary: 'surface-button text-neutral-300 hover:text-neutral-100',
    ghost: 'text-neutral-500 hover:text-neutral-300 bg-transparent border-transparent',
};

export function ShellButton({
    variant = 'primary',
    fullWidth = true,
    icon,
    className = '',
    children,
    ...props
}: ShellButtonProps) {
    return (
        <button
            type="button"
            className={[
                'inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-[background,color,opacity] duration-150',
                'disabled:opacity-45 disabled:pointer-events-none',
                fullWidth ? 'w-full' : '',
                VARIANTS[variant],
                className,
            ]
                .filter(Boolean)
                .join(' ')}
            {...props}
        >
            {children}
            {icon}
        </button>
    );
}

export function ShellCard({ children, className = '' }: { children: ReactNode; className?: string }) {
    return (
        <div className={`surface-card p-6 sm:p-7 ${className}`}>{children}</div>
    );
}

export function Eyebrow({ children }: { children: ReactNode }) {
    return <p className="text-xs font-medium text-neutral-500">{children}</p>;
}

export function ShellTitle({ children }: { children: ReactNode }) {
    return <h1 className="text-2xl font-semibold text-white tracking-tight leading-snug">{children}</h1>;
}

export function ShellDescription({ children }: { children: ReactNode }) {
    return <p className="text-sm text-neutral-400 leading-relaxed">{children}</p>;
}

export function StepDots({
    total,
    current,
    onSelect,
}: {
    total: number;
    current: number;
    onSelect: (i: number) => void;
}) {
    return (
        <div className="flex items-center justify-center gap-1.5" role="tablist" aria-label="Tour steps">
            {Array.from({ length: total }).map((_, i) => (
                <button
                    key={i}
                    type="button"
                    role="tab"
                    aria-selected={i === current}
                    aria-label={`Step ${i + 1} of ${total}`}
                    onClick={() => onSelect(i)}
                    className={[
                        'h-1 rounded-full transition-all duration-200',
                        i === current ? 'w-6 bg-neutral-300' : 'w-1 bg-neutral-800 hover:bg-neutral-600',
                    ].join(' ')}
                />
            ))}
        </div>
    );
}

export function NextButton({
    label,
    onClick,
    isLast,
}: {
    label?: string;
    onClick: () => void;
    isLast?: boolean;
}) {
    return (
        <ShellButton onClick={onClick} icon={!isLast ? <ChevronRight size={16} className="opacity-70" /> : undefined}>
            {label ?? (isLast ? 'Continue' : 'Next')}
        </ShellButton>
    );
}
