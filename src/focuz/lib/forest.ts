// =========================================================
// forest.ts — Forest feature: data model + growth engine
//
// Growth is computed lazily from timestamps (closed-form
// integral of the growth multiplier), so no background
// timers are needed. The background service worker is the
// only writer for plant/slip events; the UI only writes
// the user's "next plant position" selection.
// =========================================================

export type TreeSpecies = 'pine' | 'oak' | 'birch' | 'cherry';

export type Tree = {
    id: string;
    plantedAt: number;
    gx: number;
    gy: number;
    /** Clean growth minutes settled up to ForestState.lastSettledAt */
    cleanMinutes: number;
    species: TreeSpecies;
};

export type SlipReason = 'blocklist' | 'shorts' | 'other';

export type ForestState = {
    version: 1;
    trees: Tree[];
    lastSlipAt: number | null;
    /** All trees' cleanMinutes are accurate as of this timestamp */
    lastSettledAt: number;
    slipsToday: number;
    slipsDayKey: string;
    totalSlips: number;
    /** User-selected grid cell for the next planted tree */
    nextPlantPos: { gx: number; gy: number } | null;
};

// ---------------------------------------------------------
// Tunable constants (see spec §6 — sensible defaults)
// ---------------------------------------------------------

export const GROWTH_STAGES = [
    { key: 'seed', label: 'Seed', atMinutes: 0 },
    { key: 'sprout', label: 'Sprout', atMinutes: 45 },
    { key: 'sapling', label: 'Sapling', atMinutes: 180 },
    { key: 'young', label: 'Young tree', atMinutes: 540 },
    { key: 'mature', label: 'Mature', atMinutes: 1440 },
] as const;

export type StageKey = (typeof GROWTH_STAGES)[number]['key'];

/** Growth rate immediately after a slip (25% of normal) */
export const SLIP_MULTIPLIER_FLOOR = 0.25;
/** Minutes for the growth rate to recover back to 100% */
export const SLIP_RECOVERY_MINUTES = 90;

export const TREE_SPECIES: TreeSpecies[] = ['pine', 'oak', 'birch', 'cherry'];

export const FOREST_STORAGE_KEY = 'forestState';

// ---------------------------------------------------------
// Storage (chrome.storage.local, localStorage fallback for preview)
// ---------------------------------------------------------

function hasChromeStorage(): boolean {
    return typeof chrome !== 'undefined' && !!chrome.storage?.local;
}

export function emptyForest(now = Date.now()): ForestState {
    return {
        version: 1,
        trees: [],
        lastSlipAt: null,
        lastSettledAt: now,
        slipsToday: 0,
        slipsDayKey: new Date(now).toDateString(),
        totalSlips: 0,
        nextPlantPos: null,
    };
}

export async function loadForest(): Promise<ForestState> {
    try {
        if (hasChromeStorage()) {
            const res = await chrome.storage.local.get(FOREST_STORAGE_KEY);
            const raw = res?.[FOREST_STORAGE_KEY] as ForestState | undefined;
            if (raw && raw.version === 1) return raw;
        } else {
            const raw = localStorage.getItem(FOREST_STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed?.version === 1) return parsed as ForestState;
            }
        }
    } catch (e) {
        console.warn('[Forest] load failed', e);
    }
    return emptyForest();
}

export async function saveForest(state: ForestState): Promise<void> {
    try {
        if (hasChromeStorage()) {
            await chrome.storage.local.set({ [FOREST_STORAGE_KEY]: state });
        } else {
            localStorage.setItem(FOREST_STORAGE_KEY, JSON.stringify(state));
        }
    } catch (e) {
        console.warn('[Forest] save failed', e);
    }
}

// ---------------------------------------------------------
// Growth multiplier model
//
// After a slip at time s, growth rate drops to FLOOR and
// recovers linearly to 1.0 over SLIP_RECOVERY_MINUTES:
//   m(t) = FLOOR + (1 - FLOOR) * clamp((t - s) / R, 0, 1)
// ---------------------------------------------------------

const MIN = 60_000; // ms per minute

export function currentMultiplier(state: Pick<ForestState, 'lastSlipAt'>, now = Date.now()): number {
    if (!state.lastSlipAt) return 1;
    const elapsed = (now - state.lastSlipAt) / MIN;
    if (elapsed >= SLIP_RECOVERY_MINUTES) return 1;
    if (elapsed < 0) return SLIP_MULTIPLIER_FLOOR;
    return SLIP_MULTIPLIER_FLOOR + (1 - SLIP_MULTIPLIER_FLOOR) * (elapsed / SLIP_RECOVERY_MINUTES);
}

