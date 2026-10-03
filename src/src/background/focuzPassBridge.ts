/**
 * Service-worker FocuzPass bridge.
 * Vault key lives only in this module's memory for the SW lifetime.
 */

import {
    FocuzPassVault,
    isExactVaultDomain,
    vaultDomainMatch,
    normalizeVaultDomain,
    type VaultItemAction,
    type VaultStorageAdapter,
    type VaultUpsertInput,
} from '../lib/focuzPass/vaultCore';
import { encryptForInbox, randomBytes, type InboxEnvelope } from '../lib/focuzPass/crypto';
import { getSiteIcon } from './siteIcons';
import { senderKind } from '../lib/trustedOrigins';
import type { CloudStore } from '../lib/focuzPass/cloud/store';
import { CloudRealtime, type RealtimeLike } from '../lib/focuzPass/cloud/realtime';
import { PasskeyError, checkRpId, type CreationOptionsJSON, type RequestOptionsJSON } from '../lib/focuzPass/passkeys/webauthn';

/* ── Passkeys (docs/focuzpass-cloud-plan.md, "Passkeys") ──────────────── */

export const PASSKEYS_ENABLED_KEY = 'focuzpass.passkeys.enabled';
const PASSKEY_SCRIPT_ID = 'focuzpass-passkeys';
const LAPSED_AT_KEY = 'focuzpass.lapsedAt';
const LAPSE_DAYS = 90;

/** On unless turned off: FocuzPass offers to save and use passkeys, and "Use another device" is always one click away. */
async function passkeysEnabled(): Promise<boolean> {
    try {
        return (await chrome.storage.local.get(PASSKEYS_ENABLED_KEY))[PASSKEYS_ENABLED_KEY] !== false;
    } catch {
        return false;
    }
}

const PASSKEY_MATCHES = ['https://*/*', 'http://localhost/*'];

/**
 * Puts FocuzPass's passkey pieces into pages that are already open: the page script (every frame;
 * a copy already there steps aside for a newer one) and, with `listener`, the content script that
 * answers it. Without this, a page open across an install or update keeps the browser's own
 * passkeys (Windows Hello) until it's reloaded.
 */
async function injectPasskeyScriptIntoOpenTabs(listener = false) {
    try {
        const entry = listener ? (chrome.runtime.getManifest().content_scripts ?? []).find((script) => script.js?.some((file) => file.includes('passkeyEntry'))) : undefined;
        const tabs = await chrome.tabs.query({ url: PASSKEY_MATCHES });
        for (const tab of tabs) {
            if (tab.id == null || tab.discarded) continue;
            if (entry?.js?.length) chrome.scripting.executeScript({ target: { tabId: tab.id }, files: entry.js }).catch(() => undefined);
            chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, world: 'MAIN', files: ['focuzpass-passkeys.js'] }).catch(() => undefined);
        }
    } catch {
        /* tabs or scripting unavailable */
    }
}

/**
 * After FocuzNow is installed or updated (a reload in development counts), open pages still run the
 * previous content script, now cut off from the extension. Give them the fresh one. (Not after a
 * browser update: the content scripts in open pages are still the current ones then.)
 */
function reconnectPasskeyTabs(details: chrome.runtime.InstalledDetails) {
    if (details.reason !== 'install' && details.reason !== 'update') return;
    void passkeysEnabled().then((enabled) => {
        if (enabled) void injectPasskeyScriptIntoOpenTabs(true);
    });
}

/**
 * The page script (public/focuzpass-passkeys.js) is registered into pages only while the setting
 * is on, so with it off nothing of this runs anywhere.
 */
async function syncPasskeyScript() {
    const script: chrome.scripting.RegisteredContentScript = {
        id: PASSKEY_SCRIPT_ID,
        js: ['focuzpass-passkeys.js'],
        matches: PASSKEY_MATCHES,
        runAt: 'document_start',
        world: 'MAIN',
        allFrames: true,
        persistAcrossSessions: true,
    };
    try {
        const enabled = await passkeysEnabled();
        const [registered] = await chrome.scripting.getRegisteredContentScripts({ ids: [PASSKEY_SCRIPT_ID] });
        if (enabled && !registered) {
            await chrome.scripting.registerContentScripts([script]);
        } else if (enabled && registered) {
            // The registration outlives updates: bring one from an older version up to date.
            const shape = (s: chrome.scripting.RegisteredContentScript) => JSON.stringify([s.js, s.matches, s.runAt, s.world, s.allFrames]);
            if (shape(registered) !== shape(script)) await chrome.scripting.updateContentScripts([script]);
        } else if (!enabled && registered) {
            await chrome.scripting.unregisterContentScripts({ ids: [PASSKEY_SCRIPT_ID] });
        }
    } catch {
        /* scripting unavailable (tests, old browsers) */
    }
}

