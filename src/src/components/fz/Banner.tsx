import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { IconInfo, IconWarning, IconX } from './icons';

export function Banner({
    tone = 'info',
    title,
    children,
    onDismiss,
    className,
}: {
    tone?: 'info' | 'warn' | 'danger';
    title?: ReactNode;
    children?: ReactNode;
    onDismiss?: () => void;
    className?: string;
}) {
    const iconColor =
        tone === 'warn' ? 'text-[var(--fz-warning)]' : tone === 'danger' ? 'text-[var(--fz-danger)]' : 'text-[var(--fz-text-3)]';
    const soft =
        tone === 'warn' ? 'bg-[var(--fz-warning-soft)]' : tone === 'danger' ? 'bg-[var(--fz-danger-soft)]' : 'bg-[var(--fz-bg-hover)]';
    return (
        <div
            role={tone === 'danger' ? 'alert' : 'note'}
            className={cn('flex items-start gap-3 rounded-lg border border-[var(--fz-border)] px-3 py-2.5', soft, className)}
        >
            <span className={cn('mt-0.5 shrink-0', iconColor)}>
                {tone === 'info' ? <IconInfo size={14} /> : <IconWarning size={14} />}
            </span>
            <div className="min-w-0 flex-1">
                {title && <p className="text-body-sm font-medium text-[var(--fz-text-1)]">{title}</p>}
                {children && <div className="text-meta mt-0.5">{children}</div>}
            </div>
            {onDismiss && (
                <button
                    type="button"
                    onClick={onDismiss}
                    aria-label="Dismiss"
                    className="shrink-0 rounded-md p-0.5 text-[var(--fz-text-4)] hover:bg-[var(--fz-bg-hover)] hover:text-[var(--fz-text-2)]"
                >
                    <IconX size={12} />
                </button>
            )}
        </div>
    );
}
