import { useEffect, useMemo, useState } from 'react';
import { Check, Zap } from 'lucide-react';
import { shouldShowProConfetti } from '../../lib/proDashboard';

function ProCard({ className = '', children }: { className?: string; children: React.ReactNode }) {
    return <div className={`glass-edge-card pro-card-spring ${className}`}>{children}</div>;
}

const REDUCED_MOTION =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

export function ProBadge({ className = '', gold = false }: { className?: string; gold?: boolean }) {
    return (
        <span
            className={`inline-flex items-center gap-0.5 text-[8px] font-bold leading-none whitespace-nowrap shrink-0 px-1.5 py-0.5 rounded-md ${
                gold
                    ? 'text-amber-200 border border-amber-400/50 bg-amber-500/15'
                    : 'text-purple-200 border border-purple-400/40 bg-purple-500/15'
            } ${className}`}
        >
            <span className={gold ? 'text-amber-300' : 'text-purple-300'} aria-hidden>
                ✦
            </span>
            PRO
        </span>
    );
}

/** Minimal focus-ring mark — not a stock crown icon */
export function ProHeroMark({ className = '' }: { className?: string }) {
    return (
        <div className={`pro-hero-mark ${className}`} aria-hidden>
            <span className="pro-hero-mark-ring" />
            <span className="pro-hero-mark-core" />
        </div>
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
            className={`p-6 mb-2 border border-amber-500/30 bg-gradient-to-br from-amber-950/50 via-[#1a1508] to-transparent pro-hero-enter ${
                visible ? 'pro-hero-visible' : ''
            }`}
        >
            <div className="flex items-center gap-5">
                <ProHeroMark />
                <div>
                    <p className="text-[10px] font-bold text-amber-300/90 uppercase tracking-widest mb-1">
                        Pro · active
                    </p>
                    <h2 className="text-2xl font-black text-white tracking-tight pro-hero-title">
                        You&apos;re in the zone
                    </h2>
                    <p className="text-sm text-amber-200/60 mt-1 tabular-nums">
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
    accent,
    children,
}: {
    label: string;
    value: React.ReactNode;
    accent?: boolean;
    children?: React.ReactNode;
}) {
    return (
        <ProCard
            className={`p-6 flex flex-col justify-between h-36 transition-all duration-300 pro-stat-card border ${
                accent ? 'border-amber-500/35' : 'border-white/8'
            }`}
        >
            <div className="flex justify-between items-start">
                <span
                    className={`text-[10px] font-bold uppercase tracking-widest ${
                        accent ? 'text-amber-300' : 'text-neutral-500'
                    }`}
                >
                    {label}
                </span>
                {children}
            </div>
            <div className="text-4xl font-black text-white tracking-tighter tabular-nums pro-gold-text-glow">
                {value}
            </div>
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
                hue: i % 3 === 0 ? '45' : i % 3 === 1 ? '38' : '48',
            })),
        [],
    );

    if (!active || REDUCED_MOTION) return null;

    return (
        <div className="pointer-events-none fixed inset-0 z-[400] overflow-hidden" aria-hidden>
            {particles.map((p) => (
                <span
                    key={p.id}
                    className="pro-confetti-bit absolute top-0 w-2 h-2 rounded-sm"
                    style={{
                        left: p.left,
                        animationDelay: p.delay,
                        background: `hsl(${p.hue} 85% 55%)`,
                        boxShadow: '0 0 6px rgba(255, 215, 0, 0.8)',
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
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[350] flex items-center gap-3 px-5 py-3 rounded-xl bg-[#1a1408] border border-amber-500/40 text-sm text-amber-100 shadow-[0_0_32px_rgba(212,175,55,0.45)] max-w-md pro-toast-enter">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-400 flex items-center justify-center pro-check-spin">
                <Check size={18} strokeWidth={3} className="text-amber-950" />
            </span>
            <span className="font-semibold">{message}</span>
        </div>
    );
}

export function ProNavSuffix() {
    return <span className="text-amber-400/90 text-[10px] ml-0.5">✦</span>;
}

export function ProSidebarAvatarRing({ children }: { children: React.ReactNode }) {
    return <div className="pro-avatar-ring rounded flex-shrink-0">{children}</div>;
}

export function ProSubscriptionTrophy({ children }: { children: React.ReactNode }) {
    return <div className="pro-subscription-trophy rounded-xl">{children}</div>;
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
        <ProCard className="p-6 border border-amber-500/20">
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0 shadow-[0_0_16px_rgba(212,175,55,0.25)]">
                        <Zap size={20} className="text-amber-300" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-white">Pro Gold animations</h3>
                        <p className="text-xs text-neutral-500 mt-1 max-w-md">
                            Extra motion on clicks, page changes, hero, and celebrations. Gold colors stay
                            while Pro Gold theme is selected.
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange(!enabled)}
                    className={`w-14 h-8 rounded-full transition-all relative flex-shrink-0 ${
                        enabled ? 'bg-amber-500' : 'bg-neutral-800'
                    } ${disabled ? 'opacity-50' : ''}`}
                    aria-pressed={enabled}
                >
                    <div
                        className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-all ${
                            enabled ? 'left-7' : 'left-1'
                        }`}
                    />
                </button>
            </div>
            <p className="text-[10px] text-amber-700/80 mt-3 uppercase tracking-widest font-bold">
                {enabled ? 'Full gold experience' : 'Gold theme · calm motion'}
            </p>
        </ProCard>
    );
}
