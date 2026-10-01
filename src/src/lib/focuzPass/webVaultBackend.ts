/**
 * The web vault: FocuzPass in a browser without the extension (docs/focuzpass-cloud-plan.md). The
 * dashboard's own FocuzPass UI talks to this instead of the extension (client.ts transport), and
 * this runs the same vault core the extension does, in the page's memory: opened from the cloud
 * copy with the master password and Security Key, saved nowhere in the browser, synced after
 * every change, and dropped when it locks (5 idle minutes, the tab closing, or Lock).
 *
 * Less protected than the extension (the page's own code runs next to it), which is why the site
 * uses the extension whenever it's there.
 */

import { FocuzPassVault, createMemoryStorage, type VaultItemAction, type VaultUpsertInput } from './vaultCore';
import { randomBytes } from './crypto';
import { CloudError, type CloudStore } from './cloud/store';
import { CloudRealtime, type RealtimeLike } from './cloud/realtime';
import type { VaultStatus } from './types';

export const WEB_VAULT_IDLE_MINUTES = 5;

type Message = { type: string; [key: string]: unknown };
type Response = { ok: true; data: unknown } | { ok: false; error: string };

/** Changes that go up straight away. */
const CHANGES = new Set(['FOCUZPASS_UPSERT', 'FOCUZPASS_IMPORT', 'FOCUZPASS_IMPORT_PACKAGE', 'FOCUZPASS_DELETE', 'FOCUZPASS_ITEM_ACTION', 'FOCUZPASS_REORDER', 'FOCUZPASS_CREATE_VAULT', 'FOCUZPASS_CREATE_TAG']);

function generatePassword(length = 20): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*+-=';
    const values = randomBytes(Math.max(12, Math.min(64, length | 0)));
    return Array.from(values, (value) => alphabet[value % alphabet.length]).join('');
}

export class WebVaultBackend {
    private vault: FocuzPassVault | null = null;
    private realtime: CloudRealtime | null = null;
    private syncTimer: ReturnType<typeof setTimeout> | null = null;
    private lockTimer: ReturnType<typeof setInterval> | null = null;

    constructor(
        private readonly store: CloudStore,
        private readonly emit: (message: Message) => void,
        private readonly realtimeClient: RealtimeLike | null = null,
    ) {}

    get isOpen() {
        return Boolean(this.vault?.isUnlocked);
    }

    /** Opens the cloud copy here: sign-in (already done), then the master password and Security Key. */
    async open(input: { masterPassword: string; secretKey: string }): Promise<void> {
        this.lock();
        const vault = new FocuzPassVault(createMemoryStorage());
        await vault.joinCloud(this.store, input, { idleLockMinutes: WEB_VAULT_IDLE_MINUTES, recordDevice: false });
        this.vault = vault;
        vault.onLock(() => this.closed(vault));
        this.lockTimer = setInterval(() => vault.enforceLockTimers(), 10_000);
        // Never keeps a process alive on its own (Node, in tests); a no-op in browsers.
        (this.lockTimer as unknown as { unref?: () => void }).unref?.();
        const name = await vault.cloudRealtimeName();
        if (this.realtimeClient && name) {
            this.realtime = new CloudRealtime(this.realtimeClient, () => this.syncSoon(0));
            await this.realtime.connect(name);
        }
        this.emit({ type: 'FOCUZPASS_ACCESS_CHANGED', inboxMerged: 0 });
    }

    lock() {
        this.vault?.lock();
    }

    private closed(vault: FocuzPassVault) {
        if (this.vault !== vault) return;
        this.vault = null;
        if (this.lockTimer) clearInterval(this.lockTimer);
        if (this.syncTimer) clearTimeout(this.syncTimer);
        this.lockTimer = null;
        this.syncTimer = null;
        void this.realtime?.disconnect();
        this.realtime = null;
        this.emit({ type: 'FOCUZPASS_LOCKED' });
    }

    private syncSoon(delayMs = 250) {
        if (!this.vault) return;
        if (this.syncTimer) clearTimeout(this.syncTimer);
        this.syncTimer = setTimeout(() => {
            this.syncTimer = null;
            void this.sync().catch(() => undefined);
        }, delayMs);
        (this.syncTimer as unknown as { unref?: () => void }).unref?.();
    }

    /** Pull, merge, push; tells the page when something arrived and the other devices when something went up. */
    async sync() {
        const vault = this.vault;
        if (!vault?.isUnlocked) throw new Error('Vault is locked');
        await vault.syncCloudAccount(this.store).catch(() => undefined);
        const result = await vault.syncCloud(this.store);
        if (result.pulled > 0) this.emit({ type: 'FOCUZPASS_VAULT_CHANGED' });
        if (result.pushed > 0) this.realtime?.nudge();
        return result;
    }

