/** FocuzPass UI client — crypto/CRUD always runs in the extension service worker. */

import { getPlatform, isWebPlatform } from '../platform';
import { extensionPresent, sendExtensionRpc } from '../platform/webPlatform';
import { extensionContextGone, extensionReloadedError, isContextInvalidatedError } from './extensionReload';
import { importFingerprint } from './vaultCore';
import type { CloudAccountState, CloudStatus, VaultExportPackage } from './types';
import type {
    CustomItemKind,
    DecryptedVaultItem,
    VaultCollection,
    VaultItemAction,
    VaultSnapshot,
    VaultTag,
    VaultUpsertInput,
    VaultStatus,
} from './vaultCore';

export type { CustomItemKind, DecryptedVaultItem, VaultCollection, VaultSnapshot, VaultStatus, VaultTag, VaultUpsertInput };

type MessageResponse<T> = { ok: true; data: T } | { ok: false; error: string; needsExtension?: boolean };

// Setup/unlock run PBKDF2; opening the unlock window may have to wake a sleeping worker.
// Imports encrypt every item they add.
const SLOW_OPS = new Set(['FOCUZPASS_SETUP', 'FOCUZPASS_UNLOCK', 'FOCUZPASS_CHANGE_MASTER_PASSWORD', 'FOCUZPASS_CLOUD_PREPARE', 'FOCUZPASS_CLOUD_ENABLE', 'FOCUZPASS_CLOUD_KIT', 'FOCUZPASS_CLOUD_SYNC', 'FOCUZPASS_CLOUD_JOIN', 'FOCUZPASS_CLOUD_ADD_DEVICE', 'FOCUZPASS_OPEN_ACCESS_WINDOW', 'FOCUZPASS_IMPORT', 'FOCUZPASS_EXPORT_PACKAGE', 'FOCUZPASS_IMPORT_PACKAGE']);
const FOCUZPASS_UI_ORDER_KEY = 'focuzpass.ui.custom-order.v1';

/**
 * The extension's page bridge installs asynchronously (its content script loads
 * after the page starts), so a fast page can ask before it exists. Give it a
 * moment instead of declaring the extension missing.
 */
function waitForExtensionBridge(timeoutMs = 2500): Promise<boolean> {
    if (extensionPresent()) return Promise.resolve(true);
    return new Promise((resolve) => {
        const started = Date.now();
        const finish = (present: boolean) => {
            window.clearInterval(poll);
            window.removeEventListener('message', onReady);
            resolve(present);
        };
        const onReady = (event: MessageEvent) => {
            if (event.source === window && event.data?.type === 'FOCUZNOW_EXTENSION_READY') finish(true);
        };
        const poll = window.setInterval(() => {
            if (extensionPresent()) finish(true);
            else if (Date.now() - started >= timeoutMs) finish(false);
        }, 50);
        window.addEventListener('message', onReady);
    });
}

/**
 * The web vault (webVaultBackend.ts) answers FocuzPass requests itself when there's no extension:
 * with a transport set, requests go there instead.
 */
type Transport = (message: Record<string, unknown>) => Promise<MessageResponse<unknown>>;
let transport: Transport | null = null;
export function setFocuzPassTransport(next: Transport | null) {
    transport = next;
}

/** FocuzPass events (locked, access changed, vault changed): from the extension, or from the web vault. */
type FocuzPassEvent = { type?: string; inboxMerged?: number };
const eventListeners = new Set<(event: FocuzPassEvent) => void>();
export function emitFocuzPassEvent(event: FocuzPassEvent) {
    for (const listener of eventListeners) listener(event);
}
export function subscribeFocuzPassEvents(listener: (event: FocuzPassEvent) => void): () => void {
    eventListeners.add(listener);
    let fromExtension = false;
    try {
        if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
            chrome.runtime.onMessage.addListener(listener);
            fromExtension = true;
        }
    } catch {
        /* no extension messaging here */
    }
    return () => {
        eventListeners.delete(listener);
        if (fromExtension) {
            try {
                chrome.runtime.onMessage.removeListener(listener);
            } catch {
                /* gone already */
            }
        }
    };
}

