/**
 * Accent system (§1.1 / §4). Default is monochrome (white in dark, near-black in
 * light). Colored accents are the same OKLCH L/C at a different hue so perceived
 * weight is identical across choices; CSS switches to the hue ramp when
 * <html data-accent="hue"> is set.
 */
export type AccentId = 'mono' | 'azure' | 'violet' | 'emerald' | 'amber' | 'rose' | 'custom';

export const ACCENTS: { id: AccentId; label: string; hue: number }[] = [
    { id: 'mono', label: 'Mono', hue: -1 },
    { id: 'azure', label: 'Blue', hue: 255 },
    { id: 'violet', label: 'Purple', hue: 295 },
    { id: 'emerald', label: 'Emerald', hue: 160 },
    { id: 'amber', label: 'Amber', hue: 80 },
    { id: 'rose', label: 'Rose', hue: 15 },
    { id: 'custom', label: 'Custom', hue: 255 },
];

export const DEFAULT_ACCENT: AccentId = 'mono';
export const CUSTOM_ACCENT_HUE_KEY = 'focuznow-accent-hue';

/** Hue for an accent id; undefined means monochrome. */
export function accentHueFor(id: string | undefined, customHue?: number | null): number | undefined {
    if (id === 'custom') return clampHue(customHue ?? readCustomHue());
    const found = ACCENTS.find((a) => a.id === id);
    return found && found.hue >= 0 ? found.hue : undefined;
}

export function accentSwatch(hue: number): string {
    return hue < 0 ? 'oklch(0.96 0 0)' : `oklch(0.68 0.15 ${hue})`;
}

export function clampHue(hue: number): number {
    if (!Number.isFinite(hue)) return 255;
    return ((hue % 360) + 360) % 360;
}

/** Apply an accent hue on :root. undefined → monochrome default. */
export function applyAccentHue(hue: number | undefined) {
    const root = document.documentElement;
    if (hue === undefined) {
        root.style.removeProperty('--fz-accent-hue');
        root.removeAttribute('data-accent');
    } else {
        root.style.setProperty('--fz-accent-hue', String(clampHue(hue)));
        root.setAttribute('data-accent', 'hue');
    }
}

export function readCustomHue(): number {
    try {
        const raw = window.localStorage.getItem(CUSTOM_ACCENT_HUE_KEY);
        const parsed = raw === null ? NaN : Number(raw);
        return Number.isFinite(parsed) ? parsed : 255;
    } catch {
        return 255;
    }
}

export function writeCustomHue(hue: number) {
    try {
        window.localStorage.setItem(CUSTOM_ACCENT_HUE_KEY, String(clampHue(hue)));
    } catch {
        /* ignore */
    }
}
