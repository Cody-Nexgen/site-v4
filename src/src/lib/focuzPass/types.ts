/** FocuzPass vault types — secrets never leave the unlocked in-memory document. */

export const FOCUZPASS_STORAGE_META = 'focuzpass.meta.v1';
export const FOCUZPASS_STORAGE_BLOB = 'focuzpass.blob.v1';
export const FOCUZPASS_STORAGE_SETTINGS = 'focuzpass.settings.v1';

export const FOCUZPASS_KDF = 'pbkdf2-sha256' as const;
export const FOCUZPASS_PBKDF2_ITERATIONS = 600_000;
export const FOCUZPASS_VERIFIER_PLAINTEXT = 'focuzpass.v1.ok';
export const FOCUZPASS_ABSOLUTE_MAX_MS = 24 * 60 * 60 * 1000;
export const FOCUZPASS_DEFAULT_IDLE_LOCK_MS = 15 * 60 * 1000;
export const FOCUZPASS_VAULT_VERSION = 1;

export type VaultItemType = 'login' | 'card' | 'passkey';
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
    salt: string;
    kdf: typeof FOCUZPASS_KDF;
    iterations: number;
    verifier: EncryptedPayload;
};

export type VaultBlob = {
    iv: string;
    ct: string;
};

export type VaultSettings = {
    idleLockMinutes: number;
};

/** Sensitive fields encrypted individually before outer vault wrap. */
export type StoredLoginItem = {
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

export type StoredCardItem = {
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

export type StoredPasskeyItem = {
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

export type StoredVaultItem = StoredLoginItem | StoredCardItem | StoredPasskeyItem;

export type EncryptedVaultDocument = {
    version: number;
    items: StoredVaultItem[];
};

export type DecryptedLoginItem = {
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

export type DecryptedCardItem = {
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

export type DecryptedPasskeyItem = {
    id: string;
    type: 'passkey';
    title: string;
    identity: string;
    domain?: string;
    credentialId?: string;
    note?: string;
    mark: string;
    markTone: string;
    createdAt: string;
    updatedAt: string;
    lastUsedAt?: string;
    experimental: true;
};

export type DecryptedVaultItem = DecryptedLoginItem | DecryptedCardItem | DecryptedPasskeyItem;

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
};

export type FocuzPassMessageType =
    | 'FOCUZPASS_STATUS'
    | 'FOCUZPASS_SETUP'
    | 'FOCUZPASS_UNLOCK'
    | 'FOCUZPASS_LOCK'
    | 'FOCUZPASS_LIST'
    | 'FOCUZPASS_UPSERT'
    | 'FOCUZPASS_DELETE'
    | 'FOCUZPASS_TOUCH'
    | 'FOCUZPASS_GENERATE';
