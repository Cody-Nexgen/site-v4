import type { ReactNode } from 'react';

type AuthShellProps = {
    children: ReactNode;
    /** Subtle tint behind content — violet | red | blue */
    tint?: 'violet' | 'red' | 'blue';
    className?: string;
};

/** Full-screen backdrop for onboarding + sign-in flows */
export function AuthShell({ children, tint: _tint = 'violet', className = '' }: AuthShellProps) {
    return (
        <div
            className={`focuz-shell fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-8 bg-[#0a0a0b] ${className}`}
        >
            <div className="relative z-10 w-full max-w-[420px]">{children}</div>
        </div>
    );
}
