/**
 * Opening FocuzPass Cloud where the Security Key isn't stored yet: a new device, or the web vault
 * in a browser without the extension. The signed-in account's wrapped keys are unlocked with the
 * master password and Security Key, then every record is pulled and opened.
 */

import { importRawVaultKey } from '../crypto';
import { deriveUnlockKey, parseAccountKey, unwrapAccountKey, unwrapVaultKeyFromCloud } from './keys';
import { CloudError, type CloudAccountRow, type CloudKeyRow, type CloudStore } from './store';
import { mergeRemote, pullChanges, type LocalRecord, type SyncKeys, type SyncState } from './sync';

export type OpenedAccount = {
    user: { id: string; email?: string };
    account: CloudAccountRow;
    /** Canonical Security Key (A1 + 26 characters). */
    secretKey: string;
    accountKey: Uint8Array;
    vaultKeyRaw: Uint8Array;
    keys: SyncKeys;
};

export const WRONG_SECRETS = 'That master password and Security Key don\'t open this account. Check both and try again.';

/** The server's key-derivation settings, refused when they're weaker (or heavier) than FocuzPass ever uses. */
function checkKdf(account: CloudAccountRow) {
    const iterations = Number(account.iterations);
    if (account.kdf !== 'pbkdf2-sha256' || !Number.isInteger(iterations) || iterations < 100_000 || iterations > 10_000_000 || typeof account.salt !== 'string') {
        throw new CloudError('unknown', 'This cloud account has settings FocuzPass won\'t use. Contact support.');
    }
}

/** The newest vault key the account has (one until key rotation arrives). */
function currentKey(keys: CloudKeyRow[]): CloudKeyRow {
    const key = [...keys].sort((a, b) => b.key_version - a.key_version)[0];
    if (!key) throw new CloudError('unknown', 'The cloud copy isn\'t finished yet. Finish turning on Cloud sync on your other device, then try again.');
    return key;
}

export async function openCloudAccount(store: CloudStore, input: { masterPassword: string; secretKey: string }): Promise<OpenedAccount> {
    const secretKey = parseAccountKey(input.secretKey, 'secret');
    if (!secretKey) throw new Error('That doesn\'t look like a Security Key. It starts with A1- and is in your Emergency Kit.');
    if (!input.masterPassword) throw new Error('Enter your master password.');
    const user = await store.currentUser();
    if (!user) throw new CloudError('signed-out', 'Sign in to FocuzNow first.');
    const account = await store.getAccount();
    if (!account) throw new CloudError('missing', 'Cloud sync isn\'t on for this FocuzNow account yet. Turn it on from a device that has your vault.');
    checkKdf(account);

    const unlockKey = await deriveUnlockKey(input.masterPassword, secretKey, user.id, { salt: account.salt, iterations: Number(account.iterations) });
    let accountKey: Uint8Array;
    try {
        accountKey = await unwrapAccountKey(unlockKey, account.wrapped_account_key, user.id);
    } catch {
        throw new Error(WRONG_SECRETS);
    }
    const key = currentKey(await store.listKeys());
    let vaultKeyRaw: Uint8Array;
    try {
        vaultKeyRaw = await unwrapVaultKeyFromCloud(accountKey, key.wrapped_key, user.id, key.id, key.key_version);
    } catch {
        throw new CloudError('unknown', 'The cloud copy\'s vault key doesn\'t open. Contact support before changing anything.');
    }
    return {
        user,
        account,
        secretKey,
        accountKey,
        vaultKeyRaw,
        keys: { userId: user.id, keyId: key.id, keyVersion: key.key_version, vaultKey: await importRawVaultKey(vaultKeyRaw) },
    };
}

/** Every record in the account, opened, and the sync state that goes with having all of them. */
export async function pullEverything(store: CloudStore, keys: SyncKeys): Promise<{ records: LocalRecord[]; state: SyncState; refused: number }> {
    const empty: SyncState = { cursor: 0, synced: {} };
    const pulled = await pullChanges(store, keys, empty);
    const merged = mergeRemote(new Map(), pulled.remote, {});
    return { records: merged.changes.upserts, state: { cursor: pulled.cursor, pullFrom: 0, synced: merged.synced }, refused: pulled.refused };
}
