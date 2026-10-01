/**
 * FocuzPass as a passkey provider: the authenticator side of WebAuthn Level 3, in WebCrypto
 * (docs/focuzpass-cloud-plan.md, "Passkeys"). ES256 (P-256) keys made on the device, "none"
 * attestation, discoverable credentials, sign count 0 (normal for synced passkeys), and flags that
 * say only what's true. Options and responses use the WebAuthn JSON forms (base64url), so they
 * pass through extension messaging unchanged.
 *
 * Where the origin comes from matters most: callers pass the origin the browser reported for the
 * requesting frame, never one a page claims, and the rpId is checked against it here.
 */

export const FOCUZPASS_AAGUID = '6d3f2a8c-4b1e-4f7a-9c2d-5e8b7a1f0c34';
export const ES256 = -7;

const encoder = new TextEncoder();

/* ── base64url ─────────────────────────────────────────────────────────── */

export function toBase64Url(bytes: Uint8Array): string {
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(value: string): Uint8Array {
    if (typeof value !== 'string' || !/^[A-Za-z0-9_-]*$/.test(value)) throw new TypeError('Not base64url');
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
    return Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0));
}

/* ── CBOR (just what attestation objects and COSE keys need) ───────────── */

type Cbor = number | string | Uint8Array | Cbor[] | Map<number | string, Cbor>;

function cborHead(major: number, length: number): number[] {
    if (length < 24) return [(major << 5) | length];
    if (length < 0x100) return [(major << 5) | 24, length];
    if (length < 0x10000) return [(major << 5) | 25, length >> 8, length & 0xff];
    return [(major << 5) | 26, (length >>> 24) & 0xff, (length >> 16) & 0xff, (length >> 8) & 0xff, length & 0xff];
}

export function cborEncode(value: Cbor): Uint8Array {
    const out: number[] = [];
    const write = (v: Cbor) => {
        if (typeof v === 'number') {
            if (!Number.isInteger(v)) throw new TypeError('CBOR: integers only');
            out.push(...(v >= 0 ? cborHead(0, v) : cborHead(1, -1 - v)));
        } else if (typeof v === 'string') {
            const bytes = encoder.encode(v);
            out.push(...cborHead(3, bytes.length), ...bytes);
        } else if (v instanceof Uint8Array) {
            out.push(...cborHead(2, v.length), ...v);
        } else if (Array.isArray(v)) {
            out.push(...cborHead(4, v.length));
            v.forEach(write);
        } else {
            // Keys in CTAP2 canonical order: shorter encodings first, then bytewise.
            const entries = [...v.entries()].map(([k, val]) => [cborEncode(k), val] as const);
            entries.sort(([a], [b]) => a.length - b.length || compareBytes(a, b));
            out.push(...cborHead(5, entries.length));
            for (const [key, val] of entries) {
                out.push(...key);
                write(val);
            }
        }
    };
    write(value);
    return Uint8Array.from(out);
}

function compareBytes(a: Uint8Array, b: Uint8Array): number {
    for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i]! - b[i]!;
    return a.length - b.length;
}

/* ── Keys and signatures ───────────────────────────────────────────────── */

export async function newPasskeyKeyPair(): Promise<{ privateKey: JsonWebKey; publicKey: JsonWebKey }> {
    const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
    const privateKey = await crypto.subtle.exportKey('jwk', pair.privateKey);
    return { privateKey, publicKey: { kty: privateKey.kty, crv: privateKey.crv, x: privateKey.x, y: privateKey.y, ext: true, key_ops: ['verify'] } };
}

/** The COSE_Key for an ES256 public key: kty EC2, alg -7, crv P-256, x, y. */
export function coseKey(publicKey: JsonWebKey): Uint8Array {
    return cborEncode(new Map<number, Cbor>([[1, 2], [3, ES256], [-1, 1], [-2, fromBase64Url(publicKey.x!)], [-3, fromBase64Url(publicKey.y!)]]));
}

export async function spkiOf(publicKey: JsonWebKey): Promise<Uint8Array> {
    const key = await crypto.subtle.importKey('jwk', publicKey, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['verify']);
    return new Uint8Array(await crypto.subtle.exportKey('spki', key));
}

/** WebCrypto signs ECDSA as r‖s; WebAuthn wants an ASN.1 DER SEQUENCE of two INTEGERs. */
export function rawToDer(raw: Uint8Array): Uint8Array {
    const integer = (bytes: Uint8Array) => {
        let start = 0;
        while (start < bytes.length - 1 && bytes[start] === 0) start++;
        const trimmed = bytes.slice(start);
        const padded = trimmed[0]! & 0x80 ? Uint8Array.from([0, ...trimmed]) : trimmed;
        return [0x02, padded.length, ...padded];
    };
    const body = [...integer(raw.slice(0, 32)), ...integer(raw.slice(32))];
    return Uint8Array.from([0x30, body.length, ...body]);
}