async function send<T>(message: Record<string, unknown>): Promise<T> {
    const type = String(message.type || '');
    // Generous: the browser runs extension workers at idle priority, so on a busy
    // machine a sleeping worker can take a while to answer.
    const timeoutMs = SLOW_OPS.has(type) ? 40000 : 25000;

    let response: MessageResponse<T>;
    if (transport) {
        response = (await transport(message)) as MessageResponse<T>;
    } else if (isWebPlatform()) {
        if (!(await waitForExtensionBridge())) {
            throw Object.assign(new Error('Install or reload the FocuzNow extension to use FocuzPass'), {
                needsExtension: true,
            });
        }
        response = (await sendExtensionRpc<MessageResponse<T>>(message as never, timeoutMs)) as MessageResponse<T>;
    } else {
        if (extensionContextGone()) throw extensionReloadedError();
        try {
            response = (await chrome.runtime.sendMessage(message)) as MessageResponse<T>;
        } catch (error) {
            if (isContextInvalidatedError(error) || extensionContextGone()) throw extensionReloadedError();
            throw error;
        }
    }

    if (!response || response.ok !== true) {
        const err = new Error(
            (response && 'error' in response && response.error) || 'FocuzPass request failed',
        ) as Error & { needsExtension?: boolean };
        if (response && 'needsExtension' in response && response.needsExtension) {
            err.needsExtension = true;
        }
        throw err;
    }
    return response.data;
}

export async function focuzPassStatus(): Promise<VaultStatus> {
    return send<VaultStatus>({ type: 'FOCUZPASS_STATUS' });
}

export async function focuzPassSetup(masterPassword: string): Promise<VaultStatus> {
    return send<VaultStatus>({ type: 'FOCUZPASS_SETUP', masterPassword });
}

export async function focuzPassUnlock(masterPassword: string): Promise<VaultStatus> {
    return send<VaultStatus>({ type: 'FOCUZPASS_UNLOCK', masterPassword });
}

/** Re-wraps the vault key under a new master password; the old one stops working. */
export async function focuzPassChangeMasterPassword(currentPassword: string, newPassword: string): Promise<VaultStatus> {
    return send<VaultStatus>({ type: 'FOCUZPASS_CHANGE_MASTER_PASSWORD', masterPassword: currentPassword, newMasterPassword: newPassword });
}

/* ── FocuzPass Cloud ── */

export type CloudKit = { secretKey: string; secretKeyId: string; email?: string; recoveryKey?: string };

/** null while the vault is locked. */
export async function focuzPassCloudStatus(): Promise<CloudStatus | null> {
    return send<CloudStatus | null>({ type: 'FOCUZPASS_CLOUD_STATUS' });
}

/** Makes the Security Key (and optionally a recovery key) on this device; nothing is sent yet. */
export async function focuzPassCloudPrepare(masterPassword: string, recoveryKey: boolean): Promise<CloudKit> {
    return send<CloudKit>({ type: 'FOCUZPASS_CLOUD_PREPARE', masterPassword, recoveryKey });
}

/** Sends the encrypted cloud copy (resumes an interrupted upload). */
export async function focuzPassCloudEnable(): Promise<{ uploaded: number }> {
    return send<{ uploaded: number }>({ type: 'FOCUZPASS_CLOUD_ENABLE' });
}

export async function focuzPassCloudCancel(): Promise<CloudStatus> {
    return send<CloudStatus>({ type: 'FOCUZPASS_CLOUD_CANCEL' });
}

/** The Security Key again, for a new Emergency Kit. */
export async function focuzPassCloudKit(masterPassword: string): Promise<CloudKit> {
    return send<CloudKit>({ type: 'FOCUZPASS_CLOUD_KIT', masterPassword });
}

export type CloudSyncResult = { pulled: number; pushed: number; conflicts: number; refused: number };

/** Pulls other devices' changes and pushes this one's. */
export async function focuzPassCloudSync(): Promise<CloudSyncResult> {
    return send<CloudSyncResult>({ type: 'FOCUZPASS_CLOUD_SYNC' });
}

