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
    sm: { box: 'w-8 h-8 rounded-lg text-sm', title: 'text-sm font-semibold' },
    md: { box: 'w-10 h-10 rounded-xl text-base', title: 'text-base font-semibold' },
    lg: { box: 'w-12 h-12 rounded-xl text-lg', title: 'text-lg font-semibold' },
} as const;

export function Brand({ size = 'md', subtitle, className = '', glow = false, showRotatingWord = false }: BrandProps) {
    const s = SIZES[size];
    return (
        <div className={`flex items-center gap-3 min-w-0 ${className}`}>
            <div
                className={`${s.box} shrink-0 flex items-center justify-center font-semibold text-white bg-gradient-to-br from-violet-600 to-violet-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] ring-1 ring-white/10 ${glow ? 'focuz-brand-icon-glow' : ''}`}
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
                        Time to <RotatingWord className="text-purple-400 font-bold" />
                    </p>
                ) : subtitle ? (
                    <p className="text-xs text-neutral-500 mt-0.5 truncate">{subtitle}</p>
                ) : null}
            </div>
        </div>
    );
}
