// =========================================================
// forestArt.ts — Canvas drawing for the Forest tab.
//
// Everything here draws in *world units*: the caller sets the
// canvas transform for pan/zoom. The ground is batched into a
// handful of Path2D fills so thousands of tiles cost a few
// draw calls instead of thousands of SVG nodes.
// =========================================================

import { GROWTH_STAGES, type DisplayTree, type TreeSpecies } from '../../lib/forest';

export const TILE_W = 96;
export const TILE_H = 48;
export const HALF_W = TILE_W / 2;
export const HALF_H = TILE_H / 2;

const TAU = Math.PI * 2;

// ---------------------------------------------------------
// Isometric math
// ---------------------------------------------------------

export function cellCenter(gx: number, gy: number): { x: number; y: number } {
    return { x: (gx - gy) * HALF_W, y: (gx + gy) * HALF_H };
}

/** Grid cell whose diamond contains the world point. */
export function cellAt(x: number, y: number): { gx: number; gy: number } {
    const a = x / HALF_W;
    const b = y / HALF_H;
    return { gx: Math.round((b + a) / 2), gy: Math.round((b - a) / 2) };
}

/** Stable 0..1 noise per cell (salt picks an independent stream). */
export function cellNoise(gx: number, gy: number, salt = 0): number {
    let h = Math.imul(gx | 0, 374761393) ^ Math.imul(gy | 0, 668265263) ^ Math.imul(salt + 1, 2246822519);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}

export function hashString(id: string): number {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
    return Math.abs(h);
}

// ---------------------------------------------------------
// Palettes
// ---------------------------------------------------------

export type ScenePalette = {
    base: string;
    /** [even row a, even row b, odd row a, odd row b] */
    tiles: [string, string, string, string];
    grid: string;
    tuft: string;
    flowers: [string, string];
    pebble: string;
    shadow: string;
    soil: string;
    soilTop: string;
    hover: string;
    select: string;
    selectFill: string;
    sparkle: string;
};

export const DARK_PALETTE: ScenePalette = {
    base: '#17301f',
    tiles: ['#1d3a28', '#1f3d2a', '#1a3424', '#1c3726'],
    grid: 'rgba(255, 255, 255, 0.05)',
    tuft: 'rgba(132, 190, 118, 0.38)',
    flowers: ['rgba(244, 240, 206, 0.8)', 'rgba(240, 164, 194, 0.75)'],
    pebble: 'rgba(0, 0, 0, 0.22)',
    shadow: 'rgba(0, 0, 0, 0.32)',
    soil: '#2b2017',
    soilTop: '#3d2d1f',
    hover: 'rgba(255, 255, 255, 0.4)',
    select: '#eaf7cf',
    selectFill: 'rgba(234, 247, 207, 0.1)',
    sparkle: '#fff7c9',
};

export const LIGHT_PALETTE: ScenePalette = {
    base: '#a2cd8e',
    tiles: ['#abd597', '#b0d99c', '#a4cf90', '#a8d294'],
    grid: 'rgba(38, 80, 30, 0.1)',
    tuft: 'rgba(64, 124, 54, 0.45)',
    flowers: ['rgba(255, 255, 255, 0.95)', 'rgba(226, 104, 146, 0.85)'],
    pebble: 'rgba(58, 70, 48, 0.2)',
    shadow: 'rgba(28, 64, 28, 0.2)',
    soil: '#6e5035',
    soilTop: '#876441',
    hover: 'rgba(18, 40, 18, 0.45)',
    select: '#18340f',
    selectFill: 'rgba(24, 52, 15, 0.1)',
    sparkle: '#fffbe0',
};

type SpeciesColors = { hi: string; lo: string; deep: string; trunk: string; trunkShade: string };

const SPECIES: Record<TreeSpecies, SpeciesColors> = {
    pine: { hi: '#52b17f', lo: '#2f7e56', deep: '#215c3f', trunk: '#7c583b', trunkShade: '#5b3f2a' },
    oak: { hi: '#8ac86d', lo: '#5d9d4a', deep: '#417636', trunk: '#835b3c', trunkShade: '#61432c' },
    birch: { hi: '#c6e08a', lo: '#97c060', deep: '#729c45', trunk: '#eee9dc', trunkShade: '#cbc4b2' },
    cherry: { hi: '#f7b6c9', lo: '#e287a2', deep: '#bd6380', trunk: '#78534b', trunkShade: '#583b36' },
};

