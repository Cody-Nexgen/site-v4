// =========================================================
// ForestEngine — owns the Forest canvas: camera, input and a
// render-on-demand loop.
//
// Frames are only drawn when something changes (pan, zoom,
// hover, data) plus a gentle ~30fps ambient sway while the
// canvas is on screen. Reduced motion, hidden tabs and an
// off-screen canvas all stop the loop entirely. The ground comes
// from a map-style chunk cache (forestGround.ts) and is only
// recomposed when the camera moves.
// =========================================================

import type { DisplayTree } from '../../lib/forest';
import {
    DARK_PALETTE,
    LIGHT_PALETTE,
    cellAt,
    cellCenter,
    drawTileMark,
    drawTree,
    treeBounds,
    HALF_H,
    type ScenePalette,
} from './forestArt';
import { GroundLayer } from './forestGround';

export const MIN_ZOOM = 0.35;
export const MAX_ZOOM = 2.5;
const AMBIENT_FRAME_MS = 1000 / 30;
/** Below this zoom the sway is too small to see, so trees are drawn still. */
const SWAY_MIN_ZOOM = 0.6;
/** Quiet period after the last zoom change before the ground is re-rendered crisp. */
const ZOOM_SETTLE_MS = 160;

type Cell = { gx: number; gy: number };

export type ForestHover = { tree: DisplayTree; x: number; y: number };

export type EngineCallbacks = {
    onSelectTree: (id: string | null) => void;
    onPickCell: (gx: number, gy: number) => void;
    onHover: (hover: ForestHover | null) => void;
    onZoom: (zoom: number) => void;
};

type Camera = { x: number; y: number; zoom: number };

const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
const keyOf = (gx: number, gy: number) => `${gx},${gy}`;

export class ForestEngine {
    private readonly ctx: CanvasRenderingContext2D;
    private readonly ground = document.createElement('canvas');
    private readonly gctx: CanvasRenderingContext2D;
    private readonly groundLayer = new GroundLayer();
    private dataVersion = 0;
    private lastZoomAt = -Infinity;
    private hasAmbient = false;

    private w = 0;
    private h = 0;
    private dpr = 1;
    private cam: Camera = { x: 0, y: -24, zoom: 1 };

    private trees: DisplayTree[] = [];
    private occupied = new Map<string, DisplayTree>();
    private occupiedKeys = new Set<string>();
    private next: Cell | null = null;
    private selectedId: string | null = null;
    private hoverCell: Cell | null = null;
    private hoverTreeId: string | null = null;
    private palette: ScenePalette = DARK_PALETTE;

    private reduced = false;
    private inView = true;
    private raf = 0;
    private dirty = true;
    private lastFrame = 0;
    private pendingFit = false;
    private tween: { from: Camera; to: Camera; start: number; ms: number } | null = null;

    private pointers = new Map<number, { x: number; y: number }>();
    private drag: { sx: number; sy: number; cx: number; cy: number; moved: boolean } | null = null;
    private pinch: { dist: number; zoom: number; world: { x: number; y: number } } | null = null;
    private cleanups: (() => void)[] = [];