/** Whether the signed-in FocuzNow account already has a cloud vault. Works while locked. */
export async function focuzPassCloudAccount(): Promise<CloudAccountState> {
    return send<CloudAccountState>({ type: 'FOCUZPASS_CLOUD_ACCOUNT' });
}

/** Sets up FocuzPass on this device from the cloud copy (no vault here yet). */
export async function focuzPassCloudJoin(masterPassword: string, secretKey: string): Promise<VaultStatus> {
    return send<VaultStatus>({ type: 'FOCUZPASS_CLOUD_JOIN', masterPassword, secretKey });
}

/** "Use FocuzPass for passkeys" in this browser: read it, or set it with `enabled`. */
export async function focuzPassPasskeySettings(enabled?: boolean): Promise<{ enabled: boolean }> {
    return send<{ enabled: boolean }>({ type: 'FOCUZPASS_PASSKEY_SETTINGS', ...(typeof enabled === 'boolean' ? { enabled } : {}) });
}

/** Adds this device's vault to the cloud one; this device then uses the cloud master password. */
export async function focuzPassCloudAddDevice(input: { masterPassword: string; secretKey: string; localPassword: string }): Promise<{ added: number; alreadyThere: number }> {
    return send<{ added: number; alreadyThere: number }>({ type: 'FOCUZPASS_CLOUD_ADD_DEVICE', ...input });
}

export async function focuzPassLock(): Promise<VaultStatus> {
    return send<VaultStatus>({ type: 'FOCUZPASS_LOCK' });
}

export async function focuzPassList(): Promise<DecryptedVaultItem[]> {
    return send<DecryptedVaultItem[]>({ type: 'FOCUZPASS_LIST' });
}

export async function focuzPassSnapshot(): Promise<VaultSnapshot> {
    return send<VaultSnapshot>({ type: 'FOCUZPASS_SNAPSHOT' });
}

export async function focuzPassUpsert(item: VaultUpsertInput): Promise<DecryptedVaultItem> {
    return send<DecryptedVaultItem>({ type: 'FOCUZPASS_UPSERT', item });
}

type ImportOptions = { vaultId?: string; tagName?: string };
type ImportResult = { added: number; duplicates: number; failed: number };

/** Adds a whole export in one save; items already in the vault are skipped. */
export async function focuzPassImport(
    items: VaultUpsertInput[],
    options: ImportOptions = {},
    onProgress?: (done: number, total: number) => void,
): Promise<ImportResult> {
    try {
        return await send<ImportResult>({ type: 'FOCUZPASS_IMPORT', items, importOptions: options });
    } catch (error) {
        if (!/unknown focuzpass message/i.test(error instanceof Error ? error.message : '')) throw error;
        // The extension is older than this page (the website can ship first): it doesn't know
        // bulk import yet, so save the items one at a time instead.
        return importOneByOne(items, options, onProgress);
    }
}

async function importOneByOne(items: VaultUpsertInput[], options: ImportOptions, onProgress?: (done: number, total: number) => void): Promise<ImportResult> {
    const snapshot = await focuzPassSnapshot();
    const known = new Set(snapshot.items.filter((item) => !item.deletedAt).map(importFingerprint));
    let tagIds: string[] = [];
    const tagName = options.tagName?.trim();
    if (tagName) {
        const existing = snapshot.tags.find((tag) => tag.name.toLowerCase() === tagName.toLowerCase());
        tagIds = [existing ? existing.id : (await focuzPassCreateTag({ name: tagName, color: '#8b93a1', icon: 'tag' })).id];
    }
    let added = 0;
    let duplicates = 0;
    let failed = 0;
    // Each save goes on top of the list, so walk the export backwards to keep its order.
    for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        const key = importFingerprint(item);
        if (known.has(key)) duplicates++;
        else {
            try {
                await focuzPassUpsert({ ...item, id: undefined, vaultId: options.vaultId, tagIds: [...(item.tagIds ?? []), ...tagIds] });
                known.add(key);
                added++;
            } catch {
                failed++;
            }
        }
        onProgress?.(items.length - i, items.length);
    }
    return { added, duplicates, failed };
}

