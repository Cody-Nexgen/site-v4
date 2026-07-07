import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export const FOCUZ_ACTION_WORDS = ['build', 'work', 'win', 'focus'] as const;

type RotatingWordProps = {
    words?: readonly string[];
    intervalMs?: number;
    className?: string;
};

/** Cycles through action words with a smooth fade — used in brand, popup, and hero areas. */
export function RotatingWord({
    words = FOCUZ_ACTION_WORDS,
    intervalMs = 2800,
    className = 'focuz-rotating-word',
}: RotatingWordProps) {
    const [index, setIndex] = useState(0);
    const word = words[index % words.length];

    useEffect(() => {
        const id = window.setInterval(() => {
            setIndex((i) => (i + 1) % words.length);
        }, intervalMs);
        return () => window.clearInterval(id);
    }, [words, intervalMs]);

    return (
        <span className={`inline-block align-baseline text-left min-w-[4.5ch] ${className}`}>
            <AnimatePresence mode="wait" initial={false}>
                <motion.span
                    key={word}
                    initial={{ opacity: 0, y: 6, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, y: -6, filter: 'blur(4px)' }}
                    transition={{ duration: 0.35, ease: 'easeOut' }}
                    className="inline-block whitespace-nowrap"
                >
                    {word}
                </motion.span>
            </AnimatePresence>
        </span>
    );
}
