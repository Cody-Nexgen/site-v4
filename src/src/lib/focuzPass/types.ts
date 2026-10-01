import type { LocalRecord, SyncState } from './cloud/sync';
import type { PasskeySecret } from './passkeys/webauthn';

/** FocuzPass vault types — secrets never leave the unlocked in-memory document. */

export const FOCUZPASS_STORAGE_META = 'focuzpass.meta.v1';
export const FOCUZPASS_STORAGE_BLOB = 'focuzpass.blob.v1';
export const FOCUZPASS_STORAGE_SETTINGS = 'focuzpass.settings.v1';
/** chrome.storage.session: exported raw vault key for SW-restart restore (§5.2). */
export const FOCUZPASS_STORAGE_SESSION_KEY = 'focuzpass.session.v1';
/** chrome.storage.local: public JWK (plaintext) + sealed pending-login queue (§5.3). */
export const FOCUZPASS_STORAGE_INBOX_PUB = 'focuzpass.inbox.pub';
export const FOCUZPASS_STORAGE_INBOX = 'focuzpass.inbox';
/** The previous meta + blob, kept only while an upgrade to the key hierarchy is being checked. */
export const FOCUZPASS_STORAGE_UPGRADE_BACKUP = 'focuzpass.upgrade-backup';

export const FOCUZPASS_KDF = 'pbkdf2-sha256' as const;
export const FOCUZPASS_PBKDF2_ITERATIONS = 600_000;
export const FOCUZPASS_VERIFIER_PLAINTEXT = 'focuzpass.v1.ok';
export const FOCUZPASS_ABSOLUTE_MAX_MS = 24 * 60 * 60 * 1000;
export const FOCUZPASS_DEFAULT_IDLE_LOCK_MS = 15 * 60 * 1000;
export const FOCUZPASS_VAULT_VERSION = 2;

export type VaultItemType = 'login' | 'card' | 'passkey' | 'custom';
export type CustomItemKind =
    | 'identity'
    | 'password'
    | 'api_credentials'
    | 'bank_account'
    | 'crypto_wallet'
    | 'driver_license'
    | 'email'
    | 'medical_record'
    | 'membership'
    | 'passport'
    | 'ssh_key'
    | 'social_security_number'
    | 'wireless_router';
export type PasswordStrength = 'weak' | 'okay' | 'strong';
export type AuthMethod =
    | 'PASSWORD'
    | 'GOOGLE_SSO'
    | 'MICROSOFT_SSO'
    | 'CLASSLINK_SSO'
    | 'APPLE_SSO'
    | 'OKTA_SSO'
    | 'SAML_GENERIC'
    | 'PASSKEY'
    | 'MAGIC_LINK'
    | 'OTP_ONLY'
    | 'CARD';

export type EncryptedPayload = {
    iv: string;
    ct: string;
};

export type VaultMeta = {
    version: number;
    /** Salt for the key derived from the master password. */
    salt: string;
    kdf: typeof FOCUZPASS_KDF;
    iterations: number;
    /**
     * The random vault key, wrapped by the key derived from the master password. Every vault
     * set up or unlocked by this version has one.
     */
    wrappedKey?: EncryptedPayload;
    /**
     * Older vaults only (no wrappedKey): the password-derived key was the vault key itself, and
     * this proved the password. Upgraded to wrappedKey on the next unlock.
     */
    verifier?: EncryptedPayload;
};

export type VaultBlob = {
    iv: string;
    ct: string;
};

export type VaultSettings = {
    idleLockMinutes: number;
};

/** Stored in chrome.storage.session (TRUSTED_CONTEXTS); survives SW restarts, dies on lock/browser restart. */
export type VaultSessionRecord = {
    k: string;
    unlockedAt: number;
    lastActivityAt: number;
};

/** Payload sealed into an inbox envelope while the vault is locked (§5.3). */
export type InboxPendingLogin = {
    domain: string;
    title: string;
    identity: string;
    password: string;
    createdAt: string;
};

export type VaultCollection = {
    id: string;
    name: string;
    color: string;
    icon: string;
    createdAt: string;
};

export type VaultTag = {
    id: string;
    name: string;
    color: string;
    icon: string;
    createdAt: string;
};

type StoredItemOrganization = {
    vaultId?: string;
    tagIds?: string[];
    favorite?: boolean;
    archivedAt?: string;
    deletedAt?: string;
    sortOrder?: number;
};

type DecryptedItemOrganization = {
    vaultId: string;
    tagIds: string[];
    favorite: boolean;
    archivedAt?: string;
    deletedAt?: string;
    sortOrder: number;
};

