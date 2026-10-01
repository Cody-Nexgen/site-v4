import { useEffect, useState } from 'react';
import { Dialog } from '../components/fz/Dialog';
import { Button } from '../components/fz/Button';
import { Input } from '../components/fz/Field';

export const FOCUS_PHRASES = [
    'I choose focus over distraction',
    'My time is my most valuable asset',
    'I am in control of my attention',
    'Focus is the key to productivity',
    'Progress over perfection',
    'Discipline creates absolute freedom',
    'I will not sacrifice the future for the present',
    'Small steps every day lead to massive results',
    'Success demands singular and unwavering focus',
];

export function randomFocusPhrase(): string {
    return FOCUS_PHRASES[Math.floor(Math.random() * FOCUS_PHRASES.length)];
}

type ChallengeModalProps = {
    isOpen: boolean;
    phrase: string;
    onClose: () => void;
    onComplete: () => void;
    onDisableChallenge?: () => void;
    error?: string;
};

export function ChallengeModal({ isOpen, onClose, onComplete, phrase, onDisableChallenge, error }: ChallengeModalProps) {
    const [input, setInput] = useState('');

    useEffect(() => {
        if (isOpen) setInput('');
    }, [isOpen]);

    // §6.6: live character-diff — correct chars text-1, wrong chars danger-underlined,
    // untyped chars dimmed; progress = longest correct prefix.
    let correctPrefix = 0;
    while (correctPrefix < input.length && input[correctPrefix] === phrase[correctPrefix]) correctPrefix += 1;
    const progress = phrase.length ? correctPrefix / phrase.length : 0;

    const close = () => {
        setInput('');
        onClose();
    };

    return (
        <Dialog
            open={isOpen}
            onClose={close}
            size="sm"
            title="Focus challenge"
            description="Type the phrase below exactly to unblock. No timer — you must get it right."
            footer={
                <>
                    <Button variant="secondary" onClick={close}>Cancel</Button>
                    <Button
                        variant="primary"
                        disabled={input !== phrase}
                        onClick={() => {
                            onComplete();
                            setInput('');
                        }}
                    >
                        Confirm unblock
                    </Button>
                </>
            }
        >
            <div className="space-y-4">
                <div className="select-none rounded-lg border border-[var(--fz-border)] bg-[var(--fz-bg-raised)] p-4 text-center">
                    <p className="text-title-3">
                        {phrase.split('').map((char, i) => {
                            const typed = i < input.length;
                            const correct = typed && input[i] === char;
                            const wrong = typed && !correct;
                            return (
                                <span
                                    key={i}
                                    className={
                                        wrong
                                            ? 'text-[var(--fz-danger)] underline decoration-[var(--fz-danger)] underline-offset-4'
                                            : correct
                                              ? 'text-[var(--fz-text-1)]'
                                              : 'text-[var(--fz-text-4)]'
                                    }
                                >
                                    {char === ' ' ? ' ' : char}
                                </span>
                            );
                        })}
                    </p>
                </div>

                {error && (
                    <p role="alert" className="rounded-lg border border-[var(--fz-danger)]/30 bg-[var(--fz-danger-soft)] px-3 py-2 text-[13px] text-[var(--fz-danger)]">
                        {error}
                    </p>
                )}

                <div className="space-y-2">
                    <Input
                        autoFocus
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Type the phrase here…"
                        aria-label="Type the phrase to unblock"
                    />
                    <div className="h-1 overflow-hidden rounded-full bg-[var(--fz-bg-raised)]" aria-hidden>
                        <div
                            className="h-full rounded-full bg-[var(--fz-accent)] transition-[width] duration-150"
                            style={{ width: `${Math.round(progress * 100)}%` }}
                        />
                    </div>
                </div>

                {onDisableChallenge && (
                    <button
                        type="button"
                        onClick={onDisableChallenge}
                        className="w-full py-1 text-meta text-[var(--fz-text-3)] transition-colors hover:text-[var(--fz-text-1)]"
                    >
                        Turn off typing challenge
                    </button>
                )}
            </div>
        </Dialog>
    );
}
