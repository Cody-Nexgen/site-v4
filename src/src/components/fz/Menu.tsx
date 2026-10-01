import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type ReactNode,
    type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { isTopLayer, popLayer, pushLayer } from './layers';
import { DUR, EASE, reducedMotion } from '../../lib/motion';
import { IconCheck, IconChevronRight, IconDot } from './icons';

export type MenuItem =
    | { type?: 'item'; id: string; label: ReactNode; icon?: ReactNode; shortcut?: string; checked?: boolean; disabled?: boolean; danger?: boolean; onSelect?: () => void; submenu?: MenuItem[]; /** Stay open after selecting (checkbox-style toggles). */ keepOpen?: boolean }
    | { type: 'separator'; id: string }
    | { type: 'label'; id: string; label: ReactNode }
    | { type: 'custom'; id: string; node: ReactNode };

function itemKey(item: MenuItem, i: number) {
    return item.id ?? `item-${i}`;
}

function MenuList({
    items,
    depth,
    onCloseAll,
}: {
    items: MenuItem[];
    depth: number;
    onCloseAll: () => void;
}) {
    const listRef = useRef<HTMLDivElement>(null);
    const [openSub, setOpenSub] = useState<string | null>(null);
    const subAnchorRefs = useRef(new Map<string, HTMLElement | null>());

    const selectable = items.filter((i) => (i.type ?? 'item') === 'item' && !(i.type === 'item' || i.type === undefined ? i.disabled : false));

    const focusItem = useCallback((id: string) => {
        listRef.current?.querySelector<HTMLElement>(`[data-menu-item="${id}"]`)?.focus();
    }, []);

    const onKeyDown = (e: React.KeyboardEvent) => {
        const ids = selectable.map((i) => i.id);
        const idx = ids.indexOf((document.activeElement as HTMLElement)?.dataset.menuItem ?? '');
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            const dir = e.key === 'ArrowDown' ? 1 : -1;
            const next = ids[(idx + dir + ids.length) % ids.length];
            focusItem(next);
        } else if (e.key === 'ArrowRight') {
            const item = items.find((i) => i.id === (document.activeElement as HTMLElement)?.dataset.menuItem);
            if (item && 'submenu' in item && item.submenu) setOpenSub(item.id);
        } else if (e.key === 'ArrowLeft' && depth > 0) {
            setOpenSub(null);
        } else if (e.key === 'Home' || e.key === 'End') {
            e.preventDefault();
            const id = e.key === 'Home' ? ids[0] : ids[ids.length - 1];
            focusItem(id);
        } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
            // type-ahead
            const ch = e.key.toLowerCase();
            const match = selectable.find((i) =>
                'label' in i && typeof i.label === 'string' && i.label.toLowerCase().startsWith(ch),
            );
            if (match) focusItem(match.id);
        }
    };

    return (
        <div ref={listRef} role="menu" onKeyDown={onKeyDown} className="p-1 outline-none">
            {items.map((item, i) => {
                const key = itemKey(item, i);
                if (item.type === 'separator') {
                    return <div key={key} role="separator" className="my-1 h-px bg-[var(--fz-border)]" />;
                }
                if (item.type === 'label') {
                    return (
                        <p key={key} className="text-label px-2 py-1.5 text-[var(--fz-text-4)]">
                            {item.label}
                        </p>
                    );
                }
                if (item.type === 'custom') {
                    return <div key={key}>{item.node}</div>;
                }
                const hasSub = Boolean(item.submenu?.length);
                return (
                    <div key={key} className="relative">
                        <button
                            type="button"
                            role="menuitem"
                            data-menu-item={item.id}
                            ref={(el) => { subAnchorRefs.current.set(item.id, el); }}
                            tabIndex={-1}
                            disabled={item.disabled}
                            onClick={() => {
                                if (hasSub) {
                                    setOpenSub(openSub === item.id ? null : item.id);
                                    return;
                                }
                                item.onSelect?.();
                                if (!item.keepOpen) onCloseAll();
                            }}
                            onMouseEnter={() => {
                                focusItem(item.id);
                                if (openSub && openSub !== item.id) setOpenSub(hasSub ? item.id : null);
                            }}
                            className={cn(
                                'flex h-[30px] w-full items-center gap-2.5 rounded-md px-2 text-left text-[13px]',
                                'text-[var(--fz-text-2)] transition-colors duration-75',
                                'hover:bg-[var(--fz-bg-hover)] hover:text-[var(--fz-text-1)]',
                                'focus:bg-[var(--fz-bg-hover)] focus:text-[var(--fz-text-1)] focus:outline-none',
                                'disabled:opacity-40',
                                item.danger && 'text-[var(--fz-danger)] hover:text-[var(--fz-danger)]',
                            )}
                        >
                            {item.checked !== undefined ? (
                                <span className="flex size-4 shrink-0 items-center justify-center">
                                    {item.checked ? <IconCheck size={12} /> : <IconDot size={8} className="opacity-0" />}
                                </span>
                            ) : item.icon ? (
                                <span className="flex size-4 shrink-0 items-center justify-center text-[var(--fz-text-4)]">
                                    {item.icon}
                                </span>
                            ) : null}
                            <span className="min-w-0 flex-1 truncate">{item.label}</span>
                            {item.shortcut && (
                                <span className="text-meta shrink-0 text-[var(--fz-text-4)]">{item.shortcut}</span>
                            )}
                            {hasSub && <IconChevronRight size={11} className="shrink-0 text-[var(--fz-text-4)]" />}
                        </button>
                        {hasSub && openSub === item.id && (
                            <SubMenu
                                anchor={{ current: subAnchorRefs.current.get(item.id) ?? null }}
                                items={item.submenu!}
                                depth={depth + 1}
                                onCloseAll={onCloseAll}
                            />
                        )}
                    </div>
                );
            })}
        </div>
    );
}