/**
 * The origin of a page's top frame asking for a passkey, as the browser reports it. Only a content
 * script in a tab's top frame of an http(s) page qualifies; iframes keep the browser's own passkeys.
 */
function passkeyOrigin(sender?: chrome.runtime.MessageSender): string | null {
    if (!sender?.tab || sender.frameId !== 0 || sender.id !== chrome.runtime.id) return null;
    try {
        const origin = sender.origin ?? new URL(sender.url ?? '').origin;
        return /^https?:\/\//.test(origin) ? origin : null;
    } catch {
        return null;
    }
}

/**
 * Where a passkey request comes from: the page's top frame, or an iframe in it. An iframe's origin
 * comes from the content script, which read it off the message the browser delivered (a page can't
 * forge it); the top frame's comes from the browser's sender info.
 */
function passkeyCaller(sender: chrome.runtime.MessageSender | undefined, frameOrigin: unknown): { origin: string; topOrigin?: string } | null {
    const top = passkeyOrigin(sender);
    if (!top) return null;
    if (frameOrigin === undefined) return { origin: top };
    if (typeof frameOrigin !== 'string') return null;
    try {
        const origin = new URL(frameOrigin).origin;
        return origin === frameOrigin && /^https?:\/\//.test(origin) ? { origin, topOrigin: top } : null;
    } catch {
        return null;
    }
}

/**
 * A lapsed subscription (decided 2026-09-29): passkeys keep signing in for the 90 days, each time
 * with a reminder of how many days are left; new ones can't be saved (the vault is read-only).
 */
async function lapseInfo(): Promise<{ daysLeft: number } | undefined> {
    if (vault.cloudStatus().state !== 'on') return undefined;
    const stored = await chrome.storage.local.get(['subscriptionTier', LAPSED_AT_KEY]);
    if (stored.subscriptionTier !== 'free') {
        if (stored.subscriptionTier === 'pro' && stored[LAPSED_AT_KEY]) await chrome.storage.local.remove(LAPSED_AT_KEY);
        return undefined;
    }
    let lapsedAt = Number(stored[LAPSED_AT_KEY]);
    if (!Number.isFinite(lapsedAt) || lapsedAt <= 0) {
        lapsedAt = Date.now();
        await chrome.storage.local.set({ [LAPSED_AT_KEY]: lapsedAt });
    }
    return { daysLeft: Math.max(0, LAPSE_DAYS - Math.floor((Date.now() - lapsedAt) / 86_400_000)) };
}

function remindLapse(daysLeft: number, site: string) {
    try {
        chrome.notifications.create(`focuzpass-lapse-${Date.now()}`, {
            type: 'basic',
            iconUrl: chrome.runtime.getURL('public/icons/icon-128.png'),
            title: `Signed in to ${site} with FocuzPass`,
            message: `FocuzNow Pro has ended: ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left to resubscribe and keep Cloud sync. Your passkeys keep working until then.`,
            priority: 1,
        });
    } catch {
        /* notifications unavailable */
    }
}

/** A passkey operation's result for the page: a credential, or a WebAuthn error it can act on. */
async function passkeyAnswer(work: () => Promise<unknown>) {
    try {
        return { credential: await work() };
    } catch (error) {
        if (error instanceof PasskeyError) return { error: { name: error.name, message: error.message } };
        return { error: { name: 'NotAllowedError', message: error instanceof Error ? error.message : 'FocuzPass couldn\'t finish that.' } };
    }
}

/**
 * FocuzPass Cloud talks to Supabase through this. The service worker sets it after its other
 * imports, so this module (loaded first for fast answers) doesn't pull in the Supabase client.
 */
