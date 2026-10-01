/**
 * An extension page (the website's FocuzPass frame, the unlock window, the dashboard) that was
 * open when FocuzNow was reloaded or updated keeps running the old copy, whose `chrome.runtime`
 * is gone: every call then throws "Extension context invalidated". These helpers spot that and
 * reload the page so it picks up the new copy, instead of showing the raw error.
 */

export const EXTENSION_RELOADED_MESSAGE = 'FocuzNow was updated. Reloading FocuzPass…';

/**
 * True when this page is one of the extension's own pages but the extension has since been
 * reloaded. Only extension pages count: the website installs a `chrome` shim with no runtime id.
 */
export function extensionContextGone(): boolean {
    if (typeof location === 'undefined' || location.protocol !== 'chrome-extension:') return false;
    try {
        return !chrome.runtime?.id;
    } catch {
        return true;
    }
}

export function isContextInvalidatedError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error ?? '');
    return /extension context invalidated/i.test(message);
}

let reloadScheduled = false;

/** Reload this page soon (once), so a message saying why can be seen first. */
export function reloadForExtensionUpdate(delayMs = 1200) {
    if (reloadScheduled || typeof window === 'undefined') return;
    reloadScheduled = true;
    window.setTimeout(() => window.location.reload(), delayMs);
}

/** The error a FocuzPass request throws in an orphaned page; the page reloads itself shortly. */
export function extensionReloadedError(): Error & { extensionReloaded: true } {
    reloadForExtensionUpdate();
    return Object.assign(new Error(EXTENSION_RELOADED_MESSAGE), { extensionReloaded: true as const });
}

/**
 * For extension pages: when the page comes back into view after FocuzNow was reloaded, reload it
 * right away, before anyone types a master password into a page that can't send it anywhere.
 */
export function reloadWhenExtensionReloaded() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const check = () => {
        if (extensionContextGone()) reloadForExtensionUpdate(0);
    };
    window.addEventListener('focus', check);
    window.addEventListener('pointerdown', check, true);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
    });
}
