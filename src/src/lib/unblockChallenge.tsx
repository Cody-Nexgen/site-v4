import { useState } from 'react';

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
};

export function ChallengeModal({ isOpen, onClose, onComplete, phrase, onDisableChallenge }: ChallengeModalProps) {
    const [input, setInput] = useState('');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="w-full max-w-lg p-8 space-y-6 border border-purple-500/30 rounded-3xl bg-[#111] shadow-2xl">
                <div className="text-center space-y-2">
                    <h3 className="text-2xl font-black text-white tracking-tight">Focus Challenge</h3>
                    <p className="text-neutral-400 text-sm">
                        Type the phrase below exactly to unblock. No timer — you must get it right.
                    </p>
                </div>

                <div className="p-4 bg-white/5 border border-white/10 rounded-2xl text-center select-none">
                    <p className="text-lg font-mono font-bold text-purple-400 tracking-wide">&ldquo;{phrase}&rdquo;</p>
                </div>

                <div className="space-y-4">
                    <input
                        autoFocus
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Type the phrase here..."
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white placeholder:text-neutral-600 outline-none focus:border-purple-500 transition-all font-medium"
                    />
                    <div className="flex space-x-3">
                        <button
                            type="button"
                            onClick={() => {
                                setInput('');
                                onClose();
                            }}
                            className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-neutral-400 font-bold rounded-2xl transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            disabled={input !== phrase}
                            onClick={() => {
                                onComplete();
                                setInput('');
                            }}
                            className={`flex-1 py-4 font-black rounded-2xl transition-all shadow-xl ${
                                input === phrase
                                    ? 'bg-purple-600 text-white shadow-purple-600/20 hover:bg-purple-500'
                                    : 'bg-neutral-800 text-neutral-600 cursor-not-allowed opacity-50'
                            }`}
                        >
                            Confirm Unblock
                        </button>
                    </div>
                    {onDisableChallenge && (
                        <button
                            type="button"
                            onClick={onDisableChallenge}
                            className="w-full py-3 text-xs font-semibold text-neutral-500 hover:text-neutral-300 transition-colors"
                        >
                            Turn off typing challenge
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
