import { motion, HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

interface GlassCardProps extends HTMLMotionProps<'div'> {
    variant?: 'default' | 'hover' | 'interactive';
}

export function GlassCard({ className, variant = 'default', children, ...props }: GlassCardProps) {
    const variants = {
        default: "bg-zinc-900/40 backdrop-blur-xl border border-white/10 shadow-xl",
        hover: "bg-zinc-900/40 backdrop-blur-xl border border-white/10 shadow-xl hover:bg-zinc-800/50 hover:border-white/20 transition-colors duration-300",
        interactive: "bg-zinc-900/40 backdrop-blur-xl border border-white/10 shadow-xl cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={cn("rounded-2xl overflow-hidden", variants[variant], className)}
            {...props}
        >
            {children}
        </motion.div>
    );
}
