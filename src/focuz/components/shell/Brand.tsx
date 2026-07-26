import type { ReactNode } from 'react';
import { RotatingWord } from '../RotatingWord';

type BrandProps = {
    size?: 'sm' | 'md' | 'lg';
    subtitle?: ReactNode;
    className?: string;
    glow?: boolean;
    showRotatingWord?: boolean;
};

const SIZES = {
    sm: { box: 'w-7 h-7 text-xs', title: 'text-sm font-medium' },
    md: { box: 'w-9 h-9 text-sm', title: 'text-base font-medium' },
    lg: { box: 'w-11 h-11 text-base', title: 'text-lg font-medium' },
} as const;

export function Brand({ size = 'md', subtitle, className = '', glow = false, showRotatingWord = false }: BrandProps) {
    const s = SIZES[size];
    return (
        <div className={`flex items-center gap-3 min-w-0 ${className}`}>
            <div
                className={`${s.box} shrink-0 flex items-center justify-center rounded-full font-medium text-neutral-200 bg-neutral-800 border border-white/[0.08]`}
                aria-hidden
            >
                F
            </div>
            <div className="min-w-0">
                <p className={`${s.title} text-white tracking-tight leading-none ${glow ? 'focuz-brand-glow' : ''}`}>
                    FocuzNow
                </p>
                {showRotatingWord ? (
                    <p className="text-xs text-neutral-500 mt-0.5 flex items-center gap-1">
                        Time to <RotatingWord className="text-neutral-300 font-medium" />
                    </p>
                ) : subtitle ? (
                    <p className="text-xs text-neutral-500 mt-0.5 truncate">{subtitle}</p>
                ) : null}
            </div>
        </div>
    );
}
