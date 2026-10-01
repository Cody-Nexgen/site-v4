/**
 * Workspace sidebar controller (§3.2) — resize / rail / hidden / peek.
 *
 * Modes: 'expanded' (200–320px, default 244) · 'rail' (52px) · 'hidden' (0).
 * Persisted in localStorage 'focuznow-sidebar-v2' as {mode,width}; the legacy
 * 'focuznow-sidebar-collapsed-v1' flag migrates to 'rail'.
 *
 * The grid column is `var(--sb-w)` on the shell element; drags write it every
 * rAF with transitions off, mode snaps animate via CSS (320ms ease-standard).
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';

export type SidebarMode = 'expanded' | 'rail' | 'hidden';

export const SIDEBAR_STATE_KEY = 'focuznow-sidebar-v2';
const LEGACY_COLLAPSED_KEY = 'focuznow-sidebar-collapsed-v1';

export const SIDEBAR_MIN = 200;
export const SIDEBAR_MAX = 320;
export const SIDEBAR_DEFAULT = 244;
export const SIDEBAR_RAIL = 52;
/**
 * Folding to a rail has a detent: the sidebar stops at MIN and holds (with a
 * few px of give) until the pointer is FOLD_PX past it, then animates to the
 * rail. Opening a rail works the same way in reverse.
 */
const FOLD_PX = 56;
const FOLD_GIVE = 0.1;
/** Pull a rail this far outward before it opens. */
const UNFOLD_PX = 56;
/** How long a mid-drag fold/unfold animates before the column tracks the pointer raw again. */
const SNAP_MS = 320;
/** Dragging the rail left past this hides it. */
const RAIL_HIDE_AT = 24;
/** Rubber band above MAX: +0.25×overshoot, capped +20. */
const RUBBER_CAP = 20;

const PEEK_DELAY_MS = 120;
const PEEK_GRACE_MS = 280;

type Stored = { mode?: SidebarMode; width?: number };

function readStored(): Stored | null {
    try {
        const raw = window.localStorage.getItem(SIDEBAR_STATE_KEY);
        if (!raw) return null;
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;
        const s = parsed as Stored;
        const mode = s.mode === 'expanded' || s.mode === 'rail' || s.mode === 'hidden' ? s.mode : undefined;
        const width = typeof s.width === 'number' && s.width >= SIDEBAR_MIN && s.width <= SIDEBAR_MAX
            ? s.width
            : undefined;
        return mode ? { mode, width } : null;
    } catch {
        return null;
    }
}

function readLegacyCollapsed(): boolean {
    try {
        return window.localStorage.getItem(LEGACY_COLLAPSED_KEY) === '1';
    } catch {
        return false;
    }
}

function viewportDefault(): SidebarMode {
    if (typeof window === 'undefined') return 'expanded';
    if (window.innerWidth < 640) return 'hidden';
    if (window.innerWidth < 900) return 'rail';
    return 'expanded';
}

function initialState(): { mode: SidebarMode; width: number } {
    const stored = readStored();
    if (stored?.mode) return { mode: stored.mode, width: stored.width ?? SIDEBAR_DEFAULT };
    if (readLegacyCollapsed()) return { mode: 'rail', width: SIDEBAR_DEFAULT };
    return { mode: viewportDefault(), width: SIDEBAR_DEFAULT };
}

function persist(mode: SidebarMode, width: number) {
    try {
        window.localStorage.setItem(SIDEBAR_STATE_KEY, JSON.stringify({ mode, width }));
    } catch {
        /* ignore */
    }
}

export const SIDEBAR_DEFAULT_EVENT = 'focuznow-sidebar-default-change';

/** Settings "sidebar default" — persists the mode and applies it live. */
export function setSidebarDefaultMode(mode: SidebarMode) {
    try {
        const stored = readStored();
        window.localStorage.setItem(
            SIDEBAR_STATE_KEY,
            JSON.stringify({ mode, width: stored?.width ?? SIDEBAR_DEFAULT }),
        );
    } catch {
        /* ignore */
    }
    window.dispatchEvent(new CustomEvent(SIDEBAR_DEFAULT_EVENT, { detail: mode }));
}

export function readSidebarDefaultMode(): SidebarMode {
    return readStored()?.mode ?? 'expanded';
}

/* ---- Sidebar style: current (v2) or the legacy floating sidebar ---- */

