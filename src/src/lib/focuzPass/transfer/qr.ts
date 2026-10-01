/**
 * A small QR Code (Model 2) encoder: byte mode, error correction L or M, versions 1 to 10
 * (up to ~270 bytes), which covers a transfer link with room to spare. Follows ISO/IEC 18004;
 * structured like Project Nayuki's reference encoder. No dependency.
 */

type Ecc = 'L' | 'M';

// Indexed by version (1..10); index 0 unused.
const ECC_PER_BLOCK: Record<Ecc, number[]> = {
    L: [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18],
    M: [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26],
};
const BLOCKS: Record<Ecc, number[]> = {
    L: [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4],
    M: [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5],
};
const FORMAT_ECC_BITS: Record<Ecc, number> = { L: 1, M: 0 };
const MAX_VERSION = 10;

function rawDataModules(ver: number): number {
    let result = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
        const numAlign = Math.floor(ver / 7) + 2;
        result -= (25 * numAlign - 10) * numAlign - 55;
        if (ver >= 7) result -= 36;
    }
    return result;
}

function dataCodewords(ver: number, ecc: Ecc): number {
    return Math.floor(rawDataModules(ver) / 8) - ECC_PER_BLOCK[ecc][ver] * BLOCKS[ecc][ver];
}

/* ── Reed-Solomon over GF(256), polynomial 0x11D ──────────────────────── */

function gfMul(x: number, y: number): number {
    let z = 0;
    for (let i = 7; i >= 0; i--) {
        z = (z << 1) ^ ((z >>> 7) * 0x11d);
        z ^= ((y >>> i) & 1) * x;
    }
    return z;
}

function rsDivisor(degree: number): number[] {
    const result = new Array<number>(degree).fill(0);
    result[degree - 1] = 1;
    let root = 1;
    for (let i = 0; i < degree; i++) {
        for (let j = 0; j < result.length; j++) {
            result[j] = gfMul(result[j], root);
            if (j + 1 < result.length) result[j] ^= result[j + 1];
        }
        root = gfMul(root, 0x02);
    }
    return result;
}

function rsRemainder(data: number[], divisor: number[]): number[] {
    const result = divisor.map(() => 0);
    for (const b of data) {
        const factor = b ^ (result.shift() as number);
        result.push(0);
        divisor.forEach((coef, i) => (result[i] ^= gfMul(coef, factor)));
    }
    return result;
}

/* ── encoding ──────────────────────────────────────────────────────────── */

function encodeData(bytes: Uint8Array, ecc: Ecc): { ver: number; codewords: number[] } {
    let ver = 1;
    for (; ver <= MAX_VERSION; ver++) {
        const countBits = ver <= 9 ? 8 : 16;
        if (4 + countBits + bytes.length * 8 <= dataCodewords(ver, ecc) * 8) break;
    }
    if (ver > MAX_VERSION) throw new Error('Too much data for this QR encoder');
    const bits: number[] = [];
    const push = (value: number, len: number) => {
        for (let i = len - 1; i >= 0; i--) bits.push((value >>> i) & 1);
    };
    push(0b0100, 4); // byte mode
    push(bytes.length, ver <= 9 ? 8 : 16);
    for (const b of bytes) push(b, 8);
    const capacity = dataCodewords(ver, ecc) * 8;
    push(0, Math.min(4, capacity - bits.length)); // terminator
    push(0, (8 - (bits.length % 8)) % 8);
    for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) push(pad, 8);
    const data: number[] = [];
    for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((acc, bit) => (acc << 1) | bit, 0));

    // Split into blocks, add error correction, interleave.
    const numBlocks = BLOCKS[ecc][ver];
    const eccLen = ECC_PER_BLOCK[ecc][ver];
    const raw = Math.floor(rawDataModules(ver) / 8);
    const numShort = numBlocks - (raw % numBlocks);
    const shortLen = Math.floor(raw / numBlocks);
    const divisor = rsDivisor(eccLen);
    const blocks: number[][] = [];
    for (let i = 0, k = 0; i < numBlocks; i++) {
        const dat = data.slice(k, k + shortLen - eccLen + (i < numShort ? 0 : 1));
        k += dat.length;
        const block = [...dat];
        if (i < numShort) block.push(0);
        blocks.push(block.concat(rsRemainder(dat, divisor)));
    }
    const codewords: number[] = [];
    for (let i = 0; i < blocks[0].length; i++) {
        blocks.forEach((block, j) => {
            if (i !== shortLen - eccLen || j >= numShort) codewords.push(block[i]);
        });
    }
    return { ver, codewords };
}

/* ── the symbol ────────────────────────────────────────────────────────── */

export type QrMatrix = { size: number; dark: (x: number, y: number) => boolean };