    constructor(
        private readonly canvas: HTMLCanvasElement,
        private readonly cb: () => EngineCallbacks,
    ) {
        this.ctx = canvas.getContext('2d', { alpha: false })!;
        this.gctx = this.ground.getContext('2d', { alpha: false })!;

        const listen = <K extends keyof HTMLElementEventMap>(
            target: EventTarget,
            type: K | 'visibilitychange',
            fn: (e: HTMLElementEventMap[K]) => void,
            opts?: AddEventListenerOptions,
        ) => {
            target.addEventListener(type, fn as EventListener, opts);
            this.cleanups.push(() => target.removeEventListener(type, fn as EventListener, opts));
        };
        listen(canvas, 'pointerdown', this.onPointerDown);
        listen(canvas, 'pointermove', this.onPointerMove);
        listen(canvas, 'pointerup', this.onPointerUp);
        listen(canvas, 'pointercancel', this.onPointerUp);
        listen(canvas, 'pointerleave', this.onPointerLeave);
        listen(canvas, 'wheel', this.onWheel, { passive: false });
        listen(canvas, 'keydown', this.onKeyDown);
        listen(document, 'visibilitychange', () => this.invalidate());

        const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
        if (mq) {
            this.reduced = mq.matches;
            const onMotion = () => {
                this.reduced = mq.matches;
                this.invalidate();
            };
            mq.addEventListener('change', onMotion);
            this.cleanups.push(() => mq.removeEventListener('change', onMotion));
        }

        const ro = new ResizeObserver((entries) => {
            const r = entries[0]?.contentRect;
            if (r) this.resize(r.width, r.height);
        });
        ro.observe(canvas);
        this.cleanups.push(() => ro.disconnect());

        const io = new IntersectionObserver((entries) => {
            this.inView = entries.some((e) => e.isIntersecting);
            if (this.inView) this.invalidate();
        });
        io.observe(canvas);
        this.cleanups.push(() => io.disconnect());
    }

    destroy() {
        cancelAnimationFrame(this.raf);
        this.raf = 0;
        this.cleanups.forEach((fn) => fn());
        this.cleanups = [];
        this.groundLayer.clear();
        this.ground.width = this.ground.height = 0;
    }

    // ---- data ------------------------------------------------

    setData(trees: DisplayTree[], next: Cell | null, selectedId: string | null) {
        // Painter's order: back rows first (u = gx + gy), then left to right.
        this.trees = [...trees].sort((a, b) => a.gx + a.gy - (b.gx + b.gy) || a.gx - a.gy - (b.gx - b.gy));
        const keys = new Set(trees.map((t) => keyOf(t.gx, t.gy)));
        if (keys.size !== this.occupiedKeys.size || [...keys].some((k) => !this.occupiedKeys.has(k))) {
            this.dataVersion++;
        }
        this.occupiedKeys = keys;
        this.occupied = new Map(trees.map((t) => [keyOf(t.gx, t.gy), t]));
        this.next = next;
        this.selectedId = selectedId;
        this.invalidate();
    }

    setTheme(isLight: boolean) {
        this.palette = isLight ? LIGHT_PALETTE : DARK_PALETTE;
        this.invalidate();
    }

    // ---- camera ----------------------------------------------

    get zoom() {
        return this.cam.zoom;
    }

    zoomBy(factor: number) {
        this.animateTo({ ...this.cam, zoom: clampZoom(this.cam.zoom * factor) });
    }

    /** Frames every tree (and the next planting spot) in view. */
    fit(instant = false) {
        if (!this.w || !this.h) {
            this.pendingFit = true;
            return;
        }
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        const include = (x: number, y: number, bw: number, bh: number) => {
            minX = Math.min(minX, x - bw / 2);
            maxX = Math.max(maxX, x + bw / 2);
            minY = Math.min(minY, y - bh);
            maxY = Math.max(maxY, y + HALF_H);
        };
        for (const t of this.trees) {
            const c = cellCenter(t.gx, t.gy);
            const b = treeBounds(t);
            include(c.x, c.y, Math.max(b.w, 96), Math.max(b.h, 24));
        }
        if (this.next) {
            const c = cellCenter(this.next.gx, this.next.gy);
            include(c.x, c.y, 96, 24);
        }
        let target: Camera;
        if (!Number.isFinite(minX)) {
            target = { x: 0, y: -24, zoom: 1 };
        } else {
            const pad = 72;
            const zoom = Math.min((this.w - pad * 2) / (maxX - minX), (this.h - pad * 2) / (maxY - minY));
            target = { x: (minX + maxX) / 2, y: (minY + maxY) / 2, zoom: Math.min(1.3, Math.max(0.45, zoom)) };
        }
        if (instant) this.jumpTo(target);
        else this.animateTo(target);
    }

