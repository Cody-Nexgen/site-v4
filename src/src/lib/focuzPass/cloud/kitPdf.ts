/**
 * The FocuzPass Emergency Kit (and the separate recovery key sheet) as real one-page PDFs, made
 * on this device with no library: the standard PDF fonts, vector shapes, a vector setup QR code
 * and a clickable sign-in link. The master password and FocuzNow password are lines to write on by
 * hand: FocuzNow never knows them, and printing them next to the Security Key would put every
 * secret in one file.
 */

import { encodeQr } from '../transfer/qr';

/* ── Tiny PDF writer ───────────────────────────────────────────────────── */

const PAGE_W = 612; // US Letter, points
const PAGE_H = 792;

type FontId = 'regular' | 'bold' | 'mono';
const FONT_NAME: Record<FontId, string> = { regular: 'F1', bold: 'F2', mono: 'F3' };

// Standard 14 font metrics (AFM widths, 1/1000 em) for WinAnsi 32…126.
const HELVETICA = [
    278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
    1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
    333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];
const HELVETICA_BOLD = [
    278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
    975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
    333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];
// A few typographic characters, by WinAnsi code.
const EXTRA: Record<string, { code: number; regular: number; bold: number }> = {
    '’': { code: 0x92, regular: 222, bold: 278 }, // ’
    '•': { code: 0x95, regular: 350, bold: 350 }, // •
    '–': { code: 0x96, regular: 556, bold: 556 }, // –
    '·': { code: 0xb7, regular: 278, bold: 278 }, // ·
};

function charWidth(ch: string, font: FontId): number {
    if (font === 'mono') return 600;
    const extra = EXTRA[ch];
    if (extra) return font === 'bold' ? extra.bold : extra.regular;
    const code = ch.charCodeAt(0);
    const table = font === 'bold' ? HELVETICA_BOLD : HELVETICA;
    return code >= 32 && code <= 126 ? table[code - 32]! : 556;
}

function textWidth(text: string, font: FontId, size: number, tracking = 0): number {
    return [...text].reduce((w, ch) => w + (charWidth(ch, font) * size) / 1000 + tracking, 0) - (text ? tracking : 0);
}

/** A PDF string literal: printable ASCII as is, the few typographic characters by code, anything else as '?'. */
function pdfString(text: string): string {
    let out = '';
    for (const ch of text) {
        const extra = EXTRA[ch];
        if (extra) out += `\\${extra.code.toString(8)}`;
        else if (ch === '(' || ch === ')' || ch === '\\') out += `\\${ch}`;
        else out += ch.charCodeAt(0) >= 32 && ch.charCodeAt(0) <= 126 ? ch : '?';
    }
    return `(${out})`;
}

function rgb(hex: string): string {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => (c / 255).toFixed(3)).join(' ');
}

const f = (n: number) => (Math.round(n * 100) / 100).toString();

class Page {
    readonly ops: string[] = [];
    readonly links: { x: number; y: number; w: number; h: number; uri: string }[] = [];

    /** Top-left coordinates in, PDF (bottom-left) coordinates out. */
    private y(top: number) {
        return PAGE_H - top;
    }

    rect(x: number, top: number, w: number, h: number, fill: string, radius = 0, stroke?: string) {
        const b = this.y(top + h);
        const r = Math.min(radius, w / 2, h / 2);
        this.ops.push(`${rgb(fill)} rg`);
        if (stroke) this.ops.push(`${rgb(stroke)} RG 0.75 w`);
        if (!r) {
            this.ops.push(`${f(x)} ${f(b)} ${f(w)} ${f(h)} re`);
        } else {
            const k = r * 0.5523;
            const t = b + h;
            this.ops.push(
                `${f(x + r)} ${f(b)} m`,
                `${f(x + w - r)} ${f(b)} l ${f(x + w - r + k)} ${f(b)} ${f(x + w)} ${f(b + r - k)} ${f(x + w)} ${f(b + r)} c`,
                `${f(x + w)} ${f(t - r)} l ${f(x + w)} ${f(t - r + k)} ${f(x + w - r + k)} ${f(t)} ${f(x + w - r)} ${f(t)} c`,
                `${f(x + r)} ${f(t)} l ${f(x + r - k)} ${f(t)} ${f(x)} ${f(t - r + k)} ${f(x)} ${f(t - r)} c`,
                `${f(x)} ${f(b + r)} l ${f(x)} ${f(b + r - k)} ${f(x + r - k)} ${f(b)} ${f(x + r)} ${f(b)} c h`,
            );
        }
        this.ops.push(stroke ? 'B' : 'f');
    }

