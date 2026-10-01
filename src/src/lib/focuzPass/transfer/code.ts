/**
 * Transfer codes and the keys derived from them. The code (typed in, or read from the QR) is
 * the only shared secret between the two devices; the relay only ever sees a hash of it.
 *
 *   channel  SHA-256 of the code        the Realtime channel both devices meet on
 *   auth     HKDF(code, "auth")         HMAC on every signalling message
 *   payload  HKDF(code, "payload")      AES-GCM around the (already password-encrypted) package
 */

/** Crockford base32: no I, L, O or U, so a code survives being read out or typed by hand. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const CODE_LENGTH = 10;
export const CODE_TTL_MS = 10 * 60 * 1000;
/** The page that takes a code on a device that has the extension. */
export const TRANSFER_URL = 'https://focuznow.com/pwcode';

export function newTransferCode(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
    return Array.from(bytes, (b) => ALPHABET[b & 31]).join('');
}

/** "k7q4m-z8tr1", "K7Q4M Z8TR1", "k7q4mz8tri" (I for 1) → "K7Q4MZ8TR1"; null if it can't be a code. */
export function normalizeTransferCode(input: string): string | null {
    const cleaned = input
        .toUpperCase()
        .replace(/[\s-]/g, '')
        .replace(/O/g, '0')
        .replace(/[IL]/g, '1');
    if (cleaned.length !== CODE_LENGTH) return null;
    for (const ch of cleaned) if (!ALPHABET.includes(ch)) return null;
    return cleaned;
}

export function formatTransferCode(code: string): string {
    return `${code.slice(0, 5)}-${code.slice(5)}`;
}

/** The code from a pasted /pwcode link (fragment or ?c=), or from the text itself. */
export function codeFromText(text: string): string | null {
    const trimmed = text.trim();
    try {
        const url = new URL(trimmed);
        return normalizeTransferCode(url.hash.replace(/^#/, '') || url.searchParams.get('c') || '');
    } catch {
        return normalizeTransferCode(trimmed);
    }
}

export function transferLink(code: string): string {
    // The code rides in the fragment, which browsers never send to the server.
    return `${TRANSFER_URL}#${code}`;
}

const enc = new TextEncoder();

function toHex(bytes: ArrayBuffer): string {
    return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
}

export type TransferKeys = {
    channel: string;
    auth: CryptoKey;
    payload: CryptoKey;
};

export async function deriveTransferKeys(code: string): Promise<TransferKeys> {
    const channel = `fzp-xfer-${toHex(await crypto.subtle.digest('SHA-256', enc.encode(`focuzpass-transfer-channel:${code}`))).slice(0, 32)}`;
    const base = await crypto.subtle.importKey('raw', enc.encode(code), 'HKDF', false, ['deriveKey']);
    const hkdf = (info: string) => ({ name: 'HKDF', hash: 'SHA-256', salt: enc.encode('focuzpass-transfer-v1'), info: enc.encode(info) });
    const auth = await crypto.subtle.deriveKey(hkdf('auth'), base, { name: 'HMAC', hash: 'SHA-256', length: 256 }, false, ['sign', 'verify']);
    const payload = await crypto.subtle.deriveKey(hkdf('payload'), base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    return { channel, auth, payload };
}

/* ── signed signalling messages ────────────────────────────────────────── */

export type SignedMessage = { kind: string; from: 'sender' | 'receiver'; body: unknown; at: number; mac: string };

function macInput(m: Omit<SignedMessage, 'mac'>): Uint8Array {
    return enc.encode(`${m.kind}\n${m.from}\n${m.at}\n${JSON.stringify(m.body)}`);
}

export async function signMessage(keys: TransferKeys, m: Omit<SignedMessage, 'mac' | 'at'>): Promise<SignedMessage> {
    const unsigned = { ...m, at: Date.now() };
    const mac = toHex(await crypto.subtle.sign('HMAC', keys.auth, macInput(unsigned) as BufferSource));
    return { ...unsigned, mac };
}

/** True only for a message made with the same code, from the other side, and recent. */
export async function verifyMessage(keys: TransferKeys, m: unknown, expectFrom: 'sender' | 'receiver'): Promise<boolean> {
    const msg = m as SignedMessage;
    if (!msg || typeof msg.mac !== 'string' || msg.from !== expectFrom || typeof msg.at !== 'number') return false;
    if (Math.abs(Date.now() - msg.at) > CODE_TTL_MS) return false;
    const pairs = msg.mac.match(/../g);
    if (!pairs || msg.mac.length !== 64) return false;
    const mac = new Uint8Array(pairs.map((h) => parseInt(h, 16)));
    return crypto.subtle.verify('HMAC', keys.auth, mac as BufferSource, macInput(msg) as BufferSource);
}

/* ── payload encryption (on top of the vault's own) ───────────────────── */

export async function sealPayload(keys: TransferKeys, text: string): Promise<Uint8Array> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, keys.payload, enc.encode(text)));
    const out = new Uint8Array(iv.length + ct.length);
    out.set(iv);
    out.set(ct, iv.length);
    return out;
}

export async function openPayload(keys: TransferKeys, sealed: Uint8Array): Promise<string> {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: sealed.subarray(0, 12) as BufferSource }, keys.payload, sealed.subarray(12) as BufferSource);
    return new TextDecoder().decode(plain);
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
    return toHex(await crypto.subtle.digest('SHA-256', bytes as BufferSource));
}
