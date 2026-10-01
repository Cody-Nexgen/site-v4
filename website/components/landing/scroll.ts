import Lenis from 'lenis';

let lenis: Lenis | null = null;

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Smooth wheel scrolling for the landing page. Skipped when the user asks for reduced motion. */
export function startSmoothScroll(): () => void {
    if (reducedMotion() || lenis) return () => {};
    const instance = new Lenis({ autoRaf: true, lerp: 0.11, wheelMultiplier: 1 });
    lenis = instance;
    return () => {
        instance.destroy();
        if (lenis === instance) lenis = null;
    };
}

export function scrollToY(top: number) {
    const target = Math.max(0, top);
    if (lenis) {
        lenis.scrollTo(target, { duration: 1.2 });
        return;
    }
    window.scrollTo({ top: target, behavior: reducedMotion() ? 'auto' : 'smooth' });
}

/** Scroll so the element sits just under the fixed nav. */
export function scrollToId(id: string, offset = 72) {
    const el = document.getElementById(id);
    if (!el) return;
    scrollToY(el.getBoundingClientRect().top + window.scrollY - offset);
}

/** Stage chapters listen for this so the nav, palette and chapter list can jump to a scene. */
export const STAGE_JUMP_EVENT = 'fzl:stage-jump';

export function jumpToScene(index: number) {
    window.dispatchEvent(new CustomEvent<number>(STAGE_JUMP_EVENT, { detail: index }));
}
