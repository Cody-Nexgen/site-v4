// Content Script: YouTube Smart Mode + Shorts blocking

import {
    classifyByPageCategory,
    classifyYouTubeVideo,
    isYouTubeWatchUrl,
    normalizeSmartYouTube,
    parseYouTubePageMeta,
} from '../lib/youtubeSmartMode';

let lastClassifiedVideoId: string | null = null;

function shortsBlockingEnabled(blocks: Record<string, unknown>): boolean {
    const smart = normalizeSmartYouTube(
        (blocks.smartYouTube as Record<string, unknown>) || undefined,
    );
    if (smart.enabled && smart.blockShorts !== false) return true;
    return blocks.youtubeShorts === true;
}

function blockedPageUrl(targetUrl: string, category?: string) {
    const params = new URLSearchParams({
        view: 'blocked',
        url: targetUrl,
        source: 'in_app',
    });
    if (category) params.set('ytCategory', category);
    return chrome.runtime.getURL(`src/options/index.html?${params.toString()}`);
}

function applyShortsBlocks() {
    injectCSS(`
        ytd-reel-shelf-renderer { display: none !important; }
        ytd-shorts { display: none !important; }
        a[href*="/shorts/"] { display: none !important; pointer-events: none !important; }
    `);
}

function blockWatch(href: string, category: string) {
    window.location.replace(blockedPageUrl(href, category));
}

function applySmartYouTubeWatch(blocks: Record<string, unknown>) {
    const href = window.location.href;
    if (!isYouTubeWatchUrl(href)) return;

    const smart = normalizeSmartYouTube(
        (blocks.smartYouTube as Record<string, unknown>) || undefined,
    );
    if (!smart.enabled) {
        console.info('[FocuzNow] Smart YouTube is disabled — enable it in Settings to classify videos.');
        return;
    }

    const meta = parseYouTubePageMeta();
    const filters = Array.isArray(blocks.filters) ? (blocks.filters as string[]) : [];

    if (meta.videoId && meta.videoId === lastClassifiedVideoId) return;

    const runKeywordFallback = () => {
        const result = classifyYouTubeVideo(meta, smart, filters);
        console.info(`[FocuzNow] Smart YouTube (keywords): ${meta.videoId} → ${result.decision} (${result.reason})`);
        if (result.decision === 'block') {
            lastClassifiedVideoId = meta.videoId || null;
            blockWatch(href, result.category);
        } else if (meta.videoId) {
            lastClassifiedVideoId = meta.videoId ?? null;
        }
    };

    const runPageCategoryFallback = () => {
        const pageResult = classifyByPageCategory(meta, smart, filters);
        if (pageResult) {
            console.info(`[FocuzNow] Smart YouTube (page category): ${meta.videoId} → ${pageResult.decision} (${pageResult.reason})`);
            if (pageResult.decision === 'block') {
                lastClassifiedVideoId = meta.videoId || null;
                blockWatch(href, pageResult.category);
            } else if (meta.videoId) {
                lastClassifiedVideoId = meta.videoId;
            }
            return;
        }
        runKeywordFallback();
    };

    // Primary: YouTube Data API classification via the service worker.
    if (meta.videoId) {
        chrome.runtime.sendMessage(
            {
                type: 'CLASSIFY_YOUTUBE_VIDEO',
                videoId: meta.videoId,
                channel: meta.channel,
                blockedCategoryIds: smart.blockedCategoryIds,
                allowedChannels: filters,
            },
            (resp) => {
                if (chrome.runtime.lastError) {
                    console.warn('[FocuzNow] Smart YouTube: classify message failed:', chrome.runtime.lastError.message);
                    runPageCategoryFallback();
                    return;
                }
                const data = resp as {
                    ok?: boolean;
                    useFallback?: boolean;
                    error?: string;
                    categoryId?: string;
                    result?: { decision: string; category: string; reason?: string };
                };
                if (data?.ok && data.result) {
                    console.info(
                        `[FocuzNow] Smart YouTube (API): ${meta.videoId} → ${data.result.decision} (category ${data.categoryId ?? '?'} · ${data.result.reason ?? data.result.category})`,
                    );
                    if (data.result.decision === 'block') {
                        lastClassifiedVideoId = meta.videoId ?? null;
                        blockWatch(href, data.result.category);
                    } else {
                        lastClassifiedVideoId = meta.videoId ?? null;
                    }
                    return;
                }
                console.warn('[FocuzNow] Smart YouTube: Data API failed:', data?.error ?? 'no response');
                runPageCategoryFallback();
            },
        );
        return;
    }

    runPageCategoryFallback();
}

function applyInAppBlocks() {
    chrome.storage.local.get(['blockEngineState'], (result: Record<string, unknown>) => {
        const state = (result.blockEngineState as Record<string, unknown>) || {};
        const domain = window.location.hostname.replace(/^www\./i, '');
        const blocks = (state.inAppBlock as Record<string, unknown>) || {};

        if (!domain.includes('youtube.com')) return;

        const href = window.location.href;

        if (shortsBlockingEnabled(blocks) && /\/shorts(\/|$|\?)/i.test(href)) {
            window.location.replace(blockedPageUrl(href, 'shorts'));
            return;
        }

        if (shortsBlockingEnabled(blocks)) {
            applyShortsBlocks();
        }

        applySmartYouTubeWatch(blocks);
    });
}

let injectedCSS = new Set<string>();

function injectCSS(cssStr: string) {
    if (injectedCSS.has(cssStr)) return;
    injectedCSS.add(cssStr);
    const style = document.createElement('style');
    style.textContent = cssStr;
    document.documentElement.appendChild(style);
}

applyInAppBlocks();

if (window.location.hostname.replace(/^www\./i, '').includes('youtube.com')) {
    const rerun = () => {
        const meta = parseYouTubePageMeta();
        if (meta.videoId && meta.videoId !== lastClassifiedVideoId) {
            setTimeout(() => applyInAppBlocks(), 250);
        } else if (!meta.videoId) {
            lastClassifiedVideoId = null;
            setTimeout(() => applyInAppBlocks(), 250);
        }
    };

    document.addEventListener('yt-navigate-finish', rerun);
    window.addEventListener('popstate', rerun);

    let lastUrl = window.location.href;
    const urlObserver = new MutationObserver(() => {
        if (window.location.href !== lastUrl) {
            lastUrl = window.location.href;
            lastClassifiedVideoId = null;
            rerun();
        }
    });
    urlObserver.observe(document.querySelector('title') || document.documentElement, {
        childList: true,
        subtree: true,
        characterData: true,
    });
}

(window as unknown as { reset?: () => void }).reset = () => {
    chrome.storage.local.get(null, (items: Record<string, unknown>) => {
        const keysToRemove = Object.keys(items).filter((k) => k.startsWith('screenTime_'));
        chrome.storage.local.remove(keysToRemove, () => {
            console.log(`[FocuzNow] Reset complete — removed ${keysToRemove.length} screenTime entries.`);
        });
    });
};
