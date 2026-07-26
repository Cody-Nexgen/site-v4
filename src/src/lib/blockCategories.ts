export const SAFE_BLOCK_CATEGORY_KEYS = [
    'social',
    'gambling',
    'news',
    'shopping',
    'streaming',
    'gaming',
    'dating',
] as const;

export type SafeBlockCategoryKey = (typeof SAFE_BLOCK_CATEGORY_KEYS)[number];

export const SAFE_BLOCK_CATEGORY_LABELS: Record<SafeBlockCategoryKey, string> = {
    social: 'Social media',
    gambling: 'Gambling',
    news: 'News',
    shopping: 'Shopping',
    streaming: 'Streaming',
    gaming: 'Gaming',
    dating: 'Dating',
};

export const SAFE_BLOCK_CATEGORIES: Record<SafeBlockCategoryKey, readonly string[]> = {
    social: [
        'facebook.com', 'twitter.com', 'x.com', 'instagram.com', 'tiktok.com',
        'linkedin.com', 'reddit.com', 'pinterest.com', 'snapchat.com', 'tumblr.com',
        'whatsapp.com', 'threads.net', 'discord.com', 'bluesky.social', 'mastodon.social',
    ],
    gambling: [
        'bet365.com', 'draftkings.com', 'fanduel.com', 'pokerstars.com', '888casino.com',
        'betway.com', 'bovada.lv', 'roobet.com', 'stake.com', 'williamhill.com',
        '888poker.com', 'skybet.com',
    ],
    news: [
        'cnn.com', 'bbc.com', 'nytimes.com', 'foxnews.com', 'nbcnews.com',
        'washingtonpost.com', 'theguardian.com', 'usatoday.com', 'dailymail.co.uk',
        'reuters.com', 'apnews.com', 'bloomberg.com', 'aljazeera.com',
    ],
    shopping: [
        'amazon.com', 'ebay.com', 'walmart.com', 'target.com', 'bestbuy.com',
        'etsy.com', 'aliexpress.com', 'temu.com', 'shein.com', 'craigslist.org',
        'shopify.com', 'homedepot.com', 'lowes.com',
    ],
    streaming: [
        'netflix.com', 'youtube.com', 'hulu.com', 'disneyplus.com', 'twitch.tv',
        'hbomax.com', 'peacocktv.com', 'primevideo.com', 'spotify.com',
        'apple.com/apple-tv-plus', 'paramountplus.com', 'vimeo.com', 'dailymotion.com',
    ],
    gaming: [
        'steamcommunity.com', 'roblox.com', 'epicgames.com', 'discord.com', 'battle.net',
        'ubisoft.com', 'minecraft.net', 'leagueoflegends.com', 'ign.com', 'gamespot.com',
        'twitch.tv', 'nintendo.com',
    ],
    dating: [
        'tinder.com', 'bumble.com', 'hinge.co', 'match.com', 'okcupid.com',
        'plentyoffish.com', 'grindr.com', 'badoo.com', 'coffeeandbagel.com',
    ],
};

export function isSafeBlockCategoryKey(value: unknown): value is SafeBlockCategoryKey {
    return typeof value === 'string'
        && (SAFE_BLOCK_CATEGORY_KEYS as readonly string[]).includes(value);
}
