import { cn } from '@/lib/utils';

export function ProgressRing({
    value,
    size = 40,
    stroke = 3,
    className,
    children,
}: {
    /** 0..1 */
    value: number;
    size?: number;
    stroke?: number;
    className?: string;
    children?: React.ReactNode;
}) {
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const clamped = Math.min(1, Math.max(0, value));
    return (
        <span className={cn('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }}>
            <svg width={size} height={size} className="-rotate-90">
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--fz-bg-active)" strokeWidth={stroke} />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    fill="none"
                    stroke="var(--fz-accent)"
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    strokeDasharray={c}
                    strokeDashoffset={c * (1 - clamped)}
                    style={{ transition: 'stroke-dashoffset var(--fz-dur-slow) var(--fz-ease-standard)' }}
                />
            </svg>
            {children && <span className="absolute inset-0 flex items-center justify-center">{children}</span>}
        </span>
    );
}
