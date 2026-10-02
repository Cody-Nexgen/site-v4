/**
 * FocuzPass vault core — crypto + CRUD + lock timers.
 * Intended for the service worker; UI talks via messages only.
 */

import {
    base64ToBytes,
    bytesToBase64,
    decryptAesGcm,
    decryptInboxEntry,
    deriveVaultKey,
    deriveVaultKeyExtractable,
    deriveWrappingKey,
    encryptAesGcm,
    exportRawVaultKey,
    generateInboxKeyPair,
    importRawVaultKey,
    newVaultKeyBytes,
    randomBytes,
    unwrapVaultKey,
    verifyMasterPassword,
    wrapVaultKey,
    type InboxEnvelope,
} from './crypto';
import {
    deriveRecoveryUnlockKey,
    deriveUnlockKey,
    formatAccountKey,
    newAccountKdf,
    newAccountKey,
    newSecretKeyId,
    recordIdFor,
    wrapAccountKey,
    wrapAccountKeyForRecovery,
    wrapVaultKeyForCloud,
} from './cloud/keys';
import { CloudError, type CloudAccountRow, type CloudStore } from './cloud/store';
import {
    PasskeyError,
    checkRpId,
    getAssertion,
    makeCredential,
    readPasskeySecret,
    type AuthenticationResponseJSON,
    type CreationOptionsJSON,
    type PasskeySecret,
    type RegistrationResponseJSON,
    type RequestOptionsJSON,
} from './passkeys/webauthn';
import { openCloudAccount, pullEverything, type OpenedAccount } from './cloud/join';
import { realtimeChannelName } from './cloud/realtime';
import {
    canonicalJson,
    fingerprint,
    indexLocal,
    recordPlaintext,
    syncOnce,
    type LocalRecord,
    type RemoteChanges,
    type SyncedEntry,
    type SyncHost,
    type SyncResult,
    type SyncState,
} from './cloud/sync';
import {
    FOCUZPASS_ABSOLUTE_MAX_MS,
    FOCUZPASS_DEFAULT_IDLE_LOCK_MS,
    FOCUZPASS_KDF,
    FOCUZPASS_PBKDF2_ITERATIONS,
    FOCUZPASS_STORAGE_BLOB,
    FOCUZPASS_STORAGE_INBOX,
    FOCUZPASS_STORAGE_INBOX_PUB,
    FOCUZPASS_STORAGE_META,
    FOCUZPASS_STORAGE_SESSION_KEY,
    FOCUZPASS_STORAGE_SETTINGS,
    FOCUZPASS_STORAGE_UPGRADE_BACKUP,
    FOCUZPASS_VAULT_VERSION,
    type InboxPendingLogin,
    type VaultSessionRecord,
    type AuthMethod,
    type DecryptedCardItem,
    type DecryptedCustomItem,
    type DecryptedLoginItem,
    type DecryptedPasskeyItem,
    type DecryptedVaultItem,
    type EncryptedPayload,
    type EncryptedVaultDocument,
    type PasswordStrength,
    type StoredCardItem,
    type StoredCustomItem,
    type StoredLoginItem,
    type StoredPasskeyItem,
    type StoredVaultItem,
    type VaultBlob,
    type VaultCollection,
    type VaultMeta,
    type VaultSettings,
    type VaultSnapshot,
    type VaultStatus,
    type VaultTag,
    type CustomItemKind,
    type VaultExportPackage,
    type VaultCloudState,
    type CloudStatus,
    type CloudAccountState,
} from './types';

export type { CustomItemKind, DecryptedVaultItem, VaultCollection, VaultSnapshot, VaultStatus, VaultTag };

export type VaultStorageAdapter = {
    get: (keys: string[]) => Promise<Record<string, unknown>>;
    set: (items: Record<string, unknown>) => Promise<void>;
    remove: (keys: string[]) => Promise<void>;
};

export type VaultUpsertInput = {
    id?: string;
    type: 'login' | 'card' | 'passkey' | 'custom';
    kind?: CustomItemKind;
    title: string;
    identity: string;
    domain?: string;
    password?: string;
    cardNumber?: string;
    expiry?: string;
    cvv?: string;
    note?: string;
    authMethod?: AuthMethod;
    credentialId?: string;
    /** A passkey coming from another device (a transfer package). Only FocuzPass's own pages can send one. */
    passkey?: PasskeySecret;
    fields?: Record<string, string>;
    mark?: string;
    markTone?: string;
    vaultId?: string;
    tagIds?: string[];
    favorite?: boolean;
    archivedAt?: string;
    deletedAt?: string;
    sortOrder?: number;
};

export type VaultItemAction =
    | { action: 'favorite'; id: string; value: boolean }
    | { action: 'move'; id: string; vaultId: string }
    | { action: 'archive'; id: string }
    | { action: 'unarchive'; id: string }
    | { action: 'trash'; id: string }
    | { action: 'restore'; id: string }
    | { action: 'purge'; id: string }
    | { action: 'duplicate'; id: string };

export const DEFAULT_VAULT_ID = 'focuzpass-personal';

function defaultVault(): VaultCollection {
    return {
        id: DEFAULT_VAULT_ID,
        name: 'Personal',
        color: '#6e8fb8',
        icon: 'vault',
        createdAt: nowIso(),
    };
}

function nowIso() {
    return new Date().toISOString();
}

export function passwordStrength(password: string): PasswordStrength {
    if (password.length >= 16) return 'strong';
    if (password.length >= 10) return 'okay';
    return 'weak';
}