    focusCell(gx: number, gy: number) {
        const c = cellCenter(gx, gy);
        this.animateTo({ x: c.x, y: c.y - 30, zoom: Math.max(this.cam.zoom, 1) });
    }

    private jumpTo(cam: Camera) {
        this.tween = null;
        this.cam = { ...cam, zoom: clampZoom(cam.zoom) };
        this.zoomChanged();
        this.invalidate();
    }

    private animateTo(to: Camera, ms = 280) {
        if (this.reduced) {
            this.jumpTo(to);
            return;
        }
        this.tween = { from: { ...this.cam }, to: { ...to, zoom: clampZoom(to.zoom) }, start: performance.now(), ms };
        this.invalidate();
    }

    private zoomAt(zoom: number, sx: number, sy: number) {
        const z = clampZoom(zoom);
        const before = this.screenToWorld(sx, sy);
        this.tween = null;
        this.cam = { zoom: z, x: before.x - (sx - this.w / 2) / z, y: before.y - (sy - this.h / 2) / z };
        this.zoomChanged();
        this.invalidate();
    }

    private zoomChanged() {
        this.lastZoomAt = performance.now();
        this.cb().onZoom(this.cam.zoom);
    }

    private screenToWorld(sx: number, sy: number) {
        return { x: (sx - this.w / 2) / this.cam.zoom + this.cam.x, y: (sy - this.h / 2) / this.cam.zoom + this.cam.y };
    }

    private worldToScreen(x: number, y: number) {
        return { x: (x - this.cam.x) * this.cam.zoom + this.w / 2, y: (y - this.cam.y) * this.cam.zoom + this.h / 2 };
    }

    // ---- loop ------------------------------------------------

    private resize(w: number, h: number) {
        this.w = w;
        this.h = h;
        this.dpr = Math.min(window.devicePixelRatio || 1, 2);
        const pw = Math.max(1, Math.round(w * this.dpr));
        const ph = Math.max(1, Math.round(h * this.dpr));
        this.canvas.width = this.ground.width = pw;
        this.canvas.height = this.ground.height = ph;
        this.groundLayer.clear(); // forces a recompose into the resized buffer
        if (this.pendingFit && w && h) {
            this.pendingFit = false;
            this.fit(true);
        }
        this.invalidate();
        this.draw(performance.now()); // avoid a blank frame after the canvas is cleared by resizing
    }

    private invalidate() {
        this.dirty = true;
        if (!this.raf) this.raf = requestAnimationFrame(this.frame);
    }

    private get animating() {
        return !this.reduced && this.inView && document.visibilityState === 'visible' && this.hasAmbient;
    }

    private frame = (t: number) => {
        this.raf = 0;
        if (this.tween) {
            const { from, to, start, ms } = this.tween;
            const k = Math.min(1, (t - start) / ms);
            const e = 1 - (1 - k) ** 3;
            this.cam = {
                x: from.x + (to.x - from.x) * e,
                y: from.y + (to.y - from.y) * e,
                zoom: Math.exp(Math.log(from.zoom) + (Math.log(to.zoom) - Math.log(from.zoom)) * e),
            };
            if (to.zoom !== from.zoom) this.zoomChanged();
            this.dirty = true;
            if (k >= 1) this.tween = null;
        }
        // Keep ticking until a zoom settles, then draw once more at full sharpness.
        const settling = performance.now() - this.lastZoomAt < ZOOM_SETTLE_MS + 40;
        if (!settling && this.lastZoomAt > 0) {
            this.lastZoomAt = -Infinity;
            this.dirty = true;
        }
        const animating = this.animating;
        if (this.dirty || (animating && t - this.lastFrame >= AMBIENT_FRAME_MS)) {
            this.draw(t);
            this.dirty = false;
            this.lastFrame = t;
        }
        if (this.animating || this.tween || settling) this.raf = requestAnimationFrame(this.frame);
    };

