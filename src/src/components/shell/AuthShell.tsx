import type { ReactNode } from 'react';

type AuthShellProps = {
    children: ReactNode;
    /** Subtle tint behind content — violet | red | blue */
    tint?: 'violet' | 'red' | 'blue';
    className?: string;
};

const TINTS = {
    violet: 'from-violet-600/[0.12] via-transparent to-transparent',
    red: 'from-red-600/[0.1] via-transparent to-transparent',
    blue: 'from-sky-600/[0.1] via-transparent to-transparent',
} as const;

/** Full-screen backdrop for onboarding + sign-in flows */
export function AuthShell({ children, tint = 'violet', className = '' }: AuthShellProps) {
    return (
        <div
            className={`focuz-shell fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-8 bg-[#080808] ${className}`}
        >
            <div
                className={`pointer-events-none absolute inset-0 bg-gradient-to-b ${TINTS[tint]}`}
                aria-hidden
            />
            <div
                className="pointer-events-none absolute inset-0 opacity-[0.35]"
                style={{
                    backgroundImage:
                        'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0)',
                    backgroundSize: '24px 24px',
                }}
                aria-hidden
            />
            <div className="relative z-10 w-full max-w-[420px]">{children}</div>
        </div>
    );
}
