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
        'bg-white text-neutral-950 hover:bg-neutral-100 shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_8px_24px_-8px_rgba(0,0,0,0.5)]',
    secondary: 'glass-edge-btn text-neutral-200 hover:text-white',
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
                'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-[background,color,transform,opacity] duration-150',
                'active:scale-[0.98] disabled:opacity-45 disabled:pointer-events-none',
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
        <div className={`glass-edge-card rounded-2xl p-6 sm:p-7 ${className}`}>{children}</div>
    );
}

export function Eyebrow({ children }: { children: ReactNode }) {
    return <p className="text-xs font-medium text-violet-400/90 tracking-wide">{children}</p>;
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
                        i === current ? 'w-6 bg-violet-500' : 'w-1 bg-neutral-700 hover:bg-neutral-600',
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