export type SidebarStyle = 'modern' | 'legacy';
export const SIDEBAR_STYLE_KEY = 'focuznow-sidebar-style';
export const SIDEBAR_STYLE_EVENT = 'focuznow-sidebar-style-change';

export function readSidebarStyle(): SidebarStyle {
    try {
        return window.localStorage.getItem(SIDEBAR_STYLE_KEY) === 'legacy' ? 'legacy' : 'modern';
    } catch {
        return 'modern';
    }
}

/** Settings → Page versions "sidebar" — persists and switches the dashboard live. */
export function setSidebarStyle(style: SidebarStyle) {
    try {
        window.localStorage.setItem(SIDEBAR_STYLE_KEY, style);
    } catch {
        /* ignore */
    }
    window.dispatchEvent(new CustomEvent(SIDEBAR_STYLE_EVENT, { detail: style }));
}

export function useSidebarStyle(): SidebarStyle {
    const [style, setStyle] = useState<SidebarStyle>(readSidebarStyle);
    useEffect(() => {
        const onChange = (e: Event) => setStyle((e as CustomEvent<SidebarStyle>).detail);
        window.addEventListener(SIDEBAR_STYLE_EVENT, onChange);
        return () => window.removeEventListener(SIDEBAR_STYLE_EVENT, onChange);
    }, []);
    return style;
}

/** Legacy sidebar's own collapsed flag (the key it used before v2). */
export function readLegacySidebarCollapsed(): boolean {
    return readLegacyCollapsed();
}

export function writeLegacySidebarCollapsed(collapsed: boolean) {
    try {
        window.localStorage.setItem(LEGACY_COLLAPSED_KEY, collapsed ? '1' : '0');
    } catch {
        /* ignore */
    }
}

export type SidebarController = ReturnType<typeof useSidebarController>;

