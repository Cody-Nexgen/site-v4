/**
 * Display names for vault items whose title is a raw web address (imports often save
 * "account.hoyolab.com" or "login.live.com"): show the site's own name instead, "Hoyolab", "Live".
 * Titles people typed are left alone.
 */

const HOSTNAME = /^(?:https?:\/\/)?((?:[a-z0-9-]+\.)+[a-z]{2,})(?:[:/?#].*)?$/i;
/** Two-part endings, so "bbc.co.uk" reads "Bbc", not "Co". */
const TWO_PART_SUFFIXES = new Set([
    'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'me.uk', 'com.au', 'net.au', 'org.au', 'co.nz', 'co.jp', 'co.in', 'co.kr', 'co.za',
    'com.br', 'com.mx', 'com.sg', 'com.tr', 'com.cn', 'com.hk', 'com.tw', 'com.ar', 'co.id', 'com.my', 'com.ph',
]);

export function siteNameFromHost(host: string): string | null {
    const labels = host.toLowerCase().replace(/^www\./, '').split('.').filter(Boolean);
    if (labels.length < 2) return null;
    const suffixParts = labels.length >= 3 && TWO_PART_SUFFIXES.has(labels.slice(-2).join('.')) ? 2 : 1;
    const base = labels[labels.length - suffixParts - 1];
    if (!base) return null;
    return base.charAt(0).toUpperCase() + base.slice(1);
}

export function readableTitle(title: string): string {
    const trimmed = title.trim();
    if (!trimmed || /\s/.test(trimmed)) return trimmed;
    const match = trimmed.match(HOSTNAME);
    if (!match) return trimmed;
    return siteNameFromHost(match[1]!) ?? trimmed;
}

/** Two letters for a tile with no site icon: "Hoyolab" -> "Ho". */
export function markLetters(name: string): string {
    const letters = name.replace(/[^\p{L}\p{N}]/gu, '');
    if (!letters) return '•';
    return letters.charAt(0).toUpperCase() + (letters.charAt(1) || '').toLowerCase();
}

/** A steady pastel hue per name, so the same site always gets the same tile colour. */
const TILE_HUES = [150, 185, 215, 245, 275, 310, 345, 20, 55, 95];
export function tileHue(name: string): number {
    let hash = 0;
    for (const char of name.toLowerCase()) hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
    return TILE_HUES[hash % TILE_HUES.length]!;
}

/** A person's initials for an identity tile: "Maya Jones" → "MJ", "Cher" → "C", "maya r. de la cruz" → "MC". */
export function nameInitials(fullName: string): string {
    const words = fullName.trim().split(/\s+/).map((word) => word.replace(/[^\p{L}\p{N}]/gu, '')).filter(Boolean);
    if (!words.length) return '';
    const first = words[0]![0]!;
    const last = words.length > 1 ? words[words.length - 1]![0]! : '';
    return (first + last).toUpperCase();
}
