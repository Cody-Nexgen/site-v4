// Link preview core — no Deno APIs, so it can be exercised from Node too.
//
// Order of sources, best first:
//   1. The page's own meta tags (Open Graph, Twitter cards, JSON-LD, <title>)
//   2. oEmbed — discovered from the page, or a known provider endpoint. This
//      is what rescues sites that wall off server fetches (NYT returns 403 to
//      any non-browser request but serves oEmbed happily).
//   3. A readable title built from the URL slug.

export type Preview = {
    url: string;
    title: string;
    description: string | null;
    siteName: string;
    image: string | null;
    favicon: string;
};

const FETCH_TIMEOUT_MS = 6000;
const MAX_HTML_BYTES = 768 * 1024;
const MAX_REDIRECTS = 4;

const BROWSER_HEADERS = {
    'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
};

/* ── safety ─────────────────────────────────────────────────────────── */

export function isPrivateHost(hostname: string): boolean {
    const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.localhost')) return true;
    const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4) {
        const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
        if (a === 127 || a === 10 || a === 0) return true;
        if (a === 169 && b === 254) return true;
        if (a === 172 && b >= 16 && b <= 31) return true;
        if (a === 192 && b === 168) return true;
        if (a === 100 && b >= 64 && b <= 127) return true;
    }
    if (host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80')) return true;
    return false;
}

export function sanitizeUrl(raw: unknown): URL | null {
    if (typeof raw !== 'string' || !raw.trim()) return null;
    let candidate = raw.trim();
    if (!/^https?:\/\//i.test(candidate)) candidate = `https://${candidate}`;
    try {
        const url = new URL(candidate);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
        if (isPrivateHost(url.hostname)) return null;
        return url;
    } catch {
        return null;
    }
}

/** fetch() that follows redirects by hand so every hop is checked against private hosts. */
async function safeFetch(start: URL, headers: Record<string, string>): Promise<{ res: Response; url: URL } | null> {
    let url = start;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        let res: Response;
        try {
            res = await fetch(url.toString(), { signal: controller.signal, redirect: 'manual', headers });
        } finally {
            clearTimeout(timeout);
        }
        if (res.status >= 300 && res.status < 400) {
            const next = res.headers.get('location');
            const resolved = next ? sanitizeUrl(new URL(next, url).toString()) : null;
            if (!resolved) return null;
            url = resolved;
            continue;
        }
        return { res, url };
    }
    return null;
}

async function readCapped(res: Response): Promise<string> {
    if (!res.body) return '';
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let text = '';
    let bytes = 0;
    while (bytes < MAX_HTML_BYTES) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        text += decoder.decode(value, { stream: true });
        // The <head> is all we need.
        if (/<\/head>/i.test(text)) break;
    }
    void reader.cancel().catch(() => {});
    return text;
}

/* ── HTML parsing ───────────────────────────────────────────────────── */