    line(x1: number, top: number, x2: number, color: string, width = 0.75) {
        this.ops.push(`${rgb(color)} RG ${f(width)} w ${f(x1)} ${f(this.y(top))} m ${f(x2)} ${f(this.y(top))} l S`);
    }

    /** `top` is the text's baseline, measured from the top of the page. */
    text(x: number, top: number, text: string, font: FontId, size: number, color: string, tracking = 0) {
        this.ops.push(`BT /${FONT_NAME[font]} ${f(size)} Tf ${f(tracking)} Tc ${rgb(color)} rg ${f(x)} ${f(this.y(top))} Td ${pdfString(text)} Tj ET`);
    }

    textRight(right: number, top: number, text: string, font: FontId, size: number, color: string, tracking = 0) {
        this.text(right - textWidth(text, font, size, tracking), top, text, font, size, color, tracking);
    }

    /** Bold text drawn as an outline only (render mode 1, reset afterwards: it outlives ET). */
    outlineText(x: number, top: number, text: string, size: number, color: string, width: number) {
        this.ops.push(`BT /${FONT_NAME.bold} ${f(size)} Tf 0 Tc 1 Tr ${rgb(color)} RG ${f(width)} w ${f(x)} ${f(this.y(top))} Td ${pdfString(text)} Tj 0 Tr ET`);
    }

    /** Wrapped paragraph; returns the baseline of the last line. */
    paragraph(x: number, top: number, width: number, text: string, font: FontId, size: number, color: string, leading: number): number {
        const words = text.split(' ');
        let line = '';
        let baseline = top;
        for (const word of words) {
            const next = line ? `${line} ${word}` : word;
            if (line && textWidth(next, font, size) > width) {
                this.text(x, baseline, line, font, size, color);
                baseline += leading;
                line = word;
            } else {
                line = next;
            }
        }
        if (line) this.text(x, baseline, line, font, size, color);
        return baseline;
    }

    link(x: number, top: number, w: number, h: number, uri: string) {
        this.links.push({ x, y: this.y(top + h), w, h, uri });
    }

    /** A QR code filling `size`, its 4-module quiet zone included. */
    qr(x: number, top: number, size: number, payload: string, color: string) {
        const matrix = encodeQr(payload, 'M');
        const cell = size / (matrix.size + 8);
        const cells: string[] = [];
        for (let row = 0; row < matrix.size; row++) {
            for (let col = 0; col < matrix.size; col++) {
                const cx = x + (col + 4) * cell;
                const cy = top + (row + 4) * cell;
                if (matrix.dark(col, row)) cells.push(`${f(cx)} ${f(this.y(cy + cell))} ${f(cell + 0.02)} ${f(cell + 0.02)} re`);
            }
        }
        this.ops.push(`${rgb(color)} rg`, ...cells, 'f');
    }
}

function writePdf(page: Page, title: string): Uint8Array {
    const content = page.ops.join('\n');
    const annots = page.links.map(
        (l) => `<< /Type /Annot /Subtype /Link /Rect [${f(l.x)} ${f(l.y)} ${f(l.x + l.w)} ${f(l.y + l.h)}] /Border [0 0 0] /A << /S /URI /URI ${pdfString(l.uri)} >> >>`,
    );
    const now = new Date();
    const stamp = `D:${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}${String(now.getUTCHours()).padStart(2, '0')}${String(now.getUTCMinutes()).padStart(2, '0')}00Z`;
    const objects = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 5 0 R /F2 6 0 R /F3 7 0 R >> >> /Contents 4 0 R${annots.length ? ` /Annots [${annots.map((_, i) => `${9 + i} 0 R`).join(' ')}]` : ''} >>`,
        `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
        '<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>',
        `<< /Title ${pdfString(title)} /Producer (FocuzPass) /CreationDate (${stamp}) >>`,
        ...annots,
    ];
    let out = '%PDF-1.4\n%âãÏÓ\n';
    const offsets: number[] = [];
    objects.forEach((body, i) => {
        offsets.push(out.length);
        out += `${i + 1} 0 obj\n${body}\nendobj\n`;
    });
    const xref = out.length;
    out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
    out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 8 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    // Everything above is one byte per character (Latin-1), so string offsets are byte offsets.
    return Uint8Array.from(out, (ch) => ch.charCodeAt(0) & 0xff);
}

/* ── The kit ───────────────────────────────────────────────────────────── */

// FocuzNow's own colours: the near-black and warm off-white of the Beam Z mark, with warm greys.
const INK = '#0a0b0d';
const MUTED = '#66625b';
const FAINT = '#9b968c';
const RULE = '#dcd7cd';
const PAPER = '#f4f2ee';
const WHITE = '#ffffff';

