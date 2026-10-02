import { supabase } from '../supabase';

/**
 * Address suggestions from Google Places, through the `places-autocomplete` edge function (the key
 * stays on the server). One session token covers a whole typing session plus the details request
 * that ends it, so Google bills it once. Anything going wrong just means no suggestions: saved
 * addresses still show.
 */

export type PlaceSuggestion = { placeId: string; main: string; secondary: string };
export type PlaceAddress = {
    formatted: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    region: string;
    postalCode: string;
    country: string;
    countryCode: string;
};

export const PLACES_MIN_CHARS = 3;

/** Set once the server says it isn't set up (no key yet), so this page stops asking. */
let unavailable = false;
const cache = new Map<string, PlaceSuggestion[]>();

export function newPlacesSession(): string {
    return crypto.randomUUID().replace(/-/g, '');
}

async function call<T>(body: Record<string, unknown>, signal?: AbortSignal): Promise<T | null> {
    if (unavailable) return null;
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return null;
        const { data, error } = await supabase.functions.invoke<T & { code?: string }>('places-autocomplete', { body, signal });
        if (error) {
            // 503 not_configured (or the function not deployed yet): stop trying on this page.
            const status = (error as { context?: { status?: number } }).context?.status;
            if (status === 503 || status === 404) unavailable = true;
            return null;
        }
        return data ?? null;
    } catch {
        return null;
    }
}

export async function placesSuggest(input: string, sessionToken: string, signal?: AbortSignal): Promise<PlaceSuggestion[]> {
    const text = input.trim();
    if (text.length < PLACES_MIN_CHARS) return [];
    const key = `${sessionToken}:${text.toLowerCase()}`;
    const cached = cache.get(key);
    if (cached) return cached;
    const data = await call<{ suggestions?: PlaceSuggestion[] }>({ action: 'autocomplete', input: text, sessionToken }, signal);
    const suggestions = data?.suggestions ?? [];
    if (data) {
        if (cache.size > 200) cache.clear();
        cache.set(key, suggestions);
    }
    return suggestions;
}

export async function placesDetails(placeId: string, sessionToken: string): Promise<PlaceAddress | null> {
    const data = await call<{ address?: PlaceAddress }>({ action: 'details', placeId, sessionToken });
    return data?.address ?? null;
}