    private draw(t: number) {
        if (!this.w || !this.h) return;
        const { ctx, cam, palette } = this;
        const settled = performance.now() - this.lastZoomAt >= ZOOM_SETTLE_MS;
        const version = `${palette === LIGHT_PALETTE}|${this.dpr}|${this.dataVersion}`;
        const tf = this.groundLayer.compose(this.gctx, cam, this.dpr, settled, palette, this.occupiedKeys, version);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(this.ground, 0, 0);
        ctx.setTransform(tf.s, 0, 0, tf.s, tf.ox, tf.oy);

        // Visible world rect, derived from the exact transform the ground used.
        const x0 = -tf.ox / tf.s;
        const x1 = (this.canvas.width - tf.ox) / tf.s;
        const y0 = -tf.oy / tf.s;
        const y1 = (this.canvas.height - tf.oy) / tf.s;
        const inView = (x: number, y: number, top: number) => x > x0 - 60 && x < x1 + 60 && y > y0 - 14 && y - top < y1;

        const time = this.reduced ? null : t;
        const swayTime = cam.zoom >= SWAY_MIN_ZOOM ? time : null;
        let ambient = false;
        if (this.next && !this.occupied.has(keyOf(this.next.gx, this.next.gy))) {
            const c = cellCenter(this.next.gx, this.next.gy);
            if (time != null && inView(c.x, c.y, -HALF_H)) ambient = true;
            drawTileMark(ctx, this.next.gx, this.next.gy, 'next', palette, cam.zoom, time);
        }
        const selected = this.selectedId ? this.trees.find((tr) => tr.id === this.selectedId) : undefined;
        if (this.hoverCell && !(selected && selected.gx === this.hoverCell.gx && selected.gy === this.hoverCell.gy)) {
            drawTileMark(ctx, this.hoverCell.gx, this.hoverCell.gy, 'hover', palette, cam.zoom, time);
        }
        if (selected) drawTileMark(ctx, selected.gx, selected.gy, 'select', palette, cam.zoom, time);

        for (const tree of this.trees) {
            const c = cellCenter(tree.gx, tree.gy);
            if (!inView(c.x, c.y, 110)) continue;
            if (swayTime != null) ambient = true;
            drawTree(ctx, tree, c.x, c.y, palette, swayTime);
        }
        this.hasAmbient = ambient;
    }

    // ---- input -----------------------------------------------

    private hitTest(sx: number, sy: number): { tree: DisplayTree | null; cell: Cell } {
        const p = this.screenToWorld(sx, sy);
        for (let i = this.trees.length - 1; i >= 0; i--) {
            const tree = this.trees[i];
            if (tree.stageIndex < 2) continue; // small sprites are picked by their tile
            const c = cellCenter(tree.gx, tree.gy);
            const b = treeBounds(tree);
            if (Math.abs(p.x - c.x) <= b.w * 0.42 && p.y <= c.y + 4 && p.y >= c.y - b.h) return { tree, cell: tree };
        }
        const cell = cellAt(p.x, p.y);
        return { tree: this.occupied.get(keyOf(cell.gx, cell.gy)) ?? null, cell };
    }

    private setHover(cell: Cell | null, tree: DisplayTree | null) {
        const sameCell = cell?.gx === this.hoverCell?.gx && cell?.gy === this.hoverCell?.gy;
        if (!sameCell) {
            this.hoverCell = cell;
            this.invalidate();
        }
        const id = tree?.id ?? null;
        if (id !== this.hoverTreeId) {
            this.hoverTreeId = id;
            this.canvas.style.cursor = this.drag?.moved ? 'grabbing' : tree ? 'pointer' : 'grab';
            if (tree) {
                const c = cellCenter(tree.gx, tree.gy);
                const top = this.worldToScreen(c.x, c.y - treeBounds(tree).h);
                this.cb().onHover({ tree, x: top.x, y: top.y });
            } else {
                this.cb().onHover(null);
            }
        }
    }