export const SPECIES_LABEL: Record<TreeSpecies, string> = {
    pine: 'Pine',
    oak: 'Oak',
    birch: 'Birch',
    cherry: 'Cherry',
};

// ---------------------------------------------------------
// Ground
// ---------------------------------------------------------

export type View = { cx: number; cy: number; zoom: number; w: number; h: number };

export function worldRect(v: View) {
    return {
        x0: v.cx - v.w / 2 / v.zoom,
        x1: v.cx + v.w / 2 / v.zoom,
        y0: v.cy - v.h / 2 / v.zoom,
        y1: v.cy + v.h / 2 / v.zoom,
    };
}

function diamond(p: Path2D, x: number, y: number, hw = HALF_W, hh = HALF_H) {
    p.moveTo(x, y - hh);
    p.lineTo(x + hw, y);
    p.lineTo(x, y + hh);
    p.lineTo(x - hw, y);
    p.closePath();
}

/** Paints the endless meadow for the visible rect. `occupied` cells skip decorations. */
export function drawGround(ctx: CanvasRenderingContext2D, view: View, pal: ScenePalette, occupied: Set<string>) {
    const { x0, x1, y0, y1 } = worldRect(view);
    ctx.fillStyle = pal.base;
    ctx.fillRect(x0 - 4, y0 - 4, x1 - x0 + 8, y1 - y0 + 8);

    // Screen-aligned iso axes: v = gx − gy (columns), u = gx + gy (rows).
    const vMin = Math.floor(x0 / HALF_W) - 1;
    const vMax = Math.ceil(x1 / HALF_W) + 1;
    const uMin = Math.floor(y0 / HALF_H) - 1;
    const uMax = Math.ceil(y1 / HALF_H) + 1;

    const tiles = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
    const tufts = new Path2D();
    const flowersA = new Path2D();
    const flowersB = new Path2D();
    const pebbles = new Path2D();
    const detail = view.zoom >= 0.5;

    for (let u = uMin; u <= uMax; u++) {
        for (let v = vMin; v <= vMax; v++) {
            if (((u + v) & 1) !== 0) continue;
            const gx = (u + v) / 2;
            const gy = (u - v) / 2;
            const x = v * HALF_W;
            const y = u * HALF_H;
            const shade = ((u & 1) === 0 ? 0 : 2) + (cellNoise(gx, gy) < 0.5 ? 0 : 1);
            diamond(tiles[shade], x, y);

            if (!detail || occupied.has(`${gx},${gy}`)) continue;
            const d = cellNoise(gx, gy, 7);
            if (d > 0.3) continue;
            const px = x + (cellNoise(gx, gy, 3) - 0.5) * HALF_W * 0.8;
            const py = y + (cellNoise(gx, gy, 5) - 0.5) * HALF_H * 0.7;
            if (d < 0.2) {
                tufts.moveTo(px - 3, py);
                tufts.lineTo(px - 4.5, py - 5);
                tufts.moveTo(px, py);
                tufts.lineTo(px, py - 7);
                tufts.moveTo(px + 3, py);
                tufts.lineTo(px + 4.5, py - 5);
            } else if (d < 0.26) {
                const target = cellNoise(gx, gy, 9) < 0.5 ? flowersA : flowersB;
                for (const [fx, fy] of [[0, 0], [5, 2], [-4, 3]]) {
                    target.moveTo(px + fx + 1.7, py + fy);
                    target.arc(px + fx, py + fy, 1.7, 0, TAU);
                }
            } else {
                pebbles.moveTo(px + 3.2, py);
                pebbles.ellipse(px, py, 3.2, 1.9, 0, 0, TAU);
            }
        }
    }

    tiles.forEach((p, i) => {
        ctx.fillStyle = pal.tiles[i];
        ctx.fill(p);
    });

    if (detail) {
        ctx.globalAlpha = Math.min(1, (view.zoom - 0.5) / 0.3);
        ctx.strokeStyle = pal.tuft;
        ctx.lineWidth = 1.4;
        ctx.lineCap = 'round';
        ctx.stroke(tufts);
        ctx.fillStyle = pal.flowers[0];
        ctx.fill(flowersA);
        ctx.fillStyle = pal.flowers[1];
        ctx.fill(flowersB);
        ctx.fillStyle = pal.pebble;
        ctx.fill(pebbles);
        ctx.globalAlpha = 1;
    }

    // Grid lines: long diagonals instead of one outline per tile.
    const gridAlpha = Math.min(1, Math.max(0, (view.zoom - 0.4) / 0.4));
    if (gridAlpha > 0) {
        const corners = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]];
        const gxs = corners.map(([x, y]) => (y / HALF_H + x / HALF_W) / 2);
        const gys = corners.map(([x, y]) => (y / HALF_H - x / HALF_W) / 2);
        const gxMin = Math.floor(Math.min(...gxs)) - 1;
        const gxMax = Math.ceil(Math.max(...gxs)) + 1;
        const gyMin = Math.floor(Math.min(...gys)) - 1;
        const gyMax = Math.ceil(Math.max(...gys)) + 1;
        const grid = new Path2D();
        for (let k = gxMin; k <= gxMax; k++) {
            const g = k + 0.5;
            grid.moveTo((g - gyMin) * HALF_W, (g + gyMin) * HALF_H);
            grid.lineTo((g - gyMax) * HALF_W, (g + gyMax) * HALF_H);
        }
        for (let k = gyMin; k <= gyMax; k++) {
            const g = k + 0.5;
            grid.moveTo((gxMin - g) * HALF_W, (gxMin + g) * HALF_H);
            grid.lineTo((gxMax - g) * HALF_W, (gxMax + g) * HALF_H);
        }
        ctx.globalAlpha = gridAlpha;
        ctx.strokeStyle = pal.grid;
        ctx.lineWidth = 1 / view.zoom;
        ctx.stroke(grid);
        ctx.globalAlpha = 1;
    }
}

