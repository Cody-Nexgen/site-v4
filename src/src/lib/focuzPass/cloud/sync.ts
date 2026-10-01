/**
 * FocuzPass Cloud sync (docs/focuzpass-cloud-plan.md, phase 3).
 *
 * Every item, vault and tag is its own sealed record. Each device remembers, per record, the newest
 * revision it has seen and a fingerprint of that version (`synced`), so it can tell what changed
 * locally without keeping old copies. A sync pulls what other devices wrote, merges it, then pushes
 * what changed here. The server refuses any write that isn't the next revision, so two devices
 * can't silently overwrite each other: the loser pulls, merges and tries again.
 *
 * Merging: an untouched local copy takes the newer version. When both sides changed a record,
 * the later edit wins if the secrets (password, card, fields, notes, passkey) are the same;
 * if the secrets differ, both are kept and the local one becomes a "conflict copy". Nothing is
 * dropped without a trace.
 *
 * What a malicious server can and can't do: it can't read or forge records (AES-GCM with the
 * record's id, kind, revision and key bound in), swap them between ids, or roll one back (older
 * revisions than the one remembered are refused). It can withhold or delete rows, which no
 * design prevents.
 */

import { bytesToBase64 } from '../crypto';
import { openRecord, recordIdFor, sealRecord, type RecordKind, type RecordMeta } from './keys';
import { CloudError, type CloudRecordRow, type CloudStore, type PulledRecordRow } from './store';

/** What this device last saw of a record. `kind` is kept for anything but items, for its tombstone. */
export type SyncedEntry = { rev: number; hash: string; deleted?: true; kind?: RecordKind };

function entry(rev: number, hash: string, kind: RecordKind, deleted = false): SyncedEntry {
    return { rev, hash, ...(deleted ? { deleted: true as const } : {}), ...(kind !== 'item' ? { kind } : {}) };
}

export type SyncState = {
    /** Highest server_seq pulled so far. */
    cursor: number;
    /** Where the next pull starts: the cursor as of the pull before, so a write that committed late isn't missed. */
    pullFrom?: number;
    synced: Record<string, SyncedEntry>;
};

export type SyncKeys = { userId: string; keyId: string; keyVersion: number; vaultKey: CryptoKey };

/** Something that syncs, as the vault holds it. `body` is what goes in the seal. */
export type LocalRecord = { kind: RecordKind; localId: string; body: Record<string, unknown> };

export type RemoteChanges = {
    /** New or newer versions to put in the vault (by kind + local id). */
    upserts: LocalRecord[];
    /** Records deleted elsewhere. */
    removes: { kind: RecordKind; localId: string }[];
    /** Local versions kept alongside a conflicting remote one, under a new id. */
    copies: LocalRecord[];
};

export type SyncResult = { pulled: number; pushed: number; conflicts: number; refused: number };

export interface SyncHost {
    keys(): SyncKeys;
    state(): SyncState;
    /** Everything that syncs, as it is now, and a counter that moves on every local change. */
    snapshot(): { records: LocalRecord[]; generation: number };
    /**
     * Puts pulled changes into the vault and saves it with the new state. Returns false (and
     * changes nothing) when the vault changed since `generation`, so the merge is redone.
     */
    apply(changes: RemoteChanges, state: SyncState, generation: number): Promise<boolean>;
    /** Saves new sync state alone (after a pull with nothing to merge, or a pushed batch). */
    saveState(state: SyncState): Promise<void>;
}

const PAGE = 500;
const BATCH = 200;
const ATTEMPTS = 4;

/* ── Record encoding ───────────────────────────────────────────────────── */

