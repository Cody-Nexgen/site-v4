import { useEffect, useMemo, useState } from 'react';
import { Check, Zap } from 'lucide-react';
import { shouldShowProConfetti } from '../../lib/proDashboard';

function ProCard({ className = '', children }: { className?: string; children: React.ReactNode }) {
    return <div className={`glass-edge-card pro-card-spring ${className}`}>{children}</div>;
}

const REDUCED_MOTION =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

export function ProBadge({ className = '' }: { className?: string }) {
    return (
        <span
            className={`inline-flex items-center gap-0.5 text-[11px] font-semibold leading-none whitespace-nowrap shrink-0 px-1.5 py-0.5 rounded-md border border-[var(--fz-border-strong)] bg-[var(--fz-bg-selected)] text-[var(--fz-text-1)] ${className}`}
        >
            PRO
        </span>
    );
}

export function ProDashboardHero({
    streak,
    blockedToday,
}: {
    streak: number;
    blockedToday: number;
}) {
    const [visible, setVisible] = useState(REDUCED_MOTION);

    useEffect(() => {
        if (REDUCED_MOTION) return;
        const t = window.setTimeout(() => setVisible(true), 40);
        return () => window.clearTimeout(t);
    }, []);

    return (
        <ProCard
            className={`p-6 mb-2 border border-[var(--fz-border)] pro-hero-enter ${
                visible ? 'pro-hero-visible' : ''
            }`}
        >
            <div className="flex items-center gap-5">
                <div className="flex size-12 items-center justify-center rounded-xl border border-[var(--fz-border)] bg-[var(--fz-bg-hover)]">
                    <Zap size={20} strokeWidth={1.6} className="text-[var(--fz-text-2)]" />
                </div>
                <div>
                    <p className="text-label mb-1">Pro · active</p>
                    <h2 className="text-title-1">You&apos;re in the zone</h2>
                    <p className="text-body-sm mt-1 tabular-nums text-[var(--fz-text-3)]">
                        {streak > 0 ? `${streak}-day streak` : 'Start your streak today'}
                        {blockedToday > 0 ? ` · ${blockedToday} blocks today` : ''}
                    </p>
                </div>
            </div>
        </ProCard>
    );
}

export function ProStatCard({
    label,
    value,
    children,
}: {
    label: string;
    value: React.ReactNode;
    children?: React.ReactNode;
}) {
    return (
        <ProCard className="p-6 flex flex-col justify-between h-36 border border-[var(--fz-border)]">
            <div className="flex justify-between items-start">
                <span className="text-label">{label}</span>
                {children}
            </div>
            <div className="text-stat">{value}</div>
        </ProCard>
    );
}

export function ProConfettiOverlay({ active }: { active: boolean }) {
    const particles = useMemo(
        () =>
            Array.from({ length: 28 }, (_, i) => ({
                id: i,
                left: `${(i * 17) % 100}%`,
                delay: `${(i % 8) * 0.05}s`,
                accent: i % 4 === 0,
            })),
        [],
    );

    if (!active || REDUCED_MOTION) return null;

    return (
        <div className="pointer-events-none fixed inset-0 z-[70] overflow-hidden" aria-hidden>
            {particles.map((p) => (
                <span
                    key={p.id}
                    className="pro-confetti-bit absolute top-0 w-2 h-2 rounded-sm"
                    style={{
                        left: p.left,
                        animationDelay: p.delay,
                        background: p.accent ? 'var(--fz-accent)' : 'var(--fz-text-3)',
                    }}
                />
            ))}
        </div>
    );
}

export function ProConfettiGate() {
    const [show, setShow] = useState(() => shouldShowProConfetti());
    useEffect(() => {
        if (!show) return;
        const t = window.setTimeout(() => setShow(false), 1200);
        return () => window.clearTimeout(t);
    }, [show]);
    return <ProConfettiOverlay active={show} />;
}

export function ProFocusToast({ message, onDone }: { message: string; onDone: () => void }) {
    useEffect(() => {
        const t = window.setTimeout(onDone, 3200);
        return () => window.clearTimeout(t);
    }, [onDone, message]);

    if (!message) return null;

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-3 px-4 py-2.5 rounded-lg bg-[var(--fz-bg-overlay)] border border-[var(--fz-border)] text-[13px] text-[var(--fz-text-1)] shadow-[var(--fz-shadow-overlay)] max-w-md">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-[var(--fz-accent-soft)] text-[var(--fz-accent)]">
                <Check size={14} strokeWidth={2.5} className="pro-check-spin" />
            </span>
            <span className="font-medium">{message}</span>
        </div>
    );
}

export function ProNavSuffix() {
    return <span className="text-[var(--fz-accent)] text-[11px] ml-0.5">✦</span>;
}

export function ProSidebarAvatarRing({ children }: { children: React.ReactNode }) {
    return <div className="rounded flex-shrink-0 ring-1 ring-[var(--fz-border-strong)]">{children}</div>;
}

export function ProSubscriptionTrophy({ children }: { children: React.ReactNode }) {
    return <div className="pro-subscription-trophy rounded-lg">{children}</div>;
}

export function ProSettingsToggle({
    enabled,
    onChange,
    disabled,
}: {
    enabled: boolean;
    onChange: (next: boolean) => void;
    disabled?: boolean;
}) {
    return (
        <ProCard className="p-6 border border-[var(--fz-border)]">
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[var(--fz-bg-hover)] flex items-center justify-center flex-shrink-0">
                        <Zap size={18} strokeWidth={1.6} className="text-[var(--fz-text-2)]" />
                    </div>
                    <div>
                        <h3 className="text-title-3">Motion effects</h3>
                        <p className="text-body-sm text-[var(--fz-text-3)] mt-1 max-w-md">
                            Animations on clicks, page changes, and celebrations. Turn off to reduce motion.
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange(!enabled)}
                    className={`w-8 h-[18px] rounded-full transition-colors relative flex-shrink-0 ${
                        enabled ? 'bg-[var(--fz-accent)]' : 'bg-[var(--fz-bg-active)] border border-[var(--fz-border-strong)]'
                    } ${disabled ? 'opacity-50' : ''}`}
                    aria-pressed={enabled}
                >
                    <span
                        className={`absolute top-[2px] size-3.5 rounded-full bg-white transition-transform ${
                            enabled ? 'translate-x-[15px]' : 'translate-x-[2px]'
                        }`}
                    />
                </button>
            </div>
            <p className="text-meta mt-3">
                {enabled ? 'Full motion' : 'Reduced motion'}
            </p>
        </ProCard>
    );
}
