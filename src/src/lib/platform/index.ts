import { chromePlatform } from './chromePlatform';
import { installWebChromeShim, webPlatform } from './webPlatform';
import type { Platform } from './types';

export type { Platform, PlatformMessage } from './types';
export { installWebChromeShim, hydrateWebWorkspaceFromCloud, hydrateWebStatsFromExtension } from './webPlatform';

function detectKind(): 'chrome' | 'web' {
    try {
        if (typeof chrome !== 'undefined' && chrome.runtime?.id) return 'chrome';
    } catch {
        /* ignore */
    }
    return 'web';
}

let cached: Platform | null = null;

export function getPlatform(): Platform {
    if (cached) return cached;
    const kind = detectKind();
    if (kind === 'web') {
        installWebChromeShim();
        cached = webPlatform;
    } else {
        cached = chromePlatform;
    }
    return cached;
}

export function isWebPlatform() {
    return getPlatform().kind === 'web';
}
