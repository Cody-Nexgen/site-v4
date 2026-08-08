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
    if (!contract || state.modeEnabled !== true) return null;
    const today = localDateKey();
    // After the calendar day ends, stop Future Self blocking until they start again.
    const engagedToday =
        localDateKey(contract.startedAt) === today ||
        eventsForDay(state.events, today).some(
            (event) =>
                event.contractId === contract.id &&
                (event.type === 'focus_started' || event.type === 'focus_completed'),
        );
    if (!engagedToday) return null;
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
    if (state.modeEnabled !== true) return state;
    const previous = new Date(now);
    previous.setDate(previous.getDate() - 1);
    const yesterday = localDateKey(previous.getTime());
    let changed = false;
    // Auto-dismiss anything older than yesterday so historical mirrors never re-spam on refresh.
    const mirrors = state.mirrors.map((mirror) => {
        if (mirror.date < yesterday && !mirror.shownAt) {
            changed = true;
            return { ...mirror, shownAt: now };
        }
        return mirror;
    });
    if (mirrors.some((mirror) => mirror.date === yesterday)) {
        return changed ? { ...state, mirrors } : state;
    }
    const generated = createDailyMirror({ ...state, mirrors }, yesterday, now);
    if (!generated) return changed ? { ...state, mirrors } : state;
    return {
        ...state,
        mirrors: [...mirrors, generated].slice(-FUTURE_SELF_HISTORY_LIMIT),
    };
}

export function nextUnshownMirror(state: FutureSelfState): FutureSelfMirror | null {
    if (state.modeEnabled !== true) return null;
    const previous = new Date();
    previous.setDate(previous.getDate() - 1);
    const yesterday = localDateKey(previous.getTime());
    // Only surface yesterday's mirror — never a backlog of old ones.
    return state.mirrors.find((mirror) => mirror.date === yesterday && !mirror.shownAt) ?? null;
}