let cloudStoreFactory: (() => CloudStore) | null = null;
export function setFocuzPassCloudStore(factory: () => CloudStore) {
    cloudStoreFactory = factory;
}
function cloudStore(): CloudStore {
    if (!cloudStoreFactory) throw new Error('Cloud sync isn\'t available here');
    return cloudStoreFactory();
}
/**
 * Cloud sync in the background: shortly after a change here, after unlocking, and every couple
 * of minutes while the vault is open. Failures are kept in the cloud status for the UI to show;
 * the next run tries again, and nothing local is lost meanwhile.
 */
let syncTimer: ReturnType<typeof setTimeout> | null = null;
function syncCloudSoon(delayMs = 250) {
    if (!cloudStoreFactory || !vault.isUnlocked || vault.cloudStatus().state !== 'on') return;
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
        syncTimer = null;
        void runCloudSync().catch(() => undefined);
    }, delayMs);
}

async function runCloudSync() {
    if (!cloudStoreFactory || !vault.isUnlocked || vault.cloudStatus().state !== 'on') return null;
    const store = cloudStore();
    // A new master password's account row goes up first.
    await vault.syncCloudAccount(store).catch(() => undefined);
    const result = await vault.syncCloud(store);
    if (result.pulled > 0) broadcastVaultChanged();
    // Tell the account's other devices, which pull straight away.
    if (result.pushed > 0) realtime?.nudge();
    void connectRealtime();
    return result;
}

/**
 * Realtime (cloud/realtime.ts): while the vault is open and syncing, this worker listens on the
 * account's channel and pulls whenever another device says it changed something. The open
 * connection keeps the worker awake, so it closes when the vault locks.
 */
let realtimeClient: (() => RealtimeLike) | null = null;
let realtime: CloudRealtime | null = null;
export function setFocuzPassRealtime(client: () => RealtimeLike) {
    realtimeClient = client;
}

async function connectRealtime() {
    if (!realtimeClient) return;
    const name = vault.isUnlocked ? await vault.cloudRealtimeName().catch(() => null) : null;
    if (!name) {
        await realtime?.disconnect();
        return;
    }
    realtime ??= new CloudRealtime(realtimeClient(), () => syncCloudSoon(0));
    await realtime.connect(name);
}

/** Changes that should reach the cloud copy. */
const CHANGES_VAULT: ReadonlySet<string> = new Set([
    'FOCUZPASS_UPSERT',
    'FOCUZPASS_IMPORT',
    'FOCUZPASS_IMPORT_PACKAGE',
    'FOCUZPASS_DELETE',
    'FOCUZPASS_ITEM_ACTION',
    'FOCUZPASS_REORDER',
    'FOCUZPASS_CREATE_VAULT',
    'FOCUZPASS_CREATE_TAG',
    'FOCUZPASS_COMMIT_PENDING_LOGIN',
    'FOCUZPASS_CAPTURE_LOGIN',
    'FOCUZPASS_MARK_USED',
    'FOCUZPASS_PASSKEY_CREATE',
    'FOCUZPASS_PASSKEY_GET',
]);
import {
    FOCUZPASS_STORAGE_INBOX,
    FOCUZPASS_STORAGE_INBOX_PUB,
    FOCUZPASS_STORAGE_META,
    type InboxPendingLogin,
} from '../lib/focuzPass/types';

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
    /** Same domain+identity already saved with a different password → update toast variant. */
    update?: boolean;
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

/**
 * chrome.storage.session keeps the exported vault key alive across service-worker
 * restarts (§5.2). It is scoped to TRUSTED_CONTEXTS at init so content scripts can
 * never read it.
 */
const sessionAdapter: VaultStorageAdapter | undefined =
    typeof chrome !== 'undefined' && chrome.storage?.session
        ? {
              get: (keys) => chrome.storage.session.get(keys) as Promise<Record<string, unknown>>,
              set: (items) => chrome.storage.session.set(items),
              remove: (keys) => chrome.storage.session.remove(keys),
          }
        : undefined;

// Exported for tests that simulate a service-worker restart.
export const vault = new FocuzPassVault(chromeStorage, sessionAdapter);
let initialized = false;

function generatePassword(length = 20): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*+-=';
    const values = randomBytes(Math.max(12, Math.min(64, length | 0)));
    return Array.from(values, (value) => alphabet[value % alphabet.length]).join('');
}

