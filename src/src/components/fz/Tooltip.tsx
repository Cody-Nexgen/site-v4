import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { DUR, EASE, reducedMotion } from '../../lib/motion';

type Side = 'top' | 'right' | 'bottom' | 'left';

const INITIAL_DELAY = 450;
const WARM_DELAY = 0;
const WARM_WINDOW = 700;

let lastCloseAt = 0;

export function Tooltip({
    content,
    shortcut,
    side = 'top',
    children,
    disabled,
}: {
    content: ReactNode;
    shortcut?: string;
    side?: Side;
    children: ReactNode;
    disabled?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
    const triggerRef = useRef<HTMLSpanElement>(null);
    const timer = useRef<number | null>(null);

    const show = () => {
        if (disabled) return;
        const warm = Date.now() - lastCloseAt < WARM_WINDOW;
        timer.current = window.setTimeout(() => setOpen(true), warm ? WARM_DELAY : INITIAL_DELAY);
    };
    const hide = () => {
        if (timer.current) window.clearTimeout(timer.current);
        timer.current = null;
        setOpen((o) => {
            if (o) lastCloseAt = Date.now();
            return false;
        });
    };

    useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

    useEffect(() => {
        if (!open || !triggerRef.current) return;
        const r = triggerRef.current.getBoundingClientRect();
        const gap = 6;
        const est = { w: 160, h: 26 };
        let top = r.top - est.h - gap;
        let left = r.left + r.width / 2 - est.w / 2;
        if (side === 'bottom') top = r.bottom + gap;
        if (side === 'right') { top = r.top + r.height / 2 - est.h / 2; left = r.right + gap; }
        if (side === 'left') { top = r.top + r.height / 2 - est.h / 2; left = r.left - est.w - gap; }
        setPos({ top: Math.max(4, top), left: Math.max(4, left) });
    }, [open, side]);

    return (
        <span
            ref={triggerRef}
            className="inline-flex"
            onMouseEnter={show}
            onMouseLeave={hide}
            onFocus={show}
            onBlur={hide}
        >
            {children}
            {open && pos &&
                createPortal(
                    <AnimatePresence>
                        <motion.div
                            role="tooltip"
                            initial={{ opacity: 0, y: side === 'top' ? 2 : 0 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={reducedMotion.safe({ duration: DUR.fast, ease: [...EASE.out] })}
                            className="pointer-events-none fixed z-[100] flex items-center gap-2 whitespace-nowrap rounded-md border border-[var(--fz-border)] bg-[var(--fz-bg-overlay)] px-2 py-1 text-meta text-[var(--fz-text-2)] shadow-[var(--fz-shadow-overlay)]"
                            style={{ top: pos.top, left: pos.left }}
                        >
                            {content}
                            {shortcut && <span className="text-[var(--fz-text-4)]">{shortcut}</span>}
                        </motion.div>
                    </AnimatePresence>,
                    document.body,
                )}
        </span>
    );
}
