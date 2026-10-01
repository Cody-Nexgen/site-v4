import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { DUR, EASE, reducedMotion } from '../../lib/motion';
import { isTopLayer, popLayer, pushLayer } from './layers';

type Side = 'top' | 'right' | 'bottom' | 'left';
type Align = 'start' | 'center' | 'end';

export function Popover({
    open,
    onClose,
    anchor,
    side = 'bottom',
    align = 'start',
    offset = 6,
    children,
    className,
}: {
    open: boolean;
    onClose: () => void;
    /** Element the popover is anchored to. */
    anchor: RefObject<HTMLElement | null>;
    side?: Side;
    align?: Align;
    offset?: number;
    children: ReactNode;
    className?: string;
}) {
    const panelRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

    useLayoutEffect(() => {
        if (!open || !anchor.current || !panelRef.current) return;
        const a = anchor.current.getBoundingClientRect();
        const p = panelRef.current.getBoundingClientRect();
        let top = 0;
        let left = 0;
        if (side === 'bottom') top = a.bottom + offset;
        if (side === 'top') top = a.top - p.height - offset;
        if (side === 'right') { left = a.right + offset; top = a.top; }
        if (side === 'left') { left = a.left - p.width - offset; top = a.top; }
        if (side === 'bottom' || side === 'top') {
            left = align === 'start' ? a.left : align === 'end' ? a.right - p.width : a.left + a.width / 2 - p.width / 2;
        } else {
            top = align === 'start' ? a.top : align === 'end' ? a.bottom - p.height : a.top + a.height / 2 - p.height / 2;
        }
        left = Math.max(8, Math.min(left, window.innerWidth - p.width - 8));
        top = Math.max(8, Math.min(top, window.innerHeight - p.height - 8));
        setPos({ top, left });
    }, [open, anchor, side, align, offset]);

    const onCloseRef = useRef(onClose);
    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        if (!open) {
            setPos(null);
            return;
        }
        const layer = pushLayer();
        const onDown = (e: MouseEvent) => {
            const t = e.target as Node;
            if (panelRef.current?.contains(t) || anchor.current?.contains(t)) return;
            onCloseRef.current();
        };
        const onKey = (e: globalThis.KeyboardEvent) => {
            if (e.key === 'Escape' && isTopLayer(layer)) {
                e.stopPropagation();
                onCloseRef.current();
            }
        };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey, true);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey, true);
            popLayer(layer);
        };
    }, [open, anchor]);

    return createPortal(
        <AnimatePresence>
            {open && (
                <motion.div
                    ref={panelRef}
                    role="dialog"
                    className={cn(
                        'fixed z-[64] rounded-xl border border-[var(--fz-border)] bg-[var(--fz-bg-overlay)] shadow-[var(--fz-shadow-overlay)]',
                        !pos && 'opacity-0',
                        className,
                    )}
                    style={{ top: pos?.top ?? 0, left: pos?.left ?? 0 }}
                    initial={{ opacity: 0, scale: 0.97, y: 4 }}
                    animate={{ opacity: pos ? 1 : 0, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98, y: 2 }}
                    transition={reducedMotion.safe({ duration: DUR.base, ease: [...EASE.out] })}
                >
                    {children}
                </motion.div>
            )}
        </AnimatePresence>,
        document.body,
    );
}
