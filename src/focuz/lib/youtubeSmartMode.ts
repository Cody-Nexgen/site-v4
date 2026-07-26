import { DEFAULT_BLOCKED_CATEGORY_IDS } from './youtubeDataApi';

export type SmartYouTubeSettings = {
    enabled: boolean;
    blockShorts: boolean;
    /** @deprecated use blockedCategoryIds */
    blockGaming?: boolean;
    /** @deprecated use blockedCategoryIds */
    blockMusic?: boolean;
    blockedCategoryIds: string[];
    useDataApi: boolean;
};

export type YouTubeVideoMeta = {
    title: string;
    channel: string;
    description: string;
    videoId?: string;
    /** Category title read from the watch page itself (microformat / meta genre). */
    pageCategory?: string;
};

export type YouTubeClassification = {
    decision: 'allow' | 'block';
    category: string;
    reason: string;
};

export const DEFAULT_SMART_YOUTUBE: SmartYouTubeSettings = {
    enabled: false,
    blockShorts: true,
    blockedCategoryIds: [...DEFAULT_BLOCKED_CATEGORY_IDS],
    useDataApi: true,
};

const EDUCATIONAL_KEYWORDS = [
    'tutorial', 'course', 'lecture', 'lesson', 'programming', 'coding', 'developer',
    'math', 'algebra', 'calculus', 'physics', 'chemistry', 'biology', 'science',
    'school', 'homework', 'study', 'exam', 'sat', 'act', 'ap ', 'university', 'college',
    'education', 'learn', 'explained', 'how to', 'walkthrough', 'documentation',
    'python', 'javascript', 'typescript', 'java', 'c++', 'algorithm', 'data structure',
    'machine learning', 'statistics', 'engineering', 'research', 'academic',
];

const ENTERTAINMENT_KEYWORDS = [
    'reaction', 'reacts to', 'drama', 'exposed', 'tea', 'gossip', 'celebrity',
    'vlog', 'prank', 'challenge', 'funny', 'meme', 'compilation', 'highlights',
    'storytime', 'unboxing', 'haul', 'mukbang', 'asmr', 'tiktok', 'shorts',
];

const GAMING_KEYWORDS = [
    'gameplay', 'lets play', "let's play", 'gaming', 'minecraft', 'fortnite', 'valorant',
    'roblox', 'gta', 'call of duty', 'stream highlight', 'speedrun',
];

const MUSIC_KEYWORDS = [
    'official video', 'official audio', 'music video', 'lyrics', 'feat.', 'ft.',
    'album', 'remix', 'cover song', 'live performance',
];

function normalizeText(...parts: string[]): string {
    return parts.join(' ').toLowerCase();
}

function containsAny(text: string, keywords: string[]): string | null {
    for (const kw of keywords) {
        if (text.includes(kw)) return kw;
    }
    return null;
}

function normalizeChannelHandle(channel: string): string {
    return channel.trim().toLowerCase().replace(/^@/, '');
}

export function normalizeSmartYouTube(raw: Partial<SmartYouTubeSettings> | undefined): SmartYouTubeSettings {
    const merged = { ...DEFAULT_SMART_YOUTUBE, ...raw };
    if (!merged.blockedCategoryIds?.length) {
        merged.blockedCategoryIds = [...DEFAULT_BLOCKED_CATEGORY_IDS];
        if (raw?.blockGaming) merged.blockedCategoryIds.push('20');
        if (raw?.blockMusic) merged.blockedCategoryIds.push('10');
        merged.blockedCategoryIds = [...new Set(merged.blockedCategoryIds)];
    }
    return merged;
}

const CATEGORY_TITLE_TO_ID: Record<string, string> = {
    'film & animation': '1',
    'autos & vehicles': '2',
    'music': '10',
    'pets & animals': '15',
    'sports': '17',
    'travel & events': '19',
    'gaming': '20',
    'people & blogs': '22',
    'comedy': '23',
    'entertainment': '24',
    'news & politics': '25',
    'howto & style': '26',
    'education': '27',
    'science & technology': '28',
    'nonprofits & activism': '29',
};

const ALWAYS_ALLOW_IDS = new Set(['27', '28']);

/**
 * Classify using the category YouTube embeds in the watch page itself.
 * Authoritative when available — works even if the Data API call fails.
 * Returns null when the page category is unknown/unavailable.
 */
export function classifyByPageCategory(
    meta: YouTubeVideoMeta,
    settings: SmartYouTubeSettings,
    allowedChannels: string[] = [],
): YouTubeClassification | null {
    const raw = meta.pageCategory?.trim().toLowerCase();
    if (!raw) return null;
    const id = CATEGORY_TITLE_TO_ID[raw];
    if (!id) return null;

    const channelKey = normalizeChannelHandle(meta.channel);
    for (const handle of allowedChannels) {
        const h = normalizeChannelHandle(handle);
        if (h && (channelKey.includes(h) || h.includes(channelKey))) {
            return { decision: 'allow', category: 'allowed_channel', reason: `@${h} is on your allow list` };
        }
    }

    if (ALWAYS_ALLOW_IDS.has(id)) {
        return { decision: 'allow', category: meta.pageCategory!, reason: `${meta.pageCategory} is always allowed` };
    }

    if (settings.blockedCategoryIds.includes(id)) {
        return { decision: 'block', category: meta.pageCategory!, reason: `Blocked category: ${meta.pageCategory}` };
    }

    return { decision: 'allow', category: meta.pageCategory!, reason: `${meta.pageCategory} is not blocked` };
}