const LEFT = 54;
const RIGHT = PAGE_W - LEFT;
const WIDTH = RIGHT - LEFT;
const COL = LEFT + 84; // steps: the numeral, then everything else from here
const COL_W = RIGHT - COL;
const VALUE = COL + 108; // a row's value or writing line, after its label
const SIGN_IN = 'https://focuznow.com';

const niceDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

/** The Beam Z mark from focuznow.com: its 64-unit design, scaled to `size`. */
function mark(page: Page, x: number, top: number, size: number) {
    const s = size / 64;
    page.rect(x, top, size, size, INK, 16 * s);
    const z: [number, number][] = [
        [20, 17.8], [47.2, 17.8], [47.2, 22.2], [22.8, 41.8], [47.2, 41.8],
        [44, 46.2], [16.8, 46.2], [16.8, 41.8], [29.2, 22.2], [16.8, 22.2],
    ];
    const [first, ...rest] = z.map(([px, py]) => `${f(x + px * s)} ${f(PAGE_H - (top + py * s))}`);
    page.ops.push(`${rgb(PAPER)} rg ${rgb(PAPER)} RG ${f(1.6 * s)} w 1 j`, `${first} m ${rest.map((p) => `${p} l`).join(' ')} h B`, '0 j');
}

function header(page: Page, title: string, email: string | undefined, created: Date) {
    mark(page, LEFT, 50, 26);
    page.text(LEFT + 35, 67.5, 'FocuzNow', 'bold', 12.5, INK, -0.2);
    page.textRight(RIGHT, 67.5, 'Private. Keep it safe.', 'regular', 9, FAINT);
    page.text(LEFT - 2, 128, title, 'bold', 38, INK, -1.1);
    page.text(LEFT, 150, `For ${email || 'your FocuzNow account'} · ${niceDate(created)}`, 'regular', 10.5, MUTED);
    page.line(LEFT, 170, RIGHT, INK, 1.5);
}

function footer(page: Page, note: string) {
    page.line(LEFT, 742, RIGHT, RULE);
    page.text(LEFT, 757, note, 'regular', 8, FAINT);
    page.textRight(RIGHT, 757, 'focuznow.com', 'bold', 8, MUTED);
}

/** A numbered step: an outlined numeral in the margin, the title where the content starts. */
function step(page: Page, top: number, n: number, title: string) {
    page.outlineText(LEFT, top + 31, String(n), 34, INK, 0.8); // cap top level with the title's
    page.text(COL, top + 16, title, 'bold', 13.5, INK, -0.2);
}

/** A form row: the label, then the printed value, or a line to write on. Returns the row's bottom. */
function row(page: Page, top: number, label: string, value?: { text: string; color?: string }): number {
    const height = value ? 28 : 40;
    const baseline = top + height - 9;
    page.text(COL, baseline, label, 'regular', 9.5, MUTED);
    if (value) page.text(VALUE, baseline, value.text, 'regular', 11, value.color ?? INK);
    page.line(COL, top + height, RIGHT, RULE, 0.6);
    if (!value) page.line(VALUE, top + height, RIGHT, INK, 0.9);
    return top + height;
}

/**
 * The key in large monospace, one box per group as on screen, so it's easy to copy by hand. It's a
 * single run of text with nothing between the characters, dashes included: gaps are what make PDF
 * viewers copy "A 1 7 Q …", so every viewer copies this as written.
 */
function keyCells(page: Page, x: number, top: number, width: number, formatted: string): number {
    const size = Math.min(20, width / formatted.length / 0.6);
    const advance = size * 0.6; // every Courier character
    const height = 30;
    const pad = 3;
    const groups = formatted.split('-');
    let start = 0;
    for (const group of groups) {
        page.rect(x + start * advance - pad, top, group.length * advance + pad * 2, height, PAPER, 4, RULE);
        start += group.length + 1;
    }
    // The dashes are in the text (so they copy) but not painted (render mode 3): the gaps between
    // the boxes show the groups. One BT, no repositioning, so it stays a single run.
    const run = groups.map((group) => `${pdfString(group)} Tj`).join(' 3 Tr (-) Tj 0 Tr ');
    page.ops.push(`BT /${FONT_NAME.mono} ${f(size)} Tf 0 Tc 0 Tr ${rgb(INK)} rg ${f(x)} ${f(PAGE_H - (top + height / 2 + size * 0.3))} Td ${run} ET`);
    return top + height;
}

const KEY_NOTE = 'Only letters and digits: 0 is zero and 1 is one.';

export type KitDetails = { email?: string; secretKey: string; secretKeyCanonical: string; secretKeyId: string; created: Date };

