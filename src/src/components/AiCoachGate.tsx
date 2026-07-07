import AiCoachPage from './AiCoachPage';

export default function AiCoachGate({
    onBack,
    onOpenAccount,
    initialPrompt,
    onPromptConsumed,
}: {
    onBack: () => void;
    onOpenAccount: () => void;
    initialPrompt?: string | null;
    onPromptConsumed?: () => void;
}) {
    return (
        <AiCoachPage
            onBack={onBack}
            onOpenAccount={onOpenAccount}
            initialPrompt={initialPrompt}
            onPromptConsumed={onPromptConsumed}
        />
    );
}