function SubMenu({
    anchor,
    items,
    depth,
    onCloseAll,
}: {
    anchor: RefObject<HTMLElement | null>;
    items: MenuItem[];
    depth: number;
    onCloseAll: () => void;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

    useEffect(() => {
        if (!anchor.current || !ref.current) return;
        const a = anchor.current.getBoundingClientRect();
        const p = ref.current.getBoundingClientRect();
        let left = a.right - 4;
        if (left + p.width > window.innerWidth - 8) left = a.left - p.width + 4;
        let top = a.top - 6;
        if (top + p.height > window.innerHeight - 8) top = window.innerHeight - p.height - 8;
        setPos({ top: Math.max(8, top), left });
    }, [anchor]);

    return createPortal(
        <motion.div
            ref={ref}
            className={cn(
                'fixed z-[66] min-w-[180px] rounded-lg border border-[var(--fz-border)]',
                'bg-[var(--fz-bg-overlay)] shadow-[var(--fz-shadow-overlay)]',
                !pos && 'opacity-0',
            )}
            style={{ top: pos?.top ?? 0, left: pos?.left ?? 0 }}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={reducedMotion.safe({ duration: DUR.fast, ease: [...EASE.out] })}
        >
            <MenuList items={items} depth={depth} onCloseAll={onCloseAll} />
        </motion.div>,
        document.body,
    );
}

export function Menu({
    open,
    onClose,
    anchor,
    point,
    items,
    side = 'bottom',
    align = 'start',
    minWidth = 200,
    className,
}: {
    open: boolean;
    onClose: () => void;
    anchor?: RefObject<HTMLElement | null>;
    /** Fixed viewport coordinates — for context menus opened at the pointer. */
    point?: { x: number; y: number };
    items: MenuItem[];
    side?: 'top' | 'right' | 'bottom' | 'left';
    align?: 'start' | 'center' | 'end';
    minWidth?: number;
    className?: string;
}) {
    const panelRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

    useEffect(() => {
        if (!open) {
            setPos(null);
            return;
        }
        const place = () => {
            if (!panelRef.current) return;
            const p = panelRef.current.getBoundingClientRect();
            if (point) {
                const left = Math.max(8, Math.min(point.x, window.innerWidth - p.width - 8));
                const top = Math.max(8, Math.min(point.y, window.innerHeight - p.height - 8));
                setPos({ top, left });
                return;
            }
            if (!anchor?.current) return;
            const a = anchor.current.getBoundingClientRect();
            let top = 0;
            let left = a.left;
            if (side === 'bottom') top = a.bottom + 6;
            if (side === 'top') top = a.top - p.height - 6;
            if (side === 'right') { left = a.right + 6; top = a.top; }
            if (align === 'end' && (side === 'bottom' || side === 'top')) left = a.right - p.width;
            if (align === 'center' && (side === 'bottom' || side === 'top')) left = a.left + a.width / 2 - p.width / 2;
            left = Math.max(8, Math.min(left, window.innerWidth - p.width - 8));
            top = Math.max(8, Math.min(top, window.innerHeight - p.height - 8));
            setPos({ top, left });
        };
        place();
        const raf = window.requestAnimationFrame(place);
        const first = panelRef.current?.querySelector<HTMLElement>('[data-menu-item]');
        first?.focus();
        return () => window.cancelAnimationFrame(raf);
    }, [open, anchor, point?.x, point?.y, side, align]);

    const onCloseRef = useRef(onClose);
    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        if (!open) return;
        const layer = pushLayer();
        const onDown = (e: MouseEvent) => {
            const t = e.target as Node;
            if (panelRef.current?.contains(t) || anchor?.current?.contains(t)) return;
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
                    className={cn(
                        'fixed z-[65] rounded-lg border border-[var(--fz-border)] bg-[var(--fz-bg-overlay)] shadow-[var(--fz-shadow-overlay)]',
                        !pos && 'opacity-0',
                        className,
                    )}
                    style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, minWidth }}
                    initial={{ opacity: 0, scale: 0.97, y: 4 }}
                    animate={{ opacity: pos ? 1 : 0, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={reducedMotion.safe({ duration: DUR.base, ease: [...EASE.out] })}
                >
                    <MenuList items={items} depth={0} onCloseAll={onClose} />
                </motion.div>
            )}
        </AnimatePresence>,
        document.body,
    );
}
