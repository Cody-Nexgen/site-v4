// =========================================================
// forestGround.ts — map-style tile cache for the meadow.
//
// The ground is rendered once into world-aligned chunks (like
// map tiles) and panning just blits cached chunks, so dragging
// costs the same at 35% zoom as at 250%. While a zoom gesture
// is in flight the current chunks are scaled; once it settles
// they are re-rendered crisp at the new zoom. Chunk edges are
// snapped to whole device pixels so there are no seams.
// =========================================================

import { TILE_H, TILE_W, drawGround, type ScenePalette } from './forestArt';

export type WorldTransform = { s: number; ox: number; oy: number };
type Lattice = { n: number; px: number };

/** Target chunk width in device pixels. */
const CHUNK_TARGET_PX = 384;

function idealLattice(zoom: number, dpr: number): Lattice {
    const tilePx = TILE_W * zoom * dpr;
    const n = Math.min(16, Math.max(1, 2 ** Math.round(Math.log2(CHUNK_TARGET_PX / tilePx))));
    // Even width keeps the 2:1 chunk height an integer too.
    return { n, px: 2 * Math.max(1, Math.round((n * tilePx) / 2)) };
}

export class GroundLayer {
    private chunks = new Map<string, HTMLCanvasElement>();
    private area = 0;
    private lattice: Lattice | null = null;
    private version = '';
    private composedKey = '';

    /** Drops every cached chunk (theme, tree layout or pixel ratio changed). */
    clear() {
        for (const c of this.chunks.values()) c.width = c.height = 0;
        this.chunks.clear();
        this.area = 0;
        this.composedKey = '';
    }

    /**
     * Paints the visible ground into `out` (device pixels) and returns the
     * world → device transform it used, so trees line up with the tiles.
     * Skips the work entirely when nothing moved since the last call.
     */
    compose(
        out: CanvasRenderingContext2D,
        cam: { x: number; y: number; zoom: number },
        dpr: number,
        settled: boolean,
        pal: ScenePalette,
        occupied: Set<string>,
        version: string,
    ): WorldTransform {
        if (version !== this.version) {
            this.clear();
            this.version = version;
        }
        const ideal = idealLattice(cam.zoom, dpr);
        const lat = this.lattice;
        const scaleRatio = lat ? lat.px / (lat.n * TILE_W) / (cam.zoom * dpr) : 1;
        const isIdeal = !!lat && lat.px === ideal.px && lat.n === ideal.n;
        if (!lat || (!isIdeal && settled) || scaleRatio > 1.8 || scaleRatio < 0.55) this.lattice = ideal;

        const { n, px } = this.lattice!;
        const exact = px === ideal.px && n === ideal.n;
        const cw = n * TILE_W;
        const ch = n * TILE_H;
        const W = out.canvas.width;
        const H = out.canvas.height;
        const s = exact ? px / cw : cam.zoom * dpr;
        let ox = W / 2 - cam.x * s;
        let oy = H / 2 - cam.y * s;
        if (exact) {
            ox = Math.round(ox);
            oy = Math.round(oy);
        }
        const tf = { s, ox, oy };
        const key = `${n},${px},${s},${ox},${oy},${W},${H}`;
        if (key === this.composedKey) return tf;
        this.composedKey = key;

        out.setTransform(1, 0, 0, 1, 0, 0);
        out.fillStyle = pal.base;
        out.fillRect(0, 0, W, H);
        const stepX = exact ? px : cw * s;
        const stepY = exact ? px / 2 : ch * s;
        const pad = exact ? 0 : 0.75; // hide hairline seams while scaling
        const i0 = Math.floor(-ox / stepX);
        const i1 = Math.floor((W - ox) / stepX);
        const j0 = Math.floor(-oy / stepY);
        const j1 = Math.floor((H - oy) / stepY);
        for (let j = j0; j <= j1; j++) {
            for (let i = i0; i <= i1; i++) {
                const chunk = this.chunk(i, j, n, px, dpr, pal, occupied);
                out.drawImage(chunk, ox + i * stepX, oy + j * stepY, stepX + pad, stepY + pad);
            }
        }
        this.evict(Math.max(W * H * 3, 4_000_000));
        return tf;
    }

    private chunk(i: number, j: number, n: number, px: number, dpr: number, pal: ScenePalette, occupied: Set<string>) {
        const key = `${n}:${px}:${i}:${j}`;
        const hit = this.chunks.get(key);
        if (hit) {
            // Refresh LRU position.
            this.chunks.delete(key);
            this.chunks.set(key, hit);
            return hit;
        }
        const c = document.createElement('canvas');
        c.width = px;
        c.height = px / 2;
        const g = c.getContext('2d', { alpha: false })!;
        const cw = n * TILE_W;
        const ch = n * TILE_H;
        const s = px / cw;
        const zoom = s / dpr;
        g.setTransform(s, 0, 0, s, -i * cw * s, -j * ch * s);
        drawGround(g, { cx: (i + 0.5) * cw, cy: (j + 0.5) * ch, zoom, w: cw * zoom, h: ch * zoom }, pal, occupied);
        this.chunks.set(key, c);
        this.area += c.width * c.height;
        return c;
    }

    private evict(budget: number) {
        for (const [key, c] of this.chunks) {
            if (this.area <= budget) break;
            this.area -= c.width * c.height;
            c.width = c.height = 0;
            this.chunks.delete(key);
        }
    }
}
