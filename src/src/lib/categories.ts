export const CATEGORY_BLOCKLISTS: Record<string, string[]> = {
    social: [
        'facebook.com', 'twitter.com', 'instagram.com', 'tiktok.com', 'linkedin.com',
        'reddit.com', 'pinterest.com', 'snapchat.com', 'tumblr.com', 'whatsapp.com'
    ],
    news: [
        'cnn.com', 'bbc.com', 'nytimes.com', 'foxnews.com', 'nbcnews.com',
        'washingtonpost.com', 'theguardian.com', 'usatoday.com', 'dailymail.co.uk'
    ],
    shopping: [
        'amazon.com', 'ebay.com', 'walmart.com', 'target.com', 'bestbuy.com',
        'etsy.com', 'aliexpress.com', 'temu.com', 'shein.com'
    ],
    streaming: [
        'netflix.com', 'youtube.com', 'hulu.com', 'disneyplus.com', 'twitch.tv',
        'hbomax.com', 'peacocktv.com', 'primevideo.com', 'spotify.com'
    ],
    adult: [
        'pornhub.com', 'xvideos.com', 'xnxx.com', 'xhamster.com', 'onlyfans.com',
        'chaturbate.com', 'livejasmin.com'
    ],
    gambling: [
        'bet365.com', 'draftkings.com', 'fanduel.com', 'pokerstars.com', '888casino.com',
        'betway.com', 'bovada.lv', 'roobet.com', 'stake.com'
    ],
    gaming: [
        'steamcommunity.com', 'roblox.com', 'epicgames.com', 'discord.com', 'battle.net',
        'origin.com', 'ubisoft.com', 'minecraft.net', 'leagueoflegends.com'
    ],
    dating: [
        'tinder.com', 'bumble.com', 'hinge.co', 'match.com', 'okcupid.com',
        'plentyoffish.com', 'grindr.com', 'badoo.com'
    ]
};

export const CATEGORY_LABELS: Record<string, string> = {
    social: 'Social Media',
    news: 'News & Media',
    shopping: 'Shopping',
    streaming: 'Streaming',
    adult: 'Adult Content',
    gambling: 'Gambling',
    gaming: 'Gaming',
    dating: 'Dating'
};