export function formatRelativeTime(iso?: string): string {
    if (!iso) return 'Never used';
    const ms = Date.now() - new Date(iso).getTime();
    if (!Number.isFinite(ms) || ms < 0) return 'Just now';
    const minutes = Math.floor(ms / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
    const months = Math.floor(days / 30);
    return `${months} month${months === 1 ? '' : 's'} ago`;
}

/** Exact host matching only. `www.` is treated as a presentation alias, never a wildcard. */
export function normalizeVaultDomain(value?: string): string {
    if (!value) return '';
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return '';
    try {
        const url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
        return url.hostname.replace(/^www\./, '').replace(/\.$/, '');
    } catch {
        return trimmed
            .replace(/^https?:\/\//, '')
            .split('/')[0]!
            .split(':')[0]!
            .replace(/^www\./, '')
            .replace(/\.$/, '');
    }
}

export function isExactVaultDomain(stored?: string, current?: string): boolean {
    const a = normalizeVaultDomain(stored);
    const b = normalizeVaultDomain(current);
    return Boolean(a && b && a === b);
}

/** A package from another device, checked before anything is decrypted. */
function readExportPackage(value: unknown): VaultExportPackage {
    const p = value as Partial<VaultExportPackage> | null;
    const payload = (v: unknown) => !!v && typeof (v as EncryptedPayload).iv === 'string' && typeof (v as EncryptedPayload).ct === 'string';
    const keyed = (p?.version === 1 && payload(p.verifier)) || (p?.version === 2 && payload(p.wrappedKey));
    if (!p || p.format !== 'focuzpass-export' || !keyed || typeof p.salt !== 'string' || !payload(p.data)) {
        throw new Error('This isn\'t a FocuzPass export');
    }
    const iterations = Number(p.iterations) || FOCUZPASS_PBKDF2_ITERATIONS;
    // Refuse weakened or absurd key-derivation settings instead of trusting the file.
    if (iterations < 100_000 || iterations > 10_000_000) throw new Error('This FocuzPass export has unsafe settings');
    return { ...(p as VaultExportPackage), iterations };
}

/** Set up, in either format (older vaults have a verifier, current ones a wrapped key). */
function isConfigured(meta: VaultMeta | undefined): boolean {
    return Boolean(meta?.salt && (meta.wrappedKey || meta.verifier));
}

/** Meta for a vault key wrapped by the master password: fresh salt, current key-derivation settings. */
async function wrappedMeta(masterPassword: string, raw: Uint8Array): Promise<VaultMeta> {
    const salt = randomBytes(16);
    const wrappingKey = await deriveWrappingKey(masterPassword, salt, FOCUZPASS_PBKDF2_ITERATIONS);
    return {
        version: FOCUZPASS_VAULT_VERSION,
        salt: bytesToBase64(salt),
        kdf: FOCUZPASS_KDF,
        iterations: FOCUZPASS_PBKDF2_ITERATIONS,
        wrappedKey: await wrapVaultKey(wrappingKey, raw),
    };
}

type OpenedVault = { raw: Uint8Array; document: EncryptedVaultDocument } | 'wrong-password' | 'unreadable';

/** The vault key (raw) and decrypted document for a master password, in either format. */
async function openVault(masterPassword: string, meta: VaultMeta, blob: VaultBlob | undefined): Promise<OpenedVault> {
    if (!meta?.salt || !blob?.iv || !blob.ct) return 'unreadable';
    const salt = base64ToBytes(meta.salt);
    const iterations = meta.iterations || FOCUZPASS_PBKDF2_ITERATIONS;
    let raw: Uint8Array;
    if (meta.wrappedKey) {
        try {
            raw = await unwrapVaultKey(await deriveWrappingKey(masterPassword, salt, iterations), meta.wrappedKey);
        } catch {
            return 'wrong-password';
        }
    } else if (meta.verifier) {
        const key = await deriveVaultKeyExtractable(masterPassword, salt, iterations);
        if (!(await verifyMasterPassword(key, meta.verifier))) return 'wrong-password';
        raw = await exportRawVaultKey(key);
    } else {
        return 'unreadable';
    }
    try {
        const key = await importRawVaultKey(raw);
        return { raw, document: JSON.parse(await decryptAesGcm(key, { iv: blob.iv, ct: blob.ct })) as EncryptedVaultDocument };
    } catch {
        return 'unreadable';
    }
}

/** A decrypted item as the input that recreates it (ids and timestamps are new). */
function upsertInputFrom(item: DecryptedVaultItem): VaultUpsertInput {
    const base = { title: item.title, identity: item.identity, note: item.note, favorite: item.favorite, mark: item.mark, markTone: item.markTone };
    if (item.type === 'login') return { ...base, type: 'login', domain: item.domain, password: item.password, authMethod: item.authMethod };
    if (item.type === 'card') return { ...base, type: 'card', cardNumber: item.cardNumber, expiry: item.expiry, cvv: item.cvv };
    if (item.type === 'passkey') return { ...base, type: 'passkey', domain: item.domain, credentialId: item.credentialId, passkey: item.passkey };
    return { ...base, type: 'custom', kind: item.kind, fields: item.fields };
}

/** What makes two items "the same" when importing. */
export function importFingerprint(item: VaultUpsertInput | DecryptedVaultItem): string {
    const title = item.title.trim().toLowerCase();
    if (item.type === 'login') return `login|${normalizeVaultDomain(item.domain)}|${item.identity.trim().toLowerCase()}|${item.password ?? ''}`;
    if (item.type === 'card') return `card|${(item.cardNumber ?? '').replace(/\s/g, '')}`;
    if (item.type === 'custom') return `custom|${item.kind}|${title}|${JSON.stringify(item.fields ?? {})}`;
    // A passkey is the same passkey when it's the same credential.
    if (item.type === 'passkey' && item.passkey) return `passkey|${item.passkey.rpId}|${item.passkey.credentialId}`;
    return `${item.type}|${title}|${item.identity}`;
}

function defaultMark(title: string, type: VaultUpsertInput['type']): string {
    const cleaned = title.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (type === 'card') return cleaned.slice(0, 4) || 'CARD';
    return cleaned.slice(0, 2) || 'FP';
}

function defaultTone(type: VaultUpsertInput['type'], title: string): string {
    if (type === 'passkey') return '#93c5fd';
    if (type === 'card') return '#5aa9e6';
    const palette = ['#86b7d9', '#a7d8a9', '#d6a6cf', '#b9a5de', '#e3b59f', '#93c9bd', '#d5c879'];
    const hash = Array.from(title).reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 17);
    return palette[hash % palette.length]!;
}

function organization(item: Partial<DecryptedVaultItem> | Partial<StoredVaultItem>) {
    return {
        vaultId: item.vaultId || DEFAULT_VAULT_ID,
        tagIds: Array.isArray(item.tagIds) ? [...new Set(item.tagIds.filter(Boolean))] : [],
        favorite: Boolean(item.favorite),
        archivedAt: item.archivedAt,
        deletedAt: item.deletedAt,
        sortOrder: typeof item.sortOrder === 'number' && Number.isFinite(item.sortOrder) ? item.sortOrder : 0,
    };
}

async function encryptOptional(key: CryptoKey, value?: string): Promise<EncryptedPayload | undefined> {
    if (!value) return undefined;
    return encryptAesGcm(key, value);
}

async function decryptOptional(key: CryptoKey, value?: EncryptedPayload): Promise<string | undefined> {
    if (!value) return undefined;
    return decryptAesGcm(key, value);
}

async function encryptItem(key: CryptoKey, item: DecryptedVaultItem): Promise<StoredVaultItem> {
    if (item.type === 'login') {
        const stored: StoredLoginItem = {
            ...organization(item),
            id: item.id,
            type: 'login',
            title: item.title,
            identity: item.identity,
            domain: item.domain,
            authMethod: item.authMethod,
            password: await encryptOptional(key, item.password),
            notes: await encryptOptional(key, item.note),
            strength: item.strength,
            risk: item.risk,
            mark: item.mark,
            markTone: item.markTone,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
            lastUsedAt: item.lastUsedAt,
        };
        return stored;
    }
    if (item.type === 'card') {
        const stored: StoredCardItem = {
            ...organization(item),
            id: item.id,
            type: 'card',
            title: item.title,
            identity: item.identity,
            number: await encryptOptional(key, item.cardNumber),
            expiry: item.expiry,
            cvv: await encryptOptional(key, item.cvv),
            notes: await encryptOptional(key, item.note),
            mark: item.mark,
            markTone: item.markTone,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
            lastUsedAt: item.lastUsedAt,
        };
        return stored;
    }
    if (item.type === 'passkey') {
        const stored: StoredPasskeyItem = {
            ...organization(item),
            id: item.id,
            type: 'passkey',
            title: item.title,
            identity: item.identity,
            domain: item.domain,
            credentialId: item.credentialId,
            privateKey: await encryptOptional(key, item.passkey ? JSON.stringify(item.passkey) : undefined),
            notes: await encryptOptional(key, item.note),
            mark: item.mark,
            markTone: item.markTone,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
            lastUsedAt: item.lastUsedAt,
            experimental: true,
        };
        return stored;
    }
    const stored: StoredCustomItem = {
        ...organization(item),
        id: item.id,
        type: 'custom',
        kind: item.kind,
        title: item.title,
        identity: item.identity,
        fields: await encryptOptional(key, JSON.stringify(item.fields || {})),
        notes: await encryptOptional(key, item.note),
        mark: item.mark,
        markTone: item.markTone,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        lastUsedAt: item.lastUsedAt,
    };
    return stored;
}

async function decryptPasskey(key: CryptoKey, value?: EncryptedPayload) {
    const text = await decryptOptional(key, value);
    if (!text) return undefined;
    try {
        return readPasskeySecret(JSON.parse(text)) ?? undefined;
    } catch {
        return undefined;
    }
}

async function decryptItem(key: CryptoKey, item: StoredVaultItem): Promise<DecryptedVaultItem> {
    if (item.type === 'login') {
        const decrypted: DecryptedLoginItem = {
            ...organization(item),
            id: item.id,
            type: 'login',
            title: item.title,
            identity: item.identity,
            domain: item.domain,
            authMethod: item.authMethod,
            password: await decryptOptional(key, item.password),
            note: await decryptOptional(key, item.notes),
            strength: item.strength,
            risk: item.risk,
            mark: item.mark,
            markTone: item.markTone,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
            lastUsedAt: item.lastUsedAt,
        };
        return decrypted;
    }
    if (item.type === 'card') {
        const decrypted: DecryptedCardItem = {
            ...organization(item),
            id: item.id,
            type: 'card',
            title: item.title,
            identity: item.identity,
            cardNumber: await decryptOptional(key, item.number),
            expiry: item.expiry,
            cvv: await decryptOptional(key, item.cvv),
            note: await decryptOptional(key, item.notes),
            mark: item.mark,
            markTone: item.markTone,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
            lastUsedAt: item.lastUsedAt,
        };
        return decrypted;
    }
    if (item.type === 'passkey') {
        const decrypted: DecryptedPasskeyItem = {
            ...organization(item),
            id: item.id,
            type: 'passkey',
            title: item.title,
            identity: item.identity,
            domain: item.domain,
            credentialId: item.credentialId,
            note: await decryptOptional(key, item.notes),
            passkey: await decryptPasskey(key, item.privateKey),
            mark: item.mark,
            markTone: item.markTone,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
            lastUsedAt: item.lastUsedAt,
            experimental: true,
        };
        return decrypted;
    }
    let fields: Record<string, string> = {};
    try {
        fields = JSON.parse((await decryptOptional(key, item.fields)) || '{}') as Record<string, string>;
    } catch {
        fields = {};
    }
    const decrypted: DecryptedCustomItem = {
        ...organization(item),
        id: item.id,
        type: 'custom',
        kind: item.kind,
        title: item.title,
        identity: item.identity,
        fields,
        note: await decryptOptional(key, item.notes),
        mark: item.mark,
        markTone: item.markTone,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        lastUsedAt: item.lastUsedAt,
    };
    return decrypted;
}

export function assertNoPlaintextSecrets(serialized: string, samples: string[]) {
    for (const sample of samples) {
        if (!sample || sample.length < 4) continue;
        if (serialized.includes(sample)) {
            throw new Error('Plaintext secret leaked into persisted vault payload');
        }
    }
}

/** Fields of a stored item that must only ever hold ciphertext. */
const ENCRYPTED_FIELDS: Record<StoredVaultItem['type'], string[]> = {
    login: ['password', 'notes'],
    card: ['number', 'cvv', 'notes'],
    passkey: ['privateKey', 'notes'],
    custom: ['fields', 'notes'],
};

function isEncryptedPayload(value: unknown): boolean {
    if (!value || typeof value !== 'object') return false;
    const keys = Object.keys(value);
    const payload = value as Record<string, unknown>;
    return keys.length === 2 && typeof payload.iv === 'string' && typeof payload.ct === 'string';
}

/** The clear-text fields a stored item keeps, which must be exactly the item's own. */
function clearText(item: StoredVaultItem | DecryptedVaultItem): string[] {
    return [
        item.type,
        item.title,
        item.identity,
        'domain' in item ? item.domain ?? '' : '',
        'expiry' in item ? item.expiry ?? '' : '',
        'credentialId' in item ? item.credentialId ?? '' : '',
        'kind' in item ? item.kind ?? '' : '',
        item.mark ?? '',
    ];
}

/**
 * The persist-time leak check. (1) Every secret field of every stored item is ciphertext.
 * (2) The clear text stored for an item (title, username, site…) is exactly the item's own, so
 * no code path can slip a secret into it. What people type into their own titles and usernames
 * is theirs: a username that equals the password, or a card named after its number, is saved as
 * they wrote it rather than failing the save (the old substring search refused whole imports).
 */
export function assertStoredItemsEncrypted(stored: StoredVaultItem[], decrypted: DecryptedVaultItem[]) {
    const byId = new Map(decrypted.map((item) => [item.id, item]));
    for (const item of stored) {
        for (const key of ENCRYPTED_FIELDS[item.type] ?? []) {
            const value = (item as Record<string, unknown>)[key];
            if (value !== undefined && !isEncryptedPayload(value)) {
                throw new Error('Plaintext secret leaked into persisted vault payload');
            }
        }
        const source = byId.get(item.id);
        if (!source) continue;
        const stored = clearText(item);
        const own = clearText(source);
        if (stored.some((value, i) => (value || '') !== (own[i] || ''))) {
            throw new Error('Plaintext secret leaked into persisted vault payload');
        }
    }
}

const SESSION_TOUCH_THROTTLE_MS = 15_000;

export class FocuzPassVault {
    private vaultKey: CryptoKey | null = null;
    private items: DecryptedVaultItem[] = [];
    private vaults: VaultCollection[] = [];
    private tags: VaultTag[] = [];
    private inboxPrivateKey: JsonWebKey | undefined;
    private cloud: VaultCloudState | undefined;
    /** Synced records this version doesn't understand, kept exactly as they came. */
    private cloudExtra: LocalRecord[] = [];
    /** Moves on every save, so a sync can tell the vault changed while it was merging. */
    private generation = 0;
    private syncRun: Promise<SyncResult> | null = null;
    private syncAgain = false;
    /** This session's sync outcome (not saved: a fresh session syncs straight away). */
    private syncInfo: { lastSyncAt?: string; error?: { message: string; code?: string; at: string } } = {};
    private unlockedAt = 0;
    private lastActivityAt = 0;
    private idleLockMs = FOCUZPASS_DEFAULT_IDLE_LOCK_MS;
    private onLockCallbacks = new Set<() => void>();
    private lastSessionTouchAt = 0;
    private sessionWriteInFlight: Promise<void> | null = null;
    private restoreAttempted = false;
    private restorePromise: Promise<boolean> | null = null;
    /**
     * Whether the vault has been set up, cached after the first read. Status and
     * page lookups then answer from memory — chrome.storage can stall for seconds
     * while the rest of the extension writes to it.
     */
    private configuredCache: boolean | null = null;

    constructor(
        private readonly storage: VaultStorageAdapter,
        private readonly session?: VaultStorageAdapter,
    ) {}

    onLock(cb: () => void) {
        this.onLockCallbacks.add(cb);
        return () => this.onLockCallbacks.delete(cb);
    }

    get isUnlocked() {
        return Boolean(this.vaultKey);
    }

    /** Forget the cached setup flag (vault storage changed outside this instance). */
    invalidateStatusCache() {
        this.configuredCache = null;
    }

    touch() {
        if (!this.vaultKey) return;
        this.lastActivityAt = Date.now();
        this.enforceLockTimers();
        // Keep the session record's idle timer in step, throttled to one write / 15s (§5.2).
        if (this.session && Date.now() - this.lastSessionTouchAt >= SESSION_TOUCH_THROTTLE_MS && !this.sessionWriteInFlight) {
            this.lastSessionTouchAt = Date.now();
            this.sessionWriteInFlight = this.writeSessionRecord().finally(() => {
                this.sessionWriteInFlight = null;
            });
        }
    }

    private async writeSessionRecord() {
        if (!this.session || !this.vaultKey) return;
        const record: VaultSessionRecord = {
            // Only write the raw key once per unlock — afterwards we refresh timestamps.
            k: this.sessionKeyB64 || '',
            unlockedAt: this.unlockedAt,
            lastActivityAt: this.lastActivityAt,
        };
        if (!record.k) {
            const existing = (await this.session.get([FOCUZPASS_STORAGE_SESSION_KEY]))[FOCUZPASS_STORAGE_SESSION_KEY] as VaultSessionRecord | undefined;
            if (!existing?.k) return;
            record.k = existing.k;
        }
        await this.session.set({ [FOCUZPASS_STORAGE_SESSION_KEY]: record });
    }

    private sessionKeyB64 = '';

    enforceLockTimers(): boolean {
        if (!this.vaultKey) return false;
        const now = Date.now();
        if (now - this.unlockedAt >= FOCUZPASS_ABSOLUTE_MAX_MS) {
            this.lock();
            return true;
        }
        if (now - this.lastActivityAt >= this.idleLockMs) {
            this.lock();
            return true;
        }
        return false;
    }

    lock() {
        this.vaultKey = null;
        this.items = [];
        this.vaults = [];
        this.tags = [];
        this.inboxPrivateKey = undefined;
        this.cloud = undefined;
        this.cloudExtra = [];
        this.syncInfo = {};
        this.unlockedAt = 0;
        this.lastActivityAt = 0;
        this.sessionKeyB64 = '';
        this.lastSessionTouchAt = 0;
        void this.session?.remove([FOCUZPASS_STORAGE_SESSION_KEY]).catch(() => undefined);
        for (const cb of this.onLockCallbacks) {
            try {
                cb();
            } catch {
                /* ignore */
            }
        }
    }

    /**
     * Lazily restore the vault from the session key after a service-worker restart.
     * Refuses (and locks) when the idle or absolute timers would already have fired.
     */
    async restoreFromSession(): Promise<boolean> {
        if (this.vaultKey) return true;
        // Requests that arrive while a restore is running wait for it instead of
        // reporting "locked" (they used to see restoreAttempted and bail out).
        if (this.restorePromise) return this.restorePromise;
        if (!this.session || this.restoreAttempted) return false;
        this.restorePromise = this.restoreOnce().finally(() => {
            this.restorePromise = null;
        });
        return this.restorePromise;
    }

    private async restoreOnce(): Promise<boolean> {
        if (!this.session) return false;
        this.restoreAttempted = true;
        try {
            const data = await this.session.get([FOCUZPASS_STORAGE_SESSION_KEY]);
            const record = data[FOCUZPASS_STORAGE_SESSION_KEY] as VaultSessionRecord | undefined;
            if (!record?.k || !Number.isFinite(record.unlockedAt) || !Number.isFinite(record.lastActivityAt)) return false;

            const stored = await this.storage.get([
                FOCUZPASS_STORAGE_BLOB,
                FOCUZPASS_STORAGE_SETTINGS,
            ]);
            const blob = stored[FOCUZPASS_STORAGE_BLOB] as VaultBlob | undefined;
            if (!blob?.ct || !blob.iv) return false;
            const settings = (stored[FOCUZPASS_STORAGE_SETTINGS] as VaultSettings | undefined) || { idleLockMinutes: 15 };
            this.idleLockMs = Math.max(1, Number(settings.idleLockMinutes) || 15) * 60000;

            const key = await importRawVaultKey(base64ToBytes(record.k));
            this.sessionKeyB64 = record.k;
            this.unlockedAt = record.unlockedAt;
            this.lastActivityAt = record.lastActivityAt;
            this.vaultKey = key;
            // Expired sessions must not come back — enforce before touching plaintext.
            if (this.enforceLockTimers()) return false;

            let document: EncryptedVaultDocument;
            try {
                document = JSON.parse(await decryptAesGcm(key, { iv: blob.iv, ct: blob.ct })) as EncryptedVaultDocument;
            } catch {
                this.lock();
                return false;
            }
            const items: DecryptedVaultItem[] = await Promise.all((document.items || []).map((storedItem) => decryptItem(key, storedItem)));
            this.vaults = document.vaults?.length ? document.vaults : [defaultVault()];
            this.tags = document.tags || [];
            this.inboxPrivateKey = document.inboxPrivateKey;
            this.cloud = document.cloud;
            this.cloudExtra = document.cloudExtra ?? [];
            const validVaultIds = new Set(this.vaults.map((vault) => vault.id));
            this.items = items.map((item) => ({
                ...item,
                vaultId: validVaultIds.has(item.vaultId) ? item.vaultId : this.vaults[0]!.id,
                tagIds: item.tagIds.filter((id) => this.tags.some((tag) => tag.id === id)),
            }));
            return true;
        } catch {
            return false;
        } finally {
            if (!this.vaultKey) {
                // A failed/expired restore must not keep retrying or leave a stale record.
                this.restoreAttempted = true;
            }
        }
    }

    async getStatus(platform: 'extension' | 'web' = 'extension'): Promise<VaultStatus> {
        if (!this.vaultKey) await this.restoreFromSession();
        this.enforceLockTimers();
        if (this.vaultKey) this.configuredCache = true;
        if (this.configuredCache !== true) {
            const data = await this.storage.get([
                FOCUZPASS_STORAGE_META,
                FOCUZPASS_STORAGE_SETTINGS,
            ]);
            const meta = data[FOCUZPASS_STORAGE_META] as VaultMeta | undefined;
            const settings = (data[FOCUZPASS_STORAGE_SETTINGS] as VaultSettings | undefined) || {
                idleLockMinutes: FOCUZPASS_DEFAULT_IDLE_LOCK_MS / 60000,
            };
            this.idleLockMs = Math.max(1, Number(settings.idleLockMinutes) || 15) * 60000;
            this.configuredCache = isConfigured(meta);
        }

        const unlocked = Boolean(this.vaultKey);
        const remainingMs = unlocked
            ? Math.max(
                0,
                Math.min(
                    FOCUZPASS_ABSOLUTE_MAX_MS - (Date.now() - this.unlockedAt),
                    this.idleLockMs - (Date.now() - this.lastActivityAt),
                ),
            )
            : null;

        return {
            configured: this.configuredCache === true,
            unlocked,
            itemCount: unlocked ? this.items.filter((item) => !item.deletedAt).length : 0,
            idleLockMinutes: this.idleLockMs / 60000,
            unlockedAt: unlocked ? this.unlockedAt : null,
            absoluteLockAt: unlocked ? this.unlockedAt + FOCUZPASS_ABSOLUTE_MAX_MS : null,
            remainingMs,
            platform,
            passkeysExperimental: true,
        };
    }

    async setup(masterPassword: string): Promise<VaultStatus> {
        if (!masterPassword || masterPassword.length < 8) {
            throw new Error('Master password must be at least 8 characters');
        }
        const existing = await this.storage.get([FOCUZPASS_STORAGE_META]);
        if (existing[FOCUZPASS_STORAGE_META]) {
            throw new Error('Vault already configured');
        }

        const raw = newVaultKeyBytes();
        const meta = await wrappedMeta(masterPassword, raw);
        const vaultKey = await importRawVaultKey(raw);
        const settings: VaultSettings = { idleLockMinutes: 15 };
        const initialVault = defaultVault();
        const inboxPair = await generateInboxKeyPair();
        const emptyDoc: EncryptedVaultDocument = {
            version: FOCUZPASS_VAULT_VERSION,
            items: [],
            vaults: [initialVault],
            tags: [],
            inboxPrivateKey: inboxPair.privateJwk,
        };
        const outer = await encryptAesGcm(vaultKey, JSON.stringify(emptyDoc));
        const blob: VaultBlob = { iv: outer.iv, ct: outer.ct };

        await this.storage.set({
            [FOCUZPASS_STORAGE_META]: meta,
            [FOCUZPASS_STORAGE_BLOB]: blob,
            [FOCUZPASS_STORAGE_SETTINGS]: settings,
            [FOCUZPASS_STORAGE_INBOX_PUB]: inboxPair.publicJwk,
        });

        this.unlockedAt = Date.now();
        this.lastActivityAt = this.unlockedAt;
        this.vaultKey = await this.adoptRawKey(raw);
        this.items = [];
        this.vaults = [initialVault];
        this.tags = [];
        this.inboxPrivateKey = inboxPair.privateJwk;
        this.idleLockMs = settings.idleLockMinutes * 60000;
        return this.getStatus();
    }

    /**
     * Export once into chrome.storage.session, then re-import as a non-extractable
     * key for actual use (§5.2). Without a session adapter the key is still
     * re-imported non-extractable so `vaultKey` is never the extractable handle.
     */
    private async adoptRawKey(raw: Uint8Array): Promise<CryptoKey> {
        this.sessionKeyB64 = bytesToBase64(raw);
        if (this.session) {
            const record: VaultSessionRecord = {
                k: this.sessionKeyB64,
                unlockedAt: this.unlockedAt,
                lastActivityAt: this.lastActivityAt,
            };
            this.lastSessionTouchAt = Date.now();
            await this.session.set({ [FOCUZPASS_STORAGE_SESSION_KEY]: record });
        }
        return importRawVaultKey(raw);
    }

    async unlock(masterPassword: string): Promise<VaultStatus> {
        const data = await this.storage.get([FOCUZPASS_STORAGE_META, FOCUZPASS_STORAGE_BLOB, FOCUZPASS_STORAGE_SETTINGS, FOCUZPASS_STORAGE_UPGRADE_BACKUP]);
        let meta = data[FOCUZPASS_STORAGE_META] as VaultMeta | undefined;
        let blob = data[FOCUZPASS_STORAGE_BLOB] as VaultBlob | undefined;
        const upgradeBackup = data[FOCUZPASS_STORAGE_UPGRADE_BACKUP] as { meta: VaultMeta; blob: VaultBlob } | undefined;
        if (!isConfigured(meta) || !blob?.ct || !blob.iv) {
            throw new Error('Vault is not set up');
        }

        let opened = await openVault(masterPassword, meta!, blob);
        if (opened === 'unreadable' && upgradeBackup) {
            // An upgrade was interrupted before it was checked: go back to the copy it kept.
            opened = await openVault(masterPassword, upgradeBackup.meta, upgradeBackup.blob);
            if (opened !== 'wrong-password' && opened !== 'unreadable') {
                await this.storage.set({ [FOCUZPASS_STORAGE_META]: upgradeBackup.meta, [FOCUZPASS_STORAGE_BLOB]: upgradeBackup.blob });
                meta = upgradeBackup.meta;
                blob = upgradeBackup.blob;
            }
        }
        if (opened === 'wrong-password') throw new Error('Incorrect master password');
        if (opened === 'unreadable') throw new Error('Vault ciphertext is corrupted or tampered');
        const { raw, document } = opened;

        this.unlockedAt = Date.now();
        this.lastActivityAt = this.unlockedAt;
        const key = await this.adoptRawKey(raw);

        const items: DecryptedVaultItem[] = [];
        for (const stored of document.items || []) {
            items.push(await decryptItem(key, stored));
        }

        this.vaultKey = key;
        this.inboxPrivateKey = document.inboxPrivateKey;
        this.cloud = document.cloud;
        this.cloudExtra = document.cloudExtra ?? [];
        this.vaults = document.vaults?.length ? document.vaults : [defaultVault()];
        this.tags = document.tags || [];
        const validVaultIds = new Set(this.vaults.map((vault) => vault.id));
        const hasSavedOrder = items.length <= 1 || items.some((item) => item.sortOrder !== 0);
        this.items = items.map((item, index) => ({
            ...item,
            vaultId: validVaultIds.has(item.vaultId) ? item.vaultId : this.vaults[0]!.id,
            tagIds: item.tagIds.filter((id) => this.tags.some((tag) => tag.id === id)),
            sortOrder: hasSavedOrder ? item.sortOrder : index,
        }));
        const settings = (data[FOCUZPASS_STORAGE_SETTINGS] as VaultSettings | undefined) || {
            idleLockMinutes: 15,
        };
        this.idleLockMs = Math.max(1, Number(settings.idleLockMinutes) || 15) * 60000;
        if (!meta!.wrappedKey) {
            // Vaults from before the key hierarchy move to it now. If that fails for any reason,
            // the vault stays exactly as it was and opens the old way; the next unlock tries again.
            await this.upgradeToWrappedKey(masterPassword, meta!, blob!).catch(() => undefined);
        } else if (upgradeBackup) {
            // The upgraded vault just opened with the master password: the old copy can go.
            await this.storage.remove([FOCUZPASS_STORAGE_UPGRADE_BACKUP]);
        }
        // Existing vaults get an inbox keypair on next unlock (§5.3).
        if (!this.inboxPrivateKey) await this.ensureInboxKeyPair();
        else await this.storage.set({ [FOCUZPASS_STORAGE_INBOX_PUB]: this.inboxPublicJwk() });
        const status = await this.getStatus();
        status.inboxMerged = await this.drainInbox();
        return status;
    }

    /**
     * Moves an older vault (items encrypted with the password-derived key) to a random vault key
     * wrapped by the master password. The old meta and blob are kept aside until the new ones have
     * been read back and opened with the password; if anything fails, the old ones are put back.
     */
    private async upgradeToWrappedKey(masterPassword: string, oldMeta: VaultMeta, oldBlob: VaultBlob) {
        if (!this.vaultKey) throw new Error('Vault is locked');
        const raw = newVaultKeyBytes();
        const newKey = await importRawVaultKey(raw);
        const meta = await wrappedMeta(masterPassword, raw);
        const blob = await this.encryptDocument(newKey);
        await this.storage.set({ [FOCUZPASS_STORAGE_UPGRADE_BACKUP]: { meta: oldMeta, blob: oldBlob } });
        try {
            await this.storage.set({ [FOCUZPASS_STORAGE_META]: meta, [FOCUZPASS_STORAGE_BLOB]: blob });
            const written = await this.storage.get([FOCUZPASS_STORAGE_META, FOCUZPASS_STORAGE_BLOB]);
            const check = await openVault(masterPassword, written[FOCUZPASS_STORAGE_META] as VaultMeta, written[FOCUZPASS_STORAGE_BLOB] as VaultBlob);
            if (typeof check === 'string' || (check.document.items ?? []).length !== this.items.length) throw new Error('Upgrade check failed');
        } catch (error) {
            await this.storage.set({ [FOCUZPASS_STORAGE_META]: oldMeta, [FOCUZPASS_STORAGE_BLOB]: oldBlob });
            await this.storage.remove([FOCUZPASS_STORAGE_UPGRADE_BACKUP]);
            throw error;
        }
        this.vaultKey = await this.adoptRawKey(raw);
        await this.storage.remove([FOCUZPASS_STORAGE_UPGRADE_BACKUP]);
    }

    /**
     * New master password: re-wraps the vault key under it (new salt, current key-derivation
     * settings). Nothing is re-encrypted, and the old password stops working at once. Backup
     * files made earlier still open with the password they were made with.
     */
    async changeMasterPassword(currentPassword: string, newPassword: string): Promise<VaultStatus> {
        this.enforceLockTimers();
        if (!this.vaultKey) throw new Error('Vault is locked');
        if (!newPassword || newPassword.length < 8) throw new Error('Master password must be at least 8 characters');
        if (newPassword === currentPassword) throw new Error('Choose a password different from the current one');
        const data = await this.storage.get([FOCUZPASS_STORAGE_META, FOCUZPASS_STORAGE_BLOB]);
        const meta = data[FOCUZPASS_STORAGE_META] as VaultMeta | undefined;
        const blob = data[FOCUZPASS_STORAGE_BLOB] as VaultBlob | undefined;
        if (!isConfigured(meta) || !blob) throw new Error('Vault is not set up');
        const opened = await openVault(currentPassword, meta!, blob);
        if (opened === 'wrong-password') throw new Error('The current master password isn\'t right');
        if (opened === 'unreadable') throw new Error('Vault ciphertext is corrupted or tampered');
        if (!meta!.wrappedKey) {
            await this.upgradeToWrappedKey(currentPassword, meta!, blob);
        } else if (bytesToBase64(opened.raw) !== this.sessionKeyB64) {
            throw new Error('FocuzPass changed on another tab. Lock and unlock, then try again.');
        }
        const raw = base64ToBytes(this.sessionKeyB64);
        await this.storage.set({ [FOCUZPASS_STORAGE_META]: await wrappedMeta(newPassword, raw) });
        await this.storage.remove([FOCUZPASS_STORAGE_UPGRADE_BACKUP]);
        if (this.cloud) {
            // The cloud copy opens with the master password too: re-wrap its account key for the
            // new one. It reaches the server on the next cloud sync (syncCloudAccount).
            const kdf = newAccountKdf(FOCUZPASS_PBKDF2_ITERATIONS);
            const unlockKey = await deriveUnlockKey(newPassword, this.cloud.secretKey, this.cloud.userId, kdf);
            const wrappedAccountKey = await wrapAccountKey(unlockKey, base64ToBytes(this.cloud.accountKey), this.cloud.userId);
            const onServer = this.cloud.uploaded.account;
            this.cloud = {
                ...this.cloud,
                account: { ...this.cloud.account, ...kdf, wrappedAccountKey, revision: this.cloud.account.revision + (onServer ? 1 : 0) },
                accountPending: onServer || undefined,
            };
            await this.persist();
        }
        this.touch();
        return this.getStatus();
    }

    /* ── FocuzPass Cloud (docs/focuzpass-cloud-plan.md) ───────────────── */

    /** The master password, checked against this vault the same way unlocking does. */
    private async checkMasterPassword(masterPassword: string) {
        const data = await this.storage.get([FOCUZPASS_STORAGE_META, FOCUZPASS_STORAGE_BLOB]);
        const opened = await openVault(masterPassword, data[FOCUZPASS_STORAGE_META] as VaultMeta, data[FOCUZPASS_STORAGE_BLOB] as VaultBlob);
        if (opened === 'wrong-password') throw new Error('That isn\'t your master password');
        if (opened === 'unreadable') throw new Error('Vault ciphertext is corrupted or tampered');
        if (bytesToBase64(opened.raw) !== this.sessionKeyB64) throw new Error('FocuzPass changed on another tab. Lock and unlock, then try again.');
    }

    cloudStatus(): CloudStatus {
        const cloud = this.cloud;
        if (!cloud) return { state: 'off' };
        const records = cloud.sync
            ? Object.values(cloud.sync.synced).filter((entry) => !entry.deleted).length
            : Object.keys(cloud.uploaded.records).length;
        return {
            state: cloud.status,
            email: cloud.email,
            secretKeyId: cloud.secretKeyId,
            uploadedAt: cloud.uploadedAt,
            records,
            accountPending: cloud.accountPending,
            joinedAt: cloud.joinedAt,
            lastSyncAt: this.syncInfo.lastSyncAt,
            syncing: Boolean(this.syncRun),
            syncError: this.syncInfo.error,
        };
    }

    /** The account's realtime channel (cloud/realtime.ts), while the vault is open and syncing. */
    async cloudRealtimeName(): Promise<string | null> {
        if (!this.vaultKey || this.cloud?.status !== 'on') return null;
        return realtimeChannelName(base64ToBytes(this.cloud.accountKey), this.cloud.userId);
    }

    /** Whether the signed-in FocuzNow account has a cloud vault yet. Reads no vault data. */
    async cloudAccountState(store: CloudStore): Promise<CloudAccountState> {
        const user = await store.currentUser();
        if (!user) return { signedIn: false };
        return { signedIn: true, email: user.email, exists: Boolean(await store.getAccount()) };
    }

    /**
     * Turning on Cloud sync, step 1: makes the Security Key and account key (and a recovery key
     * if asked for) and keeps them in the vault, so a closed window or a failed upload carries on
     * with the same keys. Returns what goes in the Emergency Kit. Nothing leaves the device yet.
     */
    async prepareCloud(
        masterPassword: string,
        user: { id: string; email?: string },
        options: { recoveryKey?: boolean } = {},
    ): Promise<{ secretKey: string; secretKeyId: string; email?: string; recoveryKey?: string }> {
        this.enforceLockTimers();
        if (!this.vaultKey) throw new Error('Vault is locked');
        if (this.cloud?.status === 'on') throw new Error('Cloud sync is already on');
        if (this.cloud && this.cloud.userId !== user.id) {
            throw new Error('Cloud sync was started with another FocuzNow account. Sign in with that one, or cancel it first.');
        }
        await this.checkMasterPassword(masterPassword);
        const existing = this.cloud;
        const secretKey = existing?.secretKey ?? newAccountKey('secret');
        const accountKey = existing ? base64ToBytes(existing.accountKey) : newVaultKeyBytes();
        const kdf = existing ? { salt: existing.account.salt, iterations: existing.account.iterations } : newAccountKdf(FOCUZPASS_PBKDF2_ITERATIONS);
        const wrappedAccountKey =
            existing?.account.wrappedAccountKey ?? (await wrapAccountKey(await deriveUnlockKey(masterPassword, secretKey, user.id, kdf), accountKey, user.id));
        // A recovery key can be (re)made until the account row has gone up; it's shown once, never stored.
        let recoveryKey: string | undefined;
        let recoveryWrappedAccountKey = existing?.account.recoveryWrappedAccountKey;
        if (!existing?.uploaded.account) {
            recoveryWrappedAccountKey = undefined;
            if (options.recoveryKey) {
                recoveryKey = newAccountKey('recovery');
                recoveryWrappedAccountKey = await wrapAccountKeyForRecovery(await deriveRecoveryUnlockKey(recoveryKey, user.id), accountKey, user.id);
            }
        }
        this.cloud = {
            status: 'pending',
            userId: user.id,
            email: user.email ?? existing?.email,
            secretKey,
            secretKeyId: existing?.secretKeyId ?? newSecretKeyId(),
            accountKey: bytesToBase64(accountKey),
            keyId: existing?.keyId ?? crypto.randomUUID(),
            keyVersion: existing?.keyVersion ?? 1,
            account: { ...kdf, wrappedAccountKey, recoveryWrappedAccountKey, revision: existing?.account.revision ?? 1 },
            uploaded: existing?.uploaded ?? { account: false, key: false, records: {} },
            recoveryKeyMade: recoveryWrappedAccountKey ? true : undefined,
            sync: existing?.sync,
        };
        await this.persist();
        this.touch();
        return {
            secretKey: formatAccountKey(secretKey),
            secretKeyId: this.cloud.secretKeyId,
            email: this.cloud.email,
            recoveryKey: recoveryKey && formatAccountKey(recoveryKey),
        };
    }

    /** Drops a Cloud setup that hasn't sent anything yet. */
    async cancelCloud(): Promise<CloudStatus> {
        if (!this.vaultKey) throw new Error('Vault is locked');
        if (this.cloud?.status === 'pending' && !this.cloud.uploaded.account) {
            this.cloud = undefined;
            await this.persist();
        }
        return this.cloudStatus();
    }

    /** The Security Key again, for a new copy of the Emergency Kit. Asks for the master password first. */
    async cloudKit(masterPassword: string): Promise<{ secretKey: string; secretKeyId: string; email?: string }> {
        this.enforceLockTimers();
        if (!this.vaultKey) throw new Error('Vault is locked');
        if (!this.cloud) throw new Error('Cloud sync isn\'t on');
        await this.checkMasterPassword(masterPassword);
        this.touch();
        return { secretKey: formatAccountKey(this.cloud.secretKey), secretKeyId: this.cloud.secretKeyId, email: this.cloud.email };
    }

    /**
     * Turning on Cloud sync, step 2: sends the cloud copy. Only wrapped keys and sealed records
     * leave the device. Each step is remembered in the vault, so after a dropped connection,
     * running it again carries on where it stopped. The records go up through the same sync every
     * later change uses: to a new account, everything is new.
     */
    async enableCloud(store: CloudStore, onProgress?: (done: number, total: number) => void): Promise<{ uploaded: number }> {
        this.enforceLockTimers();
        if (!this.vaultKey) throw new Error('Vault is locked');
        const cloud = this.cloud;
        if (!cloud) throw new Error('Set up Cloud sync first');
        const user = await store.currentUser();
        if (!user) throw new CloudError('signed-out', 'Sign in to FocuzNow to use Cloud sync.');
        if (user.id !== cloud.userId) {
            throw new CloudError('unknown', 'You\'re signed in to a different FocuzNow account than the one Cloud sync was set up with.');
        }
        const remember = async (change: Partial<VaultCloudState['uploaded']>) => {
            this.cloud = { ...this.cloud!, uploaded: { ...this.cloud!.uploaded, ...change } };
            await this.persist();
        };

        if (!cloud.uploaded.account) {
            const existing = await store.getAccount();
            if (existing && existing.secret_key_id !== cloud.secretKeyId) {
                throw new CloudError('exists', 'Cloud sync is already on for this FocuzNow account. Add this device with your Security Key instead.');
            }
            if (!existing) await store.createAccount(this.accountRow());
            await remember({ account: true });
        }
        if (!this.cloud!.uploaded.key) {
            const wrapped = await wrapVaultKeyForCloud(base64ToBytes(cloud.accountKey), base64ToBytes(this.sessionKeyB64), cloud.userId, cloud.keyId, cloud.keyVersion);
            await store.putKey({ id: cloud.keyId, key_version: cloud.keyVersion, wrapped_key: wrapped, revision: 1 }).catch((error) => {
                // Only this setup could have made a key with its random id: an earlier attempt got it there.
                if (!(error instanceof CloudError && error.code === 'conflict')) throw error;
            });
            await remember({ key: true });
        }

        await this.runSync(store, onProgress);

        await store.addEvent('cloud_enabled').catch(() => undefined);
        if (this.cloud!.recoveryKeyMade) await store.addEvent('recovery_key_created').catch(() => undefined);
        this.cloud = { ...this.cloud!, status: 'on', uploadedAt: nowIso() };
        await this.persist();
        this.touch();
        return { uploaded: this.cloudStatus().records ?? 0 };
    }

    /**
     * Brings this device and the cloud copy up to date with each other: pulls what other devices
     * changed, merges it, and pushes what changed here. Only one runs at a time; asking while one
     * runs queues one more run after it.
     */
    async syncCloud(store: CloudStore): Promise<SyncResult> {
        this.enforceLockTimers();
        if (!this.vaultKey) throw new Error('Vault is locked');
        if (this.cloud?.status !== 'on') throw new Error('Cloud sync isn\'t on');
        return this.runSync(store);
    }

    private runSync(store: CloudStore, onProgress?: (done: number, total: number) => void): Promise<SyncResult> {
        if (this.syncRun) {
            this.syncAgain = true;
            return this.syncRun;
        }
        this.syncRun = (async () => {
            try {
                let result: SyncResult;
                do {
                    this.syncAgain = false;
                    result = await this.syncCloudOnce(store, onProgress);
                } while (this.syncAgain && this.vaultKey);
                return result;
            } finally {
                this.syncRun = null;
            }
        })();
        return this.syncRun;
    }

    private async syncCloudOnce(store: CloudStore, onProgress?: (done: number, total: number) => void): Promise<SyncResult> {
        const key = this.vaultKey;
        const cloud = this.cloud;
        if (!key || !cloud) throw new Error('Vault is locked');
        try {
            const user = await store.currentUser();
            if (!user) throw new CloudError('signed-out', 'Sign in to FocuzNow to keep Cloud sync going.');
            if (user.id !== cloud.userId) {
                throw new CloudError('unknown', 'You\'re signed in to a different FocuzNow account than the one this vault syncs with.');
            }
            await this.ensureSyncState();
            const stillOpen = () => this.vaultKey === key && Boolean(this.cloud);
            const host: SyncHost = {
                keys: () => {
                    if (!stillOpen()) throw new Error('Vault is locked');
                    return { userId: cloud.userId, keyId: cloud.keyId, keyVersion: cloud.keyVersion, vaultKey: key };
                },
                state: () => this.cloud?.sync ?? { cursor: 0, synced: {} },
                snapshot: () => {
                    if (!stillOpen()) throw new Error('Vault is locked');
                    const generation = this.generation;
                    return { records: structuredClone(this.localRecords()), generation };
                },
                apply: (changes, state, generation) => this.applyRemote(key, changes, state, generation),
                saveState: async (state) => {
                    if (!stillOpen()) throw new Error('Vault is locked');
                    const current = this.cloud!.sync;
                    if (current && current.cursor === state.cursor && current.pullFrom === state.pullFrom && canonicalJson(current.synced) === canonicalJson(state.synced)) return;
                    this.cloud = { ...this.cloud!, sync: state };
                    await this.persist();
                },
            };
            const result = await syncOnce(store, host, { onProgress });
            if (stillOpen()) this.syncInfo = { lastSyncAt: nowIso() };
            return result;
        } catch (error) {
            if (this.vaultKey === key) {
                this.syncInfo = {
                    ...this.syncInfo,
                    error: { message: error instanceof Error ? error.message : 'Sync failed', code: error instanceof CloudError ? error.code : undefined, at: nowIso() },
                };
            }
            throw error;
        }
    }

    /** Everything that syncs, as it is now. */
    private localRecords(): LocalRecord[] {
        const as = (value: object) => value as unknown as Record<string, unknown>;
        return [
            ...this.items.map((item) => ({ kind: 'item' as const, localId: item.id, body: as(item) })),
            ...this.vaults.map((vault) => ({ kind: 'collection' as const, localId: vault.id, body: as(vault) })),
            ...this.tags.map((tag) => ({ kind: 'tag' as const, localId: tag.id, body: as(tag) })),
            ...this.cloudExtra,
        ];
    }

    /**
     * Vaults from before sync (Cloud sync turned on in phase 2) only know which revision of each
     * record went up. Items not edited since the upload count as in sync; anything else goes up
     * once more, which is harmless.
     */
    private async ensureSyncState() {
        if (!this.cloud || this.cloud.sync) return;
        const uploadedAt = Date.parse(this.cloud.uploadedAt ?? '') || 0;
        const local = await indexLocal(this.localRecords());
        const synced: Record<string, SyncedEntry> = {};
        for (const [id, rev] of Object.entries(this.cloud.uploaded.records)) {
            const mine = local.get(id);
            const edited = Date.parse(String(mine?.record.body.updatedAt ?? '')) || Number.POSITIVE_INFINITY;
            const unchanged = mine?.record.kind === 'item' && edited <= uploadedAt;
            synced[id] = { rev, hash: unchanged ? mine!.hash : '', ...(mine && mine.record.kind !== 'item' ? { kind: mine.record.kind } : {}) };
        }
        this.cloud = { ...this.cloud, sync: { cursor: 0, synced } };
    }

    /** A synced item as this vault stores it: the same round trip every item takes through storage. */
    private async itemFromRecord(key: CryptoKey, body: Record<string, unknown>): Promise<DecryptedVaultItem | null> {
        const type = body.type;
        if (typeof body.id !== 'string' || !body.id || (type !== 'login' && type !== 'card' && type !== 'passkey' && type !== 'custom')) return null;
        const title = typeof body.title === 'string' && body.title ? body.title : 'Untitled';
        const candidate = {
            ...body,
            ...organization(body as Partial<DecryptedVaultItem>),
            id: body.id,
            type,
            title,
            identity: typeof body.identity === 'string' ? body.identity : '',
            mark: typeof body.mark === 'string' && body.mark ? body.mark : defaultMark(title, type),
            markTone: typeof body.markTone === 'string' && body.markTone ? body.markTone : defaultTone(type, title),
            createdAt: typeof body.createdAt === 'string' ? body.createdAt : nowIso(),
            updatedAt: typeof body.updatedAt === 'string' ? body.updatedAt : nowIso(),
            ...(type === 'custom' && (typeof body.fields !== 'object' || !body.fields) ? { fields: {} } : {}),
        } as DecryptedVaultItem;
        try {
            return await decryptItem(key, await encryptItem(key, candidate));
        } catch {
            return null;
        }
    }

    /** Pulled records sorted into what this vault holds, each exactly as it will be stored. */
    private async contentFrom(key: CryptoKey, records: LocalRecord[]) {
        const items: DecryptedVaultItem[] = [];
        const vaults: VaultCollection[] = [];
        const tags: VaultTag[] = [];
        const extra: LocalRecord[] = [];
        const stored: LocalRecord[] = [];
        const text = (value: unknown, fallback: string) => (typeof value === 'string' && value ? value : fallback);
        for (const record of records) {
            const body = record.body;
            if (record.kind === 'item') {
                const item = await this.itemFromRecord(key, body);
                if (item) {
                    items.push(item);
                    stored.push({ kind: 'item', localId: item.id, body: item as unknown as Record<string, unknown> });
                    continue;
                }
            } else if ((record.kind === 'collection' || record.kind === 'tag') && typeof body.id === 'string' && body.id) {
                const isVault = record.kind === 'collection';
                const entry = {
                    id: body.id,
                    name: text(body.name, isVault ? 'Vault' : 'Tag'),
                    color: text(body.color, isVault ? '#6e8fb8' : '#63b995'),
                    icon: text(body.icon, isVault ? 'vault' : 'tag'),
                    createdAt: text(body.createdAt, nowIso()),
                };
                (isVault ? vaults : tags).push(entry);
                stored.push({ kind: record.kind, localId: entry.id, body: entry });
                continue;
            }
            // A newer version's record (or a settings record): kept as it came, never dropped.
            extra.push(record);
            stored.push(record);
        }
        return { items, vaults, tags, extra, stored };
    }

    /** `synced`, with the fingerprints of what's actually stored for the records just taken in. */
    private async fingerprintStored(stored: LocalRecord[], synced: Record<string, SyncedEntry>): Promise<Record<string, SyncedEntry>> {
        const next = { ...synced };
        for (const record of stored) {
            const id = await recordIdFor(record.kind, record.localId);
            if (next[id] && !next[id].deleted) next[id] = { ...next[id], hash: await fingerprint(recordPlaintext(record)) };
        }
        return next;
    }

    private async applyRemote(key: CryptoKey, changes: RemoteChanges, state: SyncState, generation: number): Promise<boolean> {
        const upserts = await this.contentFrom(key, changes.upserts);
        const copies = await this.contentFrom(key, changes.copies);
        const synced = await this.fingerprintStored(upserts.stored, state.synced);
        // Everything above was prepared without touching the vault; if it changed meanwhile, merge again.
        if (generation !== this.generation || this.vaultKey !== key || !this.cloud) return false;

        const put = <T extends { id: string }>(list: T[], entry: T, front = false) => {
            const index = list.findIndex((candidate) => candidate.id === entry.id);
            if (index >= 0) list[index] = entry;
            else if (front) list.unshift(entry);
            else list.push(entry);
        };
        for (const item of [...upserts.items, ...copies.items]) put(this.items, item, true);
        for (const vault of upserts.vaults) put(this.vaults, vault);
        for (const tag of upserts.tags) put(this.tags, tag);
        for (const record of [...upserts.extra, ...copies.extra]) {
            this.cloudExtra = [...this.cloudExtra.filter((r) => !(r.kind === record.kind && r.localId === record.localId)), record];
        }
        for (const removed of changes.removes) {
            if (removed.kind === 'item') this.items = this.items.filter((item) => item.id !== removed.localId);
            else if (removed.kind === 'collection') this.vaults = this.vaults.filter((vault) => vault.id !== removed.localId);
            else if (removed.kind === 'tag') this.tags = this.tags.filter((tag) => tag.id !== removed.localId);
            this.cloudExtra = this.cloudExtra.filter((r) => !(r.kind === removed.kind && r.localId === removed.localId));
        }
        if (!this.vaults.length) this.vaults = [defaultVault()];

        this.cloud = { ...this.cloud, sync: { ...state, synced } };
        await this.persist();
        return true;
    }

    /** The cloud state for a device that opened an existing account with the Security Key. */
    private joinedState(opened: OpenedAccount, sync: SyncState): VaultCloudState {
        return {
            status: 'on',
            userId: opened.user.id,
            email: opened.user.email,
            secretKey: opened.secretKey,
            secretKeyId: opened.account.secret_key_id,
            accountKey: bytesToBase64(opened.accountKey),
            keyId: opened.keys.keyId,
            keyVersion: opened.keys.keyVersion,
            account: {
                salt: opened.account.salt,
                iterations: Number(opened.account.iterations),
                wrappedAccountKey: opened.account.wrapped_account_key,
                recoveryWrappedAccountKey: opened.account.recovery_wrapped_account_key ?? undefined,
                revision: Number(opened.account.revision),
            },
            uploaded: { account: true, key: true, records: {} },
            joinedAt: nowIso(),
            sync,
        };
    }

    /**
     * Sets up FocuzPass on a device that doesn't have it yet, from the cloud copy: sign in, then
     * the master password and Security Key. The master password is the cloud one from then on.
     */
    async joinCloud(
        store: CloudStore,
        input: { masterPassword: string; secretKey: string },
        options: { idleLockMinutes?: number; recordDevice?: boolean } = {},
    ): Promise<VaultStatus> {
        if ((await this.storage.get([FOCUZPASS_STORAGE_META]))[FOCUZPASS_STORAGE_META]) {
            throw new Error('FocuzPass is already set up on this device. Unlock it, then add it from Cloud sync in the profile menu.');
        }
        const opened = await openCloudAccount(store, input);
        const pulled = await pullEverything(store, opened.keys);
        const content = await this.contentFrom(opened.keys.vaultKey, pulled.records);
        const synced = await this.fingerprintStored(content.stored, pulled.state.synced);
        const raw = opened.vaultKeyRaw;
        const meta = await wrappedMeta(input.masterPassword, raw);
        const inboxPair = await generateInboxKeyPair();
        const settings: VaultSettings = { idleLockMinutes: options.idleLockMinutes ?? 15 };

        this.items = content.items;
        this.vaults = content.vaults.length ? content.vaults : [defaultVault()];
        this.tags = content.tags;
        this.cloudExtra = content.extra;
        this.inboxPrivateKey = inboxPair.privateJwk;
        this.cloud = this.joinedState(opened, { ...pulled.state, synced });
        this.unlockedAt = Date.now();
        this.lastActivityAt = this.unlockedAt;
        this.idleLockMs = settings.idleLockMinutes * 60000;
        try {
            this.vaultKey = await this.adoptRawKey(raw);
            await this.storage.set({
                [FOCUZPASS_STORAGE_META]: meta,
                [FOCUZPASS_STORAGE_BLOB]: await this.encryptDocument(this.vaultKey),
                [FOCUZPASS_STORAGE_SETTINGS]: settings,
                [FOCUZPASS_STORAGE_INBOX_PUB]: inboxPair.publicJwk,
            });
        } catch (error) {
            this.lock();
            throw error;
        }
        this.configuredCache = true;
        // The web vault opens this way every time; only real devices are worth a security event.
        if (options.recordDevice !== false) await store.addEvent('device_added').catch(() => undefined);
        return this.getStatus();
    }

    /**
     * Adds a device that already has its own vault to an existing cloud account. The cloud copy
     * comes down, this device's items that aren't already in it are added (vaults and tags are
     * matched by name), and from then on the device uses the cloud vault key and the cloud master
     * password. The old vault is kept aside until the new one has been read back and opened.
     */
    async addToCloud(
        store: CloudStore,
        input: { masterPassword: string; secretKey: string; localPassword: string },
    ): Promise<{ added: number; alreadyThere: number }> {
        this.enforceLockTimers();
        if (!this.vaultKey) throw new Error('Vault is locked');
        if (this.cloud?.status === 'on') throw new Error('This device already syncs with FocuzPass Cloud');
        if (this.cloud?.uploaded.account) throw new Error('Finish turning on Cloud sync on this device instead.');
        await this.checkMasterPassword(input.localPassword);
        const opened = await openCloudAccount(store, input);
        const pulled = await pullEverything(store, opened.keys);
        const content = await this.contentFrom(opened.keys.vaultKey, pulled.records);
        const synced = await this.fingerprintStored(content.stored, pulled.state.synced);

        // This device's vaults and tags join the cloud ones with the same name.
        const byName = <T extends { id: string; name: string }>(cloudList: T[], localList: T[]) => {
            const ids = new Map<string, string>();
            const extra: T[] = [];
            for (const entry of localList) {
                const match = cloudList.find((candidate) => candidate.id === entry.id || candidate.name.toLowerCase() === entry.name.toLowerCase());
                if (match) ids.set(entry.id, match.id);
                else extra.push(entry);
            }
            return { ids, extra };
        };
        const vaultMatch = byName(content.vaults, this.vaults);
        const tagMatch = byName(content.tags, this.tags);
        const cloudIds = new Set(content.items.map((item) => item.id));
        const known = new Set(content.items.map(importFingerprint));
        const added: DecryptedVaultItem[] = [];
        let alreadyThere = 0;
        for (const item of this.items) {
            if (known.has(importFingerprint(item))) {
                alreadyThere++;
                continue;
            }
            added.push({
                ...item,
                id: cloudIds.has(item.id) ? crypto.randomUUID() : item.id,
                vaultId: vaultMatch.ids.get(item.vaultId) ?? item.vaultId,
                tagIds: item.tagIds.map((id) => tagMatch.ids.get(id) ?? id),
            });
        }

        const previous = { items: this.items, vaults: this.vaults, tags: this.tags, cloudExtra: this.cloudExtra, cloud: this.cloud, vaultKey: this.vaultKey, sessionKeyB64: this.sessionKeyB64 };
        const oldData = await this.storage.get([FOCUZPASS_STORAGE_META, FOCUZPASS_STORAGE_BLOB]);
        const raw = opened.vaultKeyRaw;
        const newKey = await importRawVaultKey(raw);
        this.items = [...content.items, ...added];
        this.vaults = [...content.vaults, ...vaultMatch.extra];
        if (!this.vaults.length) this.vaults = [defaultVault()];
        this.tags = [...content.tags, ...tagMatch.extra];
        this.cloudExtra = content.extra;
        this.cloud = this.joinedState(opened, { ...pulled.state, synced });
        try {
            const meta = await wrappedMeta(input.masterPassword, raw);
            const blob = await this.encryptDocument(newKey);
            await this.storage.set({ [FOCUZPASS_STORAGE_UPGRADE_BACKUP]: { meta: oldData[FOCUZPASS_STORAGE_META], blob: oldData[FOCUZPASS_STORAGE_BLOB] } });
            await this.storage.set({ [FOCUZPASS_STORAGE_META]: meta, [FOCUZPASS_STORAGE_BLOB]: blob });
            const written = await this.storage.get([FOCUZPASS_STORAGE_META, FOCUZPASS_STORAGE_BLOB]);
            const check = await openVault(input.masterPassword, written[FOCUZPASS_STORAGE_META] as VaultMeta, written[FOCUZPASS_STORAGE_BLOB] as VaultBlob);
            if (typeof check === 'string' || (check.document.items ?? []).length !== this.items.length) throw new Error('FocuzPass couldn\'t check the merged vault, so nothing changed.');
            this.vaultKey = await this.adoptRawKey(raw);
            await this.storage.remove([FOCUZPASS_STORAGE_UPGRADE_BACKUP]);
        } catch (error) {
            await this.storage.set({ [FOCUZPASS_STORAGE_META]: oldData[FOCUZPASS_STORAGE_META], [FOCUZPASS_STORAGE_BLOB]: oldData[FOCUZPASS_STORAGE_BLOB] });
            await this.storage.remove([FOCUZPASS_STORAGE_UPGRADE_BACKUP]);
            Object.assign(this, previous);
            throw error;
        }
        await store.addEvent('device_added').catch(() => undefined);
        this.touch();
        return { added: added.length, alreadyThere };
    }

    /** After a new master password: sends the re-wrapped account row. Returns whether it sent one. */
    async syncCloudAccount(store: CloudStore): Promise<boolean> {
        if (!this.vaultKey || !this.cloud?.accountPending) return false;
        try {
            await store.updateAccount(this.accountRow());
        } catch (error) {
            if (!(error instanceof CloudError && error.code === 'conflict')) throw error;
            // Another device wrote the account row since (its own new password): this one is newer.
            const server = await store.getAccount();
            if (!server) throw error;
            this.cloud = { ...this.cloud, account: { ...this.cloud.account, revision: Number(server.revision) + 1 } };
            await store.updateAccount(this.accountRow());
        }
        this.cloud = { ...this.cloud!, accountPending: undefined };
        await this.persist();
        await store.addEvent('password_changed').catch(() => undefined);
        return true;
    }

    private accountRow(): CloudAccountRow {
        const cloud = this.cloud!;
        return {
            user_id: cloud.userId,
            format: 1,
            kdf: FOCUZPASS_KDF,
            iterations: cloud.account.iterations,
            salt: cloud.account.salt,
            secret_key_id: cloud.secretKeyId,
            wrapped_account_key: cloud.account.wrappedAccountKey,
            recovery_wrapped_account_key: cloud.account.recoveryWrappedAccountKey ?? null,
            revision: cloud.account.revision,
        };
    }

    /* ── Passkeys (docs/focuzpass-cloud-plan.md, "Passkeys") ────────── */

    /** Usable passkeys for a site (not archived or in the trash). */
    private passkeysFor(rpId: string): DecryptedPasskeyItem[] {
        return this.items.filter(
            (item): item is DecryptedPasskeyItem => item.type === 'passkey' && !!item.passkey && item.passkey.rpId === rpId && !item.archivedAt && !item.deletedAt,
        );
    }

    /** Backed up while Cloud sync is on; "user verified" because using it needs the vault unlocked. */
    private passkeyFlags() {
        return { userVerified: true, backedUp: this.cloud?.status === 'on' };
    }

    /**
     * What a passkey request from `origin` would do, before anyone is asked: the site it's for and,
     * for sign-in, which of this vault's passkeys fit. `origin` is the requesting frame's, from the browser.
     */
    passkeyPreflight(
        origin: string,
        request: { op: 'create'; options: CreationOptionsJSON } | { op: 'get'; options: RequestOptionsJSON },
    ): { rpId: string; rpName?: string; userName?: string; excluded?: boolean; accounts: { credentialId: string; userName: string; title: string; lastUsedAt?: string }[] } {
        this.enforceLockTimers();
        if (!this.vaultKey) throw new Error('Vault is locked');
        const check = checkRpId(origin, request.op === 'create' ? request.options?.rp?.id : request.options?.rpId);
        if (!check.ok) throw new PasskeyError('SecurityError', check.reason);
        const mine = this.passkeysFor(check.rpId);
        if (request.op === 'create') {
            const exclude = new Set((request.options.excludeCredentials ?? []).map((c) => c.id));
            return {
                rpId: check.rpId,
                rpName: String(request.options.rp?.name || check.rpId).slice(0, 200),
                userName: String(request.options.user?.name ?? '').slice(0, 320),
                excluded: mine.some((item) => exclude.has(item.passkey!.credentialId)),
                accounts: [],
            };
        }
        const allow = new Set((request.options.allowCredentials ?? []).map((c) => c.id));
        const accounts = mine
            .filter((item) => !allow.size || allow.has(item.passkey!.credentialId))
            .map((item) => ({ credentialId: item.passkey!.credentialId, userName: item.passkey!.userName || item.identity, title: item.title, lastUsedAt: item.lastUsedAt }));
        return { rpId: check.rpId, accounts };
    }

    /**
     * Makes a passkey for the site at `origin` and saves it in the vault (it syncs like any item).
     * `topOrigin`: the page it's in, when the request came from an iframe on another site.
     */
    async passkeyCreate(origin: string, options: CreationOptionsJSON, topOrigin?: string): Promise<RegistrationResponseJSON> {
        this.enforceLockTimers();
        if (!this.vaultKey) throw new Error('Vault is locked');
        const preflight = this.passkeyPreflight(origin, { op: 'create', options });
        if (preflight.excluded) throw new PasskeyError('InvalidStateError', 'You already have a passkey for this account in FocuzPass.');
        const { response, secret, rpName } = await makeCredential(options, origin, this.passkeyFlags(), topOrigin);
        // One passkey per account and site: a new one for the same account replaces the old (as WebAuthn says).
        const existing = this.passkeysFor(secret.rpId).find((item) => item.passkey!.userHandle === secret.userHandle);
        const now = nowIso();
        const item: DecryptedPasskeyItem = {
            ...organization(existing ?? {}),
            vaultId: existing?.vaultId || this.vaults[0]?.id || DEFAULT_VAULT_ID,
            sortOrder: existing?.sortOrder ?? (this.items.length ? Math.min(...this.items.map((i) => i.sortOrder)) - 1 : 0),
            id: existing?.id ?? crypto.randomUUID(),
            type: 'passkey',
            title: existing?.title || rpName,
            identity: secret.userName || secret.userDisplayName || 'Passkey',
            domain: secret.rpId,
            credentialId: secret.credentialId,
            note: existing?.note,
            passkey: secret,
            mark: existing?.mark || defaultMark(rpName, 'passkey'),
            markTone: existing?.markTone || defaultTone('passkey', rpName),
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
            lastUsedAt: now,
            experimental: true,
        };
        const previous = this.items.slice();
        const index = this.items.findIndex((candidate) => candidate.id === item.id);
        if (index >= 0) this.items[index] = item;
        else this.items.unshift(item);
        try {
            await this.persist();
        } catch (error) {
            this.items = previous;
            throw error;
        }
        this.touch();
        return response;
    }

    /** Signs in to the site at `origin` with one of its passkeys. */
    async passkeyGet(origin: string, options: RequestOptionsJSON, credentialId: string, topOrigin?: string): Promise<AuthenticationResponseJSON> {
        this.enforceLockTimers();
        if (!this.vaultKey) throw new Error('Vault is locked');
        const check = checkRpId(origin, options?.rpId);
        if (!check.ok) throw new PasskeyError('SecurityError', check.reason);
        const item = this.passkeysFor(check.rpId).find((candidate) => candidate.passkey!.credentialId === credentialId);
        if (!item) throw new PasskeyError('NotAllowedError', 'That passkey isn\'t in FocuzPass anymore.');
        const response = await getAssertion(options, origin, item.passkey!, this.passkeyFlags(), topOrigin);
        // "Last used" is bookkeeping (no counter to keep in step): save it after the site has its
        // answer, not before. Saving re-encrypts the whole vault, and every sign-in waited on it.
        void this.markUsed(item.id).catch(() => undefined);
        return response;
    }

    private inboxPublicJwk(): JsonWebKey {
        // The public JWK is derivable from the private JWK by dropping `d`.
        const { d: _d, key_ops: _ops, ext: _ext, ...pub } = this.inboxPrivateKey as JsonWebKey & { d?: string };
        return pub;
    }

    /** Ensure an ECDH P-256 inbox keypair exists; public JWK stays plaintext in local storage. */
    private async ensureInboxKeyPair() {
        if (this.inboxPrivateKey) return;
        const pair = await generateInboxKeyPair();
        this.inboxPrivateKey = pair.privateJwk;
        await this.storage.set({ [FOCUZPASS_STORAGE_INBOX_PUB]: pair.publicJwk });
        await this.persist();
    }

    /**
     * Merge the locked-save inbox (§5.3): decrypt each envelope with the inbox
     * private key, upsert by domain+identity (duplicates update the password),
     * clear the queue, and report how many were merged.
     */
    async drainInbox(): Promise<number> {
        if (!this.vaultKey || !this.inboxPrivateKey) return 0;
        const stored = await this.storage.get([FOCUZPASS_STORAGE_INBOX]);
        const envelopes = Array.isArray(stored[FOCUZPASS_STORAGE_INBOX])
            ? (stored[FOCUZPASS_STORAGE_INBOX] as InboxEnvelope[])
            : [];
        if (envelopes.length === 0) return 0;
        let merged = 0;
        for (const envelope of envelopes) {
            try {
                const pending = JSON.parse(await decryptInboxEntry(this.inboxPrivateKey, envelope)) as InboxPendingLogin;
                if (!pending?.identity || !pending?.password || !pending?.domain) continue;
                const existing = this.items.find((item) =>
                    item.type === 'login'
                    && !item.deletedAt
                    && isExactVaultDomain(item.domain, pending.domain)
                    && item.identity.toLowerCase() === pending.identity.toLowerCase());
                await this.upsert({
                    id: existing?.id,
                    type: 'login',
                    title: pending.title || pending.domain,
                    identity: pending.identity,
                    domain: pending.domain,
                    password: pending.password,
                });
                merged += 1;
            } catch {
                /* undecryptable or malformed entry — discard */
            }
        }
        await this.storage.set({ [FOCUZPASS_STORAGE_INBOX]: [] });
        return merged;
    }

    list(): DecryptedVaultItem[] {
        this.enforceLockTimers();
        if (!this.vaultKey) throw new Error('Vault is locked');
        this.touch();
        return this.items.filter((item) => !item.deletedAt).map((item) => ({ ...item }));
    }

    snapshot(): VaultSnapshot {
        this.enforceLockTimers();
        if (!this.vaultKey) throw new Error('Vault is locked');
        this.touch();
        return {
            items: this.items.map((item) => ({ ...item, tagIds: [...item.tagIds] })),
            vaults: this.vaults.map((vault) => ({ ...vault })),
            tags: this.tags.map((tag) => ({ ...tag })),
        };
    }

    findLoginMatches(domain: string): DecryptedLoginItem[] {
        this.enforceLockTimers();
        if (!this.vaultKey) throw new Error('Vault is locked');
        const normalized = normalizeVaultDomain(domain);
        if (!normalized) return [];
        this.touch();
        return this.items
            .filter(
                (item): item is DecryptedLoginItem =>
                    item.type === 'login' && !item.archivedAt && !item.deletedAt && isExactVaultDomain(item.domain, normalized),
            )
            .map((item) => ({ ...item }));
    }

    async markUsed(id: string): Promise<void> {
        this.enforceLockTimers();
        if (!this.vaultKey) throw new Error('Vault is locked');
        const item = this.items.find((candidate) => candidate.id === id);
        if (!item) throw new Error('Vault item not found');
        item.lastUsedAt = nowIso();
        item.updatedAt = item.lastUsedAt;
        await this.persist();
        this.touch();
    }

    async upsert(input: VaultUpsertInput): Promise<DecryptedVaultItem> {
        this.enforceLockTimers();
        if (!this.vaultKey) throw new Error('Vault is locked');
        const next = this.buildItem(input);
        const previous = this.items.slice();
        const idx = this.items.findIndex((item) => item.id === next.id);
        if (idx >= 0) this.items[idx] = next;
        else this.items.unshift(next);
        try {
            await this.persist();
        } catch (error) {
            // Nothing was saved, so don't keep showing the change either.
            this.items = previous;
            throw error;
        }
        this.touch();
        return { ...next };
    }

    /**
     * Adds many items with one save (a vault import). Items that match something already in the
     * vault (same site, username and password; same card number…) are left out.
     */
    async importItems(
        inputs: VaultUpsertInput[],
        options: { vaultId?: string; tagName?: string } = {},
    ): Promise<{ added: number; duplicates: number; failed: number }> {
        this.enforceLockTimers();
        if (!this.vaultKey) throw new Error('Vault is locked');
        const vaultId = this.vaults.some((vault) => vault.id === options.vaultId) ? options.vaultId : this.vaults[0]?.id || DEFAULT_VAULT_ID;

        const previousItems = this.items.slice();
        const previousTags = this.tags.slice();
        let tagIds: string[] = [];
        const tagName = options.tagName?.trim();
        if (tagName) {
            let tag = this.tags.find((candidate) => candidate.name.toLowerCase() === tagName.toLowerCase());
            if (!tag) {
                tag = { id: crypto.randomUUID(), name: tagName, color: '#8b93a1', icon: 'tag', createdAt: nowIso() };
                this.tags.push(tag);
            }
            tagIds = [tag.id];
        }

        const known = new Set(this.items.filter((item) => !item.deletedAt).map(importFingerprint));
        const top = this.items.length ? Math.min(...this.items.map((item) => item.sortOrder)) : 0;
        const added: DecryptedVaultItem[] = [];
        let duplicates = 0;
        let failed = 0;
        inputs.forEach((input, index) => {
            const key = importFingerprint(input);
            if (known.has(key)) {
                duplicates++;
                return;
            }
            try {
                added.push(
                    this.buildItem({
                        ...input,
                        id: undefined,
                        vaultId: input.vaultId && this.vaults.some((vault) => vault.id === input.vaultId) ? input.vaultId : vaultId,
                        tagIds: [...new Set([...(input.tagIds ?? []), ...tagIds])],
                        archivedAt: undefined,
                        deletedAt: undefined,
                        // Keep the export's order, above everything already in the vault.
                        sortOrder: top - inputs.length + index,
                    }),
                );
                known.add(key);
            } catch {
                failed++;
            }
        });

        if (added.length || tagIds.length) {
            this.items.unshift(...added);
            try {
                await this.persist();
            } catch (error) {
                // All or nothing: a failed save leaves the vault exactly as it was.
                this.items = previousItems;
                this.tags = previousTags;
                throw error;
            }
        }
        this.touch();
        return { added: added.length, duplicates, failed };
    }

    /** The vault, encrypted as it is at rest, to open on another device with the same master password. */
    async exportPackage(): Promise<VaultExportPackage> {
        this.enforceLockTimers();
        if (!this.vaultKey) throw new Error('Vault is locked');
        const meta = (await this.storage.get([FOCUZPASS_STORAGE_META]))[FOCUZPASS_STORAGE_META] as VaultMeta | undefined;
        if (!isConfigured(meta)) throw new Error('FocuzPass is not set up');
        const live = this.items.filter((item) => !item.deletedAt);
        const stored: StoredVaultItem[] = [];
        for (const item of live) stored.push(await encryptItem(this.vaultKey, item));
        assertStoredItemsEncrypted(stored, live);
        // Items, vault and tag names only: the locked-save inbox key stays on this device.
        const data = await encryptAesGcm(
            this.vaultKey,
            JSON.stringify({ version: FOCUZPASS_VAULT_VERSION, items: stored, vaults: this.vaults, tags: this.tags }),
        );
        this.touch();
        const base = {
            format: 'focuzpass-export' as const,
            createdAt: nowIso(),
            itemCount: live.length,
            kdf: FOCUZPASS_KDF,
            iterations: meta!.iterations || FOCUZPASS_PBKDF2_ITERATIONS,
            salt: meta!.salt,
            data,
        };
        // Opens with this master password on any device: the vault key comes along, wrapped by it.
        return meta!.wrappedKey ? { ...base, version: 2, wrappedKey: meta!.wrappedKey } : { ...base, version: 1, verifier: meta!.verifier };
    }

    /**
     * Opens a package from another device with that vault's master password and adds its items
     * here (same rules as importItems: one save, nothing already here is added twice). Vaults and
     * tags are matched by name; tags that don't exist here are created.
     */
    async importPackage(
        pkg: unknown,
        masterPassword: string,
        options: { vaultId?: string; tagName?: string } = {},
    ): Promise<{ added: number; duplicates: number; failed: number }> {
        this.enforceLockTimers();
        if (!this.vaultKey) throw new Error('Vault is locked');
        const p = readExportPackage(pkg);
        const wrongPassword = 'That isn\'t the master password of the vault this came from';
        let key: CryptoKey;
        if (p.version === 2) {
            try {
                const wrappingKey = await deriveWrappingKey(masterPassword, base64ToBytes(p.salt), p.iterations);
                key = await importRawVaultKey(await unwrapVaultKey(wrappingKey, p.wrappedKey!));
            } catch {
                throw new Error(wrongPassword);
            }
        } else {
            key = await deriveVaultKey(masterPassword, base64ToBytes(p.salt), p.iterations);
            if (!(await verifyMasterPassword(key, p.verifier!))) throw new Error(wrongPassword);
        }
        const doc = JSON.parse(await decryptAesGcm(key, p.data)) as { items?: StoredVaultItem[]; vaults?: VaultCollection[]; tags?: VaultTag[] };
        const vaultByName = new Map(this.vaults.map((vault) => [vault.name.toLowerCase(), vault.id]));
        const sourceVaults = new Map((doc.vaults ?? []).map((vault) => [vault.id, vault.name]));
        const sourceTags = new Map((doc.tags ?? []).map((tag) => [tag.id, tag]));
        const inputs: VaultUpsertInput[] = [];
        for (const stored of Array.isArray(doc.items) ? doc.items : []) {
            // Exports leave the trash out; don't bring trashed items back as live ones if a file has them.
            if (stored.deletedAt) continue;
            const item = await decryptItem(key, stored);
            const vaultName = sourceVaults.get(item.vaultId)?.toLowerCase();
            const tagIds = item.tagIds
                .map((id) => sourceTags.get(id))
                .filter((tag): tag is VaultTag => !!tag)
                .map((tag) => this.tagIdFor(tag));
            inputs.push({ ...upsertInputFrom(item), vaultId: (vaultName && vaultByName.get(vaultName)) || undefined, tagIds });
        }
        return this.importItems(inputs, options);
    }

    /** This vault's tag with the same name, created (unsaved) if there isn't one. */
    private tagIdFor(tag: VaultTag): string {
        const existing = this.tags.find((candidate) => candidate.name.toLowerCase() === tag.name.toLowerCase());
        if (existing) return existing.id;
        const created: VaultTag = { id: crypto.randomUUID(), name: tag.name, color: tag.color, icon: tag.icon, createdAt: nowIso() };
        this.tags.push(created);
        return created.id;
    }

    /** The decrypted item an upsert input describes (validated), without saving it. */
    private buildItem(input: VaultUpsertInput): DecryptedVaultItem {
        if (!input.title?.trim()) {
            throw new Error('Name is required');
        }
        if (input.type !== 'custom' && !input.identity?.trim()) {
            throw new Error('Identity is required');
        }

        const existing = input.id ? this.items.find((item) => item.id === input.id) : undefined;
        const id = existing?.id || input.id || crypto.randomUUID();
        const createdAt = existing?.createdAt || nowIso();
        const updatedAt = nowIso();
        const mark = input.mark || existing?.mark || defaultMark(input.title, input.type);
        const markTone = input.markTone || existing?.markTone || defaultTone(input.type, input.title);
        const itemOrganization = {
            vaultId: input.vaultId || existing?.vaultId || this.vaults[0]?.id || DEFAULT_VAULT_ID,
            tagIds: input.tagIds ? [...new Set(input.tagIds)] : existing?.tagIds || [],
            favorite: input.favorite ?? existing?.favorite ?? false,
            archivedAt: input.archivedAt ?? existing?.archivedAt,
            deletedAt: input.deletedAt ?? existing?.deletedAt,
            sortOrder: input.sortOrder ?? existing?.sortOrder ?? (this.items.length ? Math.min(...this.items.map((item) => item.sortOrder)) - 1 : 0),
        };

        let next: DecryptedVaultItem;
        if (input.type === 'login') {
            const password =
                input.password !== undefined
                    ? input.password
                    : existing?.type === 'login'
                      ? existing.password
                      : undefined;
            const strength = password ? passwordStrength(password) : undefined;
            next = {
                ...itemOrganization,
                id,
                type: 'login',
                title: input.title.trim(),
                identity: input.identity.trim(),
                domain: input.domain?.trim() || undefined,
                authMethod: input.authMethod || (existing?.type === 'login' ? existing.authMethod : 'PASSWORD'),
                password,
                note: input.note?.trim() || undefined,
                strength,
                risk: strength === 'weak' ? 'weak' : undefined,
                mark,
                markTone,
                createdAt,
                updatedAt,
                lastUsedAt: existing?.lastUsedAt,
            };
        } else if (input.type === 'card') {
            const cardNumber =
                input.cardNumber !== undefined
                    ? input.cardNumber.replace(/\s/g, '')
                    : existing?.type === 'card'
                      ? existing.cardNumber
                      : undefined;
            next = {
                ...itemOrganization,
                id,
                type: 'card',
                title: input.title.trim(),
                identity: input.identity.trim(),
                cardNumber,
                expiry: input.expiry?.trim() || (existing?.type === 'card' ? existing.expiry : undefined),
                cvv:
                    input.cvv !== undefined
                        ? input.cvv
                        : existing?.type === 'card'
                          ? existing.cvv
                          : undefined,
                note: input.note?.trim() || undefined,
                mark,
                markTone,
                createdAt,
                updatedAt,
                lastUsedAt: existing?.lastUsedAt,
            };
        } else if (input.type === 'passkey') {
            next = {
                ...itemOrganization,
                id,
                type: 'passkey',
                title: input.title.trim(),
                identity: input.identity.trim(),
                domain: input.domain?.trim() || undefined,
                credentialId:
                    input.credentialId ||
                    (existing?.type === 'passkey' ? existing.credentialId : undefined) ||
                    `meta-${id}`,
                note: input.note?.trim() || undefined,
                // Editing a passkey's name or notes never touches the key itself; a package brings one in.
                passkey: (input.passkey && readPasskeySecret(input.passkey)) || (existing?.type === 'passkey' ? existing.passkey : undefined),
                mark,
                markTone,
                createdAt,
                updatedAt,
                lastUsedAt: existing?.lastUsedAt,
                experimental: true,
            };
        } else {
            const kind = input.kind || (existing?.type === 'custom' ? existing.kind : 'identity');
            next = {
                ...itemOrganization,
                id,
                type: 'custom',
                kind,
                title: input.title.trim(),
                identity: input.identity?.trim() || '',
                fields: input.fields || (existing?.type === 'custom' ? existing.fields : {}),
                note: input.note?.trim() || undefined,
                mark,
                markTone,
                createdAt,
                updatedAt,
                lastUsedAt: existing?.lastUsedAt,
            };
        }
        return next;
    }

    async delete(id: string): Promise<void> {
        await this.itemAction({ action: 'trash', id });
    }

    async createVault(input: { name: string; color: string; icon: string }): Promise<VaultCollection> {
        this.enforceLockTimers();
        if (!this.vaultKey) throw new Error('Vault is locked');
        const name = input.name.trim();
        if (!name) throw new Error('Vault name is required');
        if (this.vaults.some((vault) => vault.name.toLowerCase() === name.toLowerCase())) {
            throw new Error('A vault with this name already exists');
        }
        const vault: VaultCollection = {
            id: crypto.randomUUID(),
            name,
            color: input.color || '#6e8fb8',
            icon: input.icon || 'vault',
            createdAt: nowIso(),
        };
        this.vaults.push(vault);
        await this.persist();
        this.touch();
        return { ...vault };
    }

    async createTag(input: { name: string; color: string; icon: string }): Promise<VaultTag> {
        this.enforceLockTimers();
        if (!this.vaultKey) throw new Error('Vault is locked');
        const name = input.name.trim();
        if (!name) throw new Error('Tag name is required');
        if (this.tags.some((tag) => tag.name.toLowerCase() === name.toLowerCase())) {
            throw new Error('A tag with this name already exists');
        }
        const tag: VaultTag = {
            id: crypto.randomUUID(),
            name,
            color: input.color || '#63b995',
            icon: input.icon || 'tag',
            createdAt: nowIso(),
        };
        this.tags.push(tag);
        await this.persist();
        this.touch();
        return { ...tag };
    }

    async itemAction(input: VaultItemAction): Promise<DecryptedVaultItem | null> {
        this.enforceLockTimers();
        if (!this.vaultKey) throw new Error('Vault is locked');
        const item = this.items.find((candidate) => candidate.id === input.id);
        if (!item) throw new Error('Vault item not found');
        if (input.action === 'purge') {
            this.items = this.items.filter((candidate) => candidate.id !== input.id);
            await this.persist();
            this.touch();
            return null;
        }
        if (input.action === 'duplicate') {
            const duplicated: DecryptedVaultItem = {
                ...item,
                id: crypto.randomUUID(),
                title: `${item.title} copy`,
                tagIds: [...item.tagIds],
                favorite: false,
                archivedAt: undefined,
                deletedAt: undefined,
                createdAt: nowIso(),
                updatedAt: nowIso(),
                sortOrder: this.items.length ? Math.min(...this.items.map((candidate) => candidate.sortOrder)) - 1 : 0,
                ...(item.type === 'custom' ? { fields: { ...item.fields } } : {}),
                // A copy of a passkey is a note about it: one key, one credential.
                ...(item.type === 'passkey' ? { passkey: undefined, credentialId: undefined } : {}),
            } as DecryptedVaultItem;
            this.items.unshift(duplicated);
            await this.persist();
            this.touch();
            return { ...duplicated };
        }
        if (input.action === 'favorite') item.favorite = input.value;
        if (input.action === 'move') {
            if (!this.vaults.some((vault) => vault.id === input.vaultId)) throw new Error('Vault not found');
            item.vaultId = input.vaultId;
        }
        if (input.action === 'archive') {
            item.archivedAt = nowIso();
            item.deletedAt = undefined;
        }
        if (input.action === 'unarchive') item.archivedAt = undefined;
        if (input.action === 'trash') {
            item.deletedAt = nowIso();
            item.archivedAt = undefined;
        }
        if (input.action === 'restore') {
            item.deletedAt = undefined;
            item.archivedAt = undefined;
        }
        item.updatedAt = nowIso();
        await this.persist();
        this.touch();
        return { ...item };
    }

    async reorder(orderedIds: string[]): Promise<void> {
        this.enforceLockTimers();
        if (!this.vaultKey) throw new Error('Vault is locked');
        const uniqueIds = [...new Set(orderedIds.filter(Boolean))];
        const byId = new Map(this.items.map((item) => [item.id, item]));
        const ordered = uniqueIds.map((id) => byId.get(id)).filter((item): item is DecryptedVaultItem => Boolean(item));
        const included = new Set(ordered.map((item) => item.id));
        const remaining = [...this.items]
            .filter((item) => !included.has(item.id))
            .sort((a, b) => a.sortOrder - b.sortOrder);
        this.items = [...ordered, ...remaining].map((item, index) => ({ ...item, sortOrder: index }));
        await this.persist();
        this.touch();
    }

    /** Expose ciphertext samples for tests — does not include VK. */
    async readPersistedRaw(): Promise<{ meta?: VaultMeta; blob?: VaultBlob }> {
        const data = await this.storage.get([FOCUZPASS_STORAGE_META, FOCUZPASS_STORAGE_BLOB]);
        return {
            meta: data[FOCUZPASS_STORAGE_META] as VaultMeta | undefined,
            blob: data[FOCUZPASS_STORAGE_BLOB] as VaultBlob | undefined,
        };
    }

    private async persist() {
        if (!this.vaultKey) throw new Error('Vault is locked');
        this.generation++;
        await this.storage.set({ [FOCUZPASS_STORAGE_BLOB]: await this.encryptDocument(this.vaultKey) });
    }

    /** The whole vault as it's stored: items, vaults, tags and the inbox key, encrypted with `key`. */
    private async encryptDocument(key: CryptoKey): Promise<VaultBlob> {
        // All at once: one by one, a big vault made every save (and saving a passkey) slow.
        const storedItems: StoredVaultItem[] = await Promise.all(this.items.map((item) => encryptItem(key, item)));
        assertStoredItemsEncrypted(storedItems, this.items);
        const document: EncryptedVaultDocument = {
            version: FOCUZPASS_VAULT_VERSION,
            items: storedItems,
            vaults: this.vaults,
            tags: this.tags,
            inboxPrivateKey: this.inboxPrivateKey,
            cloud: this.cloud,
            cloudExtra: this.cloudExtra.length ? this.cloudExtra : undefined,
        };
        const serializedInner = JSON.stringify(document);
        const outer = await encryptAesGcm(key, serializedInner);
        const blob: VaultBlob = { iv: outer.iv, ct: outer.ct };
        // AES-GCM output is at least as long as its input; base64 makes it 4/3 longer again.
        const innerBytes = new TextEncoder().encode(serializedInner).length;
        if (typeof blob.ct !== 'string' || blob.ct.length < Math.ceil(innerBytes / 3) * 4 || blob.ct.includes('"items"')) {
            throw new Error('Vault encryption failed');
        }
        return blob;
    }
}

export function createMemoryStorage(): VaultStorageAdapter {
    const map = new Map<string, unknown>();
    return {
        async get(keys) {
            const out: Record<string, unknown> = {};
            for (const key of keys) {
                if (map.has(key)) out[key] = map.get(key);
            }
            return out;
        },
        async set(items) {
            for (const [key, value] of Object.entries(items)) map.set(key, value);
        },
        async remove(keys) {
            for (const key of keys) map.delete(key);
        },
    };
}
