import { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { useProDashboardVisuals } from '../../lib/proDashboard';

type Size = 'lg' | 'md' | 'sm';

const SIZE: Record<Size, { box: string; icon: number; dot: string; radius: string }> = {
    lg: { box: 'w-10 h-10 min-w-10 min-h-10', icon: 18, dot: 'w-2 h-2', radius: 'rounded-md' },
    md: { box: 'w-8 h-8 min-w-8 min-h-8', icon: 15, dot: 'w-1.5 h-1.5', radius: 'rounded-md' },
    sm: { box: 'w-6 h-6 min-w-6 min-h-6', icon: 12, dot: 'w-1.5 h-1.5', radius: 'rounded-[4px]' },
};

export function HabitCheckInButton({
    checked,
    onCheckIn,
    size = 'lg',
    disabled,
}: {
    checked: boolean;
    onCheckIn: () => void | Promise<void>;
    size?: Size;
    disabled?: boolean;
}) {
    const { proTheme } = useProDashboardVisuals();
    const [spinning, setSpinning] = useState(false);
    const s = SIZE[size];

    const handleClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (checked || disabled || spinning) return;
        setSpinning(true);
        try {
            await onCheckIn();
        } finally {
            window.setTimeout(() => setSpinning(false), proTheme ? 620 : 520);
        }
    };

    return (
        <button
            type="button"
            disabled={disabled}
            onClick={(e) => void handleClick(e)}
            className={`pro-habit-check-btn ${s.box} ${s.radius} shrink-0 inline-flex items-center justify-center relative border
                ${checked
                    ? 'is-checked bg-neutral-200 text-neutral-950 border-neutral-200'
                    : 'bg-white/[0.025] text-neutral-600 hover:bg-white/[0.06] hover:text-neutral-400 border-white/[0.09]'}
                ${spinning ? 'is-spinning' : ''}
                ${!proTheme && checked ? 'rotate-[360deg] transition-all duration-500' : ''}
                ${!proTheme && !checked ? 'transition-all duration-300' : ''}`}
            aria-pressed={checked}
        >
            {spinning && !checked ? (
                proTheme ? (
                    <span className="pro-habit-spinner-ring" aria-hidden />
                ) : (
                    <Loader2 size={s.icon} className="animate-spin" />
                )
            ) : checked ? (
                <Check size={s.icon} strokeWidth={2.25} className="pro-check-pop-in" />
            ) : (
                <span className={`${s.dot} rounded-full bg-neutral-700`} aria-hidden />
            )}
        </button>
    );
}

export function HabitDayCell({
    checked,
    isToday,
    disabled,
    onCheckIn,
    title,
}: {
    checked: boolean;
    isToday: boolean;
    disabled?: boolean;
    onCheckIn: () => void | Promise<void>;
    title?: string;
}) {
    const locked = disabled || !isToday;
    const handleClick = async () => {
        if (checked || locked) return;
        await onCheckIn();
    };

    return (
        <button
            type="button"
            title={title}
            disabled={locked}
            onClick={() => void handleClick()}
            className={`flex-1 h-8 rounded-[4px] border transition-colors
                ${checked ? 'bg-neutral-300 border-neutral-300' : 'bg-white/[0.035] border-transparent hover:bg-white/[0.07]'}
                ${isToday && !checked ? 'border-white/[0.2]' : ''}
                ${locked ? 'cursor-default' : 'cursor-pointer'}
                ${!isToday && !checked ? 'opacity-40 hover:bg-white/[0.035]' : ''}`}
        />
    );
}