    private lockedStatus(): VaultStatus {
        return {
            configured: true,
            unlocked: false,
            itemCount: 0,
            idleLockMinutes: WEB_VAULT_IDLE_MINUTES,
            unlockedAt: null,
            absoluteLockAt: null,
            remainingMs: null,
            platform: 'web',
            passkeysExperimental: true,
        };
    }

    /** The same messages the extension's service worker answers, for what the web vault can do. */
    async handle(message: Message): Promise<Response> {
        try {
            const response = await this.answer(message);
            if (response.ok && CHANGES.has(message.type)) this.syncSoon();
            return response;
        } catch (error) {
            return { ok: false, error: error instanceof Error ? error.message : 'FocuzPass error' };
        }
    }

    private async answer(msg: Message): Promise<Response> {
        const vault = this.vault;
        const ok = (data: unknown): Response => ({ ok: true, data });
        switch (msg.type) {
            case 'FOCUZPASS_PING':
                return ok(null);
            case 'FOCUZPASS_STATUS':
                return ok(vault?.isUnlocked ? await vault.getStatus('web') : this.lockedStatus());
            case 'FOCUZPASS_LOCK':
                this.lock();
                return ok(this.lockedStatus());
            case 'FOCUZPASS_GENERATE':
                return ok(generatePassword(Number(msg.length) || 20));
            case 'FOCUZPASS_SITE_ICON':
                return ok(null);
            // The unlock form is on the page itself; there's no separate window to open.
            case 'FOCUZPASS_OPEN_ACCESS_WINDOW':
                return ok(null);
            case 'FOCUZPASS_PASSKEY_SETTINGS':
                return ok({ enabled: false, unavailable: true });
            case 'FOCUZPASS_CLOUD_ACCOUNT': {
                const user = await this.store.currentUser();
                return ok(user ? { signedIn: true, email: user.email, exists: Boolean(await this.store.getAccount()) } : { signedIn: false });
            }
        }
        if (!vault?.isUnlocked) throw new Error('Vault is locked');
        switch (msg.type) {
            case 'FOCUZPASS_TOUCH':
                vault.touch();
                return ok(null);
            case 'FOCUZPASS_LIST':
                return ok(vault.list());
            case 'FOCUZPASS_SNAPSHOT':
                return ok(vault.snapshot());
            case 'FOCUZPASS_UPSERT':
                return ok(await vault.upsert(msg.item as VaultUpsertInput));
            case 'FOCUZPASS_IMPORT':
                return ok(await vault.importItems(Array.isArray(msg.items) ? (msg.items as VaultUpsertInput[]) : [], (msg.importOptions as { vaultId?: string; tagName?: string }) ?? {}));
            case 'FOCUZPASS_EXPORT_PACKAGE':
                return ok(await vault.exportPackage());
            case 'FOCUZPASS_IMPORT_PACKAGE':
                return ok(await vault.importPackage(msg.package, String(msg.masterPassword || ''), (msg.importOptions as { vaultId?: string; tagName?: string }) ?? {}));
            case 'FOCUZPASS_DELETE':
                await vault.delete(String(msg.id || ''));
                return ok(null);
            case 'FOCUZPASS_ITEM_ACTION':
                return ok(await vault.itemAction(msg.action as VaultItemAction));
            case 'FOCUZPASS_REORDER':
                await vault.reorder(Array.isArray(msg.orderedIds) ? msg.orderedIds.map(String) : []);
                return ok(null);
            case 'FOCUZPASS_CREATE_VAULT':
                return ok(await vault.createVault((msg.collection as { name: string; color: string; icon: string }) ?? { name: '', color: '', icon: '' }));
            case 'FOCUZPASS_CREATE_TAG':
                return ok(await vault.createTag((msg.collection as { name: string; color: string; icon: string }) ?? { name: '', color: '', icon: '' }));
            case 'FOCUZPASS_CHANGE_MASTER_PASSWORD': {
                const status = await vault.changeMasterPassword(String(msg.masterPassword || ''), String(msg.newMasterPassword || ''));
                this.syncSoon(0);
                return ok(status);
            }
            case 'FOCUZPASS_CLOUD_STATUS':
                return ok(vault.cloudStatus());
            case 'FOCUZPASS_CLOUD_SYNC':
                return ok(await this.sync());
            case 'FOCUZPASS_CLOUD_KIT':
                return ok(await vault.cloudKit(String(msg.masterPassword || '')));
            default:
                throw new CloudError('unknown', 'That isn\'t available in the web vault. Use the FocuzNow extension for it.');
        }
    }
}
