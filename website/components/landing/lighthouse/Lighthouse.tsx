import { useEffect, useRef, type RefObject } from 'react';
import { createLighthouse, type LighthouseHandle, type LighthouseView } from './scene';

function supportsWebGL() {
    try {
        const canvas = document.createElement('canvas');
        return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
    } catch {
        return false;
    }
}

type LighthouseProps = {
    className?: string;
    view?: LighthouseView;
    /** How far the camera has risen, 0–1, read on every scroll. Omit for a scene that ignores scrolling. */
    getScroll?: () => number;
    /** The text block to keep on calm water; the camera also pivots on it. */
    clearingRef?: RefObject<HTMLElement | null>;
};

/**
 * The live lighthouse scene. Runs only while on screen and the tab is visible; with
 * reduced motion it draws a single still frame.
 */
export default function Lighthouse({ className = '', view, getScroll, clearingRef }: LighthouseProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const getScrollRef = useRef(getScroll);
    getScrollRef.current = getScroll;

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !supportsWebGL()) return;
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        let scene: LighthouseHandle;
        try {
            scene = createLighthouse(canvas, { pixelSize: 2, view });
        } catch {
            return;
        }

        // Shape the calm water to the text block, with a little room around it.
        const fitClearing = () => {
            const el = clearingRef?.current;
            if (!el) return;
            const c = canvas.getBoundingClientRect();
            const r = el.getBoundingClientRect();
            if (!c.width || !c.height || !r.width) return;
            scene.setClearing([
                (r.left + r.width / 2 - c.left) / c.width,
                1 - (r.top + r.height / 2 - c.top) / c.height,
                (r.width / 2 + 40) / c.width,
                (r.height / 2 + 36) / c.height,
            ]);
        };
        const size = () => {
            scene.resize(canvas.clientWidth, canvas.clientHeight);
            fitClearing();
        };
        size();
        const ro = new ResizeObserver(size);
        ro.observe(canvas);
        if (clearingRef?.current) ro.observe(clearingRef.current);

        let onScreen = true;
        const run = () => {
            if (reduce) return;
            if (onScreen && !document.hidden) scene.start();
            else scene.stop();
        };
        const io = new IntersectionObserver(([entry]) => {
            onScreen = entry.isIntersecting;
            run();
        });
        io.observe(canvas);
        document.addEventListener('visibilitychange', run);

        const onPointer = (e: PointerEvent) => {
            scene.setPointer((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
        };
        const onScroll = () => {
            const read = getScrollRef.current;
            if (read) scene.setScroll(Math.min(1, Math.max(0, read())));
        };
        if (reduce) {
            scene.renderStill();
        } else {
            window.addEventListener('pointermove', onPointer, { passive: true });
            window.addEventListener('scroll', onScroll, { passive: true });
            onScroll();
            run();
        }

        return () => {
            ro.disconnect();
            io.disconnect();
            document.removeEventListener('visibilitychange', run);
            window.removeEventListener('pointermove', onPointer);
            window.removeEventListener('scroll', onScroll);
            scene.dispose();
        };
        // The view is fixed per placement and the scroll getter is read through a ref,
        // so the scene is created once.
    }, []);

    return <canvas ref={canvasRef} aria-hidden className={`block h-full w-full ${className}`} style={{ imageRendering: 'pixelated' }} />;
}