export function encodeQr(text: string, ecc: Ecc = 'M'): QrMatrix {
    const { ver, codewords } = encodeData(new TextEncoder().encode(text), ecc);
    const size = ver * 4 + 17;
    const modules: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
    const fn: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
    const set = (x: number, y: number, dark: boolean) => {
        modules[y][x] = dark;
        fn[y][x] = true;
    };

    // Timing patterns.
    for (let i = 0; i < size; i++) {
        set(6, i, i % 2 === 0);
        set(i, 6, i % 2 === 0);
    }
    // Finder patterns with separators.
    for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
        for (let dy = -4; dy <= 4; dy++) {
            for (let dx = -4; dx <= 4; dx++) {
                const x = cx + dx;
                const y = cy + dy;
                const dist = Math.max(Math.abs(dx), Math.abs(dy));
                if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, dist !== 2 && dist !== 4);
            }
        }
    }
    // Alignment patterns.
    if (ver > 1) {
        const numAlign = Math.floor(ver / 7) + 2;
        const step = Math.floor((ver * 8 + numAlign * 3 + 5) / (numAlign * 4 - 4)) * 2;
        const pos = [6];
        for (let p = size - 7; pos.length < numAlign; p -= step) pos.splice(1, 0, p);
        for (let i = 0; i < numAlign; i++) {
            for (let j = 0; j < numAlign; j++) {
                if ((i === 0 && j === 0) || (i === 0 && j === numAlign - 1) || (i === numAlign - 1 && j === 0)) continue;
                for (let dy = -2; dy <= 2; dy++) {
                    for (let dx = -2; dx <= 2; dx++) set(pos[i] + dx, pos[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
                }
            }
        }
    }
    const drawFormat = (mask: number) => {
        const data = (FORMAT_ECC_BITS[ecc] << 3) | mask;
        let rem = data;
        for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
        const bits = ((data << 10) | rem) ^ 0x5412;
        const bit = (i: number) => ((bits >>> i) & 1) !== 0;
        for (let i = 0; i <= 5; i++) set(8, i, bit(i));
        set(8, 7, bit(6));
        set(8, 8, bit(7));
        set(7, 8, bit(8));
        for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
        for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
        for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
        set(8, size - 8, true);
    };
    drawFormat(0); // reserve the format areas
    if (ver >= 7) {
        let rem = ver;
        for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
        const bits = (ver << 12) | rem;
        for (let i = 0; i < 18; i++) {
            const dark = ((bits >>> i) & 1) !== 0;
            const a = size - 11 + (i % 3);
            const b = Math.floor(i / 3);
            set(a, b, dark);
            set(b, a, dark);
        }
    }
    // Data, in the zigzag.
    let i = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
        if (right === 6) right = 5;
        for (let vert = 0; vert < size; vert++) {
            for (let j = 0; j < 2; j++) {
                const x = right - j;
                const upward = ((right + 1) & 2) === 0;
                const y = upward ? size - 1 - vert : vert;
                if (!fn[y][x] && i < codewords.length * 8) {
                    modules[y][x] = ((codewords[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0;
                    i++;
                }
            }
        }
    }

    const maskHit = (mask: number, x: number, y: number) => {
        switch (mask) {
            case 0: return (x + y) % 2 === 0;
            case 1: return y % 2 === 0;
            case 2: return x % 3 === 0;
            case 3: return (x + y) % 3 === 0;
            case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
            case 5: return ((x * y) % 2) + ((x * y) % 3) === 0;
            case 6: return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
            default: return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
        }
    };
    const applyMask = (mask: number) => {
        for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && maskHit(mask, x, y)) modules[y][x] = !modules[y][x];
    };
    // Penalty: long runs, 2×2 blocks and dark/light balance (the finder-lookalike rule is skipped).
    const penalty = () => {
        let score = 0;
        for (let a = 0; a < size; a++) {
            for (const horizontal of [true, false]) {
                let run = 1;
                for (let b = 1; b <= size; b++) {
                    const same = b < size && (horizontal ? modules[a][b] === modules[a][b - 1] : modules[b][a] === modules[b - 1][a]);
                    if (same) run++;
                    else {
                        if (run >= 5) score += run - 2;
                        run = 1;
                    }
                }
            }
        }
        let dark = 0;
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                if (modules[y][x]) dark++;
                if (x < size - 1 && y < size - 1) {
                    const c = modules[y][x];
                    if (c === modules[y][x + 1] && c === modules[y + 1][x] && c === modules[y + 1][x + 1]) score += 3;
                }
            }
        }
        score += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
        return score;
    };
    let best = 0;
    let bestScore = Infinity;
    for (let mask = 0; mask < 8; mask++) {
        applyMask(mask);
        drawFormat(mask);
        const score = penalty();
        if (score < bestScore) {
            best = mask;
            bestScore = score;
        }
        applyMask(mask); // undo (XOR)
    }
    applyMask(best);
    drawFormat(best);
    return { size, dark: (x, y) => modules[y][x] };
}

/** An SVG path of the dark modules, with a 4-module quiet zone; viewBox is 0 0 (size+8) (size+8). */
export function qrPath(matrix: QrMatrix): { d: string; viewBox: number } {
    let d = '';
    for (let y = 0; y < matrix.size; y++) {
        for (let x = 0; x < matrix.size; x++) if (matrix.dark(x, y)) d += `M${x + 4} ${y + 4}h1v1h-1z`;
    }
    return { d, viewBox: matrix.size + 8 };
}