/** Sensitive fields encrypted individually before outer vault wrap. */
export type StoredLoginItem = StoredItemOrganization & {
    id: string;
    type: 'login';
    title: string;
    identity: string;
    domain?: string;
    authMethod: AuthMethod;
    password?: EncryptedPayload;
    notes?: EncryptedPayload;
    strength?: PasswordStrength;
    risk?: 'weak' | 'reused';
    mark: string;
    markTone: string;
    createdAt: string;
    updatedAt: string;
    lastUsedAt?: string;
};

export type StoredCardItem = StoredItemOrganization & {
    id: string;
    type: 'card';
    title: string;
    identity: string;
    number?: EncryptedPayload;
    expiry?: string;
    cvv?: EncryptedPayload;
    notes?: EncryptedPayload;
    mark: string;
    markTone: string;
    createdAt: string;
    updatedAt: string;
    lastUsedAt?: string;
};

export type StoredPasskeyItem = StoredItemOrganization & {
    id: string;
    type: 'passkey';
    title: string;
    identity: string;
    domain?: string;
    /** Public credential id (not secret). */
    credentialId?: string;
    /** Experimental — only present if user explicitly stored private material. */
    privateKey?: EncryptedPayload;
    notes?: EncryptedPayload;
    mark: string;
    markTone: string;
    createdAt: string;
    updatedAt: string;
    lastUsedAt?: string;
    experimental: true;
};

export type StoredCustomItem = StoredItemOrganization & {
    id: string;
    type: 'custom';
    kind: CustomItemKind;
    title: string;
    identity: string;
    fields?: EncryptedPayload;
    notes?: EncryptedPayload;
    mark: string;
    markTone: string;
    createdAt: string;
    updatedAt: string;
    lastUsedAt?: string;
};

export type StoredVaultItem = StoredLoginItem | StoredCardItem | StoredPasskeyItem | StoredCustomItem;

/**
 * FocuzPass Cloud on this device. It lives inside the encrypted vault document, so at rest the
 * Security Key and account key are protected exactly like the passwords.
 */
export type VaultCloudState = {
    /** pending: keys made, upload not finished. on: the cloud copy exists. */
    status: 'pending' | 'on';
    userId: string;
    email?: string;
    /** Canonical Security Key: A1 + 26 characters. */
    secretKey: string;
    secretKeyId: string;
    /** Raw account key, base64. */
    accountKey: string;
    keyId: string;
    keyVersion: number;
    /** The account row the server should have. */
    account: {
        salt: string;
        iterations: number;
        wrappedAccountKey: EncryptedPayload;
        recoveryWrappedAccountKey?: EncryptedPayload;
        revision: number;
    };
    /** What has reached the server so far, so an interrupted upload picks up where it stopped. */
    uploaded: { account: boolean; key: boolean; records: Record<string, number> };
    /** The account row changed here (a new master password) and hasn't reached the server yet. */
    accountPending?: boolean;
    /** A recovery key was made with this setup (it is shown once and never stored). */
    recoveryKeyMade?: boolean;
    uploadedAt?: string;
    /** This device joined an account another device set up (with the Security Key). */
    joinedAt?: string;
    /** Per-record sync state (cloud/sync.ts). Missing on vaults from before sync: see vaultCore. */
    sync?: SyncState;
    lastSyncAt?: string;
    /** The last sync that failed, until one succeeds. */
    syncError?: { message: string; code?: string; at: string };
};

export type CloudStatus = {
    state: 'off' | 'pending' | 'on';
    email?: string;
    secretKeyId?: string;
    uploadedAt?: string;
    records?: number;
    accountPending?: boolean;
    joinedAt?: string;
    lastSyncAt?: string;
    syncing?: boolean;
    syncError?: { message: string; code?: string; at: string };
};

/** Whether the signed-in FocuzNow account already has a cloud vault (to turn on, or to join). */
export type CloudAccountState = { signedIn: false } | { signedIn: true; email?: string; exists: boolean };

export type EncryptedVaultDocument = {
    version: number;
    items: StoredVaultItem[];
    vaults?: VaultCollection[];
    tags?: VaultTag[];
    /** ECDH P-256 private JWK for the locked-save inbox; stored only inside this encrypted doc. */
    inboxPrivateKey?: JsonWebKey;
    cloud?: VaultCloudState;
    /** Synced records this version doesn't understand (a newer item type, settings), kept as they came. */
    cloudExtra?: LocalRecord[];
};

export type DecryptedLoginItem = DecryptedItemOrganization & {
    id: string;
    type: 'login';
    title: string;
    identity: string;
    domain?: string;
    authMethod: AuthMethod;
    password?: string;
    note?: string;
    strength?: PasswordStrength;
    risk?: 'weak' | 'reused';
    mark: string;
    markTone: string;
    createdAt: string;
    updatedAt: string;
    lastUsedAt?: string;
};