/** What the setup code holds: the sign-in email and Security Key, for a new device to read in one go. */
export function setupCodePayload(kit: { email?: string; secretKeyCanonical: string; secretKeyId: string }): string {
    return `FZKIT1${JSON.stringify({ e: kit.email ?? '', k: kit.secretKeyCanonical, i: kit.secretKeyId })}`;
}

export function emergencyKitPdf(kit: KitDetails): Uint8Array {
    const page = new Page();
    header(page, 'Emergency Kit', kit.email, kit.created);
    page.paragraph(
        LEFT,
        194,
        WIDTH,
        'Everything you need to get back into FocuzPass on a new device. Print it, write your two passwords in by hand, and keep it somewhere only you can reach.',
        'regular',
        10.5,
        MUTED,
        15,
    );

    // 1. The FocuzNow account
    let top = 236;
    step(page, top, 1, 'Sign in to FocuzNow');
    let y = row(page, top + 26, 'Website', { text: 'focuznow.com' });
    page.link(VALUE, y - 26, textWidth('focuznow.com', 'regular', 11), 22, SIGN_IN);
    y = row(page, y, 'Email', { text: kit.email || '' });
    y = row(page, y, 'FocuzNow password');
    page.text(VALUE, y + 13, 'If you sign in with Google instead, write "Google".', 'regular', 8.5, FAINT);

    // 2. The vault
    top = y + 40;
    page.line(LEFT, top - 16, RIGHT, RULE, 0.6);
    step(page, top, 2, 'Unlock FocuzPass');
    page.text(COL, top + 44, 'Security Key', 'regular', 9.5, MUTED);
    page.textRight(RIGHT, top + 44, `Key ID ${kit.secretKeyId}`, 'regular', 8.5, FAINT);
    y = keyCells(page, COL, top + 52, COL_W, kit.secretKey);
    page.text(COL, y + 14, KEY_NOTE, 'regular', 8.5, FAINT);
    y = row(page, y + 20, 'Master password');
    page.text(VALUE, y + 13, 'FocuzNow never has it, so nobody can reset it for you.', 'regular', 8.5, FAINT);

    // 3. A new device
    top = y + 40;
    page.line(LEFT, top - 16, RIGHT, RULE, 0.6);
    step(page, top, 3, 'Set up a new device');
    const qrSize = 104;
    const qrX = RIGHT - qrSize;
    page.rect(qrX, top, qrSize, qrSize, WHITE, 8, RULE);
    page.qr(qrX, top, qrSize, setupCodePayload(kit), INK);
    const textW = qrX - 24 - COL;
    const last = page.paragraph(
        COL,
        top + 38,
        textW,
        'Scan this code with FocuzPass on the new device to fill in your email and Security Key. You’ll still type both passwords.',
        'regular',
        10,
        MUTED,
        14.5,
    );
    page.paragraph(COL, last + 20, textW, 'It contains your Security Key, so keep it as private as the rest of this page.', 'regular', 8.5, FAINT, 12);

    footer(page, 'FocuzNow will never ask you for this page, your master password or your Security Key.');
    return writePdf(page, 'FocuzPass Emergency Kit');
}

export function recoveryKeyPdf(kit: { email?: string; recoveryKey: string; created: Date }): Uint8Array {
    const page = new Page();
    header(page, 'Recovery Key', kit.email, kit.created);
    page.paragraph(
        LEFT,
        194,
        WIDTH,
        'If you forget your master password, this key lets you choose a new one without losing anything in your vault.',
        'regular',
        10.5,
        MUTED,
        15,
    );

    // One key, no steps: it gets the full width.
    page.text(LEFT, 244, 'Recovery key', 'regular', 9.5, MUTED);
    const y = keyCells(page, LEFT, 252, WIDTH, kit.recoveryKey);
    page.text(LEFT, y + 14, KEY_NOTE, 'regular', 8.5, FAINT);

    const warnTop = y + 50;
    page.line(LEFT, warnTop - 16, RIGHT, RULE, 0.6);
    page.rect(LEFT, warnTop, 3, 50, INK);
    page.text(LEFT + 16, warnTop + 12, 'Keep it away from your Emergency Kit.', 'bold', 11, INK);
    page.paragraph(
        LEFT + 16,
        warnTop + 30,
        WIDTH - 16,
        'With your FocuzNow sign-in it opens your vault without your master password, so anyone who finds both papers together has everything.',
        'regular',
        9.5,
        MUTED,
        13.5,
    );

    footer(page, 'FocuzNow will never ask you for your recovery key.');
    return writePdf(page, 'FocuzPass Recovery Key');
}

export function downloadPdf(fileName: string, bytes: Uint8Array) {
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