export function useSidebarController(enabled = true, initialMode?: SidebarMode) {
    const [{ mode, width }, setState] = useState(() =>
        initialMode ? { mode: initialMode, width: initialState().width } : initialState());
    const [dragging, setDragging] = useState(false);
    /** A fold/unfold during a drag: keep CSS transitions on so it animates instead of jumping. */
    const [snapping, setSnapping] = useState(false);
    const snapTimer = useRef<number | null>(null);
    const [shrinking, setShrinking] = useState(false);
    const [peekOpen, setPeekOpen] = useState(false);
    const [overlayOpen, setOverlayOpen] = useState(false); // narrow-viewport scrim overlay
    const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640);

    const dragRef = useRef<{ startX: number; startMode: SidebarMode; startWidth: number; originWidth: number } | null>(null);
    const modeRef = useRef(mode);
    const widthRef = useRef(width);
    modeRef.current = mode;
    widthRef.current = width;

    const peekTimer = useRef<number | null>(null);
    const peekCloseTimer = useRef<number | null>(null);

    const persistNow = useCallback(() => persist(modeRef.current, widthRef.current), []);

    /* ---- persistence + viewport tracking ---- */
    useEffect(() => {
        persist(mode, width);
    }, [mode, width]);

    useEffect(() => {
        const mq = window.matchMedia('(max-width: 639px)');
        const update = () => setNarrow(mq.matches);
        mq.addEventListener('change', update);
        return () => mq.removeEventListener('change', update);
    }, []);

    /* ---- animated mode change (labels fade before shrink, after grow) ---- */
    const setMode = useCallback((next: SidebarMode) => {
        const prev = modeRef.current;
        if (next === prev) return;
        if (next === 'hidden') {
            // shrink first: fade labels fast, then collapse
            setShrinking(true);
            window.setTimeout(() => {
                setState((s) => ({ ...s, mode: 'hidden' }));
                window.setTimeout(() => setShrinking(false), 340);
            }, 120);
            return;
        }
        setState((s) => ({ ...s, mode: next }));
        if (prev === 'hidden' || prev === 'rail') {
            // labels fade in after the column has grown
            setShrinking(true);
            window.setTimeout(() => setShrinking(false), 340);
        }
        persist(next, widthRef.current);
    }, []);

    useEffect(() => {
        const onDefault = (e: Event) => {
            const next = (e as CustomEvent<SidebarMode>).detail;
            if (next === 'expanded' || next === 'rail' || next === 'hidden') setMode(next);
        };
        window.addEventListener(SIDEBAR_DEFAULT_EVENT, onDefault);
        return () => window.removeEventListener(SIDEBAR_DEFAULT_EVENT, onDefault);
    }, [setMode]);

    const setExpandedWidth = useCallback((w: number) => {
        setState((s) => ({ ...s, mode: 'expanded', width: w }));
    }, []);

    /* ---- drag ---- */
    const onPointerDown = useCallback((e: PointerEvent<HTMLDivElement>) => {
        if (!enabled || narrow) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        const w = modeRef.current === 'expanded' ? widthRef.current : SIDEBAR_RAIL;
        dragRef.current = {
            startX: e.clientX,
            startMode: modeRef.current,
            startWidth: w,
            originWidth: modeRef.current === 'expanded' ? widthRef.current : Math.max(widthRef.current, SIDEBAR_DEFAULT),
        };
        setDragging(true);
    }, [enabled, narrow]);

    /** Animate the next column change even though a drag is in progress. */
    const animateSnap = useCallback(() => {
        setSnapping(true);
        if (snapTimer.current) window.clearTimeout(snapTimer.current);
        snapTimer.current = window.setTimeout(() => setSnapping(false), SNAP_MS);
    }, []);

    useEffect(() => () => {
        if (snapTimer.current) window.clearTimeout(snapTimer.current);
    }, []);

    const onPointerMove = useCallback((e: PointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current;
        if (!drag) return;
        const x = e.clientX;
        window.requestAnimationFrame(() => {
            if (!dragRef.current) return;
            const m = modeRef.current;
            const dx = x - drag.startX;
            if (m === 'expanded') {
                const target = drag.startWidth + dx;
                if (target <= SIDEBAR_MIN - FOLD_PX) {
                    // Past the detent: fold to a rail. Re-base so pulling back out
                    // needs a deliberate UNFOLD_PX, not the first pixel of movement.
                    animateSnap();
                    setState({ mode: 'rail', width: drag.originWidth });
                    drag.startX = x;
                    drag.startWidth = SIDEBAR_RAIL;
                } else if (target < SIDEBAR_MIN) {
                    // Detent: hold at the minimum with a little give.
                    setState((s) => ({ ...s, width: SIDEBAR_MIN - (SIDEBAR_MIN - target) * FOLD_GIVE }));
                } else if (target > SIDEBAR_MAX) {
                    const over = Math.min((target - SIDEBAR_MAX) * 0.25, RUBBER_CAP);
                    setState((s) => ({ ...s, width: SIDEBAR_MAX + over }));
                } else {
                    setState((s) => ({ ...s, width: target }));
                }
            } else if (m === 'rail') {
                if (dx >= UNFOLD_PX) {
                    // Open to the minimum, then follow the pointer from here.
                    animateSnap();
                    setShrinking(true);
                    window.setTimeout(() => setShrinking(false), 340);
                    setState({ mode: 'expanded', width: SIDEBAR_MIN });
                    drag.startX = x;
                    drag.startWidth = SIDEBAR_MIN;
                } else if (x < RAIL_HIDE_AT) {
                    setState({ mode: 'hidden', width: drag.originWidth });
                }
            }
        });
    }, [animateSnap]);

    const onPointerUp = useCallback((e: PointerEvent<HTMLDivElement>) => {
        if (!dragRef.current) return;
        dragRef.current = null;
        setDragging(false);
        try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* noop */ }
        const m = modeRef.current;
        const w = widthRef.current;
        if (m === 'expanded') {
            // Let go inside the detent / rubber band: settle back to the nearest bound.
            if (w > SIDEBAR_MAX) setState((s) => ({ ...s, width: SIDEBAR_MAX }));
            else if (w < SIDEBAR_MIN) setState((s) => ({ ...s, width: SIDEBAR_MIN }));
        }
        persistNow();
    }, [persistNow]);

    const onHandleDoubleClick = useCallback(() => {
        setState({ mode: 'expanded', width: SIDEBAR_DEFAULT });
    }, []);

    const onHandleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault();
            const dir = e.key === 'ArrowRight' ? 1 : -1;
            if (modeRef.current === 'expanded') {
                setState((s) => ({
                    ...s,
                    width: Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, s.width + dir * 8)),
                }));
            } else if (modeRef.current === 'rail' && dir === 1) {
                setState({ mode: 'expanded', width: SIDEBAR_MIN });
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            setMode(modeRef.current === 'rail' ? 'expanded' : 'rail');
        }
    }, [setMode]);

    /* ---- keyboard shortcuts ---- */
    useEffect(() => {
        if (!enabled) return;
        const onKey = (e: KeyboardEvent | globalThis.KeyboardEvent) => {
            const ev = e as globalThis.KeyboardEvent;
            if (!(ev.metaKey || ev.ctrlKey) || ev.key !== '\\') return;
            ev.preventDefault();
            if (ev.shiftKey) {
                setMode(modeRef.current === 'hidden' ? 'expanded' : 'hidden');
            } else {
                setMode(modeRef.current === 'rail' ? 'expanded' : 'rail');
            }
        };
        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
    }, [enabled, setMode]);

    /* ---- peek ---- */
    const clearPeekTimers = useCallback(() => {
        if (peekTimer.current) window.clearTimeout(peekTimer.current);
        if (peekCloseTimer.current) window.clearTimeout(peekCloseTimer.current);
        peekTimer.current = null;
        peekCloseTimer.current = null;
    }, []);

    const peekEnabled = enabled && mode === 'hidden' && !narrow;

    const onHotzoneEnter = useCallback(() => {
        if (!peekEnabled) return;
        clearPeekTimers();
        peekTimer.current = window.setTimeout(() => setPeekOpen(true), PEEK_DELAY_MS);
    }, [peekEnabled, clearPeekTimers]);

    const schedulePeekClose = useCallback(() => {
        clearPeekTimers();
        peekCloseTimer.current = window.setTimeout(() => setPeekOpen(false), PEEK_GRACE_MS);
    }, [clearPeekTimers]);

    const onPeekEnter = useCallback(() => clearPeekTimers(), [clearPeekTimers]);
    const onPeekLeave = useCallback(() => schedulePeekClose(), [schedulePeekClose]);

    const pinPeek = useCallback(() => {
        clearPeekTimers();
        setPeekOpen(false);
        setMode('expanded');
    }, [clearPeekTimers, setMode]);

    const forcePeek = useCallback(() => {
        clearPeekTimers();
        setPeekOpen(true);
    }, [clearPeekTimers]);

    /** Called when a nav item is activated while peeking/overlay — stays hidden. */
    const onPeekNavigate = useCallback(() => {
        clearPeekTimers();
        setPeekOpen(false);
        setOverlayOpen(false);
    }, [clearPeekTimers]);

    /* ---- narrow overlay ---- */
    const openOverlay = useCallback(() => setOverlayOpen(true), []);
    const closeOverlay = useCallback(() => setOverlayOpen(false), []);

    useEffect(() => {
        if (mode !== 'hidden') {
            setPeekOpen(false);
            setOverlayOpen(false);
        }
    }, [mode]);

    /* ---- shell bindings ---- */
    const columnPx = mode === 'hidden' ? 0 : mode === 'rail' ? SIDEBAR_RAIL : width;
    const shellStyle = { '--sb-w': `${columnPx}px` } as CSSProperties;
    const shellClass = [
        'focuz-shell-v2',
        dragging && !snapping ? 'focuz-shell--dragging' : '',
        mode === 'hidden' ? 'focuz-shell--hidden' : '',
        shrinking ? 'focuz-shell--shrinking' : '',
    ].filter(Boolean).join(' ');

    return {
        mode,
        width,
        dragging,
        peekOpen,
        overlayOpen,
        narrow,
        peekEnabled,
        setMode,
        setExpandedWidth,
        shellStyle,
        shellClass,
        handleProps: {
            onPointerDown,
            onPointerMove,
            onPointerUp,
            onDoubleClick: onHandleDoubleClick,
            onKeyDown: onHandleKeyDown,
            role: 'separator' as const,
            'aria-orientation': 'vertical' as const,
            'aria-valuenow': Math.round(columnPx),
            'aria-valuemin': 0,
            'aria-valuemax': SIDEBAR_MAX,
            'aria-label': 'Resize sidebar',
            tabIndex: 0,
        },
        hotzoneProps: {
            onMouseEnter: onHotzoneEnter,
            onMouseLeave: schedulePeekClose,
        },
        peekProps: {
            onMouseEnter: onPeekEnter,
            onMouseLeave: onPeekLeave,
        },
        pinPeek,
        forcePeek,
        onPeekNavigate,
        openOverlay,
        closeOverlay,
    };
}
