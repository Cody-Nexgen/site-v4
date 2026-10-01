import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    icon?: React.ReactNode;
}

export const AnimatedInput = forwardRef<HTMLInputElement, InputProps>(
    ({ className, icon, ...props }, ref) => {
        return (
            <div className="relative group">
                <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-pink-500/20 to-blue-500/20 rounded-lg opacity-0 group-focus-within:opacity-100 transition-opacity duration-500 blur-md"
                    layoutId="input-glow"
                />
                <div className="relative flex items-center">
                    {icon && (
                        <div className="absolute left-3 text-neutral-500 group-focus-within:text-white transition-colors duration-300">
                            {icon}
                        </div>
                    )}
                    <input
                        className={cn(
                            "flex h-10 w-full rounded-lg border border-white/8 bg-neutral-900/50 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-neutral-500 focus-visible:outline-none focus-visible:border-white/16 focus-visible:bg-neutral-900/80 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-300 backdrop-blur-sm",
                            icon && "pl-10",
                            className
                        )}
                        ref={ref}
                        {...props}
                    />
                </div>
            </div>
        );
    }
);
AnimatedInput.displayName = "AnimatedInput";
