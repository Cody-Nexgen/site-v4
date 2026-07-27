/** Shared helpers for generating initials-based avatars (sidebar, Focus Room, etc). */

/**
 * Derives up to two initials from a display name.
 * "Avan Kottapalli" -> "AK", "avan" -> "AV", "" -> "?"
 */
export function getInitials(name?: string | null): string {
    const trimmed = (name ?? '').trim();
    if (!trimmed) return '?';

    const words = trimmed.split(/\s+/).filter(Boolean);
    if (words.length === 1) {
        const word = words[0].replace(/[^\p{L}\p{N}]/gu, '') || words[0];
        return word.slice(0, 2).toUpperCase() || '?';
    }

    const first = words[0].charAt(0);
    const last = words[words.length - 1].charAt(0);
    return `${first}${last}`.toUpperCase();
}

const AVATAR_SATURATION = 62;
const AVATAR_LIGHTNESS = 45;

/** Deterministic hash of a string into a 0-359 hue. */
function hueFromString(input: string): number {
    let hash = 0;
    for (let i = 0; i < input.length; i += 1) {
        hash = (hash << 5) - hash + input.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash) % 360;
}

/** Stable HSL background color derived from a name/id, for initials avatars. */
export function colorFromString(input?: string | null): string {
    const source = (input ?? '').trim() || 'focuznow';
    const hue = hueFromString(source);
    return `hsl(${hue}, ${AVATAR_SATURATION}%, ${AVATAR_LIGHTNESS}%)`;
}

/**
 * A small palette of related hues derived from the same seed used by `colorFromString`, for
 * feeding a MeshGradient (or any multi-stop gradient) so a user's avatar background stays
 * visually consistent with their initials color across the app.
 */
export function avatarGradientColors(input?: string | null): string[] {
    const source = (input ?? '').trim() || 'focuznow';
    const hue = hueFromString(source);
    const hueA = (hue + 34) % 360;
    const hueB = (hue + 326) % 360; // -34
    return [
        `hsl(${hue}, 70%, 28%)`,
        `hsl(${hueA}, 62%, 46%)`,
        `hsl(${hueB}, 58%, 36%)`,
        `hsl(${hue}, 50%, 16%)`,
    ];
}
