import { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { useProDashboardVisuals } from '../../lib/proDashboard';

type Size = 'lg' | 'md' | 'sm';

const SIZE: Record<Size, { box: string; icon: number; dot: string; radius: string }> = {
    lg: { box: 'w-14 h-14 min-w-[3.5rem] min-h-[3.5rem]', icon: 28, dot: 'w-2.5 h-2.5', radius: 'rounded-2xl' },
    md: { box: 'w-8 h-8 min-w-[2rem] min-h-[2rem]', icon: 16, dot: 'w-2 h-2', radius: 'rounded-xl' },
    sm: { box: 'w-6 h-6 min-w-[1.5rem] min-h-[1.5rem]', icon: 12, dot: 'w-1.5 h-1.5', radius: 'rounded-md' },
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
                    ? 'is-checked bg-purple-600 text-white shadow-xl shadow-purple-600/40 border-transparent'
                    : 'bg-white/5 text-neutral-600 hover:bg-white/10 hover:text-purple-400 border-white/5'}
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
                <Check size={s.icon} strokeWidth={3} className="pro-check-pop-in" />
            ) : (
                <Check size={s.icon} strokeWidth={2} className="text-neutral-600 pro-habit-dot-idle" />
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
    const { proTheme } = useProDashboardVisuals();
    const [popping, setPopping] = useState(false);

    const handleClick = async () => {
        if (checked || disabled) return;
        setPopping(true);
        await onCheckIn();
        window.setTimeout(() => setPopping(false), 550);
    };

    return (
        <button
            type="button"
            title={title}
            disabled={disabled}
            onClick={() => void handleClick()}
            className={`pro-habit-day-cell flex-1 h-8 rounded-xl cursor-pointer border border-transparent
                ${checked ? 'is-done bg-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.35)]' : 'bg-white/5 hover:bg-white/10'}
                ${isToday && !checked ? 'border-purple-500/50 pro-habit-day-pulse' : ''}
                ${!isToday && !checked ? 'opacity-40' : ''}
                ${popping ? 'is-popping' : ''}
                ${proTheme ? '' : isToday && !checked ? 'animate-pulse' : ''}`}
        />
    );
}
