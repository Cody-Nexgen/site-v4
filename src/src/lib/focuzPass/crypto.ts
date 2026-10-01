/** AES-256-GCM + PBKDF2-SHA-256 vault crypto. Never log plaintext secrets. */

import {
    FOCUZPASS_KDF,
    FOCUZPASS_PBKDF2_ITERATIONS,
    FOCUZPASS_VERIFIER_PLAINTEXT,
    type EncryptedPayload,
} from './types';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export function bytesToBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]!);
    return btoa(binary);
}

export function base64ToBytes(value: string): Uint8Array {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

export function randomBytes(length: number): Uint8Array {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return bytes;
}

async function deriveVaultKeyInternal(
    masterPassword: string,
    salt: Uint8Array,
    iterations: number,
    extractable: boolean,
): Promise<CryptoKey> {
    const baseKey = await crypto.subtle.importKey(
        'raw',
        textEncoder.encode(masterPassword),
        'PBKDF2',
        false,
        ['deriveKey'],
    );
    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt as BufferSource,
            iterations,
            hash: 'SHA-256',
        },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        extractable,
        ['encrypt', 'decrypt'],
    );
}

export function deriveVaultKey(
    masterPassword: string,
    salt: Uint8Array,
    iterations = FOCUZPASS_PBKDF2_ITERATIONS,
): Promise<CryptoKey> {
    return deriveVaultKeyInternal(masterPassword, salt, iterations, false);
}

/**
 * Same PBKDF2 parameters as deriveVaultKey, but extractable so the raw bytes can be
 * written to chrome.storage.session once per unlock and re-imported as a
 * non-extractable key after a service-worker restart (§5.2). The extractable key
 * must never leave this module — callers re-import via `importRawVaultKey`.
 */
export function deriveVaultKeyExtractable(
    masterPassword: string,
    salt: Uint8Array,
    iterations = FOCUZPASS_PBKDF2_ITERATIONS,
): Promise<CryptoKey> {
    return deriveVaultKeyInternal(masterPassword, salt, iterations, true);
}

export async function exportRawVaultKey(key: CryptoKey): Promise<Uint8Array> {
    return new Uint8Array(await crypto.subtle.exportKey('raw', key));
}

export function importRawVaultKey(raw: Uint8Array): Promise<CryptoKey> {
    return crypto.subtle.importKey(
        'raw',
        raw as BufferSource,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'],
    );
}

/* ---- Locked-save inbox: ECDH P-256 + HKDF-SHA-256 + AES-256-GCM (§5.3) ---- */

export type InboxEnvelope = {
    v: 1;
    epk: JsonWebKey;
    salt: string;
    iv: string;
    ct: string;
};

export async function generateInboxKeyPair(): Promise<{ publicJwk: JsonWebKey; privateJwk: JsonWebKey }> {
    const pair = await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveBits'],
    );
    return {
        publicJwk: await crypto.subtle.exportKey('jwk', pair.publicKey),
        privateJwk: await crypto.subtle.exportKey('jwk', pair.privateKey),
    };
}

function importEcdhPublicKey(jwk: JsonWebKey, usages: KeyUsage[] = []): Promise<CryptoKey> {
    return crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, false, usages);
}

async function inboxAesKey(sharedBits: ArrayBuffer, salt: Uint8Array): Promise<CryptoKey> {
    const hkdfKey = await crypto.subtle.importKey('raw', sharedBits, 'HKDF', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
        { name: 'HKDF', hash: 'SHA-256', salt: salt as BufferSource, info: textEncoder.encode('focuzpass.inbox.v1') },
        hkdfKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'],
    );
}

/** Encrypt a pending-login payload to the vault's public inbox key while locked. */
export async function encryptForInbox(publicJwk: JsonWebKey, plaintext: string): Promise<InboxEnvelope> {
    const ephemeral = await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveBits'],
    );
    const publicKey = await importEcdhPublicKey(publicJwk);
    const shared = await crypto.subtle.deriveBits(
        { name: 'ECDH', public: publicKey },
        ephemeral.privateKey,
        256,
    );
    const salt = randomBytes(16);
    const key = await inboxAesKey(shared, salt);
    const payload = await encryptAesGcm(key, plaintext);
    return {
        v: 1,
        epk: await crypto.subtle.exportKey('jwk', ephemeral.publicKey),
        salt: bytesToBase64(salt),
        iv: payload.iv,
        ct: payload.ct,
    };
}