/**
 * runtime.sendMessage only reaches extension pages; the on-page FocuzPass panels live
 * in content scripts, so tell every tab too — otherwise a page kept showing "locked"
 * after you unlocked in the secure window.
 */
function notifyTabs(message: Record<string, unknown>) {
    try {
        void chrome.tabs.query({}).then((tabs) => {
            for (const tab of tabs) {
                if (tab.id == null || tab.discarded || !/^https?:/.test(tab.url || '')) continue;
                chrome.tabs.sendMessage(tab.id, message).catch(() => undefined);
            }
        }).catch(() => undefined);
    } catch {
        /* tabs API unavailable */
    }
}

function broadcastLocked() {
    try {
        chrome.runtime.sendMessage({ type: 'FOCUZPASS_LOCKED' }).catch(() => undefined);
    } catch {
        /* no listeners */
    }
    notifyTabs({ type: 'FOCUZPASS_LOCKED' });
}

/** Another device's changes arrived: open FocuzPass pages reload what they show. */
function broadcastVaultChanged() {
    try {
        chrome.runtime.sendMessage({ type: 'FOCUZPASS_VAULT_CHANGED' }).catch(() => undefined);
    } catch {
        /* no listeners */
    }
}

function broadcastAccessChanged(inboxMerged = 0) {
    try {
        chrome.runtime.sendMessage({ type: 'FOCUZPASS_ACCESS_CHANGED', inboxMerged }).catch(() => undefined);
    } catch {
        /* no listeners */
    }
    notifyTabs({ type: 'FOCUZPASS_ACCESS_CHANGED', inboxMerged });
}

export function initFocuzPassVault() {
    if (initialized) return;
    initialized = true;

    void syncPasskeyScript();
    try {
        chrome.runtime.onInstalled.addListener(reconnectPasskeyTabs);
    } catch {
        /* no runtime events (tests) */
    }
    try {
        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName === 'local' && PASSKEYS_ENABLED_KEY in changes) void syncPasskeyScript();
        });
    } catch {
        /* storage events unavailable */
    }

    vault.onLock(() => {
        broadcastLocked();
        void realtime?.disconnect();
    });

    // Status is answered from memory; drop that cache if the vault's setup record
    // changes underneath us (e.g. extension storage cleared from another page).
    try {
        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName === 'local' && FOCUZPASS_STORAGE_META in changes) vault.invalidateStatusCache();
        });
    } catch {
        /* storage events unavailable */
    }

    try {
        // Explicit before any session write; also kicks off a lazy session restore.
        void chrome.storage.session
            ?.setAccessLevel?.({ accessLevel: 'TRUSTED_CONTEXTS' })
            ?.then(() => vault.getStatus())
            .catch(() => undefined);
    } catch {
        /* session storage unavailable */
    }

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
        chrome.alarms.create('focuzpass-cloud-sync', { periodInMinutes: 2 });
        chrome.alarms.onAlarm.addListener((alarm) => {
            if (alarm.name === 'focuzpass-lock-tick') {
                vault.enforceLockTimers();
            }
            if (alarm.name === 'focuzpass-cloud-sync') {
                // The worker may have restarted since the vault was unlocked: restore quietly first.
                void vault.restoreFromSession().then(() => {
                    if (!vault.enforceLockTimers()) void runCloudSync().catch(() => undefined);
                });
            }
        });
    } catch {
        /* alarms may be unavailable */
    }

    chrome.runtime.onStartup.addListener(() => {
        vault.lock();
    });

    // While the vault is unlocked the service worker stays up: woken from sleep on a busy machine it
    // can take many seconds to start, which made passkeys and autofill crawl. Any extension call
    // resets the browser's 30-second idle timer; once locked, it sleeps as usual.
    try {
        setInterval(() => {
            if (vault.isUnlocked) void chrome.runtime.getPlatformInfo().catch(() => undefined);
        }, 20_000);
    } catch {
        /* timers unavailable */
    }
}


/**
 * Dedicated early listener (§5.1): registered at module-eval time, and this module
 * is the first import in service-worker.js, so the listener exists before the rest
 * of the background graph even evaluates — FocuzPass messages never wait on
 * cold-start work. Returns `true` — every response is async.
 */
