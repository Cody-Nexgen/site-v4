/** Colour conversions for the vault/tag colour picker. Everything it saves is a "#rrggbb" string. */

export type Rgb = { r: number; g: number; b: number };
export type Hsv = { h: number; s: number; v: number };

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** "#abc", "abc", "#aabbcc" or "aabbcc" -> "#aabbcc"; anything else -> null. */
export function normalizeHex(input: string): string | null {
    const raw = input.trim().replace(/^#/, '').toLowerCase();
    if (/^[0-9a-f]{3}$/.test(raw)) return `#${raw.split('').map((c) => c + c).join('')}`;
    if (/^[0-9a-f]{6}$/.test(raw)) return `#${raw}`;
    return null;
}

export function hexToRgb(hex: string): Rgb | null {
    const clean = normalizeHex(hex);
    if (!clean) return null;
    const n = parseInt(clean.slice(1), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }: Rgb): string {
    return `#${[r, g, b].map((c) => clamp(Math.round(c), 0, 255).toString(16).padStart(2, '0')).join('')}`;
}

/** "rgb(1, 2, 3)", "1,2,3" or "1 2 3" -> Rgb; anything else -> null. */
export function parseRgb(input: string): Rgb | null {
    const match = input.trim().match(/^(?:rgba?\()?\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*(?:[,/]\s*[\d.]+%?\s*)?\)?$/i);
    if (!match) return null;
    const [r, g, b] = match.slice(1, 4).map(Number) as [number, number, number];
    return r <= 255 && g <= 255 && b <= 255 ? { r, g, b } : null;
}

/** h 0–360, s and v 0–1. */
export function rgbToHsv({ r, g, b }: Rgb): Hsv {
    const [rn, gn, bn] = [r / 255, g / 255, b / 255];
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const d = max - min;
    let h = 0;
    if (d) {
        if (max === rn) h = ((gn - bn) / d) % 6;
        else if (max === gn) h = (bn - rn) / d + 2;
        else h = (rn - gn) / d + 4;
        h *= 60;
        if (h < 0) h += 360;
    }
    return { h, s: max ? d / max : 0, v: max };
}

export function hsvToRgb({ h, s, v }: Hsv): Rgb {
    const hh = ((h % 360) + 360) % 360;
    const c = v * s;
    const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
    const m = v - c;
    const [r, g, b] =
        hh < 60 ? [c, x, 0] : hh < 120 ? [x, c, 0] : hh < 180 ? [0, c, x] : hh < 240 ? [0, x, c] : hh < 300 ? [x, 0, c] : [c, 0, x];
    return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

export function hexToHsv(hex: string): Hsv | null {
    const rgb = hexToRgb(hex);
    return rgb ? rgbToHsv(rgb) : null;
}

export function hsvToHex(hsv: Hsv): string {
    return rgbToHex(hsvToRgb(hsv));
}