/** The whole vault, encrypted with its master password, to move to another device. */
export async function focuzPassExportPackage(): Promise<VaultExportPackage> {
    return send<VaultExportPackage>({ type: 'FOCUZPASS_EXPORT_PACKAGE' });
}

/** Opens a package from another device (with that vault's master password) and adds its items here. */
export async function focuzPassImportPackage(
    pkg: VaultExportPackage,
    masterPassword: string,
    options: { vaultId?: string; tagName?: string } = {},
): Promise<{ added: number; duplicates: number; failed: number }> {
    return send({ type: 'FOCUZPASS_IMPORT_PACKAGE', package: pkg, masterPassword, importOptions: options });
}

export type SiteIcon = { src: string; bleed: boolean };
const siteIcons = new Map<string, Promise<SiteIcon | null>>();

/** The website's own icon for a login (fetched by the extension from the site; null if none). */
export function focuzPassSiteIcon(domain: string): Promise<SiteIcon | null> {
    const key = domain.trim().toLowerCase();
    let pending = siteIcons.get(key);
    if (!pending) {
        // An older extension doesn't know this message yet: just show the lettermark.
        pending = send<SiteIcon | null>({ type: 'FOCUZPASS_SITE_ICON', domain: key }).catch(() => null);
        siteIcons.set(key, pending);
    }
    return pending;
}

export async function focuzPassDelete(id: string): Promise<void> {
    await send<null>({ type: 'FOCUZPASS_DELETE', id });
}

export async function focuzPassItemAction(action: VaultItemAction): Promise<DecryptedVaultItem | null> {
    return send<DecryptedVaultItem | null>({ type: 'FOCUZPASS_ITEM_ACTION', action });
}

export async function focuzPassReadRememberedOrder(): Promise<string[]> {
    const stored = await getPlatform().storageLocal.get(FOCUZPASS_UI_ORDER_KEY);
    const value = stored[FOCUZPASS_UI_ORDER_KEY];
    return Array.isArray(value) ? [...new Set(value.map(String).filter(Boolean))] : [];
}

export async function focuzPassReorder(orderedIds: string[]): Promise<{ persistedInVault: boolean }> {
    const normalized = [...new Set(orderedIds.map(String).filter(Boolean))];
    await getPlatform().storageLocal.set({ [FOCUZPASS_UI_ORDER_KEY]: normalized });
    try {
        await send<null>({ type: 'FOCUZPASS_REORDER', orderedIds: normalized });
        return { persistedInVault: true };
    } catch (error) {
        if (/unknown focuzpass message/i.test(error instanceof Error ? error.message : '')) {
            // Compatibility with a dashboard tab that is newer than its still-running service worker.
            // The visible order stays stable and will be promoted into the encrypted vault after reload.
            return { persistedInVault: false };
        }
        throw error;
    }
}

export async function focuzPassOpenAccessWindow(): Promise<void> {
    await send<null>({ type: 'FOCUZPASS_OPEN_ACCESS_WINDOW' });
}

export async function focuzPassCreateVault(collection: { name: string; color: string; icon: string }): Promise<VaultCollection> {
    return send<VaultCollection>({ type: 'FOCUZPASS_CREATE_VAULT', collection });
}

export async function focuzPassCreateTag(collection: { name: string; color: string; icon: string }): Promise<VaultTag> {
    return send<VaultTag>({ type: 'FOCUZPASS_CREATE_TAG', collection });
}

export async function focuzPassTouch(): Promise<void> {
    await send<null>({ type: 'FOCUZPASS_TOUCH' });
}

/** No-op round trip that keeps the extension worker awake while FocuzPass is on screen. */
export async function focuzPassPing(): Promise<void> {
    await send<null>({ type: 'FOCUZPASS_PING' });
}

export async function focuzPassGenerate(length = 20): Promise<string> {
    return send<string>({ type: 'FOCUZPASS_GENERATE', length });
}
