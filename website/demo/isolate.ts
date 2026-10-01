/**
 * The demo frames share focuznow.com's origin, so give them in-memory storage: nothing the
 * demo dashboard saves (setup flags, theme, sidebar state) can leak into a visitor's real /app.
 * Imported first, before any FocuzNow module reads storage.
 */
class MemoryStorage implements Storage {
    private data = new Map<string, string>();
    get length() {
        return this.data.size;
    }
    clear() {
        this.data.clear();
    }
    getItem(key: string) {
        return this.data.has(key) ? (this.data.get(key) as string) : null;
    }
    key(index: number) {
        return Array.from(this.data.keys())[index] ?? null;
    }
    removeItem(key: string) {
        this.data.delete(key);
    }
    setItem(key: string, value: string) {
        this.data.set(key, String(value));
    }
}

for (const name of ['localStorage', 'sessionStorage'] as const) {
    try {
        Object.defineProperty(window, name, { configurable: true, value: new MemoryStorage() });
    } catch {
        /* keep the real one; the demo only reads and writes harmless keys */
    }
}

export {};