export function derToRaw(der: Uint8Array): Uint8Array {
    if (der[0] !== 0x30) throw new TypeError('Not a DER signature');
    const read = (offset: number) => {
        if (der[offset] !== 0x02) throw new TypeError('Not a DER integer');
        const length = der[offset + 1]!;
        const bytes = der.slice(offset + 2, offset + 2 + length);
        const trimmed = bytes[0] === 0 ? bytes.slice(1) : bytes;
        const out = new Uint8Array(32);
        out.set(trimmed, 32 - trimmed.length);
        return { out, next: offset + 2 + length };
    };
    const r = read(2);
    const s = read(r.next);
    return Uint8Array.from([...r.out, ...s.out]);
}

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
    return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as BufferSource));
}

async function sign(privateKey: JsonWebKey, data: Uint8Array): Promise<Uint8Array> {
    const key = await crypto.subtle.importKey('jwk', privateKey, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
    const raw = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, data as BufferSource));
    return rawToDer(raw);
}

/* ── Who may ask for what ──────────────────────────────────────────────── */

/**
 * Hosts shared by many unrelated sites. The browser checks rpIds against the whole Public Suffix
 * List; this provider refuses these common ones and any single-label id, which covers the cases
 * that matter (an rpId only ever gets credentials made for that exact rpId).
 */
const SHARED_SUFFIXES = new Set([
    'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'com.au', 'net.au', 'co.nz', 'co.jp', 'co.in', 'co.za', 'com.br', 'com.cn', 'com.mx', 'com.tr',
    'github.io', 'gitlab.io', 'herokuapp.com', 'vercel.app', 'netlify.app', 'pages.dev', 'workers.dev', 'web.app', 'firebaseapp.com',
    'appspot.com', 'blogspot.com', 'azurewebsites.net', 'cloudfront.net', 'glitch.me', 'repl.co', 'fly.dev', 'onrender.com',
    'amazonaws.com', 'ngrok.io', 'ngrok-free.app', 'trycloudflare.com', 'surge.sh', 'wordpress.com', 'myshopify.com',
]);

// Both fields on both branches: the website compiles this without strict null checks, where `!check.ok` doesn't narrow.
export type RpCheck = { ok: true; rpId: string; reason?: never } | { ok: false; reason: string; rpId?: never };

/** A WebAuthn rpId is the page's host or a parent domain of it, on a secure origin. */
export function checkRpId(origin: string, requested?: string): RpCheck {
    let url: URL;
    try {
        url = new URL(origin);
    } catch {
        return { ok: false, reason: 'No origin' };
    }
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    const localhost = host === 'localhost' || host.endsWith('.localhost');
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && localhost)) return { ok: false, reason: 'Passkeys need a secure page' };
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(':') || host.startsWith('[')) return { ok: false, reason: 'Passkeys need a domain name' };
    const rpId = (requested ?? host).toLowerCase().replace(/\.$/, '');
    if (rpId !== host && !host.endsWith(`.${rpId}`)) return { ok: false, reason: 'This site asked for another site\'s passkey' };
    if ((!rpId.includes('.') && rpId !== 'localhost') || SHARED_SUFFIXES.has(rpId)) return { ok: false, reason: 'That isn\'t a site passkeys can belong to' };
    return { ok: true, rpId };
}

/* ── The WebAuthn JSON forms ───────────────────────────────────────────── */

export type CredentialDescriptorJSON = { id: string; type: 'public-key'; transports?: string[] };

export type CreationOptionsJSON = {
    rp: { id?: string; name?: string };
    user: { id: string; name: string; displayName?: string };
    challenge: string;
    pubKeyCredParams: { type: 'public-key'; alg: number }[];
    timeout?: number;
    excludeCredentials?: CredentialDescriptorJSON[];
    authenticatorSelection?: { residentKey?: string; requireResidentKey?: boolean; userVerification?: string; authenticatorAttachment?: string };
    attestation?: string;
    extensions?: Record<string, unknown>;
};

export type RequestOptionsJSON = {
    challenge: string;
    timeout?: number;
    rpId?: string;
    allowCredentials?: CredentialDescriptorJSON[];
    userVerification?: string;
    extensions?: Record<string, unknown>;
};

export type RegistrationResponseJSON = {
    id: string;
    rawId: string;
    type: 'public-key';
    authenticatorAttachment: 'platform';
    clientExtensionResults: Record<string, unknown>;
    response: {
        clientDataJSON: string;
        attestationObject: string;
        authenticatorData: string;
        transports: string[];
        publicKeyAlgorithm: number;
        publicKey: string;
    };
};

