import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { DUR, EASE, reducedMotion } from '../../lib/motion';
import { IconX } from './icons';
import { isTopLayer, popLayer, pushLayer } from './layers';

export type DialogSize = 'sm' | 'md' | 'lg';
const WIDTHS: Record<DialogSize, string> = {
    sm: 'max-w-[400px]',
    md: 'max-w-[520px]',
    lg: 'max-w-[680px]',
};

const FOCUSABLE =
    'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export function Dialog({
    open,
    onClose,
    title,
    description,
    size = 'md',
    footer,
    children,
    className,
}: {
    open: boolean;
    onClose: () => void;
    title: ReactNode;
    description?: ReactNode;
    size?: DialogSize;
    /** Right-aligned actions; sticky at the bottom. */
    footer?: ReactNode;
    children: ReactNode;
    className?: string;
}) {
    const panelRef = useRef<HTMLDivElement>(null);
    const restoreRef = useRef<HTMLElement | null>(null);
    // Latest onClose without re-running the focus effect: parents often pass a
    // fresh callback every render (the calendar re-renders each second), which
    // used to re-grab focus and close any open <select> or date picker.
    const onCloseRef = useRef(onClose);
    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        if (!open) return;
        restoreRef.current = document.activeElement as HTMLElement | null;
        const panel = panelRef.current;
        const focusables = panel?.querySelectorAll<HTMLElement>(FOCUSABLE);
        const autofocus = panel?.querySelector<HTMLElement>('[autofocus], [data-autofocus]');
        (autofocus ?? focusables?.[0] ?? panel)?.focus();
        const layer = pushLayer();

        const onKey = (e: globalThis.KeyboardEvent) => {
            if (!isTopLayer(layer)) return;
            if (e.key === 'Escape') {
                e.stopPropagation();
                onCloseRef.current();
                return;
            }
            if (e.key !== 'Tab' || !panel) return;
            const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
                (el) => el.offsetParent !== null,
            );
            if (!items.length) return;
            const first = items[0];
            const last = items[items.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
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
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <motion.div
                        aria-hidden
                        className="absolute inset-0 bg-[var(--fz-scrim)] backdrop-blur-[2px]"
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
                            'relative flex max-h-[85vh] w-full flex-col overflow-hidden rounded-xl',
                            'border border-[var(--fz-border)] bg-[var(--fz-bg-overlay)] shadow-[var(--fz-shadow-overlay)]',
                            'outline-none',
                            WIDTHS[size],
                            className,
                        )}
                        initial={{ opacity: 0, scale: 0.98, y: 8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.99, y: 4 }}
                        transition={reducedMotion.safe({ duration: DUR.slow, ease: [...EASE.out] })}
                    >
                        <div className="flex items-start justify-between gap-4 px-5 pt-5">
                            <div className="min-w-0">
                                <h2 className="text-title-2">{title}</h2>
                                {description && (
                                    <p className="text-body-sm mt-1 text-[var(--fz-text-3)]">{description}</p>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                aria-label="Close"
                                className="flex size-7 shrink-0 items-center justify-center rounded-md text-[var(--fz-text-3)] transition-colors hover:bg-[var(--fz-bg-hover)] hover:text-[var(--fz-text-1)] focus-visible:outline-2 focus-visible:outline-[var(--fz-focus-ring)]"
                            >
                                <IconX size={14} />
                            </button>
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
                        {footer && (
                            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[var(--fz-border)] px-5 py-3">
                                {footer}
                            </div>
                        )}
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body,
    );
}