// ---------------------------------------------------------
// Tile marks (hover / selection / next planting spot)
// ---------------------------------------------------------

export function drawTileMark(
    ctx: CanvasRenderingContext2D,
    gx: number,
    gy: number,
    kind: 'hover' | 'select' | 'next',
    pal: ScenePalette,
    zoom: number,
    time: number | null,
) {
    const { x, y } = cellCenter(gx, gy);
    if (kind === 'hover') {
        const p = new Path2D();
        diamond(p, x, y, HALF_W - 3, HALF_H - 1.5);
        ctx.strokeStyle = pal.hover;
        ctx.lineWidth = 1.5 / zoom;
        ctx.stroke(p);
        return;
    }
    if (kind === 'select') {
        const p = new Path2D();
        diamond(p, x, y, HALF_W - 2, HALF_H - 1);
        ctx.fillStyle = pal.selectFill;
        ctx.fill(p);
        ctx.strokeStyle = pal.select;
        ctx.lineWidth = 2 / zoom;
        ctx.stroke(p);
        return;
    }
    // next: steady inset outline + dot, plus an expanding ring when animating
    const inner = new Path2D();
    diamond(inner, x, y, HALF_W * 0.62, HALF_H * 0.62);
    ctx.strokeStyle = pal.select;
    ctx.lineWidth = 1.75 / zoom;
    ctx.setLineDash([5 / zoom, 4 / zoom]);
    ctx.stroke(inner);
    ctx.setLineDash([]);
    ctx.fillStyle = pal.select;
    ctx.beginPath();
    ctx.ellipse(x, y, 3, 1.8, 0, 0, TAU);
    ctx.fill();
    if (time != null) {
        const f = (time % 2200) / 2200;
        const ring = new Path2D();
        const k = 0.62 + f * 0.36;
        diamond(ring, x, y, HALF_W * k, HALF_H * k);
        ctx.globalAlpha = (1 - f) * 0.7;
        ctx.lineWidth = 1.5 / zoom;
        ctx.stroke(ring);
        ctx.globalAlpha = 1;
    }
}

// ---------------------------------------------------------
// Trees
// ---------------------------------------------------------

type TreeLike = Pick<DisplayTree, 'id' | 'species' | 'stageIndex' | 'progress'>;

/** Sprite scale: sprouts grow in place, saplings scale up to mature size. */
export function treeScale(t: TreeLike): number {
    const vary = 0.94 + (hashString(t.id) % 13) / 100;
    if (t.stageIndex <= 0) return 1;
    if (t.stageIndex === 1) return (0.8 + t.progress * 0.45) * vary;
    const growth = Math.min(4, t.stageIndex + t.progress);
    return (0.52 + ((growth - 2) / 2) * 0.5) * vary;
}

