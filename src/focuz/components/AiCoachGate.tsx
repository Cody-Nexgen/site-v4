import AiCoachPage from './AiCoachPage';

export default function AiCoachGate({
    onBack,
    onOpenAccount,
    initialPrompt,
    onPromptConsumed,
    embedded = false,
}: {
    onBack: () => void;
    onOpenAccount: () => void;
    initialPrompt?: string | null;
    onPromptConsumed?: () => void;
    embedded?: boolean;
}) {
    return (
        <AiCoachPage
            onBack={onBack}
            onOpenAccount={onOpenAccount}
            initialPrompt={initialPrompt}
            onPromptConsumed={onPromptConsumed}
            embedded={embedded}
        />
    );
}
