export const FUTURE_SELF_STATE_KEY = 'futureSelfStateV1';
export const FUTURE_SELF_HISTORY_LIMIT = 90;

export type FutureSelfDestination = {
    url: string;
    domain: string;
    title: string;
    faviconUrl?: string;
};

export type FutureSelfContract = {
    id: string;
    createdAt: number;
    startedAt: number;
    completedAt?: number;
    status: 'active' | 'completed' | 'cancelled';
    mission: string;
    overarchingGoal: string;
    futureTargetDate: string;
    plannedMinutesPerDay: number;
    destination: FutureSelfDestination;
    pomodoroSegmentId?: string;
};

export type FutureSelfEventType =
    | 'focus_started'
    | 'focus_completed'
    | 'blocked'
    | 'override'
    | 'break_started';

export type FutureSelfEvent = {
    id: string;
    contractId: string;
    type: FutureSelfEventType;
    timestamp: number;
    minutes?: number;
    domain?: string;
    reason?: string;
    segmentId?: string;
};

export type FutureSelfMirror = {
    id: string;
    date: string;
    generatedAt: number;
    plannedMinutes: number;
    completedMinutes: number;
    biggestDistraction: string | null;
    projectedDelayDays: number;
    overrideCount: number;
    blockCount: number;
    promiseCount: number;
    contractGoal: string;
    shownAt?: number;
};

export type FutureSelfState = {
    version: 1;
    activeContract: FutureSelfContract | null;
    contracts: FutureSelfContract[];
    events: FutureSelfEvent[];
    mirrors: FutureSelfMirror[];
};

export type FutureSelfBlockedSummary = {
    contract: FutureSelfContract;
    completedMinutes: number;
    remainingMinutes: number;
    progressPercent: number;
    overrides: number;
    blocks: number;
    breaks: number;
    pastPromises: number;
};
