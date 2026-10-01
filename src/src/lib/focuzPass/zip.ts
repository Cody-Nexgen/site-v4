/**
 * Minimal ZIP reader for password-manager exports (1Password .1pux, Dashlane and Proton Pass
 * .zip). Reads the central directory and inflates entries with the platform's
 * DecompressionStream, so no dependency. Stored (0) and deflate (8) entries only; no ZIP64
 * and no encryption, which none of these exports use.
 */

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
    const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
}

export function isZip(bytes: Uint8Array): boolean {
    return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

/** Every file in the archive, by path. Directories are left out. */
export async function readZip(bytes: Uint8Array): Promise<Map<string, Uint8Array>> {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    // The end-of-central-directory record sits in the last 22 bytes plus an optional comment (< 64 KB).
    let eocd = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) {
        if (view.getUint32(i, true) === EOCD_SIGNATURE) {
            eocd = i;
            break;
        }
    }
    if (eocd < 0) throw new Error('This file isn\'t a valid .zip archive.');

    const count = view.getUint16(eocd + 10, true);
    let offset = view.getUint32(eocd + 16, true);
    const decoder = new TextDecoder();
    const files = new Map<string, Uint8Array>();

    for (let n = 0; n < count; n++) {
        if (view.getUint32(offset, true) !== CENTRAL_SIGNATURE) throw new Error('The .zip archive is damaged.');
        const method = view.getUint16(offset + 10, true);
        const compressedSize = view.getUint32(offset + 20, true);
        const nameLength = view.getUint16(offset + 28, true);
        const extraLength = view.getUint16(offset + 30, true);
        const commentLength = view.getUint16(offset + 32, true);
        const localOffset = view.getUint32(offset + 42, true);
        const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
        offset += 46 + nameLength + extraLength + commentLength;
        if (name.endsWith('/')) continue;

        if (view.getUint32(localOffset, true) !== LOCAL_SIGNATURE) throw new Error('The .zip archive is damaged.');
        const localName = view.getUint16(localOffset + 26, true);
        const localExtra = view.getUint16(localOffset + 28, true);
        const start = localOffset + 30 + localName + localExtra;
        const raw = bytes.subarray(start, start + compressedSize);
        if (method === 0) files.set(name, raw);
        else if (method === 8) files.set(name, await inflateRaw(raw));
        else throw new Error('This .zip uses a compression method FocuzPass can\'t read.');
    }
    return files;
}
