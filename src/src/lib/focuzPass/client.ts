/** FocuzPass UI client — crypto/CRUD always runs in the extension service worker. */

import { isWebPlatform } from '../platform';
import { extensionPresent, sendExtensionRpc } from '../platform/webPlatform';
import type { DecryptedVaultItem, VaultUpsertInput, VaultStatus } from './vaultCore';

export type { DecryptedVaultItem, VaultStatus, VaultUpsertInput };

type MessageResponse<T> = { ok: true; data: T } | { ok: false; error: string; needsExtension?: boolean };

const SLOW_OPS = new Set(['FOCUZPASS_SETUP', 'FOCUZPASS_UNLOCK']);

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
