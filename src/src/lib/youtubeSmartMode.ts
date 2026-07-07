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
            title = data?.videoDetails?.title || title;
            channel = data?.videoDetails?.author || channel;
            description = data?.videoDetails?.shortDescription || description;
            videoId = data?.videoDetails?.videoId || videoId;
            break;
        }
    } catch {
        /* fall back to DOM */
    }

    return { title: title.trim(), channel: channel.trim(), description: description.trim(), videoId: videoId.trim() };
}

export function isYouTubeWatchUrl(href: string): boolean {
    try {
        const u = new URL(href);
        return u.hostname.replace(/^www\./, '').includes('youtube.com') && u.pathname === '/watch';
    } catch {
        return false;
    }
}
