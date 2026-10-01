import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'framer-motion';

/** Who FocuzNow is built for. Shuffled on every visit, so the page reads a little differently each time. */
const WORDS = [
    'deep work.',
    'finals week.',
    '2 a.m. deadlines.',
    'writers.',
    'the thesis.',
    '40-tab brains.',
    'one more chapter.',
    'Friday launches.',
    'quiet mornings.',
    'night owls.',
    'exam season.',
    'side projects.',
    'getting it done.',
    'the long game.',
];

const EASE = [0.16, 1, 0.3, 1] as const;
const HOLD_MS = 3200;

const word: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.028 } },
    exit: { transition: { staggerChildren: 0.012 } },
};

const letter: Variants = {
    hidden: { opacity: 0, filter: 'blur(14px)', y: '0.14em' },
    show: { opacity: 1, filter: 'blur(0px)', y: '0em', transition: { duration: 0.7, ease: EASE } },
    exit: { opacity: 0, filter: 'blur(12px)', y: '-0.1em', transition: { duration: 0.35, ease: EASE } },
};

function shuffled<T>(items: T[]) {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

/** A word that blurs out as the next one comes into focus. `onChange` fires as each new word arrives. */
export function BlurWords({ onChange, className = '' }: { onChange?: () => void; className?: string }) {
    const order = useMemo(() => shuffled(WORDS), []);
    const [index, setIndex] = useState(0);
    const reduce = useReducedMotion();

    useEffect(() => {
        const id = window.setInterval(() => setIndex((i) => (i + 1) % order.length), HOLD_MS);
        return () => window.clearInterval(id);
    }, [order.length]);

    useEffect(() => {
        onChange?.();
    }, [index, onChange]);

    const current = order[index];
    // Reserve the widest phrase's width so the line never jumps as words change.
    const widest = useMemo(() => order.reduce((a, b) => (b.length > a.length ? b : a)), [order]);

    return (
        <span className={`relative inline-grid whitespace-nowrap ${className}`}>
            <span aria-hidden className="invisible col-start-1 row-start-1">
                {widest}
            </span>
            <span className="sr-only">{current}</span>
            <AnimatePresence mode="popLayout">
                <motion.span
                    key={current}
                    aria-hidden
                    className="col-start-1 row-start-1"
                    variants={reduce ? undefined : word}
                    initial="hidden"
                    animate="show"
                    exit="exit"
                >
                    {Array.from(current).map((ch, i) =>
                        reduce ? (
                            <span key={i}>{ch}</span>
                        ) : (
                            <motion.span key={i} variants={letter} className="inline-block whitespace-pre">
                                {ch}
                            </motion.span>
                        ),
                    )}
                </motion.span>
            </AnimatePresence>
        </span>
    );
}