/** Rough sprite box above the cell center (world units) for hit tests and fitting. */
export function treeBounds(t: TreeLike): { w: number; h: number } {
    const s = treeScale(t);
    if (t.stageIndex <= 0) return { w: 30, h: 16 };
    if (t.stageIndex === 1) return { w: 24 * s, h: 28 * s };
    return { w: 60 * s, h: 96 * s };
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
}

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
    ctx.fill();
}

function tri(ctx: CanvasRenderingContext2D, pts: number[], color: string) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    ctx.lineTo(pts[2], pts[3]);
    ctx.lineTo(pts[4], pts[5]);
    ctx.closePath();
    ctx.fill();
}

function taperedTrunk(ctx: CanvasRenderingContext2D, c: SpeciesColors, top: number, base: number, tip: number) {
    ctx.fillStyle = c.trunk;
    ctx.beginPath();
    ctx.moveTo(-base, 0);
    ctx.quadraticCurveTo(-tip * 1.2, top * 0.5, -tip, top);
    ctx.lineTo(tip, top);
    ctx.quadraticCurveTo(tip * 1.2, top * 0.5, base, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = c.trunkShade;
    ctx.beginPath();
    ctx.moveTo(0.4, 0);
    ctx.lineTo(0.3, top);
    ctx.lineTo(tip, top);
    ctx.quadraticCurveTo(tip * 1.2, top * 0.5, base, 0);
    ctx.closePath();
    ctx.fill();
}

// Light comes from the upper left: left faces use `hi`, right faces `lo`/`deep`.
function drawPine(ctx: CanvasRenderingContext2D, c: SpeciesColors) {
    taperedTrunk(ctx, c, -18, 3.4, 2.4);
    const tiers = [
        { base: -12, h: 36, hw: 30 },
        { base: -30, h: 32, hw: 24 },
        { base: -46, h: 30, hw: 17 },
    ];
    for (const { base, h, hw } of tiers) {
        const apex = base - h;
        tri(ctx, [0, apex, -hw, base, 0, base + 4], c.hi);
        tri(ctx, [0, apex, 0, base + 4, hw, base], c.lo);
        tri(ctx, [0, apex, hw * 0.45, base + 2.2, hw, base], c.deep);
    }
}

function drawOak(ctx: CanvasRenderingContext2D, c: SpeciesColors) {
    taperedTrunk(ctx, c, -34, 4.6, 2.6);
    circle(ctx, 15, -43, 15, c.deep);
    circle(ctx, 8, -60, 17, c.deep);
    circle(ctx, -14, -45, 16, c.lo);
    circle(ctx, 0, -53, 20, c.lo);
    circle(ctx, -10, -60, 13, c.hi);
    circle(ctx, -18, -47, 9, c.hi);
    circle(ctx, 1, -69, 9, c.hi);
    circle(ctx, -12, -64, 4.5, 'rgba(255, 255, 255, 0.14)');
}

function drawBirch(ctx: CanvasRenderingContext2D, c: SpeciesColors) {
    ctx.fillStyle = c.trunk;
    ctx.fillRect(-2.3, -48, 4.6, 48);
    ctx.fillStyle = c.trunkShade;
    ctx.fillRect(0.7, -48, 1.6, 48);
    ctx.fillStyle = '#4a4438';
    for (const [y, side] of [[-8, -1], [-16, 1], [-25, -1], [-33, 1]]) {
        ctx.fillRect(side < 0 ? -2.3 : -0.4, y, 2.7, 1.3);
    }
    ellipse(ctx, 4, -55, 15, 23, c.deep);
    ellipse(ctx, -1, -58, 15, 25, c.lo);
    ellipse(ctx, -5, -62, 10, 17, c.hi);
    ellipse(ctx, -7, -68, 4, 6, 'rgba(255, 255, 255, 0.14)');
}

const BLOSSOMS: [number, number][] = [[-6, -62], [9, -53], [-15, -47], [13, -43], [0, -44], [-2, -69], [17, -57], [-20, -55]];

function drawCherry(ctx: CanvasRenderingContext2D, c: SpeciesColors) {
    taperedTrunk(ctx, c, -30, 4.2, 2.4);
    ctx.strokeStyle = c.trunk;
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -24);
    ctx.lineTo(9, -36);
    ctx.stroke();
    circle(ctx, 17, -42, 15, c.deep);
    circle(ctx, 7, -58, 16, c.deep);
    circle(ctx, -16, -42, 15, c.lo);
    circle(ctx, -1, -51, 20, c.lo);
    circle(ctx, -11, -57, 13, c.hi);
    circle(ctx, -21, -45, 8, c.hi);
    ctx.fillStyle = '#ffe4ed';
    ctx.beginPath();
    for (const [x, y] of BLOSSOMS) {
        ctx.moveTo(x + 1.9, y);
        ctx.arc(x, y, 1.9, 0, TAU);
    }
    ctx.fill();
}

