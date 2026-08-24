/**
 * FocuzPass vault core — crypto + CRUD + lock timers.
 * Intended for the service worker; UI talks via messages only.
 */

import {
    base64ToBytes,
    bytesToBase64,
    createVerifier,
    decryptAesGcm,
    deriveVaultKey,
    encryptAesGcm,
    randomBytes,
    verifyMasterPassword,
} from './crypto';
import {
    FOCUZPASS_ABSOLUTE_MAX_MS,
    FOCUZPASS_DEFAULT_IDLE_LOCK_MS,
    FOCUZPASS_KDF,
    FOCUZPASS_PBKDF2_ITERATIONS,
    FOCUZPASS_STORAGE_BLOB,
    FOCUZPASS_STORAGE_META,
    FOCUZPASS_STORAGE_SETTINGS,
    FOCUZPASS_VAULT_VERSION,
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

function defaultMark(title: string, type: VaultUpsertInput['type']): string {
    const cleaned = title.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (type === 'card') return cleaned.slice(0, 4) || 'CARD';
    return cleaned.slice(0, 2) || 'FP';
}

function defaultTone(type: VaultUpsertInput['type'], title: string): string {
    if (type === 'passkey') return '#a78bfa';
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

export class FocuzPassVault {
    private vaultKey: CryptoKey | null = null;
    private items: DecryptedVaultItem[] = [];
    private vaults: VaultCollection[] = [];
    private tags: VaultTag[] = [];
    private unlockedAt = 0;
    private lastActivityAt = 0;
    private idleLockMs = FOCUZPASS_DEFAULT_IDLE_LOCK_MS;
    private onLockCallbacks = new Set<() => void>();

    constructor(private readonly storage: VaultStorageAdapter) {}

    onLock(cb: () => void) {
        this.onLockCallbacks.add(cb);
        return () => this.onLockCallbacks.delete(cb);
    }

    get isUnlocked() {
        return Boolean(this.vaultKey);
    }

    touch() {
        if (!this.vaultKey) return;
        this.lastActivityAt = Date.now();
        this.enforceLockTimers();
    }

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
        this.unlockedAt = 0;
        this.lastActivityAt = 0;
        for (const cb of this.onLockCallbacks) {
            try {
                cb();
            } catch {
                /* ignore */
            }
        }
    }

    async getStatus(platform: 'extension' | 'web' = 'extension'): Promise<VaultStatus> {
        this.enforceLockTimers();
        const data = await this.storage.get([
            FOCUZPASS_STORAGE_META,
            FOCUZPASS_STORAGE_BLOB,
            FOCUZPASS_STORAGE_SETTINGS,
        ]);
        const meta = data[FOCUZPASS_STORAGE_META] as VaultMeta | undefined;
        const settings = (data[FOCUZPASS_STORAGE_SETTINGS] as VaultSettings | undefined) || {
            idleLockMinutes: FOCUZPASS_DEFAULT_IDLE_LOCK_MS / 60000,
        };
        this.idleLockMs = Math.max(1, Number(settings.idleLockMinutes) || 15) * 60000;

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
            configured: Boolean(meta?.salt && meta?.verifier),
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

        const salt = randomBytes(16);
        const key = await deriveVaultKey(masterPassword, salt, FOCUZPASS_PBKDF2_ITERATIONS);
        const verifier = await createVerifier(key);
        const meta: VaultMeta = {
            version: FOCUZPASS_VAULT_VERSION,
            salt: bytesToBase64(salt),
            kdf: FOCUZPASS_KDF,
            iterations: FOCUZPASS_PBKDF2_ITERATIONS,
            verifier,
        };
        const settings: VaultSettings = { idleLockMinutes: 15 };
        const initialVault = defaultVault();
        const emptyDoc: EncryptedVaultDocument = {
            version: FOCUZPASS_VAULT_VERSION,
            items: [],
            vaults: [initialVault],
            tags: [],
        };
        const outer = await encryptAesGcm(key, JSON.stringify(emptyDoc));
        const blob: VaultBlob = { iv: outer.iv, ct: outer.ct };

        await this.storage.set({
            [FOCUZPASS_STORAGE_META]: meta,
            [FOCUZPASS_STORAGE_BLOB]: blob,
            [FOCUZPASS_STORAGE_SETTINGS]: settings,
        });

        this.vaultKey = key;
        this.items = [];
        this.vaults = [initialVault];
        this.tags = [];
        this.unlockedAt = Date.now();
        this.lastActivityAt = this.unlockedAt;
        this.idleLockMs = settings.idleLockMinutes * 60000;
        return this.getStatus();
    }

    async unlock(masterPassword: string): Promise<VaultStatus> {
        const data = await this.storage.get([FOCUZPASS_STORAGE_META, FOCUZPASS_STORAGE_BLOB, FOCUZPASS_STORAGE_SETTINGS]);
        const meta = data[FOCUZPASS_STORAGE_META] as VaultMeta | undefined;
        const blob = data[FOCUZPASS_STORAGE_BLOB] as VaultBlob | undefined;
        if (!meta?.salt || !meta.verifier || !blob?.ct || !blob.iv) {
            throw new Error('Vault is not set up');
        }

        const salt = base64ToBytes(meta.salt);
        const key = await deriveVaultKey(masterPassword, salt, meta.iterations || FOCUZPASS_PBKDF2_ITERATIONS);
        const ok = await verifyMasterPassword(key, meta.verifier);
        if (!ok) {
            throw new Error('Incorrect master password');
        }

        let document: EncryptedVaultDocument;
        try {
            const json = await decryptAesGcm(key, { iv: blob.iv, ct: blob.ct });
            document = JSON.parse(json) as EncryptedVaultDocument;
        } catch {
            throw new Error('Vault ciphertext is corrupted or tampered');
        }

        const items: DecryptedVaultItem[] = [];
        for (const stored of document.items || []) {
            items.push(await decryptItem(key, stored));
        }

        this.vaultKey = key;
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
        this.unlockedAt = Date.now();
        this.lastActivityAt = this.unlockedAt;
        const settings = (data[FOCUZPASS_STORAGE_SETTINGS] as VaultSettings | undefined) || {
            idleLockMinutes: 15,
        };
        this.idleLockMs = Math.max(1, Number(settings.idleLockMinutes) || 15) * 60000;
        return this.getStatus();
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

        const idx = this.items.findIndex((item) => item.id === id);
        if (idx >= 0) this.items[idx] = next;
        else this.items.unshift(next);
        await this.persist();
        this.touch();
        return { ...next };
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
        const storedItems: StoredVaultItem[] = [];
        const secretSamples: string[] = [];
        for (const item of this.items) {
            if (item.type === 'login' && item.password) secretSamples.push(item.password);
            if (item.type === 'card') {
                if (item.cardNumber) secretSamples.push(item.cardNumber);
                if (item.cvv) secretSamples.push(item.cvv);
            }
            if (item.type === 'custom') {
                secretSamples.push(...Object.values(item.fields).filter((value) => value !== item.identity && value !== item.title));
            }
            if (item.note) secretSamples.push(item.note);
            storedItems.push(await encryptItem(this.vaultKey, item));
        }
        const document: EncryptedVaultDocument = {
            version: FOCUZPASS_VAULT_VERSION,
            items: storedItems,
            vaults: this.vaults,
            tags: this.tags,
        };
        const serializedInner = JSON.stringify(document);
        assertNoPlaintextSecrets(serializedInner, secretSamples);
        const outer = await encryptAesGcm(this.vaultKey, serializedInner);
        const blob: VaultBlob = { iv: outer.iv, ct: outer.ct };
        const serializedOuter = JSON.stringify(blob);
        assertNoPlaintextSecrets(serializedOuter, secretSamples);
        await this.storage.set({ [FOCUZPASS_STORAGE_BLOB]: blob });
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
