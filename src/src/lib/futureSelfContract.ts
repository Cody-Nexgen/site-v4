import {
    FUTURE_SELF_HISTORY_LIMIT,
    type FutureSelfContract,
    type FutureSelfDestination,
    type FutureSelfEvent,
    type FutureSelfState,
} from './futureSelfTypes';

export function emptyFutureSelfState(): FutureSelfState {
    return { version: 1, activeContract: null, contracts: [], events: [], mirrors: [] };
}

export function localDateKey(timestamp = Date.now()): string {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function normalizeDestination(rawUrl: string, title = ''): FutureSelfDestination {
    const withScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(rawUrl.trim())
        ? rawUrl.trim()
        : `https://${rawUrl.trim()}`;
    const parsed = new URL(withScheme);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Use an http or https work URL.');
    const domain = parsed.hostname.replace(/^www\./, '').toLowerCase();
    if (!domain) throw new Error('Enter a valid work destination.');
    return {
        url: parsed.toString(),
        domain,
        title: title.trim() || domain,
        faviconUrl: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`,
    };
}

export function validateContractInput(input: {
    mission: string;
    overarchingGoal: string;
    futureTargetDate: string;
    plannedMinutesPerDay: number;
    destination: FutureSelfDestination;
}): string | null {
    if (input.mission.trim().length < 3) return 'Describe the mission for this session.';
    if (input.overarchingGoal.trim().length < 3) return 'Describe the future you are building toward.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.futureTargetDate)) return 'Choose a future target date.';
    if (input.futureTargetDate < localDateKey()) return 'Target date cannot be in the past.';
    if (!Number.isFinite(input.plannedMinutesPerDay) || input.plannedMinutesPerDay < 1 || input.plannedMinutesPerDay > 720) {
        return 'Planned focus must be between 1 and 720 minutes per day.';
    }
    if (!input.destination?.domain) return 'Choose an allowed work destination.';
    return null;
}

export function createContract(
    input: Omit<FutureSelfContract, 'id' | 'createdAt' | 'startedAt' | 'status'>,
    now = Date.now(),
): FutureSelfContract {
    return {
        ...input,
        id: globalThis.crypto?.randomUUID?.() ?? `future-self-${now}`,
        createdAt: now,
        startedAt: now,
        status: 'active',
    };
}

export function appendFutureSelfEvent(
    state: FutureSelfState,
    event: Omit<FutureSelfEvent, 'id'>,
): FutureSelfState {
    const duplicate = event.segmentId && state.events.some(
        (entry) => entry.type === event.type && entry.segmentId === event.segmentId,
    );
    if (duplicate) return state;
    const next = {
        ...event,
        id: `${event.type}-${event.contractId}-${event.segmentId || event.timestamp}`,
    };
    return { ...state, events: [...state.events, next].slice(-1000) };
}

export function normalizeFutureSelfState(raw: unknown): FutureSelfState {
    if (!raw || typeof raw !== 'object') return emptyFutureSelfState();
    const value = raw as Partial<FutureSelfState>;
    return {
        version: 1,
        activeContract: value.activeContract?.status === 'active' ? value.activeContract : null,
        contracts: Array.isArray(value.contracts) ? value.contracts.slice(-FUTURE_SELF_HISTORY_LIMIT) : [],
        events: Array.isArray(value.events) ? value.events.slice(-1000) : [],
        mirrors: Array.isArray(value.mirrors) ? value.mirrors.slice(-FUTURE_SELF_HISTORY_LIMIT) : [],
    };
}
