import { useEffect, useId, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

/** Official Beam Z mark path from the FocuzNow SVG. */
const Z_FULL =
    'M20 17.8 H47.2 V22.2 L22.8 41.8 H47.2 L44 46.2 H16.8 V41.8 L29.2 22.2 H16.8 Z';

type BeamZMarkProps = {
    size?: number;
    animated?: boolean;
    className?: string;
    title?: string;
    contrast?: 'auto' | 'on-light' | 'on-dark';
};

function usePrefersReducedMotion() {
    const framer = useReducedMotion();
    const [fallback, setFallback] = useState(false);
    useEffect(() => {
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        const sync = () => setFallback(mq.matches);
        sync();
        mq.addEventListener('change', sync);
        return () => mq.removeEventListener('change', sync);
    }, []);
    return Boolean(framer || fallback);
}

function useLightDashboard() {
    const [light, setLight] = useState(false);
    useEffect(() => {
        const root = document.documentElement;
        const sync = () => setLight(root.getAttribute('data-dashboard-theme') === 'light');
        sync();
        const observer = new MutationObserver(sync);
        observer.observe(root, { attributes: true, attributeFilter: ['data-dashboard-theme'] });
        return () => observer.disconnect();
    }, []);
    return light;
}

export function BeamZMark({
    size = 32,
    animated = false,
    className = '',
    title = 'FocuzNow',
    contrast = 'auto',
}: BeamZMarkProps) {
    const reactId = useId().replace(/:/g, '');
    const shineId = `beam-z-shine-${reactId}`;
    const reduceMotion = usePrefersReducedMotion();
    const lightDashboard = useLightDashboard();
    const inverted = contrast === 'on-dark' || (contrast === 'auto' && lightDashboard);
    const tile = inverted ? '#F4F2EE' : '#0A0B0D';
    const beam = inverted ? '#0A0B0D' : '#F4F2EE';
    const live = animated && !reduceMotion;

    return (
        <motion.span
            className={`beam-z-mark inline-flex shrink-0 ${className}`}
            style={{ width: size, height: size }}
            animate={live ? { opacity: [1, 0.72, 1] } : { opacity: 1 }}
            transition={live ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' } : undefined}
            aria-hidden={title ? undefined : true}
            role={title ? 'img' : undefined}
            aria-label={title}
        >
            <svg viewBox="0 0 64 64" width={size} height={size} fill="none">
                <defs>
                    <linearGradient id={shineId} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor={beam} stopOpacity="0" />
                        <stop offset="50%" stopColor={beam} stopOpacity="0.35" />
                        <stop offset="100%" stopColor={beam} stopOpacity="0" />
                    </linearGradient>
                </defs>
                <rect width="64" height="64" rx="16" fill={tile} />
                <path
                    d={Z_FULL}
                    fill={beam}
                    stroke={beam}
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                />
                {live ? (
                    <motion.rect
                        x="-16"
                        y="-6"
                        width="14"
                        height="76"
                        fill={`url(#${shineId})`}
                        animate={{ x: [-20, 70] }}
                        transition={{ duration: 2.1, repeat: Infinity, ease: 'easeInOut', repeatDelay: 0.7 }}
                        style={{ mixBlendMode: 'soft-light' }}
                    />
                ) : null}
            </svg>
        </motion.span>
    );
}

export function useSmoothReveal(target: string, active?: boolean) {
    const [shown, setShown] = useState('');
    const shownRef = useRef('');

    useEffect(() => {
        if (!active) {
            shownRef.current = target;
            setShown(target);
            return;
        }

        let frame = 0;
        const tick = () => {
            const current = target.startsWith(shownRef.current) ? shownRef.current : '';
            if (current === target) {
                if (shownRef.current !== target) {
                    shownRef.current = target;
                    setShown(target);
                }
                return;
            }
            const remaining = target.length - current.length;
            const step = remaining > 90 ? 10 : remaining > 28 ? 4 : 2;
            const next = target.slice(0, current.length + step);
            shownRef.current = next;
            setShown(next);
            if (next !== target) frame = window.requestAnimationFrame(tick);
        };

        frame = window.requestAnimationFrame(tick);
        return () => window.cancelAnimationFrame(frame);
    }, [target, active]);

    return active ? shown : target;
}
