export type PlatformStorageArea = {
    get: (
        keys?: string | string[] | Record<string, unknown> | null,
    ) => Promise<Record<string, unknown>>;
    set: (items: Record<string, unknown>) => Promise<void>;
    remove: (keys: string | string[]) => Promise<void>;
};

export type PlatformMessage = Record<string, unknown> & { type?: string };

export type Platform = {
    kind: 'chrome' | 'web';
    storageLocal: PlatformStorageArea;
    sendMessage: <T = unknown>(message: PlatformMessage) => Promise<T>;
    onMessage: {
        addListener: (fn: (message: PlatformMessage) => void) => void;
        removeListener: (fn: (message: PlatformMessage) => void) => void;
    };
    tabsCreate: (opts: { url: string }) => void;
    runtimeGetURL: (path: string) => string;
};
