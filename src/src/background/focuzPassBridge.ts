/**
 * Service-worker FocuzPass bridge.
 * Vault key lives only in this module's memory for the SW lifetime.
 */

import {
    FocuzPassVault,
    isExactVaultDomain,
    normalizeVaultDomain,
    type VaultItemAction,
    type VaultUpsertInput,
} from '../lib/focuzPass/vaultCore';
import { randomBytes } from '../lib/focuzPass/crypto';

const PENDING_PREFIX = 'focuzpass.pending-login.';
const PENDING_TTL_MS = 2 * 60 * 1000;
const pendingMemory = new Map<string, PendingLogin>();
let accessWindowId: number | null = null;

type PendingLogin = {
    domain: string;
    title: string;
    identity: string;
    password: string;
    faviconUrl?: string;
    accountCreation: boolean;
    createdAt: number;
};

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

function senderPage(sender?: chrome.runtime.MessageSender): { tabId: number; domain: string } | null {
    const tabId = sender?.tab?.id;
    const rawUrl = sender?.url || sender?.tab?.url;
    if (tabId == null || !rawUrl) return null;
    try {
        const url = new URL(rawUrl);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
        const domain = normalizeVaultDomain(url.hostname);
        return domain ? { tabId, domain } : null;
    } catch {
        return null;
    }
}

function pendingKey(tabId: number) {
    return `${PENDING_PREFIX}${tabId}`;
}

async function openAccessWindow() {
    if (accessWindowId != null) {
        try {
            await chrome.windows.update(accessWindowId, { focused: true });
            return;
        } catch {
            accessWindowId = null;
        }
    }

    const created = await chrome.windows.create({
        url: chrome.runtime.getURL('src/focuzpass-unlock/index.html'),
        type: 'popup',
        width: 440,
        height: 610,
        focused: true,
    });
    if (!created) throw new Error('Could not open the FocuzPass access window');
    accessWindowId = created.id ?? null;
    if (accessWindowId != null) {
        const openedId = accessWindowId;
        const onRemoved = (windowId: number) => {
            if (windowId !== openedId) return;
            accessWindowId = null;
            chrome.windows.onRemoved.removeListener(onRemoved);
        };
        chrome.windows.onRemoved.addListener(onRemoved);
    }
}

async function readPending(sender?: chrome.runtime.MessageSender): Promise<PendingLogin | null> {
    const page = senderPage(sender);
    if (!page) return null;
    const key = pendingKey(page.tabId);
    const stored = chrome.storage.session ? await chrome.storage.session.get(key) : {};
    const pending = (stored[key] as PendingLogin | undefined) || pendingMemory.get(key);
    if (!pending) return null;
    if (Date.now() - pending.createdAt > PENDING_TTL_MS || !isExactVaultDomain(pending.domain, page.domain)) {
        if (chrome.storage.session) await chrome.storage.session.remove(key);
        pendingMemory.delete(key);
        return null;
    }
    return pending;
}

async function clearPending(sender?: chrome.runtime.MessageSender) {
    const page = senderPage(sender);
    if (!page) return;
    const key = pendingKey(page.tabId);
    if (chrome.storage.session) await chrome.storage.session.remove(key);
    pendingMemory.delete(key);
}