/** Decrypt one inbox envelope with the vault's private inbox key (inside the vault doc). */
export async function decryptInboxEntry(privateJwk: JsonWebKey, envelope: InboxEnvelope): Promise<string> {
    if (!envelope || envelope.v !== 1 || !envelope.epk) throw new Error('Unsupported inbox entry');
    const privateKey = await crypto.subtle.importKey(
        'jwk',
        privateJwk,
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        ['deriveBits'],
    );
    const ephemeralPublic = await importEcdhPublicKey(envelope.epk);
    const shared = await crypto.subtle.deriveBits(
        { name: 'ECDH', public: ephemeralPublic },
        privateKey,
        256,
    );
    const key = await inboxAesKey(shared, base64ToBytes(envelope.salt));
    return decryptAesGcm(key, { iv: envelope.iv, ct: envelope.ct });
}

export async function encryptAesGcm(key: CryptoKey, plaintext: string): Promise<EncryptedPayload> {
    const iv = randomBytes(12);
    const cipherBuf = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv as BufferSource },
        key,
        textEncoder.encode(plaintext),
    );
    return {
        iv: bytesToBase64(iv),
        ct: bytesToBase64(new Uint8Array(cipherBuf)),
    };
}

export async function decryptAesGcm(key: CryptoKey, payload: EncryptedPayload): Promise<string> {
    const iv = base64ToBytes(payload.iv);
    const ct = base64ToBytes(payload.ct);
    const plainBuf = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv as BufferSource },
        key,
        ct as BufferSource,
    );
    return textDecoder.decode(plainBuf);
}

/*
 * Key hierarchy. Items are encrypted with a random vault key; the master password only derives
 * the key that wraps it. Changing the master password re-wraps one key instead of re-encrypting
 * the vault, and the same wrapped key can later be synced or rotated.
 */

/** Binds the local vault key's wrapping to its purpose, so no other ciphertext can stand in for it. */
const VAULT_KEY_CONTEXT = 'focuzpass:vault-key:v1';

/** A new random 256-bit key (vault key, account key), as raw bytes. */
export function newVaultKeyBytes(): Uint8Array {
    return randomBytes(32);
}

/**
 * The key derived from the master password (PBKDF2, its own random salt). It only ever wraps
 * and unwraps the vault key; nothing else is encrypted with it.
 */
export function deriveWrappingKey(masterPassword: string, salt: Uint8Array, iterations = FOCUZPASS_PBKDF2_ITERATIONS): Promise<CryptoKey> {
    return deriveVaultKeyInternal(masterPassword, salt, iterations, false);
}

/**
 * Wraps a raw 256-bit key with AES-GCM. `context` goes in as associated data, so a wrapped key
 * only opens for the purpose (and account, and key id) it was made for.
 */
export async function wrapKeyBytes(wrappingKey: CryptoKey, raw: Uint8Array, context: string): Promise<EncryptedPayload> {
    const iv = randomBytes(12);
    const ct = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv as BufferSource, additionalData: textEncoder.encode(context) as BufferSource },
        wrappingKey,
        raw as BufferSource,
    );
    return { iv: bytesToBase64(iv), ct: bytesToBase64(new Uint8Array(ct)) };
}

/** The raw key; throws when the wrapping key or context is wrong, or the data was altered. */
export async function unwrapKeyBytes(wrappingKey: CryptoKey, wrapped: EncryptedPayload, context: string): Promise<Uint8Array> {
    const raw = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: base64ToBytes(wrapped.iv) as BufferSource, additionalData: textEncoder.encode(context) as BufferSource },
        wrappingKey,
        base64ToBytes(wrapped.ct) as BufferSource,
    );
    const bytes = new Uint8Array(raw);
    if (bytes.length !== 32) throw new Error('Key has the wrong length');
    return bytes;
}

export function wrapVaultKey(wrappingKey: CryptoKey, raw: Uint8Array): Promise<EncryptedPayload> {
    return wrapKeyBytes(wrappingKey, raw, VAULT_KEY_CONTEXT);
}

/** The raw vault key; throws when the wrapping key is wrong (wrong master password) or the data was altered. */
export function unwrapVaultKey(wrappingKey: CryptoKey, wrapped: EncryptedPayload): Promise<Uint8Array> {
    return unwrapKeyBytes(wrappingKey, wrapped, VAULT_KEY_CONTEXT);
}

export async function createVerifier(key: CryptoKey): Promise<EncryptedPayload> {
    return encryptAesGcm(key, FOCUZPASS_VERIFIER_PLAINTEXT);
}

export async function verifyMasterPassword(key: CryptoKey, verifier: EncryptedPayload): Promise<boolean> {
    try {
        const plain = await decryptAesGcm(key, verifier);
        return plain === FOCUZPASS_VERIFIER_PLAINTEXT;
    } catch {
        return false;
    }
}

export { FOCUZPASS_KDF, FOCUZPASS_PBKDF2_ITERATIONS };
