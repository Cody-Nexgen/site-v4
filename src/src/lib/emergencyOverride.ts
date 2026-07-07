export const OVERRIDE_LOG_KEY = 'emergencyOverrideLogV1';

export type EmergencyOverrideSettings = {
    enabled: boolean;
    maxPerDay: number;
    minReasonLength: number;
    accessMinutes: number;
    cooldownMinutes: number;
};

export type EmergencyOverrideEntry = {
    id: string;
    timestamp: number;
    domain: string;
    url: string;
    reason: string;
    granted: boolean;
    denyReason?: string;
    expiresAt?: number;
};

export type TemporaryAllow = {
    id: string;
    domain: string;
    expiresAt: number;
    reason: string;
};

export type OverridePattern = {
    id: string;
    title: string;
    description: string;
    severity: 'high' | 'medium' | 'low';
    count: number;
};

export const DEFAULT_OVERRIDE_SETTINGS: EmergencyOverrideSettings = {
    enabled: true,
    maxPerDay: 3,
    minReasonLength: 20,
    accessMinutes: 15,
    cooldownMinutes: 30,
};

export function todayKey(): string {
    return new Date().toDateString();
}

export async function loadOverrideLog(): Promise<EmergencyOverrideEntry[]> {
    const r = await chrome.storage.local.get(OVERRIDE_LOG_KEY);
    return Array.isArray(r[OVERRIDE_LOG_KEY]) ? r[OVERRIDE_LOG_KEY] : [];
}

export async function saveOverrideLog(entries: EmergencyOverrideEntry[]): Promise<void> {
    const trimmed = entries.slice(-200);
    await chrome.storage.local.set({ [OVERRIDE_LOG_KEY]: trimmed });
}

export function countOverridesToday(entries: EmergencyOverrideEntry[]): number {
    const today = todayKey();
    return entries.filter((e) => e.granted && new Date(e.timestamp).toDateString() === today).length;
}

export function lastGrantedOverride(entries: EmergencyOverrideEntry[]): EmergencyOverrideEntry | null {
    const granted = entries.filter((e) => e.granted).sort((a, b) => b.timestamp - a.timestamp);
    return granted[0] ?? null;
}

export function validateOverrideRequest(
    reason: string,
    settings: EmergencyOverrideSettings,
    log: EmergencyOverrideEntry[],
    nuclearActive: boolean,
): { ok: boolean; error?: string } {
    if (nuclearActive) {
        return { ok: false, error: 'Emergency override is disabled during Nuclear Lockdown.' };
    }
    if (!settings.enabled) {
        return { ok: false, error: 'Emergency override is turned off in Settings.' };
    }
    const trimmed = reason.trim();
    if (trimmed.length < settings.minReasonLength) {
        return {
            ok: false,
            error: `Please explain why (${settings.minReasonLength} characters minimum).`,
        };
    }
    if (countOverridesToday(log) >= settings.maxPerDay) {
        return { ok: false, error: `Daily limit reached (${settings.maxPerDay} overrides per day).` };
    }
    const last = lastGrantedOverride(log);
    if (last) {
        const cooldownMs = settings.cooldownMinutes * 60 * 1000;
        if (Date.now() - last.timestamp < cooldownMs) {
            const minsLeft = Math.ceil((cooldownMs - (Date.now() - last.timestamp)) / 60000);
            return { ok: false, error: `Cooldown active — try again in ${minsLeft} minute(s).` };
        }
    }
    return { ok: true };
}

export function detectOverridePatterns(entries: EmergencyOverrideEntry[]): OverridePattern[] {
    const granted = entries.filter((e) => e.granted);
    if (granted.length < 2) return [];

    const patterns: OverridePattern[] = [];
    const byDomain: Record<string, number> = {};
    const byHour: Record<number, number> = {};
    const reasonSnippets: Record<string, number> = {};

    for (const e of granted) {
        byDomain[e.domain] = (byDomain[e.domain] || 0) + 1;
        const hour = new Date(e.timestamp).getHours();
        byHour[hour] = (byHour[hour] || 0) + 1;
        const words = e.reason.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
        for (const w of words.slice(0, 5)) {
            reasonSnippets[w] = (reasonSnippets[w] || 0) + 1;
        }
    }

    const topDomain = Object.entries(byDomain).sort((a, b) => b[1] - a[1])[0];
    if (topDomain && topDomain[1] >= 2) {
        patterns.push({
            id: 'repeat_domain',
            title: 'Repeat override target',
            description: `You've used emergency access for ${topDomain[0]} ${topDomain[1]} times. Consider adding it to your allowlist or removing it from your blocklist.`,
            severity: topDomain[1] >= 4 ? 'high' : 'medium',
            count: topDomain[1],
        });
    }

    const topHour = Object.entries(byHour).sort((a, b) => b[1] - a[1])[0];
    if (topHour && topHour[1] >= 2) {
        const h = Number(topHour[0]);
        const label = h >= 12 ? `${h === 12 ? 12 : h - 12} PM` : `${h === 0 ? 12 : h} AM`;
        patterns.push({
            id: 'override_time',
            title: 'Override time cluster',
            description: `Most emergency unlocks happen around ${label}. Schedule a focus block or break before this window.`,
            severity: 'low',
            count: topHour[1],
        });
    }

    if (granted.length >= 5) {
        patterns.push({
            id: 'high_override_volume',
            title: 'Frequent emergency unlocks',
            description: `${granted.length} emergency unlocks logged. Your block settings may be too strict — review your blocklist.`,
            severity: granted.length >= 8 ? 'high' : 'medium',
            count: granted.length,
        });
    }

    return patterns;
}

export function normalizeOverrideSettings(raw: Partial<EmergencyOverrideSettings> | undefined): EmergencyOverrideSettings {
    return { ...DEFAULT_OVERRIDE_SETTINGS, ...raw };
}

export function extractDomainFromUrl(url: string): string {
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    } catch {
        return url.replace(/^www\./, '').split('/')[0];
    }
}
