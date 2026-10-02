import { useEffect, useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { isTopLayer, popLayer, pushLayer } from '../../components/fz/layers';

/**
 * A dropdown drawn on top of everything, lined up under its field. Menus inside the item editor
 * used to be cut off by the editor's scrolling body; this one lives at the end of <body>, follows
 * the field as things scroll, opens upward when there's no room below, and closes on Escape (only
 * itself, not the dialog under it) or a click elsewhere.
 */
export function FloatingPanel({
    anchor,
    open,
    onClose,
    children,
    className,
    minWidth = 240,
    maxHeight = 300,
    role = 'listbox',
}: {
    anchor: RefObject<HTMLElement | null>;
    open: boolean;
    onClose: () => void;
    children: ReactNode;
    className?: string;
    minWidth?: number;
    maxHeight?: number;
    role?: string;
}) {
    const panelRef = useRef<HTMLDivElement>(null);
    const onCloseRef = useRef(onClose);
    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    // Placed by writing styles directly: no re-render on every scroll.
    useLayoutEffect(() => {
        if (!open) return;
        const place = () => {
            const panel = panelRef.current;
            const box = anchor.current?.getBoundingClientRect();
            if (!panel || !box) return;
            const below = window.innerHeight - box.bottom - 12;
            const above = box.top - 12;
            const up = below < Math.min(maxHeight, 200) && above > below;
            const width = Math.min(Math.max(box.width, minWidth), window.innerWidth - 16);
            panel.style.left = `${Math.max(8, Math.min(box.left, window.innerWidth - width - 8))}px`;
            panel.style.width = `${width}px`;
            panel.style.maxHeight = `${Math.max(120, Math.min(maxHeight, up ? above : below))}px`;
            panel.style.top = up ? '' : `${box.bottom + 6}px`;
            panel.style.bottom = up ? `${window.innerHeight - box.top + 6}px` : '';
            panel.dataset.side = up ? 'top' : 'bottom';
            panel.style.visibility = 'visible';
        };
        place();
        window.addEventListener('resize', place);
        window.addEventListener('scroll', place, true);
        return () => {
            window.removeEventListener('resize', place);
            window.removeEventListener('scroll', place, true);
        };
    });

    useEffect(() => {
        if (!open) return;
        const layer = pushLayer();
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && isTopLayer(layer)) {
                event.stopPropagation();
                onCloseRef.current();
            }
        };
        const onDown = (event: MouseEvent) => {
            const target = event.target as Node;
            if (panelRef.current?.contains(target) || anchor.current?.contains(target)) return;
            onCloseRef.current();
        };
        document.addEventListener('keydown', onKey, true);
        document.addEventListener('mousedown', onDown, true);
        return () => {
            document.removeEventListener('keydown', onKey, true);
            document.removeEventListener('mousedown', onDown, true);
            popLayer(layer);
        };
    }, [open, anchor]);

    if (!open) return null;
    return createPortal(
        <div ref={panelRef} role={role} className={`vault-floating-panel${className ? ` ${className}` : ''}`} style={{ position: 'fixed', visibility: 'hidden' }}>
            {children}
        </div>,
        document.body,
    );
}
