import { motion, HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

interface GlassCardProps extends HTMLMotionProps<'div'> {
    variant?: 'default' | 'hover' | 'interactive';
}

/**
 * Flat surface card. Named GlassCard for history only — the glass is gone.
 * One elevation, one hairline border, no backdrop blur and no glow, so the
 * marketing/auth screens read the same as the app they lead into.
 */
export function GlassCard({ className, variant = 'default', children, ...props }: GlassCardProps) {
    const variants = {
        default: "bg-[#141416] border border-white/8",
        hover: "bg-[#141416] border border-white/8 hover:bg-[#1c1c1f] hover:border-white/16 transition-colors duration-200",
        interactive: "bg-[#141416] border border-white/8 cursor-pointer hover:bg-[#1c1c1f] hover:border-white/16 transition-colors duration-200"
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={cn("rounded-lg overflow-hidden", variants[variant], className)}
            {...props}
        >
            {children}
        </motion.div>
    );
}
