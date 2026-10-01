/**
 * FocuzPass inside the FocuzNow website runs as a frame of an extension page
 * (src/focuzpass-embed/), so the site never handles vault contents: its own code can't reach
 * into a chrome-extension:// frame. The two sides only exchange these harmless messages.
 */

export const EMBED_PAGE = 'src/focuzpass-embed/index.html';

/** Frame → website. */
export type EmbedToHost =
    | { type: 'focuzpass-embed:exit' }
    | { type: 'focuzpass-embed:height'; height: number };

/** Website → frame. */
export type HostToEmbed = { type: 'focuzpass-embed:theme'; mode: 'light' | 'dark' };

export type EmbedView = 'vault' | 'receive';

export type EmbedParams = {
    view: EmbedView;
    theme?: 'light' | 'dark';
    /** Display only, for the vault sidebar. */
    name?: string;
    username?: string;
    avatar?: string;
    /** A transfer code from a focuznow.com/pwcode#CODE link; goes in the fragment. */
    code?: string;
};

export function embedSrc(embedUrl: string, params: EmbedParams): string {
    const url = new URL(embedUrl);
    url.searchParams.set('view', params.view);
    if (params.theme) url.searchParams.set('theme', params.theme);
    if (params.name) url.searchParams.set('name', params.name.slice(0, 120));
    if (params.username) url.searchParams.set('username', params.username.slice(0, 120));
    const avatar = safeImageUrl(params.avatar);
    if (avatar) url.searchParams.set('avatar', avatar);
    if (params.code) url.hash = params.code;
    return url.toString();
}

/** Only https images (or none): the frame never loads anything else it's handed. */
export function safeImageUrl(value: unknown): string | undefined {
    if (typeof value !== 'string' || value.length > 2048) return undefined;
    try {
        const url = new URL(value);
        return url.protocol === 'https:' ? url.toString() : undefined;
    } catch {
        return undefined;
    }
}

export function readEmbedToHost(data: unknown): EmbedToHost | null {
    const d = data as { type?: unknown; height?: unknown } | null;
    if (!d || typeof d !== 'object') return null;
    if (d.type === 'focuzpass-embed:exit') return { type: 'focuzpass-embed:exit' };
    if (d.type === 'focuzpass-embed:height' && typeof d.height === 'number' && Number.isFinite(d.height)) {
        return { type: 'focuzpass-embed:height', height: Math.max(0, Math.min(4000, Math.round(d.height))) };
    }
    return null;
}

export function readHostToEmbed(data: unknown): HostToEmbed | null {
    const d = data as { type?: unknown; mode?: unknown } | null;
    if (d && typeof d === 'object' && d.type === 'focuzpass-embed:theme' && (d.mode === 'light' || d.mode === 'dark')) {
        return { type: 'focuzpass-embed:theme', mode: d.mode };
    }
    return null;
}