function drawSprout(ctx: CanvasRenderingContext2D, c: SpeciesColors, pal: ScenePalette) {
    ellipse(ctx, 0, 0, 7, 3, pal.soil);
    ctx.strokeStyle = '#6a9a4f';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -1);
    ctx.quadraticCurveTo(-1, -9, 0, -16);
    ctx.stroke();
    ctx.fillStyle = c.hi;
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.bezierCurveTo(-6, -13, -9, -18, -8, -22);
    ctx.bezierCurveTo(-3, -20, -1, -16, 0, -11);
    ctx.fill();
    ctx.fillStyle = c.lo;
    ctx.beginPath();
    ctx.moveTo(0, -13);
    ctx.bezierCurveTo(5, -15, 8, -20, 7, -24);
    ctx.bezierCurveTo(3, -22, 1, -18, 0, -13);
    ctx.fill();
}

function drawSeed(ctx: CanvasRenderingContext2D, pal: ScenePalette, progress: number) {
    ellipse(ctx, 3, 1.5, 15, 6, pal.shadow);
    ellipse(ctx, 0, 0, 14, 6.5, pal.soil);
    ellipse(ctx, -1, -2, 10, 4.5, pal.soilTop);
    // A bud that fattens as the seed gets close to sprouting.
    const r = 2.2 + progress * 1.6;
    ellipse(ctx, 0, -3.5 - r * 0.6, r * 0.8, r, '#8fc86e');
    ellipse(ctx, -0.6, -3.9 - r * 0.8, r * 0.35, r * 0.5, '#c9e8a8');
}

/**
 * Draws one tree with its base at (x, y). `time` (ms) drives the gentle
 * sway and sparkle; pass null for a still frame.
 */
export function drawTree(
    ctx: CanvasRenderingContext2D,
    tree: TreeLike,
    x: number,
    y: number,
    pal: ScenePalette,
    time: number | null,
) {
    const c = SPECIES[tree.species] ?? SPECIES.oak;
    ctx.save();
    ctx.translate(x, y);
    if (tree.stageIndex <= 0) {
        drawSeed(ctx, pal, tree.progress);
        ctx.restore();
        return;
    }
    const s = treeScale(tree);
    const sprout = tree.stageIndex === 1;
    ellipse(ctx, 5 * s, 1.5 * s, (sprout ? 9 : 23) * s, (sprout ? 3.5 : 8.5) * s, pal.shadow);
    ctx.scale(s, s);

    const seed = hashString(tree.id);
    if (time != null) {
        const period = 5000 + (seed % 30) * 100;
        ctx.rotate(Math.sin((time / period) * TAU + (seed % 628) / 100) * 0.022);
    }

    if (sprout) drawSprout(ctx, c, pal);
    else if (tree.species === 'pine') drawPine(ctx, c);
    else if (tree.species === 'birch') drawBirch(ctx, c);
    else if (tree.species === 'cherry') drawCherry(ctx, c);
    else drawOak(ctx, c);

    if (time != null && tree.stageIndex >= GROWTH_STAGES.length - 1) {
        const top = tree.species === 'pine' ? -80 : -74;
        const pts: [number, number][] = [[-19, top + 6], [17, top - 2], [3, top - 16]];
        pts.forEach(([px, py], i) => {
            ctx.globalAlpha = 0.15 + 0.7 * (0.5 + 0.5 * Math.sin(time / 520 + i * 2.1 + seed));
            circle(ctx, px, py, 1.4, pal.sparkle);
        });
        ctx.globalAlpha = 1;
    }
    ctx.restore();
}