/**
 * Closed-form integral of the multiplier over [fromMs, toMs],
 * returned in clean growth minutes.
 */
export function integrateGrowthMinutes(
    lastSlipAt: number | null,
    fromMs: number,
    toMs: number,
): number {
    if (toMs <= fromMs) return 0;
    const a = fromMs / MIN;
    const b = toMs / MIN;
    if (lastSlipAt == null) return b - a;

    const s = lastSlipAt / MIN;
    const e = s + SLIP_RECOVERY_MINUTES; // fully recovered at e
    const F = SLIP_MULTIPLIER_FLOOR;

    let total = 0;
    // Portion before the slip (shouldn't normally occur — full rate)
    if (a < s) total += Math.min(b, s) - a;
    // Portion inside the recovery ramp
    const ra = Math.max(a, s);
    const rb = Math.min(b, e);
    if (rb > ra) {
        total += F * (rb - ra) + ((1 - F) / (2 * SLIP_RECOVERY_MINUTES)) * ((rb - s) ** 2 - (ra - s) ** 2);
    }
    // Portion after full recovery
    if (b > e) total += b - Math.max(a, e);
    return total;
}

/** Credit accrued growth to every tree and advance lastSettledAt. */
export function settleGrowth(state: ForestState, now = Date.now()): ForestState {
    const gained = integrateGrowthMinutes(state.lastSlipAt, state.lastSettledAt, now);
    const dayKey = new Date(now).toDateString();
    return {
        ...state,
        trees: gained > 0
            ? state.trees.map((t) => ({ ...t, cleanMinutes: t.cleanMinutes + gained }))
            : state.trees,
        lastSettledAt: Math.max(state.lastSettledAt, now),
        slipsToday: dayKey === state.slipsDayKey ? state.slipsToday : 0,
        slipsDayKey: dayKey,
    };
}

// ---------------------------------------------------------
// Stages
// ---------------------------------------------------------

export function stageIndexForMinutes(minutes: number): number {
    let idx = 0;
    for (let i = 0; i < GROWTH_STAGES.length; i++) {
        if (minutes >= GROWTH_STAGES[i].atMinutes) idx = i;
    }
    return idx;
}

/** 0..1 progress within the current stage (1 when mature) */
export function stageProgress(minutes: number): number {
    const idx = stageIndexForMinutes(minutes);
    if (idx >= GROWTH_STAGES.length - 1) return 1;
    const cur = GROWTH_STAGES[idx].atMinutes;
    const next = GROWTH_STAGES[idx + 1].atMinutes;
    return Math.min(1, Math.max(0, (minutes - cur) / (next - cur)));
}

// ---------------------------------------------------------
// Grid placement — spiral outward from the center, so the
// forest expands organically as it grows (spec §6 Q3).
// ---------------------------------------------------------

export function spiralPositions(count: number): { gx: number; gy: number }[] {
    const out: { gx: number; gy: number }[] = [{ gx: 0, gy: 0 }];
    let x = 0;
    let y = 0;
    let dx = 1;
    let dy = 0;
    let segLen = 1;
    let segPassed = 0;
    let turns = 0;
    while (out.length < count) {
        x += dx;
        y += dy;
        out.push({ gx: x, gy: y });
        segPassed++;
        if (segPassed === segLen) {
            segPassed = 0;
            // rotate direction 90°
            const t = dx;
            dx = -dy;
            dy = t;
            turns++;
            if (turns % 2 === 0) segLen++;
        }
    }
    return out;
}

export function nextFreePosition(state: ForestState): { gx: number; gy: number } {
    const occupied = new Set(state.trees.map((t) => `${t.gx},${t.gy}`));
    if (state.nextPlantPos && !occupied.has(`${state.nextPlantPos.gx},${state.nextPlantPos.gy}`)) {
        return state.nextPlantPos;
    }
    const spiral = spiralPositions(state.trees.length * 2 + 16);
    for (const p of spiral) {
        if (!occupied.has(`${p.gx},${p.gy}`)) return p;
    }
    return { gx: 0, gy: 0 };
}

/** Board radius that comfortably contains all trees (min 2 ⇒ 5×5). */
export function boardRadius(trees: Tree[]): number {
    let r = 2;
    for (const t of trees) {
        r = Math.max(r, Math.abs(t.gx) + 1, Math.abs(t.gy) + 1);
    }
    return Math.min(r, 9);
}

