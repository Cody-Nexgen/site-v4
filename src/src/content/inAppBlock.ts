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

const BLOCK_ICONS = {
    shield: `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`,
};

/** Calm full-bleed cover shown when in-app blocking stops a page. Uses
 * hardcoded --fz-* token values (content scripts can't see the dashboard
 * stylesheet). "Emergency unlock" still routes to the existing blocked view
 * which hosts the unlock flow. */
export function renderBlockedCover(targetUrl: string, reason: string) {
    document.getElementById('focuznow-inapp-block')?.remove();

    const host = document.createElement('div');
    host.id = 'focuznow-inapp-block';
    const shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
        :host { all: initial; }
        .cover {
            position: fixed; inset: 0; z-index: 2147483647;
            background: oklch(0.145 0.006 275 / 0.96);
            display: flex; align-items: center; justify-content: center;
            font-family: "Inter Variable", Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            animation: fz-cover-in 180ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .card {
            max-width: 400px; width: calc(100% - 48px);
            background: oklch(0.205 0.006 275);
            border: 1px solid oklch(0.955 0.003 275 / 0.07);
            border-radius: 12px;
            box-shadow: 0 0 0 1px oklch(0 0 0 / 0.2), 0 8px 24px -4px rgb(0 0 0 / 0.5);
            padding: 28px 24px 20px;
            text-align: center;
        }
        .icon {
            width: 44px; height: 44px; margin: 0 auto 14px;
            border-radius: 12px;
            background: oklch(0.225 0.006 275);
            border: 1px solid oklch(0.955 0.003 275 / 0.07);
            display: flex; align-items: center; justify-content: center;
            color: oklch(0.765 0.005 275);
        }
        h1 {
            margin: 0; font-size: 17px; font-weight: 560; letter-spacing: -0.01em;
            color: oklch(0.955 0.003 275);
        }
        .reason {
            margin: 8px 0 0; font-size: 12.5px; font-weight: 450; line-height: 1.55;
            color: oklch(0.765 0.005 275);
        }
        .actions { margin-top: 20px; display: flex; gap: 8px; justify-content: center; }
        .btn {
            border-radius: 8px; padding: 8px 14px; font-size: 12.5px; font-weight: 560;
            cursor: pointer; font-family: inherit; transition: opacity 120ms ease, background 120ms ease;
        }
        .btn-primary {
            border: none; background: oklch(0.68 0.15 255); color: oklch(0.17 0.02 255);
        }
        .btn-primary:hover { opacity: 0.9; }
        .btn-ghost {
            border: 1px solid oklch(0.955 0.003 275 / 0.12); background: transparent;
            color: oklch(0.765 0.005 275);
        }
        .btn-ghost:hover { background: oklch(0.955 0.003 275 / 0.05); color: oklch(0.86 0.004 275); }
        @keyframes fz-cover-in { from { opacity: 0; } to { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) { .cover { animation: none; } }
    `;

    const cover = document.createElement('div');
    cover.className = 'cover';
    cover.innerHTML = `
        <div class="card" role="alertdialog" aria-labelledby="fz-block-title" aria-describedby="fz-block-reason">
            <div class="icon">${BLOCK_ICONS.shield}</div>
            <h1 id="fz-block-title">This is blocked during focus</h1>
            <p class="reason" id="fz-block-reason"></p>
            <div class="actions">
                <button type="button" class="btn btn-primary" data-act="back">Go back</button>
                <button type="button" class="btn btn-ghost" data-act="unlock">Emergency unlock</button>
            </div>
        </div>
    `;
    cover.querySelector<HTMLElement>('.reason')!.textContent = reason;

    cover.querySelector('[data-act="back"]')?.addEventListener('click', () => {
        if (window.history.length > 1) window.history.back();
        else host.remove();
    });
    cover.querySelector('[data-act="unlock"]')?.addEventListener('click', () => {
        window.location.href = blockedPageUrl(targetUrl);
    });

    shadow.appendChild(style);
    shadow.appendChild(cover);
    document.documentElement.appendChild(host);
}

function blockWatch(href: string, category: string) {
    document.querySelectorAll('video').forEach((v) => v.pause());
    const label = category === 'shorts' ? 'Shorts' : category ? `${category} videos` : 'This video';
    renderBlockedCover(
        href,
        `${label} is on your blocklist while you're focusing. Slip-ups are fine — head back when you're ready.`,
    );
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
    const domain = window.location.hostname.replace(/^www\./i, '');
    // Only YouTube has in-app blocks — don't read the whole engine state on every other site.
    if (!domain.includes('youtube.com')) return;
    chrome.storage.local.get(['blockEngineState'], (result: Record<string, unknown>) => {
        const state = (result.blockEngineState as Record<string, unknown>) || {};
        const blocks = (state.inAppBlock as Record<string, unknown>) || {};

        const href = window.location.href;

        if (shortsBlockingEnabled(blocks) && /\/shorts(\/|$|\?)/i.test(href)) {
            renderBlockedCover(
                href,
                'Shorts are on your blocklist while you\'re focusing. Slip-ups are fine — head back when you\'re ready.',
            );
            return;
        }

        if (shortsBlockingEnabled(blocks)) {
            applyShortsBlocks();
        }

        applySmartYouTubeWatch(blocks);
    });
}

const injectedCSS = new Set<string>();

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
