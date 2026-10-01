/**
 * Coach Library — images the user attached/uploaded and documents the coach
 * wrote. Stored locally in IndexedDB (falls back to memory when unavailable,
 * e.g. private windows); every mutation notifies subscribers so the Library
 * view and chat cards stay in sync.
 */
import { useEffect, useState } from 'react';
import { docId, hashString, type CoachDocDraft, type DocType } from './docBlocks';

type ItemBase = {
    id: string;
    title: string;
    createdAt: number;
    updatedAt: number;
    favorite?: boolean;
    chatId?: string | null;
};

export type LibraryImageItem = ItemBase & {
    kind: 'image';
    dataUrl: string;
    width?: number;
    height?: number;
};

export type LibraryDocItem = ItemBase & {
    kind: 'doc';
    docType: DocType;
    markdown: string;
};

export type LibraryItem = LibraryImageItem | LibraryDocItem;

const DB_NAME = 'focuznow-coach-library';
const STORE = 'items';

let dbPromise: Promise<IDBDatabase | null> | null = null;
const memory = new Map<string, LibraryItem>();
let cache: LibraryItem[] | null = null;
const listeners = new Set<(items: LibraryItem[]) => void>();

function openDb(): Promise<IDBDatabase | null> {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve) => {
        try {
            if (typeof indexedDB === 'undefined') return resolve(null);
            const req = indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(null);
            req.onblocked = () => resolve(null);
        } catch {
            resolve(null);
        }
    });
    return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
    return openDb().then(
        (db) =>
            new Promise((resolve) => {
                if (!db) return resolve(null);
                try {
                    const req = run(db.transaction(STORE, mode).objectStore(STORE));
                    req.onsuccess = () => resolve(req.result);
                    req.onerror = () => resolve(null);
                } catch {
                    resolve(null);
                }
            }),
    );
}

const sortItems = (items: LibraryItem[]) => items.sort((a, b) => b.createdAt - a.createdAt);

async function readAll(): Promise<LibraryItem[]> {
    if (cache) return cache;
    const rows = await tx<LibraryItem[]>('readonly', (s) => s.getAll() as IDBRequest<LibraryItem[]>);
    cache = sortItems(rows ?? [...memory.values()]);
    return cache;
}

function emit() {
    const snapshot = cache ? [...cache] : [];
    listeners.forEach((fn) => fn(snapshot));
}

async function put(item: LibraryItem) {
    memory.set(item.id, item);
    await tx('readwrite', (s) => s.put(item));
    const items = await readAll();
    cache = sortItems([item, ...items.filter((i) => i.id !== item.id)]);
    emit();
}

export async function listLibrary(): Promise<LibraryItem[]> {
    return [...(await readAll())];
}

export async function getLibraryItem(id: string): Promise<LibraryItem | undefined> {
    return (await readAll()).find((i) => i.id === id);
}

export async function updateLibraryItem(id: string, patch: Partial<Omit<LibraryItem, 'id' | 'kind'>>) {
    const cur = await getLibraryItem(id);
    if (!cur) return;
    await put({ ...cur, ...patch, updatedAt: Date.now() } as LibraryItem);
}

export async function deleteLibraryItem(id: string) {
    memory.delete(id);
    await tx('readwrite', (s) => s.delete(id));
    cache = (await readAll()).filter((i) => i.id !== id);
    emit();
}

/** Save a coach document. Idempotent: the same doc is only stored once. */
export async function saveDoc(doc: Pick<CoachDocDraft, 'title' | 'docType' | 'markdown'>, chatId?: string | null) {
    const id = docId(doc);
    const existing = await getLibraryItem(id);
    if (existing) return existing as LibraryDocItem;
    const now = Date.now();
    const item: LibraryDocItem = {
        id,
        kind: 'doc',
        title: doc.title,
        docType: doc.docType,
        markdown: doc.markdown,
        createdAt: now,
        updatedAt: now,
        chatId: chatId ?? null,
    };
    await put(item);
    return item;
}

/** Blank or user-authored document (always a new entry). */
export async function createDoc(title: string, docType: DocType, markdown: string) {
    const now = Date.now();
    const item: LibraryDocItem = {
        id: `doc-${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        kind: 'doc',
        title,
        docType,
        markdown,
        createdAt: now,
        updatedAt: now,
    };
    await put(item);
    return item;
}

function imageSize(dataUrl: string): Promise<{ width: number; height: number } | null> {
    return new Promise((resolve) => {
        if (typeof Image === 'undefined') return resolve(null);
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => resolve(null);
        img.src = dataUrl;
    });
}

/** Save an uploaded/attached image. Idempotent on content. */
export async function saveImage(dataUrl: string, name: string, chatId?: string | null) {
    const id = `img-${hashString(dataUrl)}`;
    const existing = await getLibraryItem(id);
    if (existing) return existing as LibraryImageItem;
    const size = await imageSize(dataUrl);
    const now = Date.now();
    const item: LibraryImageItem = {
        id,
        kind: 'image',
        title: name.replace(/\.[a-z0-9]+$/i, '') || 'Image',
        dataUrl,
        width: size?.width,
        height: size?.height,
        createdAt: now,
        updatedAt: now,
        chatId: chatId ?? null,
    };
    await put(item);
    return item;
}

export function subscribeLibrary(fn: (items: LibraryItem[]) => void): () => void {
    listeners.add(fn);
    void readAll().then((items) => fn([...items]));
    return () => {
        listeners.delete(fn);
    };
}

/** Live Library contents (`null` until the first read resolves). */
export function useCoachLibrary(): LibraryItem[] | null {
    const [items, setItems] = useState<LibraryItem[] | null>(null);
    useEffect(() => subscribeLibrary(setItems), []);
    return items;
}

/** Trigger a browser download for a data URL or text blob. */
export function downloadFile(name: string, data: string | Blob) {
    const url = typeof data === 'string' ? data : URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (typeof data !== 'string') window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
