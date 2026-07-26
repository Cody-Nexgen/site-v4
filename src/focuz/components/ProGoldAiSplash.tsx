import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

/** Smooth “ease out” feel for brand intro */
const EASE = [0.16, 1, 0.3, 1] as const;

export function ProGoldAiSplash({ onComplete }: { onComplete: () => void }) {
    const [phase, setPhase] = useState<'together' | 'split' | 'curtain'>('together');

    useEffect(() => {
        const split = window.setTimeout(() => setPhase('split'), 500);
        const curtain = window.setTimeout(() => setPhase('curtain'), 1650);
        const done = window.setTimeout(() => onComplete(), 3100);
        return () => {
            window.clearTimeout(split);
            window.clearTimeout(curtain);
            window.clearTimeout(done);
        };
    }, [onComplete]);

    const apart = phase === 'split' || phase === 'curtain';

    return (
        <div className="fixed inset-0 z-[300] flex flex-col bg-[#0a0a0a] overflow-hidden pointer-events-none">
            <div className="relative flex-1 flex items-center justify-center">
                <div className="flex items-baseline select-none">
                    <motion.span
                        animate={{ x: apart ? -88 : 0 }}
                        transition={{ duration: 1.15, ease: EASE }}
                        className="text-[2.75rem] sm:text-6xl font-semibold tracking-tight text-white lowercase"
                    >
                        focuz
                    </motion.span>
                    <motion.span
                        animate={{ x: apart ? 88 : 0 }}
                        transition={{ duration: 1.15, ease: EASE }}
                        className="text-[2.75rem] sm:text-6xl font-semibold tracking-tight text-violet-400 lowercase"
                    >
                        now
                    </motion.span>
                </div>
            </div>
            <motion.div
                className="absolute left-0 right-0 bottom-0 bg-[#0d0d0d]"
                initial={false}
                animate={{ height: phase === 'curtain' ? '100%' : '0%' }}
                transition={{ duration: 1.4, ease: EASE }}
                style={{ transformOrigin: 'bottom' }}
            />
        </div>
    );
}

export const AI_COACH_SPLASH_SESSION_KEY = 'focuz_ai_coach_pro_gold_splash';
