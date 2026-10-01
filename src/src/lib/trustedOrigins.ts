/**
 * Which web pages may talk to the extension (the website bridge, the sign-in handoff, FocuzPass
 * on the web). The FocuzNow site always; the site's local dev servers only when the extension is
 * loaded unpacked, so a Web Store install never trusts whatever happens to run on localhost.
 */

export const SITE_ORIGINS: readonly string[] = ['https://focuznow.com', 'https://www.focuznow.com', 'https://dashboard.focuznow.com'];
export const DEV_SITE_ORIGINS: readonly string[] = ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'];

/** Unpacked (developer) installs have no update_url; the Web Store adds one to every install. */
export function isDevInstall(): boolean {
    try {
        return !('update_url' in chrome.runtime.getManifest());
    } catch {
        return false;
    }
}

export function isTrustedSiteOrigin(origin: string | null | undefined, devInstall = isDevInstall()): boolean {
    if (!origin) return false;
    return SITE_ORIGINS.includes(origin) || (devInstall && DEV_SITE_ORIGINS.includes(origin));
}

export type SenderKind = 'extension-page' | 'trusted-site' | 'other';

type SenderLike = { id?: string; url?: string; origin?: string; frameId?: number; tab?: unknown };

function originOf(sender: SenderLike): string | null {
    if (sender.origin) return sender.origin;
    try {
        return sender.url ? new URL(sender.url).origin : null;
    } catch {
        return null;
    }
}

/**
 * Where a runtime message came from. Our own pages (options, popup, unlock window) are
 * "extension-page". A content script on the FocuzNow site's top frame, which is where the page
 * bridge lives, is "trusted-site". Every other content script is "other": it runs on pages we
 * don't control, so it only gets what that page itself needs.
 */
export function classifySender(
    sender: SenderLike | undefined,
    env: { extensionId: string; extensionOrigin: string; devInstall: boolean },
): SenderKind {
    if (!sender || sender.id !== env.extensionId) return 'other';
    const origin = originOf(sender);
    if (origin === env.extensionOrigin) return 'extension-page';
    if (sender.frameId === 0 && isTrustedSiteOrigin(origin, env.devInstall)) return 'trusted-site';
    return 'other';
}

/** classifySender for this extension, in the service worker. */
export function senderKind(sender: SenderLike | undefined): SenderKind {
    return classifySender(sender, {
        extensionId: chrome.runtime.id,
        extensionOrigin: chrome.runtime.getURL('').replace(/\/$/, ''),
        devInstall: isDevInstall(),
    });
}
