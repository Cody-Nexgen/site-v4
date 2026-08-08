import { corsHeaders, getUserFromAuthHeader, jsonResponse } from '../_shared/stripeBilling.ts';

// Simple, safe link-preview fetcher: pulls Open Graph / basic meta tags server-side so
// the client never has to deal with CORS, and so we can time-box + size-cap the fetch.

const FETCH_TIMEOUT_MS = 6000;
const MAX_HTML_BYTES = 512 * 1024;

function isPrivateHost(hostname: string): boolean {
    const host = hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return true;
    const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4) {
        const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
        if (a === 127 || a === 10 || a === 0) return true;
        if (a === 169 && b === 254) return true;
        if (a === 172 && b >= 16 && b <= 31) return true;
        if (a === 192 && b === 168) return true;
    }
    if (host === '::1' || host.startsWith('fc') || host.startsWith('fd')) return true;
    return false;
}

function sanitizeUrl(raw: unknown): URL | null {
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

function decodeEntities(value: string): string {
    return value
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#0?39;/g, "'")
        .trim();
}

function matchMeta(html: string, patterns: RegExp[]): string | null {
    for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match?.[1]) return decodeEntities(match[1]);
    }
    return null;
}

function metaPattern(attr: 'property' | 'name', key: string): RegExp {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(
        `<meta[^>]+${attr}=["']${escaped}["'][^>]+content=["']([^"']*)["']`,
        'i',
    );
}

function metaPatternReversed(attr: 'property' | 'name', key: string): RegExp {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(
        `<meta[^>]+content=["']([^"']*)["'][^>]+${attr}=["']${escaped}["']`,
        'i',
    );
}

function extractMeta(html: string, keys: { attr: 'property' | 'name'; key: string }[]): string | null {
    const patterns = keys.flatMap(({ attr, key }) => [metaPattern(attr, key), metaPatternReversed(attr, key)]);
    return matchMeta(html, patterns);
}

function resolveUrl(base: URL, maybeRelative: string | null): string | null {
    if (!maybeRelative) return null;
    try {
        return new URL(maybeRelative, base).toString();
    } catch {
        return null;
    }
}

async function fetchHtml(url: URL): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
        const res = await fetch(url.toString(), {
            signal: controller.signal,
            redirect: 'follow',
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; FocuzNowLinkPreview/1.0; +https://focuznow.com)',
                Accept: 'text/html,application/xhtml+xml',
            },
        });
        if (!res.ok || !res.body) return '';
        const contentType = res.headers.get('content-type') ?? '';
        if (!contentType.includes('text/html') && !contentType.includes('xml')) return '';

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let html = '';
        let bytes = 0;
        while (bytes < MAX_HTML_BYTES) {
            const { done, value } = await reader.read();
            if (done) break;
            bytes += value.byteLength;
            html += decoder.decode(value, { stream: true });
        }
        void reader.cancel().catch(() => {});
        return html;
    } finally {
        clearTimeout(timeout);
    }
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
        if (!supabaseUrl || !supabaseAnonKey) {
            return jsonResponse({ error: 'Server configuration is incomplete.' }, 500);
        }

        const auth = await getUserFromAuthHeader(req, supabaseAnonKey, supabaseUrl);
        if ('error' in auth) {
            return jsonResponse({ error: 'NOT_AUTHENTICATED' }, 401);
        }

        const body = await req.json().catch(() => ({}));
        const target = sanitizeUrl(body?.url);
        if (!target) {
            return jsonResponse({ error: 'A valid http(s) URL is required.' }, 400);
        }

        let html = '';
        try {
            html = await fetchHtml(target);
        } catch (err) {
            console.error('[link-preview] fetch failed', err);
        }

        const title =
            extractMeta(html, [{ attr: 'property', key: 'og:title' }, { attr: 'name', key: 'twitter:title' }]) ??
            decodeEntities(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? '') ??
            target.hostname;

        const description = extractMeta(html, [
            { attr: 'property', key: 'og:description' },
            { attr: 'name', key: 'description' },
            { attr: 'name', key: 'twitter:description' },
        ]);

        const siteName =
            extractMeta(html, [{ attr: 'property', key: 'og:site_name' }]) ??
            target.hostname.replace(/^www\./, '');

        const imageRaw = extractMeta(html, [
            { attr: 'property', key: 'og:image' },
            { attr: 'name', key: 'twitter:image' },
        ]);
        const image = resolveUrl(target, imageRaw);

        const iconHref =
            html.match(/<link[^>]+rel=["'](?:shortcut icon|icon|apple-touch-icon)["'][^>]+href=["']([^"']+)["']/i)?.[1] ??
            html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut icon|icon|apple-touch-icon)["']/i)?.[1] ??
            null;
        const favicon =
            resolveUrl(target, iconHref) ??
            `${target.protocol}//${target.hostname}/favicon.ico`;

        return jsonResponse({
            url: target.toString(),
            title: title?.trim() || target.hostname,
            description: description?.trim() || null,
            siteName: siteName?.trim() || target.hostname,
            image,
            favicon,
        });
    } catch (err) {
        console.error('[link-preview]', err);
        return jsonResponse({ error: 'Could not preview that link.' }, 500);
    }
});
