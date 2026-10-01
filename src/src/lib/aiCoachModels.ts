export type AiCoachModelId = 'gemini-2.5-flash' | 'gemini-2.5-pro';

/** User-facing labels — no provider names in coach UI. */
export const COACH_MODEL_LABELS: Record<AiCoachModelId, string> = {
    'gemini-2.5-flash': 'FocuzAI',
    'gemini-2.5-pro': 'FocuzAI Think',
};

export const COACH_MODEL_IDS: Record<string, AiCoachModelId> = {
    FocuzAI: 'gemini-2.5-flash',
    'FocuzAI Think': 'gemini-2.5-pro',
};

export function modelIdForLabel(label: string): AiCoachModelId {
    return COACH_MODEL_IDS[label] ?? 'gemini-2.5-flash';
}

export function labelForModel(id: AiCoachModelId): string {
    return COACH_MODEL_LABELS[id];
}

export const AI_COACH_MODELS: {
    id: AiCoachModelId;
    label: string;
    description: string;
}[] = [
    {
        id: 'gemini-2.5-flash',
        label: 'FocuzAI',
        description: 'Fast everyday coach',
    },
    {
        id: 'gemini-2.5-pro',
        label: 'FocuzAI Think',
        description: 'Deeper reasoning',
    },
];

export const AI_COACH_HELP_WORDS = [
    'focus',
    'productivity',
    'habits',
    'deep work',
    'blocking',
    'your goals',
] as const;
