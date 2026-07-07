import { YOUTUBE_DATA_API_KEY } from './youtubeApiKey';

export const YOUTUBE_API_KEY_STORAGE = 'focuznow_youtube_api_key';

export type YouTubeCategory = {
    id: string;
    title: string;
    icon: string;
    description?: string;
};

/** YouTube Data API v3 category IDs (US region). */
export const YOUTUBE_CATEGORIES: YouTubeCategory[] = [
    { id: '1', title: 'Film & Animation', icon: '🎬' },
    { id: '2', title: 'Autos & Vehicles', icon: '🚗' },
    { id: '10', title: 'Music', icon: '🎵', description: 'Music videos, concerts, lyric videos' },
    { id: '15', title: 'Pets & Animals', icon: '🐾' },
    { id: '17', title: 'Sports', icon: '⚽' },
    { id: '19', title: 'Travel & Events', icon: '✈️' },
    { id: '20', title: 'Gaming', icon: '🎮', description: 'Lets plays, streams, game reviews' },
    { id: '22', title: 'People & Blogs', icon: '👤' },
    { id: '23', title: 'Comedy', icon: '😂' },
    { id: '24', title: 'Entertainment', icon: '🎭', description: 'Reactions, drama, pop culture' },
    { id: '25', title: 'News & Politics', icon: '📰' },
    { id: '26', title: 'Howto & Style', icon: '💅' },
    { id: '27', title: 'Education', icon: '📚', description: 'Tutorials, lectures, courses' },
    { id: '28', title: 'Science & Technology', icon: '🔬' },
    { id: '29', title: 'Nonprofits & Activism', icon: '💚' },
];

export const DEFAULT_BLOCKED_CATEGORY_IDS = ['10', '20', '23', '24'];

export const ALWAYS_ALLOW_CATEGORY_IDS = new Set(['27', '28']);

export async function getYouTubeApiKey(): Promise<string | null> {
    const key = YOUTUBE_DATA_API_KEY?.trim();
    return key || null;
}

export async function setYouTubeApiKey(_key: string): Promise<void> {
    /* key is hardcoded in youtubeApiKey.ts */
}

function extractVideoId(url: string): string | null {
    try {
        const u = new URL(url);
        if (u.hostname.includes('youtu.be')) return u.pathname.slice(1).split('/')[0] || null;
        return u.searchParams.get('v');
    } catch {
        return null;
    }
}

export async function fetchVideoCategoryId(
    videoUrlOrId: string,
    apiKey: string,
): Promise<{ categoryId: string | null; title?: string; error?: string }> {
    const videoId =
        videoUrlOrId.length === 11 && !videoUrlOrId.includes('/')
            ? videoUrlOrId
            : extractVideoId(videoUrlOrId);
    if (!videoId) return { categoryId: null, error: 'INVALID_VIDEO_ID' };

    const url = new URL('https://www.googleapis.com/youtube/v3/videos');
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('id', videoId);
    url.searchParams.set('key', apiKey);

    const res = await fetch(url.toString());
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return {
            categoryId: null,
            error: (err as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`,
        };
    }

    const data = (await res.json()) as {
        items?: { snippet?: { categoryId?: string; title?: string } }[];
    };
    const item = data.items?.[0];
    return {
        categoryId: item?.snippet?.categoryId ?? null,
        title: item?.snippet?.title,
    };
}

export function categoryTitle(categoryId: string | null): string {
    if (!categoryId) return 'Unknown';
    return YOUTUBE_CATEGORIES.find((c) => c.id === categoryId)?.title ?? `Category ${categoryId}`;
}

export function classifyByCategoryId(
    categoryId: string | null,
    blockedCategoryIds: string[],
    allowedChannels: string[],
    channel: string,
): { decision: 'allow' | 'block'; category: string; reason: string } {
    const channelKey = channel.trim().toLowerCase().replace(/^@/, '');
    for (const handle of allowedChannels) {
        const h = handle.trim().toLowerCase().replace(/^@/, '');
        if (h && (channelKey.includes(h) || h.includes(channelKey))) {
            return { decision: 'allow', category: 'allowed_channel', reason: `@${h} is allowed` };
        }
    }

    if (categoryId && ALWAYS_ALLOW_CATEGORY_IDS.has(categoryId)) {
        return {
            decision: 'allow',
            category: categoryTitle(categoryId),
            reason: `${categoryTitle(categoryId)} is always allowed`,
        };
    }

    if (categoryId && blockedCategoryIds.includes(categoryId)) {
        return {
            decision: 'block',
            category: categoryTitle(categoryId),
            reason: `Blocked category: ${categoryTitle(categoryId)}`,
        };
    }

    return {
        decision: 'allow',
        category: categoryTitle(categoryId),
        reason: categoryId ? `${categoryTitle(categoryId)} is not blocked` : 'Category unknown — allowed',
    };
}
