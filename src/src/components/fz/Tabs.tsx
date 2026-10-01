import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { reducedMotion, SPRING } from '../../lib/motion';

/** Underline tabs — indicator slides via layoutId. */
export function Tabs<T extends string>({
    tabs,
    value,
    onChange,
    className,
    idPrefix = 'tabs',
}: {
    tabs: { value: T; label: ReactNode }[];
    value: T;
    onChange: (v: T) => void;
    className?: string;
    idPrefix?: string;
}) {
    return (
        <div role="tablist" className={cn('flex items-center gap-1 border-b border-[var(--fz-border)]', className)}>
            {tabs.map((t) => {
                const active = t.value === value;
                return (
                    <button
                        key={t.value}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => onChange(t.value)}
                        className={cn(
                            'relative -mb-px px-3 pb-2 pt-1 text-[13px] font-medium transition-colors',
                            active ? 'text-[var(--fz-text-1)]' : 'text-[var(--fz-text-3)] hover:text-[var(--fz-text-2)]',
                        )}
                    >
                        {t.label}
                        {active && (
                            <motion.span
                                layoutId={`${idPrefix}-underline`}
                                className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[var(--fz-accent)]"
                                transition={reducedMotion.safe(SPRING)}
                            />
                        )}
                    </button>
                );
            })}
        </div>
    );
}
