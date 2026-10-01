/**
 * FocuzPass Cloud keys (docs/focuzpass-cloud-plan.md, "Keys").
 *
 *   master password ─PBKDF2─┐
 *                           ├─ HKDF → unlock key ─wraps→ account key ─wraps→ vault key ─seals→ records
 *   Security Key ─HKDF───────┘                          ↑
 *                                   recovery key ─wraps─┘ (optional)
 *
 * The server stores only the wrapped keys and sealed records. A database copy plus the master
 * password opens nothing without the Security Key, and the Security Key opens nothing without the
 * master password. WebCrypto only.
 */

import { base64ToBytes, bytesToBase64, randomBytes, unwrapKeyBytes, wrapKeyBytes } from '../crypto';
import type { EncryptedPayload } from '../types';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/* ── Security Key and recovery key ─────────────────────────────────────── */

/** Crockford base32: no I, L, O or U, so it reads back without mix-ups. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const KEY_CHARS = 26; // 130 random bits

export type KeyKind = 'secret' | 'recovery';
const PREFIX: Record<KeyKind, string> = { secret: 'A1', recovery: 'R1' };

function randomChars(count: number): string {
    // 256 is a multiple of 32, so masking keeps every character equally likely.
    return Array.from(randomBytes(count), (byte) => ALPHABET[byte & 31]).join('');
}

/** A new Security Key (A1…) or recovery key (R1…), in its canonical form: prefix + 26 characters. */
export function newAccountKey(kind: KeyKind): string {
    return PREFIX[kind] + randomChars(KEY_CHARS);
}

/** A short random label for a Security Key (shown in the Emergency Kit, stored on the server). Not derived from the key. */
export function newSecretKeyId(): string {
    return randomChars(6);
}

/** How people see it: A1-7QX2KD-9MPWZ-4RTB8-HN3CF-V6YGJ. */
export function formatAccountKey(canonical: string): string {
    const body = canonical.slice(2);
    return [canonical.slice(0, 2), body.slice(0, 6), body.slice(6, 11), body.slice(11, 16), body.slice(16, 21), body.slice(21, 26)].join('-');
}

/** Typed or pasted back in: forgiving about case, spaces, dashes and the usual look-alikes. */
export function parseAccountKey(input: string, kind: KeyKind): string | null {
    const cleaned = input
        .toUpperCase()
        .replace(/[\s-]+/g, '')
        .replace(/O/g, '0')
        .replace(/[IL]/g, '1');
    const prefix = PREFIX[kind];
    if (!cleaned.startsWith(prefix)) return null;
    const body = cleaned.slice(prefix.length);
    if (body.length !== KEY_CHARS || [...body].some((ch) => !ALPHABET.includes(ch))) return null;
    return prefix + body;
}

/* ── Two secrets → the unlock key ──────────────────────────────────────── */

export type AccountKdf = { salt: string; iterations: number };

async function hkdfBits(ikm: Uint8Array, salt: Uint8Array, info: string): Promise<Uint8Array> {
    const key = await crypto.subtle.importKey('raw', ikm as BufferSource, 'HKDF', false, ['deriveBits']);
    return new Uint8Array(
        await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: salt as BufferSource, info: encoder.encode(info) as BufferSource }, key, 256),
    );
}

async function passwordBits(masterPassword: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
    const key = await crypto.subtle.importKey('raw', encoder.encode(masterPassword) as BufferSource, 'PBKDF2', false, ['deriveBits']);
    return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' }, key, 256));
}

/**
 * The key that unwraps the account key. Both secrets go in (PBKDF2 of the master password,
 * HKDF of the Security Key, combined and run through HKDF), bound to the account's user id.
 */
export async function deriveUnlockKey(masterPassword: string, secretKey: string, userId: string, kdf: AccountKdf): Promise<CryptoKey> {
    const salt = base64ToBytes(kdf.salt);
    const fromPassword = await passwordBits(masterPassword, salt, kdf.iterations);
    const fromSecretKey = await hkdfBits(encoder.encode(secretKey), encoder.encode(userId), 'focuzpass:secret-key:v1');
    const combined = fromPassword.map((byte, i) => byte ^ fromSecretKey[i]!);
    const ikm = await crypto.subtle.importKey('raw', combined as BufferSource, 'HKDF', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
        { name: 'HKDF', hash: 'SHA-256', salt: salt as BufferSource, info: encoder.encode(`focuzpass:unlock-key:v1|${userId}`) as BufferSource },
        ikm,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'],
    );
}

