import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
    Ban,
    Check,
    ChevronRight,
    ExternalLink,
    Globe,
    Pin,
    Shield,
    User,
} from 'lucide-react';
import { Brand } from '../components/shell/Brand';
import { ShellButton } from '../components/shell/ui';
import { markSetupComplete, openWebDashboard } from '../lib/workspaceSync';

type SetupPageProps = {
    hasSession: boolean;
    hasBlocklist: boolean;
    historyConnected: boolean;
    onComplete: () => void;
    onOpenBlocklist: () => void;
    onImportHistory: () => void;
};

type ChecklistItem = {
    id: string;
    title: string;
    description: string;
    done: boolean;
    icon: typeof User;
    actionLabel?: string;
    onAction?: () => void;
    infographicCaption?: string;
};

function InfographicPlaceholder({ caption }: { caption: string }) {
    return (
        <div className="flex h-full min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-white/15 bg-black/25 p-6 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/10 ring-1 ring-violet-500/25">
                <Shield size={24} className="text-violet-300" strokeWidth={1.75} />
            </div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-600">Infographic placeholder</p>
            <p className="mt-1 max-w-[220px] text-xs text-neutral-500 leading-relaxed">{caption}</p>
        </div>
    );
}

export default function SetupPage({
    hasSession,
    hasBlocklist,
    historyConnected,
    onComplete,
    onOpenBlocklist,
    onImportHistory,
}: SetupPageProps) {
    const [step, setStep] = useState(0);

    const checklist: ChecklistItem[] = useMemo(
        () => [
            {
                id: 'account',
                title: 'Add your account',
                description: hasSession
                    ? 'You are signed in — your focus data will sync across devices.'
                    : 'Sign in on the web to sync streaks, habits, and calendar.',
                done: hasSession,
                icon: User,
                actionLabel: hasSession ? undefined : 'Sign in on web',
                onAction: hasSession ? undefined : () => {
                    chrome.tabs.create({ url: 'https://focuznow.com/login?extension_oauth=1' });
                },
                infographicCaption: 'Autofill practice-style tutorial card',
            },
            {
                id: 'pin',
                title: 'Pin FocuzNow to your toolbar',
                description:
                    'Click the puzzle icon in Chrome, find FocuzNow, then click the pin so quick focus is always one click away.',
                done: false,
                icon: Pin,
                infographicCaption: 'Pin-to-toolbar illustration',
            },
            {
                id: 'blocking',
                title: 'Connect blocking & import history',
                description:
                    'Add sites to your blocklist and optionally import browsing history for richer stats — all stored locally.',
                done: hasBlocklist || historyConnected,
                icon: Ban,
                actionLabel: hasBlocklist ? 'Import history' : 'Open blocklist',
                onAction: hasBlocklist ? onImportHistory : onOpenBlocklist,
                infographicCaption: 'Connect blocking / import history',
            },
        ],
        [hasSession, hasBlocklist, historyConnected, onImportHistory, onOpenBlocklist],
    );

    const completedCount = checklist.filter((item) => item.done).length;
    const allDone = completedCount === checklist.length;

    const finish = () => {
        markSetupComplete();
        onComplete();
    };

    return (
        <div className="focuz-setup fixed inset-0 z-[210] flex min-h-screen items-center justify-center bg-[#080809] p-4 sm:p-8">
            <div
                className="pointer-events-none absolute inset-0 opacity-60"
                style={{
                    background:
                        'radial-gradient(ellipse 80% 50% at 20% 20%, rgba(124,58,237,0.18), transparent 55%), radial-gradient(ellipse 60% 40% at 80% 80%, rgba(99,102,241,0.12), transparent 50%)',
                }}
            />

            <div className="relative z-10 w-full max-w-4xl">
                <AnimatePresence mode="wait">
                    {step === 0 ? (
                        <motion.div
                            key="welcome"
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.28, ease: 'easeOut' }}
                            className="setup-split-card overflow-hidden rounded-2xl border border-white/[0.08] shadow-[0_32px_80px_-24px_rgba(0,0,0,0.85)]"
                        >
                            <div className="grid min-h-[420px] grid-cols-1 md:grid-cols-2">
                                <div className="relative flex flex-col justify-between bg-gradient-to-br from-violet-600 via-indigo-600 to-violet-800 p-8 sm:p-10">
                                    <div>
                                        <Brand size="sm" className="mb-8 [&_span]:text-white/95" />
                                        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                                            Welcome to FocuzNow
                                        </h1>
                                        <p className="mt-3 max-w-sm text-sm leading-relaxed text-violet-100/85">
                                            Your extension helper for blocking distractions, running Pomodoros, and staying
                                            in flow — with your full dashboard on the web.
                                        </p>
                                    </div>
                                    <div className="mt-8 space-y-3">
                                        <ShellButton
                                            className="border-0 bg-white text-violet-950 hover:bg-violet-50"
                                            onClick={() => setStep(1)}
                                            icon={<ChevronRight size={16} className="opacity-80" />}
                                        >
                                            Continue setup
                                        </ShellButton>
                                        <button
                                            type="button"
                                            onClick={finish}
                                            className="w-full text-center text-xs font-medium text-violet-200/70 transition-colors hover:text-white"
                                        >
                                            Skip for now
                                        </button>
                                    </div>
                                </div>

                                <div className="flex flex-col bg-[#0c0c0e]/90 p-6 sm:p-8 backdrop-blur-xl">
                                    <InfographicPlaceholder caption="Welcome orbit" />
                                </div>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="checklist"
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.28, ease: 'easeOut' }}
                            className="setup-glass-card rounded-2xl border border-white/[0.08] p-6 sm:p-8"
                        >
                            <div className="mb-6 flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-xs font-medium uppercase tracking-wider text-violet-400/90">
                                        Quick setup
                                    </p>
                                    <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white">
                                        Get the most from the extension
                                    </h2>
                                    <p className="mt-2 text-sm text-neutral-500">
                                        {completedCount} of {checklist.length} complete
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={finish}
                                    className="shrink-0 text-xs font-medium text-neutral-500 transition-colors hover:text-neutral-300"
                                >
                                    Skip
                                </button>
                            </div>

                            <div className="mb-2 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                                <motion.div
                                    className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500"
                                    animate={{ width: `${(completedCount / checklist.length) * 100}%` }}
                                    transition={{ duration: 0.35, ease: 'easeOut' }}
                                />
                            </div>

                            <div className="mt-6 space-y-3">
                                {checklist.map((item) => {
                                    const Icon = item.icon;
                                    return (
                                        <div
                                            key={item.id}
                                            className={`setup-checklist-row rounded-xl border p-4 transition-colors ${
                                                item.done
                                                    ? 'border-emerald-500/20 bg-emerald-500/[0.06]'
                                                    : 'border-white/[0.07] bg-white/[0.025]'
                                            }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <span
                                                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ${
                                                        item.done
                                                            ? 'bg-emerald-500/15 ring-emerald-500/30 text-emerald-300'
                                                            : 'bg-violet-500/10 ring-violet-500/20 text-violet-300'
                                                    }`}
                                                >
                                                    {item.done ? <Check size={16} strokeWidth={2.5} /> : <Icon size={16} />}
                                                </span>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-medium text-neutral-100">{item.title}</p>
                                                    <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                                                        {item.description}
                                                    </p>
                                                    {item.id === 'pin' && !item.done && (
                                                        <p className="mt-2 text-[11px] text-neutral-600">
                                                            Chrome → Extensions puzzle icon → Pin FocuzNow
                                                        </p>
                                                    )}
                                                    {item.actionLabel && item.onAction && (
                                                        <button
                                                            type="button"
                                                            onClick={item.onAction}
                                                            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-violet-200 transition-colors hover:bg-white/[0.07]"
                                                        >
                                                            {item.id === 'blocking' && !hasBlocklist ? (
                                                                <Ban size={12} />
                                                            ) : item.id === 'blocking' ? (
                                                                <Globe size={12} />
                                                            ) : (
                                                                <ExternalLink size={12} />
                                                            )}
                                                            {item.actionLabel}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="mt-8 flex flex-col gap-2 sm:flex-row">
                                <ShellButton
                                    variant="secondary"
                                    fullWidth={false}
                                    className="sm:flex-1"
                                    onClick={() => setStep(0)}
                                >
                                    Back
                                </ShellButton>
                                <ShellButton
                                    className="sm:flex-[2] border-0 bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-500 hover:to-indigo-500"
                                    onClick={finish}
                                    disabled={!allDone && !hasSession}
                                >
                                    {allDone ? 'Finish setup' : 'Continue to extension'}
                                </ShellButton>
                            </div>

                            <button
                                type="button"
                                onClick={() => openWebDashboard()}
                                className="mt-4 flex w-full items-center justify-center gap-1.5 text-xs font-medium text-neutral-500 transition-colors hover:text-violet-300"
                            >
                                <ExternalLink size={12} />
                                Open web dashboard
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