export function registerFocuzPassListener() {
    if (typeof chrome === 'undefined' || !chrome.runtime?.onMessage) return;
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        if (msg?.type === 'FOCUZPASS_OVERLAY_RELAY') {
            const tabId = sender.tab?.id;
            if (tabId == null) {
                sendResponse({ ok: false, error: 'No tab' });
                return false;
            }
            void chrome.tabs
                .sendMessage(
                    tabId,
                    {
                        type: msg.payloadType,
                        ...(msg.payload && typeof msg.payload === 'object' ? msg.payload : {}),
                        sourceFrameId: sender.frameId,
                    },
                    { frameId: Number.isInteger(msg.frameId) ? msg.frameId : 0 },
                )
                .then(() => sendResponse({ ok: true }))
                .catch(() => sendResponse({ ok: false, error: 'Frame unreachable' }));
            return true;
        }
        // Keep-awake ping from pages with login fields or passkey support: answer at once, and if
        // this worker was restarted while the vault was unlocked, bring the vault back now (from
        // this session's storage) so a passkey or autofill request doesn't wait for it later.
        // Nothing is sent back: the page only learns "ok".
        if (msg?.type === 'FOCUZPASS_PING') {
            sendResponse({ ok: true, data: null });
            void vault.restoreFromSession().catch(() => undefined);
            return false;
        }
        if (!isFocuzPassMessage(msg?.type)) return false;
        void handleFocuzPassMessage(msg, sender).then(sendResponse);
        return true;
    });
}

// Module-eval side effect: registers before later imports of the service worker.
registerFocuzPassListener();

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
    // Re-focusing an existing window isn't reliable (Windows can keep it buried behind
    // the browser, and after a worker restart we lose track of it), so close any open
    // unlock windows and show a fresh one on top.
    const unlockUrl = chrome.runtime.getURL('src/focuzpass-unlock/index.html');
    try {
        const windows = await chrome.windows.getAll({ populate: true, windowTypes: ['popup'] });
        await Promise.all(windows
            .filter((win) => win.id != null && win.tabs?.some((tab) => (tab.url || tab.pendingUrl || '').startsWith(unlockUrl)))
            .map((win) => chrome.windows.remove(win.id!).catch(() => undefined)));
    } catch {
        /* nothing to close */
    }
    accessWindowId = null;

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
    newMasterPassword?: string;
    recoveryKey?: boolean;
    secretKey?: string;
    localPassword?: string;
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
    items?: VaultUpsertInput[];
    importOptions?: { vaultId?: string; tagName?: string };
    domain?: string;
    package?: unknown;
    op?: 'create' | 'get';
    options?: unknown;
    credentialId?: string;
    enabled?: boolean;
    frameOrigin?: string;
}, sender?: chrome.runtime.MessageSender): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
    try {
        // Reading or changing the whole vault is for FocuzPass's own pages (on the website that's
        // the embedded frame). Content scripts only get what their page needs (status, its own logins).
        if (VAULT_CLIENT_TYPES.has(msg.type) && !isVaultClient(sender)) {
            return { ok: false, error: 'Not available here' };
        }
        // After a service-worker restart the in-memory key is gone; restore it lazily
        // (cheap no-op when already unlocked, refuses expired session records) so
        // LIST/SNAPSHOT/UPSERT etc. work without a prior STATUS call.
        await vault.restoreFromSession();
        const response = await handleVaultMessage(msg, sender);
        if (response.ok && CHANGES_VAULT.has(msg.type)) syncCloudSoon();
        return response;
    } catch (error) {
        const message = error instanceof Error ? error.message : 'FocuzPass error';
        return { ok: false, error: message };
    }
}

