import { motion, HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { type ReactNode } from 'react';

interface NeonButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
    children: ReactNode;
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg' | 'icon';
    loading?: boolean;
    glowColor?: string;
}

/**
 * Flat button. Named NeonButton for history only — the neon is gone.
 * Three real variants plus danger; primary is the single accent, and nothing
 * glows, shimmers or scales on hover.
 */
export function NeonButton({
    className,
    variant = 'primary',
    size = 'md',
    loading = false,
    glowColor: _glowColor,
    children,
    disabled,
    ...props
}: NeonButtonProps) {
    const baseStyles = "relative inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5ea2ff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0b]";

    const variants = {
        primary: "bg-[#5ea2ff] text-[#04121f] hover:bg-[#7db4ff]",
        secondary: "bg-white/6 text-white border border-white/8 hover:bg-white/10 hover:border-white/16",
        ghost: "bg-transparent text-neutral-400 hover:text-white hover:bg-white/6",
        danger: "bg-transparent text-[#f87171] border border-[#f87171]/30 hover:bg-[#f87171]/10 hover:border-[#f87171]/50"
    };

    const sizes = {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10 p-0"
    };

    return (
        <motion.button
            className={cn(baseStyles, variants[variant], sizes[size], className)}
            disabled={disabled || loading}
            {...props}
        >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {children}
        </motion.button>
    );
}
