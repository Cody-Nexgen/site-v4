import { useEffect, useRef, useState } from 'react';
import { motion, useAnimationControls } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { useProDashboardVisuals } from '../../lib/proDashboard';

type Size = 'lg' | 'md' | 'sm';

const SIZE: Record<Size, { box: string; icon: number; dot: string; radius: string }> = {
    lg: { box: 'w-10 h-10 min-w-10 min-h-10', icon: 18, dot: 'w-2 h-2', radius: 'rounded-md' },
    md: { box: 'w-8 h-8 min-w-8 min-h-8', icon: 15, dot: 'w-1.5 h-1.5', radius: 'rounded-md' },
    sm: { box: 'w-6 h-6 min-w-6 min-h-6', icon: 12, dot: 'w-1.5 h-1.5', radius: 'rounded-[4px]' },
};

/** Checkmark that traces itself in with a real stroke-draw animation, instead of just fading/popping. */
function CheckDraw({ size }: { size: number }) {
    return (
        <motion.svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
            <motion.path
                d="M4 12.5L9.5 18L20 6.5"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ pathLength: { duration: 0.38, ease: [0.65, 0, 0.35, 1] }, opacity: { duration: 0.08 } }}
            />
        </motion.svg>
    );
}

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
    const controls = useAnimationControls();
    const wasChecked = useRef(checked);
    const s = SIZE[size];

    // Fire the scale-bounce the moment `checked` actually flips true, regardless of
    // whether that happens synchronously or after the store round-trips.
    useEffect(() => {
        if (checked && !wasChecked.current) {
            void controls.start({
                scale: [1, 1.32, 0.88, 1.08, 1],
                transition: { duration: 0.55, times: [0, 0.35, 0.6, 0.82, 1], ease: 'easeOut' },
            });
        }
        wasChecked.current = checked;
    }, [checked, controls]);

    const handleClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (checked || disabled || spinning) return;
        setSpinning(true);
        try {
            await onCheckIn();
        } finally {
            window.setTimeout(() => setSpinning(false), 260);
        }
    };

    return (
        <motion.button
            type="button"
            disabled={disabled}
            onClick={(e) => void handleClick(e)}
            animate={controls}
            whileHover={!checked && !disabled && !spinning ? { scale: 1.06 } : undefined}
            whileTap={!checked && !disabled ? { scale: 0.88 } : undefined}
            className={`pro-habit-check-btn ${s.box} ${s.radius} shrink-0 inline-flex items-center justify-center relative border transition-colors duration-200
                ${checked
                    ? 'is-checked bg-neutral-200 text-neutral-950 border-neutral-200'
                    : 'bg-white/[0.025] text-neutral-600 hover:bg-white/[0.06] hover:text-neutral-400 border-white/[0.09]'}`}
            aria-pressed={checked}
        >
            {spinning && !checked ? (
                proTheme ? (
                    <span className="pro-habit-spinner-ring" aria-hidden />
                ) : (
                    <Loader2 size={s.icon} className="animate-spin" />
                )
            ) : checked ? (
                <CheckDraw size={s.icon} />
            ) : (
                <span className={`${s.dot} rounded-full bg-neutral-700`} aria-hidden />
            )}
        </motion.button>
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
