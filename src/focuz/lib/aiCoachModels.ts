export type AiCoachModelId = 'gemini-2.5-flash' | 'gemini-2.5-pro';

export const AI_COACH_MODELS: {
    id: AiCoachModelId;
    label: string;
    description: string;
}[] = [
    {
        id: 'gemini-2.5-flash',
        label: 'Gemini 2.5 Flash',
        description: 'Fast — Vertex AI',
    },
    {
        id: 'gemini-2.5-pro',
        label: 'Gemini 2.5 Pro',
        description: 'Smarter — Vertex AI',
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
