import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { reducedMotion, SPRING } from '../../lib/motion';

export function SegmentedControl<T extends string>({
    options,
    value,
    onChange,
    size = 'md',
    className,
    idPrefix = 'seg',
}: {
    options: { value: T; label: ReactNode; icon?: ReactNode }[];
    value: T;
    onChange: (v: T) => void;
    size?: 'sm' | 'md';
    className?: string;
    idPrefix?: string;
}) {
    return (
        <div
            role="radiogroup"
            className={cn(
                'inline-flex items-center gap-0.5 rounded-lg border border-[var(--fz-border)] bg-[var(--fz-bg-raised)] p-0.5',
                className,
            )}
        >
            {options.map((opt) => {
                const active = opt.value === value;
                return (
                    <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => onChange(opt.value)}
                        className={cn(
                            'relative flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md text-[13px] font-medium transition-colors',
                            size === 'sm' ? 'h-6 px-2' : 'h-7 px-2.5',
                            active ? 'text-[var(--fz-text-1)]' : 'text-[var(--fz-text-3)] hover:text-[var(--fz-text-2)]',
                        )}
                    >
                        {active && (
                            <motion.span
                                layoutId={`${idPrefix}-thumb`}
                                className="absolute inset-0 rounded-md bg-[var(--fz-bg-active)] shadow-[inset_0_0_0_1px_var(--fz-border)]"
                                transition={reducedMotion.safe(SPRING)}
                            />
                        )}
                        <span className="relative z-[1] flex items-center gap-1.5">
                            {opt.icon}
                            {opt.label}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
