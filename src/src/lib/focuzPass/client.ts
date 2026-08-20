/** Extension UI client — all crypto/CRUD goes through the service worker. */

import { isWebPlatform } from '../platform';
import type { DecryptedVaultItem, VaultUpsertInput, VaultStatus } from './vaultCore';

export type { DecryptedVaultItem, VaultStatus, VaultUpsertInput };

type MessageResponse<T> = { ok: true; data: T } | { ok: false; error: string };

async function send<T>(message: Record<string, unknown>): Promise<T> {
    if (isWebPlatform()) {
        throw new Error('FocuzPass vault is only available in the browser extension');
    }
    const response = (await chrome.runtime.sendMessage(message)) as MessageResponse<T>;
    if (!response || response.ok !== true) {
        throw new Error((response && 'error' in response && response.error) || 'FocuzPass request failed');
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

export async function focuzPassUpsert(item: VaultUpsertInput): Promise<DecryptedVaultItem> {
    return send<DecryptedVaultItem>({ type: 'FOCUZPASS_UPSERT', item });
}

export async function focuzPassDelete(id: string): Promise<void> {
    await send<null>({ type: 'FOCUZPASS_DELETE', id });
}

export async function focuzPassTouch(): Promise<void> {
    await send<null>({ type: 'FOCUZPASS_TOUCH' });
}

export async function focuzPassGenerate(length = 20): Promise<string> {
    return send<string>({ type: 'FOCUZPASS_GENERATE', length });
}
