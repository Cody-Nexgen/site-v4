/**
 * Site icons for FocuzPass logins: the extension asks the site itself for its icon (never a
 * third-party icon service), using the icons the page declares and falling back to
 * /favicon.ico. Results are kept in memory and in chrome.storage.session only: a list of
 * hostnames on disk would reveal which sites are in the (otherwise encrypted) vault.
 */

export type SiteIcon = {
    /** data: URL, safe to put in an <img>. */
    src: string;
    /** A full-bleed app icon (apple-touch-icon): fill the tile instead of centring it. */
    bleed: boolean;
};

const SESSION_KEY = 'focuzpass.siteIcons.v1';
const MAX_PARALLEL = 4;
const PAGE_BYTES = 512 * 1024;
const ICON_BYTES = 400 * 1024;
const TIMEOUT_MS = 7000;
const RASTER_PX = 64;

const memory = new Map<string, Promise<SiteIcon | null>>();
let active = 0;
const waiting: (() => void)[] = [];

async function slot<T>(work: () => Promise<T>): Promise<T> {
    if (active >= MAX_PARALLEL) await new Promise<void>((resolve) => waiting.push(resolve));
    active++;
    try {
        return await work();
    } finally {
        active--;
        waiting.shift()?.();
    }
}

export function iconHost(domain: string): string | null {
    try {
        const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(domain) ? domain : `https://${domain}`);
        if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
        const host = url.hostname.toLowerCase();
        // Local and private addresses have no public icon to fetch.
        if (!host.includes('.') || /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host) || host.endsWith('.local')) return null;
        return host;
    } catch {
        return null;
    }
}

async function fetchLimited(url: string, maxBytes: number, accept: string): Promise<{ bytes: Uint8Array; type: string; url: string } | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const response = await fetch(url, { credentials: 'omit', redirect: 'follow', signal: controller.signal, headers: { Accept: accept } });
        if (!response.ok || !response.body) return null;
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let size = 0;
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.length;
            if (size > maxBytes) {
                await reader.cancel();
                break;
            }
            chunks.push(value);
        }
        const bytes = new Uint8Array(Math.min(size, maxBytes));
        let offset = 0;
        for (const chunk of chunks) {
            bytes.set(chunk.subarray(0, bytes.length - offset), offset);
            offset += chunk.length;
            if (offset >= bytes.length) break;
        }
        return { bytes, type: (response.headers.get('content-type') || '').toLowerCase(), url: response.url || url };
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

type Candidate = { href: string; score: number; bleed: boolean };

/** The icons a page declares, best first. */
export function iconCandidates(html: string, baseUrl: string): Candidate[] {
    const out: Candidate[] = [];
    for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
        const attr = (name: string) => tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'))?.slice(2).find((v) => v !== undefined) ?? '';
        const rel = attr('rel').toLowerCase();
        if (!/(^|\s)(icon|apple-touch-icon|apple-touch-icon-precomposed)(\s|$)/.test(rel)) continue;
        const href = attr('href');
        if (!href || href.startsWith('data:')) continue;
        let absolute: string;
        try {
            absolute = new URL(href, baseUrl).href;
        } catch {
            continue;
        }
        const touch = rel.includes('apple-touch-icon');
        const sizes = attr('sizes').toLowerCase();
        const px = Math.max(0, ...[...sizes.matchAll(/(\d+)x\d+/g)].map((m) => Number(m[1])));
        const svg = /\.svg(\?|$)/i.test(href) || /svg/.test(attr('type'));
        const score = touch ? 300 + Math.min(px || 180, 256) : svg ? 250 : px ? Math.min(px, 256) : 100;
        out.push({ href: absolute, score, bleed: touch });
    }
    return out.sort((a, b) => b.score - a.score);
}

function toBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(binary);
}

async function toIcon(file: { bytes: Uint8Array; type: string }, bleed: boolean): Promise<SiteIcon | null> {
    const svg = file.type.includes('svg') || /^\s*(<\?xml[^>]*>\s*)?<svg\b/i.test(new TextDecoder().decode(file.bytes.subarray(0, 200)));
    if (svg) {
        // Shown through <img>, where SVG scripts never run.
        return { src: `data:image/svg+xml;base64,${toBase64(file.bytes)}`, bleed: false };
    }
    if (file.type && !file.type.startsWith('image/') && !file.type.includes('octet-stream')) return null;
    try {
        const bitmap = await createImageBitmap(new Blob([file.bytes as BlobPart]));
        if (bitmap.width < 8 || bitmap.height < 8) return null;
        const canvas = new OffscreenCanvas(RASTER_PX, RASTER_PX);
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(bitmap, 0, 0, RASTER_PX, RASTER_PX);
        bitmap.close();
        const png = new Uint8Array(await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer());
        return { src: `data:image/png;base64,${toBase64(png)}`, bleed };
    } catch {
        return null;
    }
}

async function lookUp(host: string): Promise<SiteIcon | null> {
    const page = await fetchLimited(`https://${host}/`, PAGE_BYTES, 'text/html');
    const candidates = page && page.type.includes('html') ? iconCandidates(new TextDecoder().decode(page.bytes), page.url) : [];
    candidates.push({ href: `https://${host}/favicon.ico`, score: 0, bleed: false });
    const tried = new Set<string>();
    for (const candidate of candidates) {
        if (tried.has(candidate.href) || tried.size >= 4) continue;
        tried.add(candidate.href);
        const file = await fetchLimited(candidate.href, ICON_BYTES, 'image/*');
        if (!file) continue;
        const icon = await toIcon(file, candidate.bleed);
        if (icon) return icon;
    }
    return null;
}

async function readSession(): Promise<Record<string, SiteIcon | null>> {
    try {
        const data = await chrome.storage.session.get(SESSION_KEY);
        return (data[SESSION_KEY] as Record<string, SiteIcon | null>) ?? {};
    } catch {
        return {};
    }
}

let sessionWrite = Promise.resolve();
function remember(host: string, icon: SiteIcon | null) {
    sessionWrite = sessionWrite.then(async () => {
        try {
            const all = await readSession();
            all[host] = icon;
            await chrome.storage.session.set({ [SESSION_KEY]: all });
        } catch {
            /* session storage full or unavailable: memory still has it */
        }
    });
}

/** The site's icon, or null when it has none FocuzPass can use. */
export function getSiteIcon(domain: string): Promise<SiteIcon | null> {
    const host = iconHost(domain);
    if (!host) return Promise.resolve(null);
    let pending = memory.get(host);
    if (!pending) {
        pending = (async () => {
            const stored = await readSession();
            if (host in stored) return stored[host];
            const icon = await slot(() => lookUp(host));
            remember(host, icon);
            return icon;
        })();
        memory.set(host, pending);
    }
    return pending;
}
