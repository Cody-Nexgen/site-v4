/**
 * Service-worker FocuzPass bridge.
 * Vault key lives only in this module's memory for the SW lifetime.
 */

import { FocuzPassVault, type VaultUpsertInput } from '../lib/focuzPass/vaultCore';
import { randomBytes } from '../lib/focuzPass/crypto';

const chromeStorage = {
    async get(keys: string[]) {
        return chrome.storage.local.get(keys) as Promise<Record<string, unknown>>;
    },
    async set(items: Record<string, unknown>) {
        await chrome.storage.local.set(items);
    },
    async remove(keys: string[]) {
        await chrome.storage.local.remove(keys);
    },
};

const vault = new FocuzPassVault(chromeStorage);
let initialized = false;

function generatePassword(length = 20): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*+-=';
    const values = randomBytes(Math.max(12, Math.min(64, length | 0)));
    return Array.from(values, (value) => alphabet[value % alphabet.length]).join('');
}

function broadcastLocked() {
    try {
        chrome.runtime.sendMessage({ type: 'FOCUZPASS_LOCKED' }).catch(() => undefined);
    } catch {
        /* no listeners */
    }
}

export function initFocuzPassVault() {
    if (initialized) return;
    initialized = true;

    vault.onLock(() => broadcastLocked());

    try {
        chrome.idle.setDetectionInterval(60);
        chrome.idle.onStateChanged.addListener((state) => {
            if (state === 'idle' || state === 'locked') {
                if (vault.isUnlocked) vault.lock();
            }
        });
    } catch {
        /* idle API unavailable in some contexts */
    }

    try {
        chrome.alarms.create('focuzpass-lock-tick', { periodInMinutes: 1 });
        chrome.alarms.onAlarm.addListener((alarm) => {
            if (alarm.name === 'focuzpass-lock-tick') {
                vault.enforceLockTimers();
            }
        });
    } catch {
        /* alarms may be unavailable */
    }

    chrome.runtime.onStartup.addListener(() => {
        vault.lock();
    });
}

export async function handleFocuzPassMessage(msg: {
    type: string;
    masterPassword?: string;
    item?: VaultUpsertInput;
    id?: string;
    length?: number;
}): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
    try {
        switch (msg.type) {
            case 'FOCUZPASS_STATUS':
                return { ok: true, data: await vault.getStatus('extension') };
            case 'FOCUZPASS_SETUP':
                return { ok: true, data: await vault.setup(String(msg.masterPassword || '')) };
            case 'FOCUZPASS_UNLOCK':
                return { ok: true, data: await vault.unlock(String(msg.masterPassword || '')) };
            case 'FOCUZPASS_LOCK':
                vault.lock();
                return { ok: true, data: await vault.getStatus('extension') };
            case 'FOCUZPASS_LIST':
                return { ok: true, data: vault.list() };
            case 'FOCUZPASS_UPSERT':
                return { ok: true, data: await vault.upsert(msg.item as VaultUpsertInput) };
            case 'FOCUZPASS_DELETE':
                await vault.delete(String(msg.id || ''));
                return { ok: true, data: null };
            case 'FOCUZPASS_TOUCH':
                vault.touch();
                return { ok: true, data: null };
            case 'FOCUZPASS_GENERATE':
                return { ok: true, data: generatePassword(msg.length) };
            default:
                return { ok: false, error: 'Unknown FocuzPass message' };
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : 'FocuzPass error';
        return { ok: false, error: message };
    }
}

export function isFocuzPassMessage(type: unknown): boolean {
    return typeof type === 'string' && type.startsWith('FOCUZPASS_') && type !== 'FOCUZPASS_LOCKED';
}