export type AuthenticationResponseJSON = {
    id: string;
    rawId: string;
    type: 'public-key';
    authenticatorAttachment: 'platform';
    clientExtensionResults: Record<string, unknown>;
    response: { clientDataJSON: string; authenticatorData: string; signature: string; userHandle: string };
};

/** What FocuzPass keeps for a passkey. The private key only ever sits inside the encrypted vault. */
export type PasskeySecret = {
    v: 1;
    credentialId: string;
    rpId: string;
    userHandle: string;
    userName: string;
    userDisplayName: string;
    privateKey: JsonWebKey;
    publicKey: JsonWebKey;
    algorithm: typeof ES256;
    createdAt: string;
    /** The PRF extension's per-passkey secret (base64url, 32 bytes). Passkeys made before PRF don't have one. */
    prfSeed?: string;
};

export class PasskeyError extends Error {
    constructor(readonly name: 'NotAllowedError' | 'InvalidStateError' | 'SecurityError' | 'NotSupportedError' | 'TypeError', message: string) {
        super(message);
    }
}

/* ── Authenticator data ────────────────────────────────────────────────── */

const FLAG = { UP: 0x01, UV: 0x04, BE: 0x08, BS: 0x10, AT: 0x40 };

export type Flags = { userVerified: boolean; backedUp: boolean };

async function authenticatorData(rpId: string, flags: Flags, attested?: { credentialId: Uint8Array; publicKey: JsonWebKey }): Promise<Uint8Array> {
    // Backup eligible always: FocuzPass can sync any passkey. Backed up only while Cloud sync is on.
    let bits = FLAG.UP | FLAG.BE;
    if (flags.userVerified) bits |= FLAG.UV;
    if (flags.backedUp) bits |= FLAG.BS;
    const parts: number[] = [...(await sha256(encoder.encode(rpId))), 0, 0, 0, 0, 0];
    if (attested) {
        parts[32] = bits | FLAG.AT;
        const aaguid = FOCUZPASS_AAGUID.replace(/-/g, '').match(/../g)!.map((h) => parseInt(h, 16));
        const idLength = attested.credentialId.length;
        parts.push(...aaguid, idLength >> 8, idLength & 0xff, ...attested.credentialId, ...coseKey(attested.publicKey));
    } else {
        parts[32] = bits;
    }
    return Uint8Array.from(parts);
}

/**
 * Client data, in the member order WebAuthn's own serialization uses. From an iframe on another
 * site, crossOrigin is true and topOrigin says whose page it's in.
 */
function clientData(type: 'webauthn.create' | 'webauthn.get', challenge: string, origin: string, topOrigin?: string): Uint8Array {
    const cross = Boolean(topOrigin && topOrigin !== origin);
    return encoder.encode(JSON.stringify(cross ? { type, challenge, origin, crossOrigin: true, topOrigin } : { type, challenge, origin, crossOrigin: false }));
}

/* ── PRF (a site-specific secret from a passkey, for sites that encrypt with passkeys) ── */

type PrfInputs = { first?: unknown; second?: unknown };
type PrfExtension = { eval?: PrfInputs; evalByCredential?: Record<string, PrfInputs> };

