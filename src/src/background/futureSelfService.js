import {
    FUTURE_SELF_STATE_KEY,
} from '../lib/futureSelfTypes';
import {
    appendFutureSelfEvent,
    createContract,
    normalizeDestination,
    normalizeFutureSelfState,
    validateContractInput,
} from '../lib/futureSelfContract';
import {
    ensureMirrorForPreviousDay,
    nextUnshownMirror,
    summarizeActiveContract,
} from '../lib/futureSelfMirror';

let mutationQueue = Promise.resolve();

async function loadState() {
    const stored = await chrome.storage.local.get(FUTURE_SELF_STATE_KEY);
    return normalizeFutureSelfState(stored[FUTURE_SELF_STATE_KEY]);
}

async function saveState(state) {
    await chrome.storage.local.set({ [FUTURE_SELF_STATE_KEY]: state });
    return state;
}

function mutate(operation) {
    const pending = mutationQueue.then(async () => saveState(await operation(await loadState())));
    mutationQueue = pending.catch(() => {});
    return pending;
}

export async function getCurrentWorkDestination() {
    const tabs = await chrome.tabs.query({ lastFocusedWindow: true });
    const tab = tabs
        .filter((candidate) => candidate.url && /^https?:/i.test(candidate.url))
        .sort((a, b) => {
            if (a.active !== b.active) return a.active ? -1 : 1;
            return (b.lastAccessed || 0) - (a.lastAccessed || 0);
        })[0];
    if (!tab?.url || !/^https?:/i.test(tab.url)) return null;
    try {
        return {
            ...normalizeDestination(tab.url, tab.title || ''),
            faviconUrl: tab.favIconUrl || normalizeDestination(tab.url).faviconUrl,
        };
    } catch {
        return null;
    }
}

export async function getFutureSelfState({ dashboardOpen = false } = {}) {
    let state = await loadState();
    if (dashboardOpen) {
        const next = ensureMirrorForPreviousDay(state);
        if (next !== state) state = await saveState(next);
    }
    return {
        state,
        summary: summarizeActiveContract(state),
        pendingMirror: dashboardOpen ? nextUnshownMirror(state) : null,
    };
}

export async function startFutureSelfContract(input) {
    const tier = await chrome.storage.local.get('subscriptionTier');
    if (tier.subscriptionTier !== 'pro') {
        return { ok: false, code: 'PRO_REQUIRED', error: 'Future Self Mode is a Pro feature.' };
    }
    let destination;
    try {
        destination = normalizeDestination(input.destination?.url || '', input.destination?.title || '');
        if (input.destination?.faviconUrl) destination.faviconUrl = input.destination.faviconUrl;
    } catch (error) {
        return { ok: false, error: error.message };
    }
    const candidate = { ...input, destination, plannedMinutesPerDay: Number(input.plannedMinutesPerDay) };
    const error = validateContractInput(candidate);
    if (error) return { ok: false, error };
    const contract = createContract(candidate);
    await mutate((state) => {
        const previous = state.activeContract
            ? { ...state.activeContract, status: 'cancelled', completedAt: Date.now() }
            : null;
        const contracts = previous
            ? [...state.contracts.filter((item) => item.id !== previous.id), previous, contract]
            : [...state.contracts, contract];
        return {
            ...state,
            activeContract: contract,
            contracts: contracts.slice(-90),
            events: appendFutureSelfEvent(state, {
                contractId: contract.id,
                type: 'focus_started',
                timestamp: Date.now(),
                segmentId: input.pomodoroSegmentId,
            }).events,
        };
    });
    return { ok: true, contract };
}

export async function recordFutureSelfEvent(type, details = {}) {
    return mutate((state) => {
        if (!state.activeContract) return state;
        if (type === 'blocked') {
            const recent = state.events.some((event) =>
                event.contractId === state.activeContract.id &&
                event.type === 'blocked' &&
                event.domain === details.domain &&
                Date.now() - event.timestamp < 30_000,
            );
            if (recent) return state;
        }
        return appendFutureSelfEvent(state, {
            contractId: state.activeContract.id,
            type,
            timestamp: details.timestamp || Date.now(),
            minutes: details.minutes,
            domain: details.domain,
            reason: details.reason,
            segmentId: details.segmentId,
        });
    });
}

export async function finishFutureSelfContract(status = 'completed') {
    return mutate((state) => {
        if (!state.activeContract) return state;
        const finished = { ...state.activeContract, status, completedAt: Date.now() };
        return {
            ...state,
            activeContract: null,
            contracts: state.contracts.map((contract) =>
                contract.id === finished.id ? finished : contract,
            ),
        };
    });
}

export async function markFutureSelfMirrorShown(id) {
    await mutate((state) => ({
        ...state,
        mirrors: state.mirrors.map((mirror) =>
            mirror.id === id ? { ...mirror, shownAt: mirror.shownAt || Date.now() } : mirror,
        ),
    }));
    return { ok: true };
}

export async function initFutureSelfService() {
    const state = await loadState();
    const normalized = ensureMirrorForPreviousDay(state);
    if (normalized !== state) await saveState(normalized);
}