/** The key a recovery key turns into: it wraps the account key a second time. */
export async function deriveRecoveryUnlockKey(recoveryKey: string, userId: string): Promise<CryptoKey> {
    const bits = await hkdfBits(encoder.encode(recoveryKey), encoder.encode(userId), 'focuzpass:recovery-key:v1');
    return crypto.subtle.importKey('raw', bits as BufferSource, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export function newAccountKdf(iterations: number): AccountKdf {
    return { salt: bytesToBase64(randomBytes(16)), iterations };
}

const accountKeyContext = (userId: string) => `focuzpass:account-key:v1|${userId}`;
const recoveryContext = (userId: string) => `focuzpass:account-key:recovery:v1|${userId}`;
const vaultKeyContext = (userId: string, keyId: string, keyVersion: number) => `focuzpass:vault-key:cloud:v1|${userId}|${keyId}|${keyVersion}`;

export function wrapAccountKey(unlockKey: CryptoKey, accountKey: Uint8Array, userId: string): Promise<EncryptedPayload> {
    return wrapKeyBytes(unlockKey, accountKey, accountKeyContext(userId));
}

export function unwrapAccountKey(unlockKey: CryptoKey, wrapped: EncryptedPayload, userId: string): Promise<Uint8Array> {
    return unwrapKeyBytes(unlockKey, wrapped, accountKeyContext(userId));
}

export function wrapAccountKeyForRecovery(recoveryUnlockKey: CryptoKey, accountKey: Uint8Array, userId: string): Promise<EncryptedPayload> {
    return wrapKeyBytes(recoveryUnlockKey, accountKey, recoveryContext(userId));
}

export function unwrapAccountKeyWithRecovery(recoveryUnlockKey: CryptoKey, wrapped: EncryptedPayload, userId: string): Promise<Uint8Array> {
    return unwrapKeyBytes(recoveryUnlockKey, wrapped, recoveryContext(userId));
}

async function aesKey(raw: Uint8Array): Promise<CryptoKey> {
    return crypto.subtle.importKey('raw', raw as BufferSource, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function wrapVaultKeyForCloud(accountKey: Uint8Array, vaultKey: Uint8Array, userId: string, keyId: string, keyVersion: number): Promise<EncryptedPayload> {
    return wrapKeyBytes(await aesKey(accountKey), vaultKey, vaultKeyContext(userId, keyId, keyVersion));
}

export async function unwrapVaultKeyFromCloud(accountKey: Uint8Array, wrapped: EncryptedPayload, userId: string, keyId: string, keyVersion: number): Promise<Uint8Array> {
    return unwrapKeyBytes(await aesKey(accountKey), wrapped, vaultKeyContext(userId, keyId, keyVersion));
}

/* ── Records ───────────────────────────────────────────────────────────── */

export type RecordKind = 'item' | 'collection' | 'tag' | 'setting';

/** Everything that identifies a record. It's bound into the seal, so a row copied to another id,
 *  kind, revision, key or account doesn't open. */
export type RecordMeta = { userId: string; id: string; kind: RecordKind; revision: number; keyId: string; keyVersion: number };

const recordAad = (m: RecordMeta) => encoder.encode(`fp2|${m.userId}|${m.kind}|${m.id}|${m.revision}|${m.keyId}|${m.keyVersion}`);

export async function sealRecord(vaultKey: CryptoKey, meta: RecordMeta, plaintext: string): Promise<{ ciphertext: string; iv: string }> {
    const iv = randomBytes(12);
    const ct = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv as BufferSource, additionalData: recordAad(meta) as BufferSource },
        vaultKey,
        encoder.encode(plaintext) as BufferSource,
    );
    return { ciphertext: bytesToBase64(new Uint8Array(ct)), iv: bytesToBase64(iv) };
}

export async function openRecord(vaultKey: CryptoKey, meta: RecordMeta, sealed: { ciphertext: string; iv: string }): Promise<string> {
    const plain = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: base64ToBytes(sealed.iv) as BufferSource, additionalData: recordAad(meta) as BufferSource },
        vaultKey,
        base64ToBytes(sealed.ciphertext) as BufferSource,
    );
    return decoder.decode(plain);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The record id for a local id. Most local ids are already UUIDs; the few that aren't (the
 * built-in "Personal" vault) get a stable UUID derived from kind + id, the same on every device.
 */
export async function recordIdFor(kind: RecordKind, localId: string): Promise<string> {
    if (UUID.test(localId)) return localId.toLowerCase();
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(`focuzpass:record-id:v1|${kind}|${localId}`)));
    hash[6] = (hash[6]! & 0x0f) | 0x50; // version 5 (name-based)
    hash[8] = (hash[8]! & 0x3f) | 0x80; // RFC 4122 variant
    const hex = Array.from(hash.slice(0, 16), (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