    private onPointerDown = (e: PointerEvent) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        this.canvas.setPointerCapture(e.pointerId);
        this.pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
        this.tween = null;
        if (this.pointers.size === 1) {
            this.drag = { sx: e.offsetX, sy: e.offsetY, cx: this.cam.x, cy: this.cam.y, moved: false };
        } else if (this.pointers.size === 2) {
            const [a, b] = [...this.pointers.values()];
            const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
            this.pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, zoom: this.cam.zoom, world: this.screenToWorld(mid.x, mid.y) };
            this.drag = null;
            this.setHover(null, null);
        }
    };

    private onPointerMove = (e: PointerEvent) => {
        const p = { x: e.offsetX, y: e.offsetY };
        if (!this.pointers.has(e.pointerId)) {
            if (e.pointerType === 'mouse') {
                const hit = this.hitTest(p.x, p.y);
                this.setHover(hit.tree ?? hit.cell, hit.tree);
            }
            return;
        }
        this.pointers.set(e.pointerId, p);
        if (this.pinch && this.pointers.size >= 2) {
            const [a, b] = [...this.pointers.values()];
            const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
            const z = clampZoom(this.pinch.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / this.pinch.dist));
            this.cam = { zoom: z, x: this.pinch.world.x - (mid.x - this.w / 2) / z, y: this.pinch.world.y - (mid.y - this.h / 2) / z };
            this.zoomChanged();
            this.invalidate();
            return;
        }
        const d = this.drag;
        if (!d) return;
        const dx = p.x - d.sx;
        const dy = p.y - d.sy;
        if (!d.moved && Math.hypot(dx, dy) > 4) {
            d.moved = true;
            this.setHover(null, null);
            this.canvas.style.cursor = 'grabbing';
        }
        if (d.moved) {
            this.cam = { ...this.cam, x: d.cx - dx / this.cam.zoom, y: d.cy - dy / this.cam.zoom };
            this.invalidate();
        }
    };

    private onPointerUp = (e: PointerEvent) => {
        if (!this.pointers.delete(e.pointerId)) return;
        if (this.pinch) {
            if (this.pointers.size < 2) this.pinch = null;
            this.drag = null;
            return;
        }
        const d = this.drag;
        this.drag = null;
        this.canvas.style.cursor = 'grab';
        if (!d || d.moved || e.type !== 'pointerup') return;
        const hit = this.hitTest(e.offsetX, e.offsetY);
        if (hit.tree) {
            this.cb().onSelectTree(hit.tree.id === this.selectedId ? null : hit.tree.id);
        } else if (this.selectedId) {
            this.cb().onSelectTree(null);
        } else {
            this.cb().onPickCell(hit.cell.gx, hit.cell.gy);
        }
        if (e.pointerType === 'mouse') this.setHover(hit.tree ?? hit.cell, hit.tree);
    };

    private onPointerLeave = () => {
        if (!this.drag) this.setHover(null, null);
    };

    private onWheel = (e: WheelEvent) => {
        e.preventDefault();
        const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? this.h : 1;
        const k = Math.exp(-e.deltaY * unit * (e.ctrlKey ? 0.01 : 0.0015));
        this.setHover(null, null);
        this.zoomAt(this.cam.zoom * k, e.offsetX, e.offsetY);
    };

    private onKeyDown = (e: KeyboardEvent) => {
        const step = 90 / this.cam.zoom;
        const pan = (dx: number, dy: number) => this.animateTo({ ...this.cam, x: this.cam.x + dx, y: this.cam.y + dy }, 160);
        switch (e.key) {
            case 'ArrowLeft': pan(-step, 0); break;
            case 'ArrowRight': pan(step, 0); break;
            case 'ArrowUp': pan(0, -step); break;
            case 'ArrowDown': pan(0, step); break;
            case '+':
            case '=': this.zoomBy(1.25); break;
            case '-':
            case '_': this.zoomBy(0.8); break;
            case '0': this.fit(); break;
            case 'Escape':
                if (!this.selectedId) return;
                this.cb().onSelectTree(null);
                break;
            default: return;
        }
        e.preventDefault();
    };
}
