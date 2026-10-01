#!/usr/bin/env node
/**
 * APCA contrast check for the --fz-* token ramp (plan §1.1).
 * Parses :root and html[data-dashboard-theme="light"] blocks in
 * src/styles/focuzDesign.css and verifies each text tier on panel / raised /
 * overlay in both modes meets its Lc target.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const cssPath = join(dirname(fileURLToPath(import.meta.url)), '../src/styles/focuzDesign.css');
const css = readFileSync(cssPath, 'utf8');

/* ---------- parse ---------- */
function block(selectorRe) {
    const m = css.match(selectorRe);
    return m ? m[1] : '';
}
const darkBlock = block(/:root\s*\{([^}]*)\}/);
const lightBlock = block(/html\[data-dashboard-theme="light"\]\s*\{([^}]*)\}/);

function vars(src) {
    const out = {};
    for (const m of src.matchAll(/(--fz-[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
    return out;
}
const dark = vars(darkBlock);
const light = { ...dark, ...vars(lightBlock) };

/* ---------- oklch → sRGB ---------- */
function oklchToSrgb(l, c, h, alpha = 1) {
    const hr = (h * Math.PI) / 180;
    const a = c * Math.cos(hr);
    const b = c * Math.sin(hr);
    // OKLab → LMS
    const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = l - 0.0894841775 * a - 1.2914855480 * b;
    const L = l_ ** 3, M = m_ ** 3, S = s_ ** 3;
    const rLin = +4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S;
    const gLin = -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S;
    const bLin = -0.0041960863 * L - 0.7034186147 * M + 1.7076147010 * S;
    const gam = (x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055);
    return { r: gam(rLin), g: gam(gLin), b: gam(bLin), a: alpha };
}

function parseColor(raw, varsMap) {
    raw = raw.replace(/var\((--fz-[\w-]+)\)/g, (_, n) => varsMap[n] ?? 'oklch(0 0 0)');
    const m = raw.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+%?))?\s*\)/);
    if (m) {
        const alpha = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
        return oklchToSrgb(parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]), alpha);
    }
    const hex = raw.match(/#([0-9a-f]{6})/i);
    if (hex) {
        const n = parseInt(hex[1], 16);
        return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255, a: 1 };
    }
    return null;
}

/* Composite fg over bg if fg has alpha */
function composite(fg, bg) {
    const a = fg.a;
    return { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a), a: 1 };
}

/* ---------- APCA (W3 public formula, 0.0.98G) ---------- */
function lumY({ r, g, b }) {
    const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126729 * lin(r) + 0.7151522 * lin(g) + 0.0721750 * lin(b);
}
function apcaLc(fgColor, bgColor) {
    let yTxt = lumY(fgColor);
    let yBg = lumY(bgColor);
    const blackThresh = 0.022, blackClamp = 1.414, scale = 1.14;
    const loClip = 0.1, deltaYmin = 0.0005;
    if (Math.abs(yBg - yTxt) < deltaYmin) return 0;
    let sapc;
    if (yBg > yTxt) {
        sapc = (yBg ** 0.56 - yTxt ** 0.57) * scale;
        return sapc < loClip ? 0 : (sapc - 0.027) * 100;
    }
    sapc = (yBg ** 0.65 - yTxt ** 0.62) * scale;
    return sapc > -loClip ? 0 : (sapc + 0.027) * 100;
}

/* ---------- targets ---------- */
const TIERS = [
    ['--fz-text-1', 90],
    ['--fz-text-2', 75],
    ['--fz-text-3', 60],
    ['--fz-text-4', 45],
];
const SURFACES = ['--fz-bg-panel', '--fz-bg-raised', '--fz-bg-overlay'];

let failures = 0;
for (const [mode, map] of [['dark', dark], ['light', light]]) {
    for (const surf of SURFACES) {
        const bg = parseColor(map[surf], map);
        for (const [tier, target] of TIERS) {
            const fg = parseColor(map[tier], map);
            const lc = Math.abs(apcaLc(composite(fg, bg), bg));
            const ok = lc >= target;
            if (!ok) failures++;
            console.log(
                `${ok ? 'PASS' : 'FAIL'} ${mode.padEnd(5)} ${tier} on ${surf.padEnd(16)} Lc ${lc.toFixed(1)} (target ${target})`,
            );
        }
    }
}
console.log(failures === 0 ? '\nAll APCA checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
