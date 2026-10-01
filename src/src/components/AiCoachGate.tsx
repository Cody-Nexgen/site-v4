import AiCoachPage from './AiCoachPage';
import { isCoachDemo } from '../lib/coach/demoCoach';
import { useAuthStore } from '../lib/store';
import { Card } from './fz/Card';
import { Button } from './fz/Button';
import { IconSparkle } from './fz/icons';

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
    const isPro = useAuthStore((s) => s.subscriptionTier === 'pro');

    if (!isPro && !isCoachDemo()) {
        return (
            <div className="flex h-full items-center justify-center p-8">
                <Card pad="md" className="max-w-md text-center">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--fz-accent-soft)] text-[var(--fz-accent)]">
                        <IconSparkle size={22} />
                    </div>
                    <h2 className="text-title-2 text-[var(--fz-text-1)]">AI Coach is a Pro feature</h2>
                    <p className="mt-2 text-body-sm text-[var(--fz-text-2)]">
                        Get a coach that can block or unblock sites, schedule focus, manage habits and
                        pomodoros, and explain your patterns — right inside FocuzNow.
                    </p>
                    <div className="mt-6 flex items-center justify-center gap-2">
                        <Button variant="primary" onClick={onOpenAccount}>Upgrade to Pro</Button>
                        <Button variant="ghost" onClick={onBack}>Back to overview</Button>
                    </div>
                </Card>
            </div>
        );
    }

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