export async function handleFocuzPassMessage(msg: {
    type: string;
    masterPassword?: string;
    item?: VaultUpsertInput;
    id?: string;
    length?: number;
    title?: string;
    identity?: string;
    password?: string;
    faviconUrl?: string;
    accountCreation?: boolean;
    action?: VaultItemAction;
    collection?: { name: string; color: string; icon: string };
    orderedIds?: string[];
}, sender?: chrome.runtime.MessageSender): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
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
            case 'FOCUZPASS_SNAPSHOT':
                return { ok: true, data: vault.snapshot() };
            case 'FOCUZPASS_UPSERT':
                return { ok: true, data: await vault.upsert(msg.item as VaultUpsertInput) };
            case 'FOCUZPASS_DELETE':
                await vault.delete(String(msg.id || ''));
                return { ok: true, data: null };
            case 'FOCUZPASS_ITEM_ACTION':
                return { ok: true, data: await vault.itemAction(msg.action as VaultItemAction) };
            case 'FOCUZPASS_REORDER':
                await vault.reorder(Array.isArray(msg.orderedIds) ? msg.orderedIds.map(String) : []);
                return { ok: true, data: null };
            case 'FOCUZPASS_CREATE_VAULT':
                return { ok: true, data: await vault.createVault(msg.collection || { name: '', color: '', icon: '' }) };
            case 'FOCUZPASS_CREATE_TAG':
                return { ok: true, data: await vault.createTag(msg.collection || { name: '', color: '', icon: '' }) };
            case 'FOCUZPASS_TOUCH':
                vault.touch();
                return { ok: true, data: null };
            case 'FOCUZPASS_GENERATE':
                return { ok: true, data: generatePassword(msg.length) };
            case 'FOCUZPASS_OPEN_ACCESS_WINDOW':
                await openAccessWindow();
                return { ok: true, data: null };
            case 'FOCUZPASS_PAGE_CONTEXT': {
                const page = senderPage(sender);
                if (!page) throw new Error('FocuzPass is unavailable on this page');
                const status = await vault.getStatus('extension');
                if (!status.configured) {
                    return { ok: true, data: { state: 'unconfigured', domain: page.domain, matches: [], items: [] } };
                }
                if (!status.unlocked) {
                    return { ok: true, data: { state: 'locked', domain: page.domain, matches: [], items: [] } };
                }
                const snapshot = vault.snapshot();
                const activeItems = snapshot.items.filter((item) => {
                    if (item.archivedAt || item.deletedAt || item.type === 'passkey') return false;
                    return item.type !== 'login' || isExactVaultDomain(item.domain, page.domain);
                });
                return {
                    ok: true,
                    data: {
                        state: 'ready',
                        domain: page.domain,
                        matches: activeItems.filter((item) => item.type === 'login'),
                        items: activeItems,
                    },
                };
            }
            case 'FOCUZPASS_CAPTURE_LOGIN': {
                const page = senderPage(sender);
                if (!page) throw new Error('FocuzPass is unavailable on this page');
                const status = await vault.getStatus('extension');
                if (!status.configured) {
                    return { ok: true, data: { captured: false, reason: 'unconfigured' } };
                }
                const identity = String(msg.identity || '').trim();
                const password = String(msg.password || '');
                if (!identity || !password) {
                    return { ok: true, data: { captured: false, reason: 'empty' } };
                }
                const exact = status.unlocked
                    ? vault
                          .findLoginMatches(page.domain)
                          .find((item) => item.identity.toLowerCase() === identity.toLowerCase() && item.password === password)
                    : undefined;
                if (exact) {
                    await vault.markUsed(exact.id);
                    await clearPending(sender);
                    return { ok: true, data: { captured: false, reason: 'already-saved', itemId: exact.id } };
                }
                const pending: PendingLogin = {
                    domain: page.domain,
                    title: String(msg.title || page.domain).trim().slice(0, 120) || page.domain,
                    identity: identity.slice(0, 320),
                    password,
                    faviconUrl: String(msg.faviconUrl || '').slice(0, 2048) || undefined,
                    accountCreation: Boolean(msg.accountCreation),
                    createdAt: Date.now(),
                };
                const key = pendingKey(page.tabId);
                if (chrome.storage.session) await chrome.storage.session.set({ [key]: pending });
                else pendingMemory.set(key, pending);
                return { ok: true, data: { captured: true } };
            }
            case 'FOCUZPASS_PENDING_LOGIN': {
                const pending = await readPending(sender);
                return {
                    ok: true,
                    data: pending
                        ? {
                              available: true,
                              domain: pending.domain,
                              title: pending.title,
                              identity: pending.identity,
                              faviconUrl: pending.faviconUrl,
                              accountCreation: pending.accountCreation,
                          }
                        : { available: false },
                };
            }
            case 'FOCUZPASS_COMMIT_PENDING_LOGIN': {
                const pending = await readPending(sender);
                if (!pending) throw new Error('This login save request has expired');
                const matches = vault.findLoginMatches(pending.domain);
                const existing = matches.find(
                    (item) => item.identity.toLowerCase() === pending.identity.toLowerCase(),
                );
                const saved = await vault.upsert({
                    id: existing?.id,
                    type: 'login',
                    title: pending.title,
                    identity: pending.identity,
                    domain: pending.domain,
                    password: pending.password,
                    authMethod: 'PASSWORD',
                });
                await clearPending(sender);
                return { ok: true, data: { saved: true, itemId: saved.id } };
            }
            case 'FOCUZPASS_DISMISS_PENDING_LOGIN':
                await clearPending(sender);
                return { ok: true, data: null };
            case 'FOCUZPASS_MARK_USED': {
                const page = senderPage(sender);
                if (!page) throw new Error('FocuzPass is unavailable on this page');
                const item = vault.snapshot().items.find((candidate) => candidate.id === msg.id && !candidate.archivedAt && !candidate.deletedAt);
                if (!item || (item.type === 'login' && !isExactVaultDomain(item.domain, page.domain))) throw new Error('No matching item for this page');
                await vault.markUsed(item.id);
                return { ok: true, data: null };
            }
            default:
                return { ok: false, error: 'Unknown FocuzPass message' };
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : 'FocuzPass error';
        return { ok: false, error: message };
    }
}

export function isFocuzPassMessage(type: unknown): boolean {
    return typeof type === 'string'
        && type.startsWith('FOCUZPASS_')
        && type !== 'FOCUZPASS_LOCKED'
        && type !== 'FOCUZPASS_ACCESS_CHANGED'
        && !type.startsWith('FOCUZPASS_OVERLAY_');
}
