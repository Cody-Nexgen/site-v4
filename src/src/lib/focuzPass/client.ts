/** FocuzPass UI client — crypto/CRUD always runs in the extension service worker. */

import { getPlatform, isWebPlatform } from '../platform';
import { extensionPresent, sendExtensionRpc } from '../platform/webPlatform';
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

const SLOW_OPS = new Set(['FOCUZPASS_SETUP', 'FOCUZPASS_UNLOCK']);
const FOCUZPASS_UI_ORDER_KEY = 'focuzpass.ui.custom-order.v1';

async function send<T>(message: Record<string, unknown>): Promise<T> {
    const type = String(message.type || '');
    const timeoutMs = SLOW_OPS.has(type) ? 20000 : 10000;

    let response: MessageResponse<T>;
    if (isWebPlatform()) {
        if (!extensionPresent()) {
            throw Object.assign(new Error('Install or reload the FocuzNow extension to use FocuzPass'), {
                needsExtension: true,
            });
        }
        response = (await sendExtensionRpc<MessageResponse<T>>(message as never, timeoutMs)) as MessageResponse<T>;
    } else {
        response = (await chrome.runtime.sendMessage(message)) as MessageResponse<T>;
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

export async function focuzPassGenerate(length = 20): Promise<string> {
    return send<string>({ type: 'FOCUZPASS_GENERATE', length });
}