/** WebAuthn's PRF: HMAC-SHA-256 of the passkey's secret over SHA-256("WebAuthn PRF" ‖ 0x00 ‖ input). */
export async function prfOutput(seed: Uint8Array, input: Uint8Array): Promise<Uint8Array> {
    const salt = await sha256(Uint8Array.from([...encoder.encode('WebAuthn PRF'), 0, ...input]));
    const key = await crypto.subtle.importKey('raw', seed as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return new Uint8Array(await crypto.subtle.sign('HMAC', key, salt as BufferSource));
}

async function prfResults(seed: string | undefined, inputs: PrfInputs | undefined): Promise<{ first: string; second?: string } | undefined> {
    if (!seed || !inputs || typeof inputs.first !== 'string') return undefined;
    const raw = fromBase64Url(seed);
    const first = toBase64Url(await prfOutput(raw, fromBase64Url(inputs.first)));
    const second = typeof inputs.second === 'string' ? toBase64Url(await prfOutput(raw, fromBase64Url(inputs.second))) : undefined;
    return second ? { first, second } : { first };
}

function checkChallenge(challenge: unknown): string {
    if (typeof challenge !== 'string' || fromBase64Url(challenge).length < 16) throw new PasskeyError('TypeError', 'The site sent a challenge that is too short');
    return challenge;
}

/* ── Make a passkey ────────────────────────────────────────────────────── */

export async function makeCredential(
    options: CreationOptionsJSON,
    origin: string,
    flags: Flags,
    topOrigin?: string,
): Promise<{ response: RegistrationResponseJSON; secret: PasskeySecret; rpName: string }> {
    const check = checkRpId(origin, options?.rp?.id);
    if (!check.ok) throw new PasskeyError('SecurityError', check.reason);
    if (!options.pubKeyCredParams?.some((param) => param.type === 'public-key' && param.alg === ES256)) {
        throw new PasskeyError('NotSupportedError', 'This site doesn\'t accept the kind of passkey FocuzPass makes');
    }
    const userHandle = fromBase64Url(options.user?.id ?? '');
    if (userHandle.length < 1 || userHandle.length > 64) throw new PasskeyError('TypeError', 'The site sent an invalid account id');
    const challenge = checkChallenge(options.challenge);

    const credentialId = crypto.getRandomValues(new Uint8Array(16));
    const { privateKey, publicKey } = await newPasskeyKeyPair();
    const authData = await authenticatorData(check.rpId, flags, { credentialId, publicKey });
    const attestationObject = cborEncode(new Map<string, Cbor>([['fmt', 'none'], ['attStmt', new Map()], ['authData', authData]]));
    const id = toBase64Url(credentialId);
    const prfSeed = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
    const extensions: Record<string, unknown> = {};
    if (options.extensions?.credProps) extensions.credProps = { rk: true };
    const prf = options.extensions?.prf as PrfExtension | undefined;
    if (prf) {
        const results = await prfResults(prfSeed, prf.eval);
        extensions.prf = results ? { enabled: true, results } : { enabled: true };
    }
    const secret: PasskeySecret = {
        v: 1,
        credentialId: id,
        rpId: check.rpId,
        userHandle: toBase64Url(userHandle),
        userName: String(options.user.name ?? '').slice(0, 320),
        userDisplayName: String(options.user.displayName ?? options.user.name ?? '').slice(0, 320),
        privateKey,
        publicKey,
        algorithm: ES256,
        createdAt: new Date().toISOString(),
        prfSeed,
    };
    return {
        secret,
        rpName: String(options.rp?.name || check.rpId).slice(0, 200),
        response: {
            id,
            rawId: id,
            type: 'public-key',
            authenticatorAttachment: 'platform',
            clientExtensionResults: extensions,
            response: {
                clientDataJSON: toBase64Url(clientData('webauthn.create', challenge, origin, topOrigin)),
                attestationObject: toBase64Url(attestationObject),
                authenticatorData: toBase64Url(authData),
                transports: ['hybrid', 'internal'],
                publicKeyAlgorithm: ES256,
                publicKey: toBase64Url(await spkiOf(publicKey)),
            },
        },
    };
}

/* ── Sign in with one ──────────────────────────────────────────────────── */

export async function getAssertion(options: RequestOptionsJSON, origin: string, secret: PasskeySecret, flags: Flags, topOrigin?: string): Promise<AuthenticationResponseJSON> {
    const check = checkRpId(origin, options?.rpId);
    if (!check.ok) throw new PasskeyError('SecurityError', check.reason);
    if (secret.rpId !== check.rpId) throw new PasskeyError('SecurityError', 'That passkey belongs to another site');
    if (options.allowCredentials?.length && !options.allowCredentials.some((c) => c.id === secret.credentialId)) {
        throw new PasskeyError('NotAllowedError', 'The site didn\'t ask for that passkey');
    }
    const challenge = checkChallenge(options.challenge);
    const authData = await authenticatorData(check.rpId, flags);
    const clientDataJSON = clientData('webauthn.get', challenge, origin, topOrigin);
    const signature = await sign(secret.privateKey, Uint8Array.from([...authData, ...(await sha256(clientDataJSON))]));
    const extensions: Record<string, unknown> = {};
    const prf = options.extensions?.prf as PrfExtension | undefined;
    if (prf) {
        const results = await prfResults(secret.prfSeed, prf.evalByCredential?.[secret.credentialId] ?? prf.eval);
        if (results) extensions.prf = { results };
    }
    return {
        id: secret.credentialId,
        rawId: secret.credentialId,
        type: 'public-key',
        authenticatorAttachment: 'platform',
        clientExtensionResults: extensions,
        response: {
            clientDataJSON: toBase64Url(clientDataJSON),
            authenticatorData: toBase64Url(authData),
            signature: toBase64Url(signature),
            userHandle: secret.userHandle,
        },
    };
}

/** A stored passkey, checked before it's used (it came out of the vault, but a bad one shouldn't crash anything). */
export function readPasskeySecret(value: unknown): PasskeySecret | null {
    const s = value as Partial<PasskeySecret> | null;
    if (!s || s.v !== 1 || s.algorithm !== ES256) return null;
    if (typeof s.credentialId !== 'string' || typeof s.rpId !== 'string' || typeof s.userHandle !== 'string') return null;
    if (!s.privateKey?.d || !s.publicKey?.x || !s.publicKey?.y) return null;
    if (s.prfSeed !== undefined && (typeof s.prfSeed !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(s.prfSeed))) return null;
    return s as PasskeySecret;
}