export function decodeEntities(value: string): string {
    return value
        .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
        .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Every <meta> tag as a lowercase key → content map (property / name / itemprop). */
export function readMetaTags(html: string): Map<string, string> {
    const out = new Map<string, string>();
    const tagRe = /<meta\b[^>]*>/gi;
    const attrRe = /([a-zA-Z:_-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
    for (const tag of html.match(tagRe) ?? []) {
        const attrs: Record<string, string> = {};
        for (const m of tag.matchAll(attrRe)) attrs[m[1].toLowerCase()] = m[3] ?? m[4] ?? m[5] ?? '';
        const key = (attrs.property || attrs.name || attrs.itemprop || '').toLowerCase();
        if (key && attrs.content && !out.has(key)) out.set(key, decodeEntities(attrs.content));
    }
    return out;
}

function readLinkHref(html: string, test: (attrs: Record<string, string>) => boolean): string | null {
    const attrRe = /([a-zA-Z:_-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
    for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
        const attrs: Record<string, string> = {};
        for (const m of tag.matchAll(attrRe)) attrs[m[1].toLowerCase()] = m[3] ?? m[4] ?? m[5] ?? '';
        if (attrs.href && test(attrs)) return decodeEntities(attrs.href);
    }
    return null;
}

type LdBits = { title?: string; description?: string; image?: string };

/** Headline / description / image from JSON-LD (news sites, blogs, products). */
export function readJsonLd(html: string): LdBits {
    const bits: LdBits = {};
    for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
        try {
            const data = JSON.parse(m[1].trim());
            const nodes: unknown[] = Array.isArray(data) ? data : data?.['@graph'] ? data['@graph'] : [data];
            for (const node of nodes) {
                if (!node || typeof node !== 'object') continue;
                const n = node as Record<string, unknown>;
                const img = n.image;
                const image =
                    typeof img === 'string'
                        ? img
                        : Array.isArray(img)
                          ? typeof img[0] === 'string'
                              ? img[0]
                              : (img[0] as Record<string, unknown>)?.url
                          : (img as Record<string, unknown>)?.url;
                bits.title ??= typeof n.headline === 'string' ? n.headline : typeof n.name === 'string' ? n.name : undefined;
                bits.description ??= typeof n.description === 'string' ? n.description : undefined;
                bits.image ??= typeof image === 'string' ? image : undefined;
            }
        } catch {
            /* malformed JSON-LD is common — skip it */
        }
    }
    return bits;
}

/* ── oEmbed ─────────────────────────────────────────────────────────── */

const OEMBED_PROVIDERS: { test: RegExp; endpoint: (u: string) => string }[] = [
    { test: /(^|\.)youtube\.com$|^youtu\.be$/, endpoint: (u) => `https://www.youtube.com/oembed?format=json&url=${u}` },
    { test: /(^|\.)vimeo\.com$/, endpoint: (u) => `https://vimeo.com/api/oembed.json?url=${u}` },
    { test: /(^|\.)nytimes\.com$/, endpoint: (u) => `https://www.nytimes.com/svc/oembed/json/?url=${u}` },
    { test: /(^|\.)(twitter|x)\.com$/, endpoint: (u) => `https://publish.twitter.com/oembed?omit_script=1&url=${u}` },
    { test: /(^|\.)spotify\.com$/, endpoint: (u) => `https://open.spotify.com/oembed?url=${u}` },
    { test: /(^|\.)soundcloud\.com$/, endpoint: (u) => `https://soundcloud.com/oembed?format=json&url=${u}` },
    { test: /(^|\.)tiktok\.com$/, endpoint: (u) => `https://www.tiktok.com/oembed?url=${u}` },
    { test: /(^|\.)reddit\.com$/, endpoint: (u) => `https://www.reddit.com/oembed?url=${u}` },
    { test: /(^|\.)flickr\.com$|^flic\.kr$/, endpoint: (u) => `https://www.flickr.com/services/oembed/?format=json&url=${u}` },
    { test: /(^|\.)loom\.com$/, endpoint: (u) => `https://www.loom.com/v1/oembed?url=${u}` },
    { test: /(^|\.)figma\.com$/, endpoint: (u) => `https://www.figma.com/api/oembed?url=${u}` },
    { test: /(^|\.)codepen\.io$/, endpoint: (u) => `https://codepen.io/api/oembed?format=json&url=${u}` },
    { test: /(^|\.)ted\.com$/, endpoint: (u) => `https://www.ted.com/services/v1/oembed.json?url=${u}` },
    { test: /(^|\.)giphy\.com$/, endpoint: (u) => `https://giphy.com/services/oembed?url=${u}` },
    { test: /(^|\.)dailymotion\.com$/, endpoint: (u) => `https://www.dailymotion.com/services/oembed?url=${u}` },
];

type OEmbed = {
    title?: string;
    description?: string;
    summary?: string;
    author_name?: string;
    provider_name?: string;
    thumbnail_url?: string;
};

async function fetchOEmbed(endpoint: string): Promise<OEmbed | null> {
    const target = sanitizeUrl(endpoint);
    if (!target) return null;
    try {
        const got = await safeFetch(target, { ...BROWSER_HEADERS, Accept: 'application/json' });
        if (!got || !got.res.ok) return null;
        const text = await got.res.text();
        const data = JSON.parse(text.slice(0, 256 * 1024));
        return data && typeof data === 'object' ? (data as OEmbed) : null;
    } catch {
        return null;
    }
}

/* ── fallbacks ──────────────────────────────────────────────────────── */

/** "…/2018/03/08/arts/chicago-museums-art.html" → "Chicago museums art". */
export function titleFromUrl(url: URL): string {
    const segment = url.pathname
        .split('/')
        .filter(Boolean)
        .reverse()
        .find((s) => /[a-z]/i.test(s) && !/^(index|home|default)(\.\w+)?$/i.test(s));
    if (!segment) return url.hostname.replace(/^www\./, '');
    const words = decodeURIComponent(segment)
        .replace(/\.[a-z0-9]{2,5}$/i, '')
        .replace(/[-_+]+/g, ' ')
        .trim();
    return words ? words.charAt(0).toUpperCase() + words.slice(1) : url.hostname.replace(/^www\./, '');
}

function clean(value: string | null | undefined, max: number): string | null {
    if (!value) return null;
    const v = decodeEntities(value).replace(/\s*\(Published \d{4}\)\s*$/i, '');
    return v ? (v.length > max ? `${v.slice(0, max - 1).trimEnd()}…` : v) : null;
}

function absolute(base: URL, maybe: string | null | undefined): string | null {
    if (!maybe) return null;
    try {
        const u = new URL(maybe, base);
        return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
    } catch {
        return null;
    }
}

/* ── main ───────────────────────────────────────────────────────────── */

export async function buildPreview(target: URL): Promise<Preview> {
    let html = '';
    let finalUrl = target;
    try {
        const got = await safeFetch(target, BROWSER_HEADERS);
        if (got && got.res.ok) {
            const type = got.res.headers.get('content-type') ?? '';
            if (type.includes('html') || type.includes('xml')) {
                html = await readCapped(got.res);
                finalUrl = got.url;
            } else if (type.startsWith('image/')) {
                // A direct image link previews as itself.
                return {
                    url: got.url.toString(),
                    title: titleFromUrl(got.url),
                    description: null,
                    siteName: got.url.hostname.replace(/^www\./, ''),
                    image: got.url.toString(),
                    favicon: `https://www.google.com/s2/favicons?domain=${got.url.hostname}&sz=64`,
                };
            }
        }
    } catch {
        /* blocked, timed out, or not HTML — oEmbed and the URL itself still help */
    }

    const meta = readMetaTags(html);
    const ld = readJsonLd(html);
    const htmlTitle = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];

    let title = clean(meta.get('og:title') ?? meta.get('twitter:title') ?? ld.title ?? htmlTitle, 200);
    let description = clean(
        meta.get('og:description') ?? meta.get('description') ?? meta.get('twitter:description') ?? ld.description,
        300,
    );
    let image = absolute(finalUrl, meta.get('og:image') ?? meta.get('og:image:url') ?? meta.get('twitter:image') ?? meta.get('twitter:image:src') ?? ld.image);
    let siteName = clean(meta.get('og:site_name') ?? meta.get('application-name'), 80);

    // Fill gaps from oEmbed: the page's own link, else a known provider.
    if (!title || !image) {
        const discovered = readLinkHref(html, (a) => /json\+oembed/i.test(a.type ?? ''));
        const encoded = encodeURIComponent(finalUrl.toString());
        const provider = OEMBED_PROVIDERS.find((p) => p.test.test(finalUrl.hostname.replace(/^www\./, '')));
        const endpoint = discovered ? absolute(finalUrl, discovered) : provider?.endpoint(encoded);
        const oe = endpoint ? await fetchOEmbed(endpoint) : null;
        if (oe) {
            title ??= clean(oe.title, 200);
            description ??= clean(oe.summary ?? oe.description ?? (oe.author_name ? `By ${oe.author_name.replace(/^By\s+/i, '')}` : null), 300);
            image ??= absolute(finalUrl, oe.thumbnail_url);
            siteName ??= clean(oe.provider_name, 80);
        }
    }

    const iconHref = readLinkHref(html, (a) => /(^|\s)(icon|shortcut icon|apple-touch-icon)(\s|$)/i.test(a.rel ?? ''));
    const host = finalUrl.hostname.replace(/^www\./, '');

    return {
        url: finalUrl.toString(),
        title: title ?? titleFromUrl(finalUrl),
        description,
        siteName: siteName ?? host,
        image,
        favicon: absolute(finalUrl, iconHref) ?? `https://www.google.com/s2/favicons?domain=${finalUrl.hostname}&sz=64`,
    };
}
