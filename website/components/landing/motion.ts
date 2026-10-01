import type { Variants } from 'framer-motion';

/** The dashboard's `--fz-ease-out`, used for every landing animation. */
export const EASE = [0.16, 1, 0.3, 1] as const;

export const DUR = { fast: 0.2, base: 0.4, slow: 0.7 } as const;

/** Rise into focus: used for section content as it scrolls into view. */
export const focusIn: Variants = {
    hidden: { opacity: 0, y: 18, filter: 'blur(8px)' },
    show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: DUR.slow, ease: EASE } },
};

export const stagger = (gap = 0.08, delay = 0): Variants => ({
    hidden: {},
    show: { transition: { staggerChildren: gap, delayChildren: delay } },
});
