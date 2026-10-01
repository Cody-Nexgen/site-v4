/**
 * Motion tokens (§1.4) shared by CSS vars (--fz-dur-*, --fz-ease-*) and
 * framer-motion. Durations are in seconds here because framer wants seconds.
 */
import type { Transition } from 'framer-motion';

export const DUR = {
    instant: 0.09,
    fast: 0.15,
    hoverOut: 0.12,
    base: 0.22,
    slow: 0.32,
    page: 0.26,
} as const;

export const EASE = {
    /** ease-out-expo — enters */
    out: [0.16, 1, 0.3, 1] as const,
    /** standard — moves / resizes */
    standard: [0.2, 0, 0, 1] as const,
    /** ease-in — exits (always faster than enters) */
    in: [0.4, 0, 1, 1] as const,
};

/** Drag-release spring (sidebar snap, reorder settle). */
export const SPRING: Transition = { type: 'spring', stiffness: 520, damping: 42, mass: 0.9 };

export function enterTransition(duration: number = DUR.base): Transition {
    return { duration, ease: [...EASE.out] };
}

export function exitTransition(enterDuration: number = DUR.base): Transition {
    return { duration: enterDuration * 0.7, ease: [...EASE.in] };
}

export function moveTransition(duration: number = DUR.slow): Transition {
    return { duration, ease: [...EASE.standard] };
}

/** List stagger: 18ms per item, capped at 8 items. */
export function listStagger(index: number): number {
    return Math.min(index, 8) * 0.018;
}

export const reducedMotion = {
    matches: () =>
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    /** Transition that respects prefers-reduced-motion (opacity only, ≤80ms). */
    safe: (t: Transition): Transition =>
        reducedMotion.matches() ? { duration: 0.08 } : t,
};