/** JSON with sorted keys and no undefined values: the same object always gives the same text. */
export function canonicalJson(value: unknown): string {
    if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
    if (Array.isArray(value)) return `[${value.map((entry) => (entry === undefined ? 'null' : canonicalJson(entry))).join(',')}]`;
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
        .sort()
        .filter((key) => object[key] !== undefined)
        .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
        .join(',')}}`;
}

export function recordPlaintext(record: LocalRecord): string {
    return canonicalJson({ v: 1, [record.kind]: record.body });
}

export async function fingerprint(plaintext: string): Promise<string> {
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(plaintext)));
    return bytesToBase64(digest.slice(0, 18));
}

type IndexedLocal = { id: string; record: LocalRecord; plaintext: string; hash: string };

export async function indexLocal(records: LocalRecord[]): Promise<Map<string, IndexedLocal>> {
    const out = new Map<string, IndexedLocal>();
    for (const record of records) {
        const plaintext = recordPlaintext(record);
        const id = await recordIdFor(record.kind, record.localId);
        out.set(id, { id, record, plaintext, hash: await fingerprint(plaintext) });
    }
    return out;
}

/* ── Pull ──────────────────────────────────────────────────────────────── */

export type OpenedRemote = {
    id: string;
    kind: RecordKind;
    rev: number;
    seq: number;
    deleted: boolean;
    record?: LocalRecord;
    hash?: string;
};

const KINDS: readonly RecordKind[] = ['item', 'collection', 'tag', 'setting'];

/** Opens one pulled row, or returns null when it doesn't open as what it claims to be. */
export async function openPulledRow(keys: SyncKeys, row: PulledRecordRow): Promise<OpenedRemote | null> {
    const base = { id: row.id, kind: row.kind, rev: Number(row.revision), seq: Number(row.server_seq), deleted: Boolean(row.deleted) };
    if (!KINDS.includes(row.kind) || !Number.isInteger(base.rev) || base.rev < 1) return null;
    if (row.deleted) return base;
    if (row.key_id !== keys.keyId || row.key_version !== keys.keyVersion) return null;
    const meta: RecordMeta = { userId: keys.userId, id: row.id, kind: row.kind, revision: base.rev, keyId: row.key_id, keyVersion: row.key_version };
    let plaintext: string;
    try {
        plaintext = await openRecord(keys.vaultKey, meta, row);
    } catch {
        return null;
    }
    let parsed: { v?: unknown } & Record<string, unknown>;
    try {
        parsed = JSON.parse(plaintext);
    } catch {
        return null;
    }
    const body = parsed?.[row.kind] as Record<string, unknown> | undefined;
    const localId = body && typeof body.id === 'string' ? body.id : '';
    // The record's id is derived from what's inside it; a body under someone else's id doesn't count.
    if (parsed?.v !== 1 || !body || !localId || (await recordIdFor(row.kind, localId)) !== row.id) return null;
    const record: LocalRecord = { kind: row.kind, localId, body };
    return { ...base, record, hash: await fingerprint(recordPlaintext(record)) };
}

/** Everything written since the last pull, opened. Rows that don't open are counted, not applied. */
export async function pullChanges(store: CloudStore, keys: SyncKeys, state: SyncState): Promise<{ remote: OpenedRemote[]; cursor: number; refused: number }> {
    const remote: OpenedRemote[] = [];
    let after = state.pullFrom ?? state.cursor;
    let cursor = state.cursor;
    let refused = 0;
    for (;;) {
        const rows = await store.listRecords(after, PAGE);
        for (const row of rows) {
            const opened = await openPulledRow(keys, row);
            if (opened) remote.push(opened);
            // Rows in the overlap with the last pull were counted then.
            else if (Number(row.server_seq) > state.cursor) refused++;
            after = Math.max(after, Number(row.server_seq));
        }
        cursor = Math.max(cursor, after);
        if (rows.length < PAGE) break;
    }
    return { remote, cursor, refused };
}

/* ── Merge ─────────────────────────────────────────────────────────────── */

const SECRET_FIELDS = ['password', 'cardNumber', 'cvv', 'fields', 'note', 'privateKey', 'passkey'];

function sameSecrets(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
    return SECRET_FIELDS.every((field) => canonicalJson(a[field] ?? null) === canonicalJson(b[field] ?? null));
}

function laterEdit(a: Record<string, unknown>, b: Record<string, unknown>): 'a' | 'b' {
    const time = (value: unknown) => (typeof value === 'string' ? Date.parse(value) || 0 : 0);
    return time(a.updatedAt) > time(b.updatedAt) ? 'a' : 'b';
}

function conflictCopy(record: LocalRecord): LocalRecord {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const title = typeof record.body.title === 'string' ? record.body.title : 'Item';
    return { kind: record.kind, localId: id, body: { ...record.body, id, title: `${title} (conflict copy)`, createdAt: now, updatedAt: now } };
}

/**
 * What pulled rows mean for this device: which local records to replace, remove or copy, and the
 * new `synced` map. Pure, apart from the random ids of conflict copies.
 */
export function mergeRemote(
    local: Map<string, IndexedLocal>,
    remote: OpenedRemote[],
    synced: Record<string, SyncedEntry>,
): { changes: RemoteChanges; synced: Record<string, SyncedEntry>; conflicts: number; applied: number } {
    const next = { ...synced };
    const changes: RemoteChanges = { upserts: [], removes: [], copies: [] };
    let conflicts = 0;
    let applied = 0;
    // A pull can see a record more than once (the overlap with the last pull): keep the newest.
    const newest = new Map<string, OpenedRemote>();
    for (const row of remote) if ((newest.get(row.id)?.rev ?? 0) < row.rev) newest.set(row.id, row);

    for (const row of newest.values()) {
        const prev = next[row.id];
        // Seen already, or older than what this device has seen (a rollback): nothing to do.
        if (prev && row.rev <= prev.rev) continue;
        const mine = local.get(row.id);
        const changedHere = mine ? !prev || prev.deleted === true || mine.hash !== prev.hash : false;
        applied++;

        if (row.deleted) {
            // Deleted elsewhere. An edit made here since is kept (it goes back up as the next revision).
            if (mine && !changedHere) changes.removes.push({ kind: mine.record.kind, localId: mine.record.localId });
            next[row.id] = entry(row.rev, '', mine?.record.kind ?? prev?.kind ?? row.kind, true);
            continue;
        }

        const theirs = row.record!;
        const theirHash = row.hash!;
        if (!mine || !changedHere) {
            // New to this device, untouched here, or deleted here before this edit arrived (the edit wins).
            changes.upserts.push(theirs);
        } else if (mine.hash !== theirHash) {
            if (row.kind === 'item' && !sameSecrets(mine.record.body, theirs.body)) {
                changes.upserts.push(theirs);
                changes.copies.push(conflictCopy(mine.record));
                conflicts++;
            } else if (row.kind !== 'item' || laterEdit(mine.record.body, theirs.body) === 'b') {
                changes.upserts.push(theirs);
            }
            // Otherwise the local edit is newer: it stays, and goes up as the next revision.
        }
        next[row.id] = entry(row.rev, theirHash, row.kind);
    }
    return { changes, synced: next, conflicts, applied };
}

/* ── Push ──────────────────────────────────────────────────────────────── */

type Push = { id: string; kind: RecordKind; rev: number; plaintext?: string; hash: string };

/** Records changed or deleted here since they were last synced, with the revision each goes up as. */
export function pendingPushes(local: Map<string, IndexedLocal>, synced: Record<string, SyncedEntry>): Push[] {
    const out: Push[] = [];
    for (const entry of local.values()) {
        const prev = synced[entry.id];
        if (prev && !prev.deleted && prev.hash === entry.hash) continue;
        out.push({ id: entry.id, kind: entry.record.kind, rev: (prev?.rev ?? 0) + 1, plaintext: entry.plaintext, hash: entry.hash });
    }
    for (const [id, prev] of Object.entries(synced)) {
        if (prev.deleted || local.has(id)) continue;
        out.push({ id, kind: prev.kind ?? 'item', rev: prev.rev + 1, hash: '' });
    }
    return out;
}

async function pushAll(
    store: CloudStore,
    keys: SyncKeys,
    pushes: Push[],
    synced: Record<string, SyncedEntry>,
    save: (synced: Record<string, SyncedEntry>) => Promise<void>,
    onProgress?: (done: number, total: number) => void,
) {
    let current = synced;
    for (let i = 0; i < pushes.length; i += BATCH) {
        const batch = pushes.slice(i, i + BATCH);
        const rows: CloudRecordRow[] = [];
        for (const push of batch) {
            if (push.plaintext === undefined) {
                // A tombstone keeps nothing but its id, kind and revision.
                rows.push({ id: push.id, kind: push.kind, key_id: keys.keyId, key_version: keys.keyVersion, ciphertext: '', iv: '', revision: push.rev, deleted: true });
                continue;
            }
            const meta: RecordMeta = { userId: keys.userId, id: push.id, kind: push.kind, revision: push.rev, keyId: keys.keyId, keyVersion: keys.keyVersion };
            const sealed = await sealRecord(keys.vaultKey, meta, push.plaintext);
            rows.push({ id: push.id, kind: push.kind, key_id: keys.keyId, key_version: keys.keyVersion, ciphertext: sealed.ciphertext, iv: sealed.iv, revision: push.rev, deleted: false });
        }
        await store.upsertRecords(rows);
        current = { ...current };
        for (const push of batch) {
            current[push.id] = entry(push.rev, push.hash, push.kind, push.plaintext === undefined);
        }
        await save(current);
        onProgress?.(Math.min(i + BATCH, pushes.length), pushes.length);
    }
}

/* ── One sync ──────────────────────────────────────────────────────────── */

/** Pull, merge, push; again after a conflict or a local change mid-merge, a few times at most. */
export async function syncOnce(store: CloudStore, host: SyncHost, options: { onProgress?: (done: number, total: number) => void } = {}): Promise<SyncResult> {
    const result: SyncResult = { pulled: 0, pushed: 0, conflicts: 0, refused: 0 };
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
        const keys = host.keys();
        const state = host.state();
        const pulled = await pullChanges(store, keys, state);
        result.refused += pulled.refused;

        const snap = host.snapshot();
        const merged = mergeRemote(await indexLocal(snap.records), pulled.remote, state.synced);
        const pulledState: SyncState = { cursor: pulled.cursor, pullFrom: state.cursor, synced: merged.synced };
        const { upserts, removes, copies } = merged.changes;
        if (upserts.length || removes.length || copies.length) {
            if (!(await host.apply(merged.changes, pulledState, snap.generation))) continue;
        } else {
            await host.saveState(pulledState);
        }
        result.pulled += merged.applied;
        result.conflicts += merged.conflicts;

        const pushes = pendingPushes(await indexLocal(host.snapshot().records), host.state().synced);
        if (!pushes.length) return result;
        try {
            await pushAll(store, keys, pushes, host.state().synced, (synced) => host.saveState({ ...host.state(), synced }), options.onProgress);
            result.pushed += pushes.length;
            return result;
        } catch (error) {
            // Another device got there first: pull its version and merge before trying again.
            if (error instanceof CloudError && error.code === 'conflict') continue;
            throw error;
        }
    }
    throw new CloudError('conflict', 'Your vault kept changing while it synced. FocuzPass will try again shortly.');
}