// ---------------------------------------------------------
// Events (background service worker is the writer)
// ---------------------------------------------------------

function pickSpecies(seed: number): TreeSpecies {
    return TREE_SPECIES[seed % TREE_SPECIES.length];
}

/** Called when a focus session (Pomodoro / Deep Work) completes. */
export async function plantTreeFromSession(): Promise<Tree> {
    const now = Date.now();
    const state = settleGrowth(await loadForest(), now);
    const pos = nextFreePosition(state);
    const tree: Tree = {
        id: `tree-${now}-${Math.floor(Math.random() * 1e6)}`,
        plantedAt: now,
        gx: pos.gx,
        gy: pos.gy,
        cleanMinutes: 0,
        species: pickSpecies(state.trees.length + (Math.random() < 0.5 ? 0 : 1)),
    };
    const next: ForestState = {
        ...state,
        trees: [...state.trees, tree],
        nextPlantPos: null,
    };
    await saveForest(next);
    return tree;
}

/** Called on blocklist violation or Shorts/Reels/TikTok detection. */
export async function registerSlip(_reason: SlipReason = 'other'): Promise<void> {
    const now = Date.now();
    const state = settleGrowth(await loadForest(), now);
    // Ignore rapid duplicates (e.g. redirect + reload within a minute)
    if (state.lastSlipAt && now - state.lastSlipAt < MIN) return;
    const next: ForestState = {
        ...state,
        lastSlipAt: now,
        slipsToday: state.slipsToday + 1,
        totalSlips: state.totalSlips + 1,
    };
    await saveForest(next);
}

/** UI: choose (or clear) the cell where the next tree will be planted. */
export async function setNextPlantPos(pos: { gx: number; gy: number } | null): Promise<void> {
    const state = await loadForest();
    await saveForest({ ...state, nextPlantPos: pos });
}

// ---------------------------------------------------------
// Dev-mode testing helpers (/devmodetest toolkit)
// ---------------------------------------------------------

export async function devPlantTrees(count: number): Promise<void> {
    for (let i = 0; i < count; i++) await plantTreeFromSession();
}

/** Instantly credit clean growth minutes to every tree. */
export async function devGrowAll(minutes: number): Promise<void> {
    const state = settleGrowth(await loadForest());
    await saveForest({
        ...state,
        trees: state.trees.map((t) => ({ ...t, cleanMinutes: t.cleanMinutes + minutes })),
    });
}

/** Clear any active slip penalty (instant recovery to 100%). */
export async function devClearSlip(): Promise<void> {
    const state = settleGrowth(await loadForest());
    await saveForest({ ...state, lastSlipAt: null });
}

/** Wipe the forest back to an empty state. */
export async function devResetForest(): Promise<void> {
    await saveForest(emptyForest());
}

// ---------------------------------------------------------
// Display helpers (pure — used by the Forest tab)
// ---------------------------------------------------------

export type DisplayTree = Tree & {
    displayMinutes: number;
    stageIndex: number;
    stageKey: StageKey;
    progress: number;
};

export type ForestDisplay = {
    trees: DisplayTree[];
    multiplier: number;
    recoveryRemainingMin: number;
    totalCleanMinutes: number;
    matureCount: number;
    slipsToday: number;
};

export function computeDisplay(state: ForestState, now = Date.now()): ForestDisplay {
    const pending = integrateGrowthMinutes(state.lastSlipAt, state.lastSettledAt, now);
    const trees: DisplayTree[] = state.trees.map((t) => {
        const displayMinutes = t.cleanMinutes + pending;
        const stageIndex = stageIndexForMinutes(displayMinutes);
        return {
            ...t,
            displayMinutes,
            stageIndex,
            stageKey: GROWTH_STAGES[stageIndex].key,
            progress: stageProgress(displayMinutes),
        };
    });
    const multiplier = currentMultiplier(state, now);
    const recoveryRemainingMin = state.lastSlipAt
        ? Math.max(0, SLIP_RECOVERY_MINUTES - (now - state.lastSlipAt) / MIN)
        : 0;
    return {
        trees,
        multiplier,
        recoveryRemainingMin,
        totalCleanMinutes: trees.reduce((s, t) => s + t.displayMinutes, 0),
        matureCount: trees.filter((t) => t.stageIndex === GROWTH_STAGES.length - 1).length,
        slipsToday: new Date(now).toDateString() === state.slipsDayKey ? state.slipsToday : 0,
    };
}
