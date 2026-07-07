import {
    validateOverrideRequest,
    loadOverrideLog,
    saveOverrideLog,
    extractDomainFromUrl,
    normalizeOverrideSettings,
    type EmergencyOverrideEntry,
    type EmergencyOverrideSettings,
    type TemporaryAllow,
} from './emergencyOverride';

type EngineLike = {
    nuclearState: { active: boolean };
    emergencyOverrideSettings?: Partial<EmergencyOverrideSettings>;
    temporaryAllows?: TemporaryAllow[];
};

export async function grantEmergencyOverride(
    getEngine: () => EngineLike,
    saveEngine: () => Promise<void>,
    applyRules: () => void,
    input: { url: string; reason: string },
): Promise<{ ok: boolean; error?: string; entry?: EmergencyOverrideEntry; expiresAt?: number }> {
    const state = getEngine();
    const settings = normalizeOverrideSettings(state.emergencyOverrideSettings);
    const log = await loadOverrideLog();

    const validation = validateOverrideRequest(input.reason, settings, log, state.nuclearState.active);
    if (!validation.ok) {
        const entry: EmergencyOverrideEntry = {
            id: `eo_${Date.now()}`,
            timestamp: Date.now(),
            domain: extractDomainFromUrl(input.url),
            url: input.url,
            reason: input.reason.trim(),
            granted: false,
            denyReason: validation.error,
        };
        await saveOverrideLog([...log, entry]);
        return { ok: false, error: validation.error };
    }

    const domain = extractDomainFromUrl(input.url);
    const expiresAt = Date.now() + settings.accessMinutes * 60 * 1000;
    const allowId = `ta_${Date.now()}`;

    const temporaryAllows = [...(state.temporaryAllows || [])].filter((t) => t.expiresAt > Date.now());
    temporaryAllows.push({
        id: allowId,
        domain,
        expiresAt,
        reason: input.reason.trim(),
    });

    state.temporaryAllows = temporaryAllows;
    state.emergencyOverrideSettings = settings;

    const entry: EmergencyOverrideEntry = {
        id: allowId,
        timestamp: Date.now(),
        domain,
        url: input.url,
        reason: input.reason.trim(),
        granted: true,
        expiresAt,
    };
    await saveOverrideLog([...log, entry]);
    applyRules();
    await saveEngine();

    return { ok: true, entry, expiresAt };
}

export function pruneTemporaryAllows(state: EngineLike): boolean {
    const before = state.temporaryAllows?.length ?? 0;
    state.temporaryAllows = (state.temporaryAllows || []).filter((t) => t.expiresAt > Date.now());
    return (state.temporaryAllows?.length ?? 0) !== before;
}

export function isTemporarilyAllowed(state: EngineLike, domain: string): boolean {
    pruneTemporaryAllows(state);
    const d = domain.replace(/^www\./, '').toLowerCase();
    return (state.temporaryAllows || []).some(
        (t) => t.domain.replace(/^www\./, '').toLowerCase() === d && t.expiresAt > Date.now(),
    );
}

export async function getOverrideLogForUi(): Promise<EmergencyOverrideEntry[]> {
    return loadOverrideLog();
}
