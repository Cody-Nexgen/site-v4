import type { Platform, PlatformMessage } from './types';

function storageGet(keys?: string | string[] | Record<string, unknown> | null) {
    return new Promise<Record<string, unknown>>((resolve) => {
        chrome.storage.local.get(keys as never, (result) => resolve(result as Record<string, unknown>));
    });
}

function storageSet(items: Record<string, unknown>) {
    return new Promise<void>((resolve) => {
        chrome.storage.local.set(items, () => resolve());
    });
}

function storageRemove(keys: string | string[]) {
    return new Promise<void>((resolve) => {
        chrome.storage.local.remove(keys, () => resolve());
    });
}

export const chromePlatform: Platform = {
    kind: 'chrome',
    storageLocal: {
        get: storageGet,
        set: storageSet,
        remove: storageRemove,
    },
    sendMessage: <T = unknown>(message: PlatformMessage) =>
        new Promise<T>((resolve) => {
            chrome.runtime.sendMessage(message, (response) => resolve(response as T));
        }),
    onMessage: {
        addListener: (fn) => {
            chrome.runtime.onMessage.addListener(fn as never);
        },
        removeListener: (fn) => {
            chrome.runtime.onMessage.removeListener(fn as never);
        },
    },
    tabsCreate: (opts) => {
        void chrome.tabs.create(opts);
    },
    runtimeGetURL: (path) => chrome.runtime.getURL(path),
};