async function handleVaultMessage(
    msg: Parameters<typeof handleFocuzPassMessage>[0],
    sender?: chrome.runtime.MessageSender,
): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
    try {
        switch (msg.type) {
            case 'FOCUZPASS_STATUS':
                return { ok: true, data: await vault.getStatus('extension') };
            case 'FOCUZPASS_SETUP': {
                const status = await vault.setup(String(msg.masterPassword || ''));
                broadcastAccessChanged(status.inboxMerged || 0);
                return { ok: true, data: status };
            }
            case 'FOCUZPASS_UNLOCK': {
                const status = await vault.unlock(String(msg.masterPassword || ''));
                broadcastAccessChanged(status.inboxMerged || 0);
                syncCloudSoon(0);
                return { ok: true, data: status };
            }
            case 'FOCUZPASS_CHANGE_MASTER_PASSWORD': {
                const status = await vault.changeMasterPassword(String(msg.masterPassword || ''), String(msg.newMasterPassword || ''));
                syncCloudSoon(0);
                return { ok: true, data: status };
            }
            case 'FOCUZPASS_CLOUD_STATUS':
                return { ok: true, data: vault.isUnlocked ? vault.cloudStatus() : null };
            case 'FOCUZPASS_CLOUD_PREPARE': {
                const user = await cloudStore().currentUser();
                if (!user) throw new Error('Sign in to FocuzNow to use Cloud sync.');
                return { ok: true, data: await vault.prepareCloud(String(msg.masterPassword || ''), user, { recoveryKey: Boolean(msg.recoveryKey) }) };
            }
            case 'FOCUZPASS_CLOUD_ENABLE':
                return { ok: true, data: await vault.enableCloud(cloudStore()) };
            case 'FOCUZPASS_CLOUD_CANCEL':
                return { ok: true, data: await vault.cancelCloud() };
            case 'FOCUZPASS_CLOUD_KIT':
                return { ok: true, data: await vault.cloudKit(String(msg.masterPassword || '')) };
            case 'FOCUZPASS_CLOUD_SYNC': {
                if (syncTimer) clearTimeout(syncTimer);
                syncTimer = null;
                const result = await runCloudSync();
                if (!result) throw new Error(vault.isUnlocked ? 'Cloud sync isn\'t on' : 'Vault is locked');
                return { ok: true, data: result };
            }
            case 'FOCUZPASS_CLOUD_ACCOUNT':
                return { ok: true, data: await vault.cloudAccountState(cloudStore()) };
            case 'FOCUZPASS_CLOUD_JOIN': {
                const status = await vault.joinCloud(cloudStore(), { masterPassword: String(msg.masterPassword || ''), secretKey: String(msg.secretKey || '') });
                broadcastAccessChanged(0);
                return { ok: true, data: status };
            }
            case 'FOCUZPASS_CLOUD_ADD_DEVICE': {
                const merged = await vault.addToCloud(cloudStore(), {
                    masterPassword: String(msg.masterPassword || ''),
                    secretKey: String(msg.secretKey || ''),
                    localPassword: String(msg.localPassword || ''),
                });
                broadcastVaultChanged();
                syncCloudSoon(0);
                return { ok: true, data: merged };
            }
            case 'FOCUZPASS_LOCK':
                vault.lock();
                return { ok: true, data: await vault.getStatus('extension') };
            case 'FOCUZPASS_LIST':
                return { ok: true, data: vault.list() };
            case 'FOCUZPASS_SNAPSHOT':
                return { ok: true, data: vault.snapshot() };
            case 'FOCUZPASS_UPSERT':
                return { ok: true, data: await vault.upsert(msg.item as VaultUpsertInput) };
            case 'FOCUZPASS_SITE_ICON': {
                // Only for the dashboard (extension pages, focuznow.com /app) with the vault open.
                if (!(await vault.getStatus('extension')).unlocked) return { ok: true, data: null };
                return { ok: true, data: await getSiteIcon(String(msg.domain || '').slice(0, 2048)) };
            }
            // Moving the vault between devices: the dashboard only, never a page's content script.
            case 'FOCUZPASS_EXPORT_PACKAGE':
                return { ok: true, data: await vault.exportPackage() };
            case 'FOCUZPASS_IMPORT_PACKAGE':
                return {
                    ok: true,
                    data: await vault.importPackage(msg.package, String(msg.masterPassword || ''), msg.importOptions ?? {}),
                };
            case 'FOCUZPASS_IMPORT':
                return {
                    ok: true,
                    data: await vault.importItems(Array.isArray(msg.items) ? msg.items : [], msg.importOptions ?? {}),
                };
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
            case 'FOCUZPASS_PASSKEY_SETTINGS': {
                if (typeof msg.enabled === 'boolean') {
                    await chrome.storage.local.set({ [PASSKEYS_ENABLED_KEY]: msg.enabled });
                    await syncPasskeyScript();
                    if (msg.enabled) await injectPasskeyScriptIntoOpenTabs();
                }
                return { ok: true, data: { enabled: await passkeysEnabled() } };
            }
            case 'FOCUZPASS_PASSKEY_PREFLIGHT': {
                const caller = passkeyCaller(sender, msg.frameOrigin);
                if (!caller || !(await passkeysEnabled())) return { ok: true, data: { state: 'off' } };
                const origin = caller.origin;
                const status = await vault.getStatus('extension');
                if (!status.configured) return { ok: true, data: { state: 'unconfigured' } };
                const op = msg.op === 'create' ? 'create' : 'get';
                const options = (msg.options ?? {}) as CreationOptionsJSON & RequestOptionsJSON;
                const site = checkRpId(origin, op === 'create' ? options.rp?.id : options.rpId);
                if (!site.ok) return { ok: true, data: { state: 'refused' } };
                if (!status.unlocked) return { ok: true, data: { state: 'locked', rpId: site.rpId } };
                const info = vault.passkeyPreflight(origin, op === 'create' ? { op, options } : { op, options });
                return { ok: true, data: { state: 'ready', ...info, synced: vault.cloudStatus().state === 'on', lapse: await lapseInfo() } };
            }
            case 'FOCUZPASS_PASSKEY_CREATE': {
                const caller = passkeyCaller(sender, msg.frameOrigin);
                if (!caller || !(await passkeysEnabled())) throw new Error('Not available here');
                if (await lapseInfo()) {
                    return { ok: true, data: { error: { name: 'NotAllowedError', message: 'FocuzPass can\'t save new passkeys while FocuzNow Pro has ended.' } } };
                }
                return { ok: true, data: await passkeyAnswer(() => vault.passkeyCreate(caller.origin, msg.options as CreationOptionsJSON, caller.topOrigin)) };
            }
            case 'FOCUZPASS_PASSKEY_GET': {
                const caller = passkeyCaller(sender, msg.frameOrigin);
                if (!caller || !(await passkeysEnabled())) throw new Error('Not available here');
                const origin = caller.origin;
                const options = msg.options as RequestOptionsJSON;
                const answer = await passkeyAnswer(() => vault.passkeyGet(origin, options, String(msg.credentialId || ''), caller.topOrigin));
                if (answer.credential) {
                    const lapse = await lapseInfo();
                    const site = checkRpId(origin, options?.rpId);
                    if (lapse && site.ok) remindLapse(lapse.daysLeft, site.rpId);
                }
                return { ok: true, data: answer };
            }
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
                // Logins from the whole site (an Apple ID saved on idmsa.apple.com shows on developer.apple.com
                // too), the exact address first, then the most recently used: the first row is what Enter fills.
                const fit = (item: (typeof snapshot.items)[number]) => (item.type === 'login' ? vaultDomainMatch(item.domain, page.domain) : 2);
                const recency = (item: (typeof snapshot.items)[number]) => Date.parse(item.lastUsedAt || item.updatedAt || item.createdAt || '') || 0;
                const activeItems = snapshot.items
                    .filter((item) => !item.archivedAt && !item.deletedAt && item.type !== 'passkey' && fit(item) > 0)
                    .sort((a, b) => fit(b) - fit(a) || recency(b) - recency(a));
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
                const identityMatch = status.unlocked
                    ? vault
                          .findLoginMatches(page.domain)
                          .find((item) => item.identity.toLowerCase() === identity.toLowerCase())
                    : undefined;
                if (identityMatch && identityMatch.password === password) {
                    await vault.markUsed(identityMatch.id);
                    await clearPending(sender);
                    return { ok: true, data: { captured: false, reason: 'already-saved', itemId: identityMatch.id } };
                }
                const pending: PendingLogin = {
                    domain: page.domain,
                    title: String(msg.title || page.domain).trim().slice(0, 120) || page.domain,
                    identity: identity.slice(0, 320),
                    password,
                    faviconUrl: String(msg.faviconUrl || '').slice(0, 2048) || undefined,
                    accountCreation: Boolean(msg.accountCreation),
                    update: Boolean(identityMatch),
                    createdAt: Date.now(),
                };
                const key = pendingKey(page.tabId);
                if (chrome.storage.session) await chrome.storage.session.set({ [key]: pending });
                else pendingMemory.set(key, pending);
                return { ok: true, data: { captured: true, update: pending.update } };
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
                              update: pending.update,
                          }
                        : { available: false },
                };
            }
            case 'FOCUZPASS_COMMIT_PENDING_LOGIN': {
                const pending = await readPending(sender);
                if (!pending) throw new Error('This login save request has expired');
                const status = await vault.getStatus('extension');
                if (!status.unlocked) {
                    // Locked-save inbox (§5.3): seal the pending login to the vault's
                    // public ECDH key and queue it in chrome.storage.local.
                    const stored = await chrome.storage.local.get([
                        FOCUZPASS_STORAGE_INBOX_PUB,
                        FOCUZPASS_STORAGE_INBOX,
                    ]);
                    const publicJwk = stored[FOCUZPASS_STORAGE_INBOX_PUB] as JsonWebKey | undefined;
                    if (!publicJwk?.x || !publicJwk?.y) {
                        // Pre-inbox vaults fall back to a one-time "Unlock to save".
                        throw new Error('Unlock FocuzPass to save this login');
                    }
                    const payload: InboxPendingLogin = {
                        domain: pending.domain,
                        title: pending.title,
                        identity: pending.identity,
                        password: pending.password,
                        createdAt: new Date(pending.createdAt).toISOString(),
                    };
                    const envelope = await encryptForInbox(publicJwk, JSON.stringify(payload));
                    const inbox = Array.isArray(stored[FOCUZPASS_STORAGE_INBOX])
                        ? (stored[FOCUZPASS_STORAGE_INBOX] as InboxEnvelope[])
                        : [];
                    inbox.push(envelope);
                    await chrome.storage.local.set({ [FOCUZPASS_STORAGE_INBOX]: inbox });
                    await clearPending(sender);
                    return { ok: true, data: { saved: true, queued: true } };
                }
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
                if (!item || (item.type === 'login' && !vaultDomainMatch(item.domain, page.domain))) throw new Error('No matching item for this page');
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

const VAULT_CLIENT_TYPES: ReadonlySet<string> = new Set([
    'FOCUZPASS_SETUP',
    'FOCUZPASS_UNLOCK',
    'FOCUZPASS_CHANGE_MASTER_PASSWORD',
    'FOCUZPASS_CLOUD_STATUS',
    'FOCUZPASS_CLOUD_PREPARE',
    'FOCUZPASS_CLOUD_ENABLE',
    'FOCUZPASS_CLOUD_CANCEL',
    'FOCUZPASS_CLOUD_KIT',
    'FOCUZPASS_CLOUD_SYNC',
    'FOCUZPASS_CLOUD_ACCOUNT',
    'FOCUZPASS_CLOUD_JOIN',
    'FOCUZPASS_CLOUD_ADD_DEVICE',
    'FOCUZPASS_PASSKEY_SETTINGS',
    'FOCUZPASS_LIST',
    'FOCUZPASS_SNAPSHOT',
    'FOCUZPASS_UPSERT',
    'FOCUZPASS_IMPORT',
    'FOCUZPASS_EXPORT_PACKAGE',
    'FOCUZPASS_IMPORT_PACKAGE',
    'FOCUZPASS_SITE_ICON',
    'FOCUZPASS_DELETE',
    'FOCUZPASS_ITEM_ACTION',
    'FOCUZPASS_REORDER',
    'FOCUZPASS_CREATE_VAULT',
    'FOCUZPASS_CREATE_TAG',
]);

/** This extension's own pages (including the frame on the website). No sender: a call inside the worker. */
function isVaultClient(sender?: chrome.runtime.MessageSender): boolean {
    return !sender || senderKind(sender) === 'extension-page';
}

export function isFocuzPassMessage(type: unknown): boolean {
    return typeof type === 'string'
        && type.startsWith('FOCUZPASS_')
        && type !== 'FOCUZPASS_LOCKED'
        && type !== 'FOCUZPASS_ACCESS_CHANGED'
        && type !== 'FOCUZPASS_VAULT_CHANGED'
        && !type.startsWith('FOCUZPASS_OVERLAY_');
}
