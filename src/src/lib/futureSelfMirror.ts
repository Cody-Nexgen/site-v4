import { localDateKey } from './futureSelfContract';
import {
    FUTURE_SELF_HISTORY_LIMIT,
    type FutureSelfBlockedSummary,
    type FutureSelfEvent,
    type FutureSelfMirror,
    type FutureSelfState,
} from './futureSelfTypes';

function eventsForDay(events: FutureSelfEvent[], date: string): FutureSelfEvent[] {
    return events.filter((event) => localDateKey(event.timestamp) === date);
}

export function completedMinutesForContract(state: FutureSelfState, contractId: string, date?: string): number {
    return state.events
        .filter((event) =>
            event.contractId === contractId &&
            event.type === 'focus_completed' &&
            (!date || localDateKey(event.timestamp) === date),
        )
        .reduce((total, event) => total + Math.max(0, event.minutes || 0), 0);
}

export function summarizeActiveContract(state: FutureSelfState): FutureSelfBlockedSummary | null {
    const contract = state.activeContract;
    if (!contract) return null;
    const today = localDateKey();
    const events = eventsForDay(state.events, today).filter((event) => event.contractId === contract.id);
    const completedMinutes = completedMinutesForContract(state, contract.id, today);
    const remainingMinutes = Math.max(0, contract.plannedMinutesPerDay - completedMinutes);
    return {
        contract,
        completedMinutes,
        remainingMinutes,
        progressPercent: Math.min(100, Math.round((completedMinutes / contract.plannedMinutesPerDay) * 100)),
        overrides: events.filter((event) => event.type === 'override').length,
        blocks: events.filter((event) => event.type === 'blocked').length,
        breaks: events.filter((event) => event.type === 'break_started').length,
        pastPromises: state.events.filter((event) =>
            event.contractId === contract.id && event.type === 'override',
        ).length,
    };
}

export function createDailyMirror(
    state: FutureSelfState,
    date: string,
    generatedAt = Date.now(),
): FutureSelfMirror | null {
    const dayEvents = eventsForDay(state.events, date);
    const relevantContract = [...state.contracts].reverse().find((contract) =>
        dayEvents.some((event) => event.contractId === contract.id),
    ) ?? state.activeContract;
    if (!relevantContract) return null;
    const completedMinutes = completedMinutesForContract(state, relevantContract.id, date);
    const domains: Record<string, number> = {};
    for (const event of dayEvents) {
        if (event.domain && (event.type === 'blocked' || event.type === 'override')) {
            domains[event.domain] = (domains[event.domain] || 0) + 1;
        }
    }
    const biggestDistraction = Object.entries(domains).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const shortfall = Math.max(0, relevantContract.plannedMinutesPerDay - completedMinutes);
    return {
        id: `future-self-mirror-${date}`,
        date,
        generatedAt,
        plannedMinutes: relevantContract.plannedMinutesPerDay,
        completedMinutes,
        biggestDistraction,
        projectedDelayDays: shortfall === 0 ? 0 : Math.ceil(shortfall / relevantContract.plannedMinutesPerDay),
        overrideCount: dayEvents.filter((event) => event.type === 'override').length,
        blockCount: dayEvents.filter((event) => event.type === 'blocked').length,
        promiseCount: dayEvents.filter((event) => event.type === 'override').length,
        contractGoal: relevantContract.overarchingGoal,
    };
}

export function ensureMirrorForPreviousDay(state: FutureSelfState, now = Date.now()): FutureSelfState {
    const previous = new Date(now);
    previous.setDate(previous.getDate() - 1);
    const latestEligible = localDateKey(previous.getTime());
    const existing = new Set(state.mirrors.map((mirror) => mirror.date));
    const dates = [...new Set(state.events.map((event) => localDateKey(event.timestamp)))]
        .filter((date) => date <= latestEligible && !existing.has(date))
        .sort();
    const generated = dates
        .map((date) => createDailyMirror(state, date, now))
        .filter((mirror): mirror is FutureSelfMirror => mirror !== null);
    if (!generated.length) return state;
    return {
        ...state,
        mirrors: [...state.mirrors, ...generated].slice(-FUTURE_SELF_HISTORY_LIMIT),
    };
}

export function nextUnshownMirror(state: FutureSelfState): FutureSelfMirror | null {
    return state.mirrors.find((mirror) => !mirror.shownAt) ?? null;
}
