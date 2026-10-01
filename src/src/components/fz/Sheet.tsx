import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { DUR, EASE, reducedMotion } from '../../lib/motion';
import { IconX } from './icons';
import { isTopLayer, popLayer, pushLayer } from './layers';

/** Detail sheet, 440px. Same scrim/Esc/focus rules as Dialog. */
export function Sheet({
    open,
    onClose,
    title,
    side = 'right',
    footer,
    children,
    className,
}: {
    open: boolean;
    onClose: () => void;
    title?: ReactNode;
    side?: 'left' | 'right';
    /** Pinned action bar under the scrolling body (right-aligned). */
    footer?: ReactNode;
    children: ReactNode;
    className?: string;
}) {
    const panelRef = useRef<HTMLDivElement>(null);
    const restoreRef = useRef<HTMLElement | null>(null);
    // Latest onClose without re-running the focus effect. Parents often pass a
    // fresh callback every render (the calendar re-renders each second); keying
    // the effect on it re-focused the panel every tick and stole focus from
    // whatever field was being edited.
    const onCloseRef = useRef(onClose);
    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        if (!open) return;
        restoreRef.current = document.activeElement as HTMLElement | null;
        panelRef.current?.focus();
        const layer = pushLayer();
        const onKey = (e: globalThis.KeyboardEvent) => {
            if (e.key === 'Escape' && isTopLayer(layer)) {
                e.stopPropagation();
                onCloseRef.current();
            }
        };
        document.addEventListener('keydown', onKey, true);
        return () => {
            document.removeEventListener('keydown', onKey, true);
            popLayer(layer);
            restoreRef.current?.focus?.();
        };
    }, [open]);

    return createPortal(
        <AnimatePresence>
            {open && (
                <>
                    <motion.div
                        aria-hidden
                        className="fixed inset-0 z-[50] bg-[var(--fz-scrim)]"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={reducedMotion.safe({ duration: 0.18 })}
                        onClick={onClose}
                    />
                    <motion.div
                        ref={panelRef}
                        role="dialog"
                        aria-modal="true"
                        tabIndex={-1}
                        className={cn(
                            'fixed inset-y-0 z-[50] flex w-[440px] max-w-[92vw] flex-col',
                            side === 'right'
                                ? 'right-0 border-l'
                                : 'left-0 border-r',
                            'border-[var(--fz-border)] bg-[var(--fz-bg-overlay)] shadow-[var(--fz-shadow-overlay)] outline-none',
                            className,
                        )}
                        initial={{ x: side === 'right' ? 40 : -40, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: side === 'right' ? 24 : -24, opacity: 0 }}
                        transition={reducedMotion.safe({ duration: DUR.slow, ease: [...EASE.out] })}
                    >
                        {title !== undefined && (
                            <div className="flex items-center justify-between gap-3 border-b border-[var(--fz-border)] px-5 py-4">
                                <h2 className="text-title-2 truncate">{title}</h2>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    aria-label="Close"
                                    className="flex size-7 shrink-0 items-center justify-center rounded-md text-[var(--fz-text-3)] hover:bg-[var(--fz-bg-hover)] hover:text-[var(--fz-text-1)]"
                                >
                                    <IconX size={14} />
                                </button>
                            </div>
                        )}
                        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
                        {footer && (
                            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[var(--fz-border)] px-5 py-3">
                                {footer}
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>,
        document.body,
    );
}
