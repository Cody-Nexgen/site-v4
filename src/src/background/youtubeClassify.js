import { YOUTUBE_DATA_API_KEY } from '../lib/youtubeApiKey';

const ALWAYS_ALLOW_CATEGORY_IDS = new Set(['27', '28']);

const CATEGORY_TITLES = {
    '1': 'Film & Animation',
    '2': 'Autos & Vehicles',
    '10': 'Music',
    '15': 'Pets & Animals',
    '17': 'Sports',
    '19': 'Travel & Events',
    '20': 'Gaming',
    '22': 'People & Blogs',
    '23': 'Comedy',
    '24': 'Entertainment',
    '25': 'News & Politics',
    '26': 'Howto & Style',
    '27': 'Education',
    '28': 'Science & Technology',
    '29': 'Nonprofits & Activism',
};

function categoryTitle(categoryId) {
    if (!categoryId) return 'Unknown';
    return CATEGORY_TITLES[categoryId] ?? `Category ${categoryId}`;
}

function normalizeChannelHandle(channel) {
    return String(channel || '').trim().toLowerCase().replace(/^@/, '');
}

function classifyByCategoryId(categoryId, blockedCategoryIds, allowedChannels, channel) {
    const channelKey = normalizeChannelHandle(channel);
    for (const handle of allowedChannels || []) {
        const h = normalizeChannelHandle(handle);
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

    if (categoryId && (blockedCategoryIds || []).includes(categoryId)) {
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

async function fetchVideoCategoryId(videoId, apiKey) {
    const url = new URL('https://www.googleapis.com/youtube/v3/videos');
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('id', videoId);
    url.searchParams.set('key', apiKey);

    const res = await fetch(url.toString());
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return {
            categoryId: null,
            error: err?.error?.message ?? `HTTP ${res.status}`,
        };
    }

    const data = await res.json();
    const item = data?.items?.[0];
    return {
        categoryId: item?.snippet?.categoryId ?? null,
        title: item?.snippet?.title,
    };
}

export async function classifyYouTubeViaApi({
    videoId,
    channel = '',
    blockedCategoryIds = [],
    allowedChannels = [],
}) {
    const apiKey = YOUTUBE_DATA_API_KEY?.trim();
    if (!apiKey || !videoId) {
        return { ok: false, useFallback: true, error: 'NO_API_KEY_OR_VIDEO' };
    }

    const { categoryId, error } = await fetchVideoCategoryId(videoId, apiKey);
    if (error) {
        return { ok: false, useFallback: true, error };
    }

    const result = classifyByCategoryId(categoryId, blockedCategoryIds, allowedChannels, channel);
    return { ok: true, result, categoryId };
}