/** Keyword fallback when Data API unavailable. */
export function classifyYouTubeVideo(
    meta: YouTubeVideoMeta,
    settings: SmartYouTubeSettings,
    allowedChannels: string[] = [],
): YouTubeClassification {
    const text = normalizeText(meta.title, meta.channel, meta.description);
    const channelKey = normalizeChannelHandle(meta.channel);

    for (const handle of allowedChannels) {
        const h = normalizeChannelHandle(handle);
        if (h && (channelKey.includes(h) || h.includes(channelKey))) {
            return { decision: 'allow', category: 'allowed_channel', reason: `@${h} is on your allow list` };
        }
    }

    const educational = containsAny(text, EDUCATIONAL_KEYWORDS);
    if (educational) {
        return { decision: 'allow', category: 'educational', reason: `Educational signal: "${educational}"` };
    }

    const blocked = new Set(settings.blockedCategoryIds);
    if (blocked.has('20')) {
        const gaming = containsAny(text, GAMING_KEYWORDS);
        if (gaming) return { decision: 'block', category: 'gaming', reason: `Gaming content: "${gaming}"` };
    }
    if (blocked.has('10')) {
        const music = containsAny(text, MUSIC_KEYWORDS);
        if (music) return { decision: 'block', category: 'music', reason: `Music: "${music}"` };
    }
    if (blocked.has('24') || blocked.has('23')) {
        const entertainment = containsAny(text, ENTERTAINMENT_KEYWORDS);
        if (entertainment) return { decision: 'block', category: 'entertainment', reason: `Entertainment: "${entertainment}"` };
    }

    return { decision: 'allow', category: 'neutral', reason: 'No distraction signals detected' };
}

export function parseYouTubePageMeta(doc: Document = document): YouTubeVideoMeta {
    let title =
        doc.querySelector('meta[name="title"]')?.getAttribute('content') ||
        doc.querySelector('h1 yt-formatted-string')?.textContent ||
        doc.title.replace(' - YouTube', '') ||
        '';
    let channel =
        doc.querySelector('#channel-name a')?.textContent?.trim() ||
        doc.querySelector('ytd-channel-name a')?.textContent?.trim() ||
        doc.querySelector('yt-formatted-string.ytd-channel-name')?.textContent?.trim() ||
        '';
    let description = '';
    let videoId = '';
    let pageCategory = '';

    try {
        const u = new URL(doc.location?.href ?? window.location.href);
        videoId = u.searchParams.get('v') ?? '';
    } catch {
        /* ignore */
    }

    try {
        for (const script of doc.querySelectorAll('script')) {
            const text = script.textContent || '';
            if (!text.includes('ytInitialPlayerResponse')) continue;
            const marker = 'var ytInitialPlayerResponse = ';
            const start = text.indexOf(marker);
            if (start < 0) continue;
            const jsonStart = start + marker.length;
            let depth = 0;
            let end = jsonStart;
            for (let i = jsonStart; i < text.length; i++) {
                if (text[i] === '{') depth++;
                if (text[i] === '}') depth--;
                if (depth === 0) {
                    end = i + 1;
                    break;
                }
            }
            const data = JSON.parse(text.slice(jsonStart, end));
            const scriptVideoId = data?.videoDetails?.videoId || '';
            // Only trust initial-load data when it describes the video we're on
            // (SPA navigations leave stale ytInitialPlayerResponse in the DOM).
            if (!videoId || scriptVideoId === videoId) {
                title = data?.videoDetails?.title || title;
                channel = data?.videoDetails?.author || channel;
                description = data?.videoDetails?.shortDescription || description;
                videoId = scriptVideoId || videoId;
                pageCategory = data?.microformat?.playerMicroformatRenderer?.category || '';
            }
            break;
        }
    } catch {
        /* fall back to DOM */
    }

    if (!pageCategory) {
        const genre = doc.querySelector('meta[itemprop="genre"]')?.getAttribute('content') || '';
        const metaVideoId =
            doc.querySelector('meta[itemprop="identifier"]')?.getAttribute('content') ||
            doc.querySelector('meta[itemprop="videoId"]')?.getAttribute('content') ||
            '';
        if (genre && (!metaVideoId || !videoId || metaVideoId === videoId)) {
            pageCategory = genre;
        }
    }

    return {
        title: title.trim(),
        channel: channel.trim(),
        description: description.trim(),
        videoId: videoId.trim(),
        pageCategory: pageCategory.trim() || undefined,
    };
}

export function isYouTubeWatchUrl(href: string): boolean {
    try {
        const u = new URL(href);
        return u.hostname.replace(/^www\./, '').includes('youtube.com') && u.pathname === '/watch';
    } catch {
        return false;
    }
}
