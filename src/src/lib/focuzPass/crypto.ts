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

export async function deriveVaultKey(
    masterPassword: string,
    salt: Uint8Array,
    iterations = FOCUZPASS_PBKDF2_ITERATIONS,
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
        false,
        ['encrypt', 'decrypt'],
    );
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