export type DecryptedCardItem = DecryptedItemOrganization & {
    id: string;
    type: 'card';
    title: string;
    identity: string;
    cardNumber?: string;
    expiry?: string;
    cvv?: string;
    note?: string;
    mark: string;
    markTone: string;
    createdAt: string;
    updatedAt: string;
    lastUsedAt?: string;
};

export type DecryptedPasskeyItem = DecryptedItemOrganization & {
    id: string;
    type: 'passkey';
    title: string;
    identity: string;
    domain?: string;
    credentialId?: string;
    note?: string;
    /** The passkey itself (private key included), for passkeys FocuzPass made. Older items only have the metadata. */
    passkey?: PasskeySecret;
    mark: string;
    markTone: string;
    createdAt: string;
    updatedAt: string;
    lastUsedAt?: string;
    experimental: true;
};

export type DecryptedCustomItem = DecryptedItemOrganization & {
    id: string;
    type: 'custom';
    kind: CustomItemKind;
    title: string;
    identity: string;
    fields: Record<string, string>;
    note?: string;
    mark: string;
    markTone: string;
    createdAt: string;
    updatedAt: string;
    lastUsedAt?: string;
};

export type DecryptedVaultItem = DecryptedLoginItem | DecryptedCardItem | DecryptedPasskeyItem | DecryptedCustomItem;

/**
 * A whole vault packed up to move to another device (a .focuzpass file, or a code/QR
 * transfer). Encrypted exactly like the vault at rest: opening it needs the master password
 * of the vault it came from, whichever way it travelled.
 */
export type VaultExportPackage = {
    format: 'focuzpass-export';
    /** 1: the password-derived key encrypts the data (verifier). 2: it wraps the vault key (wrappedKey). */
    version: 1 | 2;
    createdAt: string;
    itemCount: number;
    kdf: typeof FOCUZPASS_KDF;
    iterations: number;
    salt: string;
    verifier?: EncryptedPayload;
    wrappedKey?: EncryptedPayload;
    /** { version, items: StoredVaultItem[], vaults, tags }, encrypted with the vault key. */
    data: EncryptedPayload;
};

export type VaultSnapshot = {
    items: DecryptedVaultItem[];
    vaults: VaultCollection[];
    tags: VaultTag[];
};

export type VaultStatus = {
    configured: boolean;
    unlocked: boolean;
    itemCount: number;
    idleLockMinutes: number;
    unlockedAt: number | null;
    absoluteLockAt: number | null;
    remainingMs: number | null;
    platform: 'extension' | 'web';
    passkeysExperimental: true;
    /** Number of locked-save inbox entries merged on the most recent unlock. */
    inboxMerged?: number;
};

export type FocuzPassMessageType =
    | 'FOCUZPASS_STATUS'
    | 'FOCUZPASS_SETUP'
    | 'FOCUZPASS_UNLOCK'
    | 'FOCUZPASS_LOCK'
    | 'FOCUZPASS_LIST'
    | 'FOCUZPASS_SNAPSHOT'
    | 'FOCUZPASS_UPSERT'
    | 'FOCUZPASS_IMPORT'
    | 'FOCUZPASS_SITE_ICON'
    | 'FOCUZPASS_EXPORT_PACKAGE'
    | 'FOCUZPASS_IMPORT_PACKAGE'
    | 'FOCUZPASS_CHANGE_MASTER_PASSWORD'
    | 'FOCUZPASS_CLOUD_STATUS'
    | 'FOCUZPASS_CLOUD_PREPARE'
    | 'FOCUZPASS_CLOUD_ENABLE'
    | 'FOCUZPASS_CLOUD_CANCEL'
    | 'FOCUZPASS_CLOUD_KIT'
    | 'FOCUZPASS_CLOUD_SYNC'
    | 'FOCUZPASS_CLOUD_ACCOUNT'
    | 'FOCUZPASS_CLOUD_JOIN'
    | 'FOCUZPASS_CLOUD_ADD_DEVICE'
    | 'FOCUZPASS_DELETE'
    | 'FOCUZPASS_ITEM_ACTION'
    | 'FOCUZPASS_REORDER'
    | 'FOCUZPASS_CREATE_VAULT'
    | 'FOCUZPASS_CREATE_TAG'
    | 'FOCUZPASS_TOUCH'
    | 'FOCUZPASS_GENERATE'
    | 'FOCUZPASS_OPEN_ACCESS_WINDOW'
    | 'FOCUZPASS_PAGE_CONTEXT'
    | 'FOCUZPASS_CAPTURE_LOGIN'
    | 'FOCUZPASS_PENDING_LOGIN'
    | 'FOCUZPASS_COMMIT_PENDING_LOGIN'
    | 'FOCUZPASS_DISMISS_PENDING_LOGIN'
    | 'FOCUZPASS_MARK_USED';
