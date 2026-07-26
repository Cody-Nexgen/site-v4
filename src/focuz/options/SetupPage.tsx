import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
    Ban,
    Check,
    ChevronRight,
    ExternalLink,
    KeyRound,
    Pin,
} from 'lucide-react';
import { Brand } from '../components/shell/Brand';
import { markSetupComplete, openWebDashboard } from '../lib/workspaceSync';

type SetupPageProps = {
    hasSession: boolean;
    hasBlocklist: boolean;
    historyConnected: boolean;
    onComplete: () => void;
    onOpenBlocklist: () => void;
    onImportHistory: () => void;
};

type StepId = 'account' | 'pin' | 'blocking';

const SETUP_PINNED_KEY = 'focuznow-setup-pinned';
const SETUP_TUTORIAL_KEY = 'focuznow-setup-tutorial';

function StepIllustration({ kind }: { kind: StepId }) {
    if (kind === 'account') {
        return (
            <div className="relative mx-auto flex h-40 w-full max-w-sm items-center justify-center rounded-2xl bg-[#1a2332] px-6">
                <div className="w-full rounded-xl border border-white/10 bg-[#0f141c] p-4 shadow-inner">
                    <div className="mb-2 h-2 w-16 rounded-full bg-white/15" />
                    <div className="flex items-center gap-2 rounded-lg border border-sky-400/40 bg-sky-500/10 px-3 py-2.5">
                        <KeyRound size={16} className="text-sky-300" />
                        <div className="h-2 flex-1 rounded-full bg-white/20" />
                        <span className="text-[10px] font-semibold text-sky-200">•••</span>
                    </div>
                </div>
                <div className="absolute -right-1 top-8 flex h-9 w-9 items-center justify-center rounded-full bg-sky-500 text-white shadow-lg shadow-sky-500/30">
                    <Check size={16} strokeWidth={2.5} />
                </div>
            </div>
        );
    }
    if (kind === 'pin') {
        return (
            <div className="relative mx-auto flex h-40 w-full max-w-sm items-center justify-center rounded-2xl bg-[#1a2332] px-6">
                <div className="flex items-end gap-2">
                    <div className="flex h-12 w-28 items-center justify-center rounded-t-xl border border-white/10 bg-[#121820] text-[10px] text-neutral-500">
                        Toolbar
                    </div>
                    <div className="flex h-14 w-14 -translate-y-1 items-center justify-center rounded-2xl border border-sky-400/40 bg-sky-500/15 shadow-lg shadow-sky-500/20">
                        <Pin size={20} className="text-sky-300" />
                    </div>
                </div>
            </div>
        );
    }
    return (
        <div className="relative mx-auto flex h-40 w-full max-w-sm items-center justify-center rounded-2xl bg-[#1a2332] px-6">
            <div className="flex w-full max-w-[240px] flex-col gap-2 rounded-xl border border-white/10 bg-[#0f141c] p-4">
                <div className="flex items-center gap-2">
                    <Ban size={14} className="text-rose-300" />
                    <div className="h-2 flex-1 rounded-full bg-white/15" />
                </div>
                <div className="h-2 w-3/4 rounded-full bg-white/10" />
                <div className="mt-1 h-8 rounded-lg bg-emerald-500/15 ring-1 ring-emerald-400/30" />
            </div>
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
    const [phase, setPhase] = useState<'welcome' | 'checklist'>('welcome');
    const [expandedId, setExpandedId] = useState<StepId>('account');
    const [pinnedDone, setPinnedDone] = useState(false);
    const [tutorialDone, setTutorialDone] = useState(false);

    useEffect(() => {
        try {
            chrome.storage.local.get([SETUP_PINNED_KEY, SETUP_TUTORIAL_KEY], (res) => {
                if (res[SETUP_PINNED_KEY]) setPinnedDone(true);
                if (res[SETUP_TUTORIAL_KEY]) setTutorialDone(true);
            });
        } catch {
            /* web / unavailable */
        }
    }, []);

    const accountDone = hasSession;
    const pinDone = pinnedDone || tutorialDone;
    const blockingDone = hasBlocklist || historyConnected;

    const steps = useMemo(
        () =>
            [
                {
                    id: 'account' as const,
                    title: 'Add your account',
                    description: accountDone
                        ? 'You are signed in. Focus data syncs across devices and the web dashboard.'
                        : 'Sign in so streaks, habits, calendar, and settings stay with you everywhere.',
                    done: accountDone,
                    primaryLabel: accountDone ? undefined : 'Sign in on web',
                    onPrimary: accountDone
                        ? undefined
                        : () => {
                              chrome.tabs.create({ url: 'https://focuznow.com/login?extension_oauth=1' });
                          },
                    secondaryLabel: accountDone ? 'Continue' : undefined,
                    onSecondary: accountDone
                        ? () => setExpandedId(pinDone ? 'blocking' : 'pin')
                        : undefined,
                },
                {
                    id: 'pin' as const,
                    title: 'Pin FocuzNow to your toolbar',
                    description:
                        'Open the Chrome puzzle menu, find FocuzNow, then pin it so the helper popup is always one click away.',
                    done: pinDone,
                    primaryLabel: 'I pinned it',
                    onPrimary: () => {
                        setPinnedDone(true);
                        void chrome.storage.local.set({ [SETUP_PINNED_KEY]: true });
                        setExpandedId('blocking');
                    },
                    secondaryLabel: 'Skip for now',
                    onSecondary: () => {
                        setTutorialDone(true);
                        void chrome.storage.local.set({ [SETUP_TUTORIAL_KEY]: true });
                        setExpandedId('blocking');
                    },
                },
                {
                    id: 'blocking' as const,
                    title: 'Connect blocking & import history',
                    description:
                        'Add distraction sites to your blocklist and optionally import history for richer stats. Blocking runs in the extension helper.',
                    done: blockingDone,
                    primaryLabel: hasBlocklist ? 'Import history' : 'Open blocklist',
                    onPrimary: hasBlocklist ? onImportHistory : onOpenBlocklist,
                    secondaryLabel: hasBlocklist ? 'Open blocklist' : undefined,
                    onSecondary: hasBlocklist ? onOpenBlocklist : undefined,
                },
            ] as const,
        [
            accountDone,
            pinDone,
            blockingDone,
            hasBlocklist,
            onImportHistory,
            onOpenBlocklist,
        ],
    );

    const allDone = steps.every((s) => s.done);

    useEffect(() => {
        if (phase !== 'checklist') return;
        const firstOpen = steps.find((s) => !s.done);
        if (firstOpen && !steps.find((s) => s.id === expandedId && !s.done)) {
            setExpandedId(firstOpen.id);
        }
    }, [phase, steps, expandedId]);

    const finish = () => {
        markSetupComplete();
        onComplete();
    };

    return (
        <div className="focuz-setup fixed inset-0 z-[210] flex min-h-screen items-center justify-center bg-[#0a0b10] p-4 sm:p-8">
            <div
                className="pointer-events-none absolute inset-0"
                style={{
                    background:
                        'radial-gradient(ellipse 70% 55% at 50% 0%, rgba(56, 98, 180, 0.28), transparent 60%), radial-gradient(ellipse 50% 40% at 80% 90%, rgba(88, 28, 135, 0.18), transparent 55%)',
                }}
            />

            <div className="relative z-10 w-full max-w-lg">
                <AnimatePresence mode="wait">
                    {phase === 'welcome' ? (
                        <motion.div
                            key="welcome"
                            initial={{ opacity: 0, y: 14, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -10, scale: 0.98 }}
                            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                            className="overflow-hidden rounded-3xl border border-white/10 bg-[#14151c]/92 shadow-[0_40px_100px_-28px_rgba(0,0,0,0.85)] backdrop-blur-2xl"
                        >
                            <div className="bg-gradient-to-br from-sky-600 via-indigo-600 to-violet-700 px-8 pb-8 pt-8 sm:px-10 sm:pt-10">
                                <Brand size="sm" className="mb-8 [&_p]:text-white [&_div]:border-white/20 [&_div]:bg-white/15" />
                                <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-[2rem]">
                                    Welcome to FocuzNow
                                </h1>
                                <p className="mt-3 max-w-md text-sm leading-relaxed text-white/80">
                                    The extension is your focus helper. Manage everything else on the web dashboard —
                                    same UI, synced everywhere.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setPhase('checklist')}
                                    className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3.5 text-sm font-semibold text-slate-900 transition hover:bg-sky-50"
                                >
                                    Continue setup
                                    <ChevronRight size={16} className="opacity-70" />
                                </button>
                                <button
                                    type="button"
                                    onClick={finish}
                                    className="mt-3 w-full text-center text-xs font-medium text-white/65 transition hover:text-white"
                                >
                                    Skip for now
                                </button>
                            </div>
                            <div className="border-t border-white/5 bg-[#101118] px-8 py-6 sm:px-10">
                                <StepIllustration kind="account" />
                                <p className="mt-4 text-center text-xs text-neutral-500">
                                    Modern setup · high-radius SaaS · synced web dashboard
                                </p>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="checklist"
                            initial={{ opacity: 0, y: 14, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -10, scale: 0.98 }}
                            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                            className="rounded-3xl border border-white/10 bg-[#16171f] p-5 shadow-[0_40px_100px_-28px_rgba(0,0,0,0.85)] sm:p-6"
                        >
                            <div className="mb-5 flex items-start justify-between gap-3">
                                <h2 className="text-xl font-semibold tracking-tight text-white">Start setup</h2>
                                <button
                                    type="button"
                                    onClick={finish}
                                    className="text-xs font-medium text-neutral-500 transition hover:text-neutral-300"
                                >
                                    Skip
                                </button>
                            </div>

                            <div className="space-y-3">
                                {steps.map((item) => {
                                    const expanded = expandedId === item.id;
                                    return (
                                        <div
                                            key={item.id}
                                            className={[
                                                'overflow-hidden rounded-2xl border transition-colors',
                                                item.done
                                                    ? 'border-emerald-500/55 bg-emerald-500/[0.04]'
                                                    : expanded
                                                      ? 'border-white/12 bg-[#1c1d27]'
                                                      : 'border-white/[0.08] bg-[#1a1b24]',
                                            ].join(' ')}
                                        >
                                            <button
                                                type="button"
                                                onClick={() => setExpandedId(item.id)}
                                                className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
                                            >
                                                <span
                                                    className={[
                                                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border',
                                                        item.done
                                                            ? 'border-emerald-400 bg-emerald-500 text-white'
                                                            : 'border-white/25 bg-transparent text-transparent',
                                                    ].join(' ')}
                                                >
                                                    {item.done ? <Check size={13} strokeWidth={3} /> : null}
                                                </span>
                                                <span
                                                    className={[
                                                        'text-sm font-medium',
                                                        item.done
                                                            ? 'text-white'
                                                            : expanded
                                                              ? 'text-white'
                                                              : 'text-neutral-400',
                                                    ].join(' ')}
                                                >
                                                    {item.title}
                                                </span>
                                            </button>

                                            <AnimatePresence initial={false}>
                                                {expanded && (
                                                    <motion.div
                                                        key={`${item.id}-body`}
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                                                        className="overflow-hidden"
                                                    >
                                                        <div className="space-y-4 border-t border-white/[0.06] px-4 pb-4 pt-3">
                                                            <StepIllustration kind={item.id} />
                                                            <p className="text-sm leading-relaxed text-neutral-300">
                                                                {item.description}
                                                            </p>
                                                            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                                                                {item.secondaryLabel && item.onSecondary && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={item.onSecondary}
                                                                        className="rounded-xl bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-neutral-300 transition hover:bg-white/[0.1]"
                                                                    >
                                                                        {item.secondaryLabel}
                                                                    </button>
                                                                )}
                                                                {item.primaryLabel && item.onPrimary && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={item.onPrimary}
                                                                        className="rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-400"
                                                                    >
                                                                        {item.primaryLabel}
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    );
                                })}
                            </div>

                            <button
                                type="button"
                                disabled={!allDone}
                                onClick={finish}
                                className={[
                                    'mt-6 flex w-full items-center justify-center rounded-2xl px-4 py-3.5 text-sm font-semibold transition',
                                    allDone
                                        ? 'bg-sky-500 text-white hover:bg-sky-400'
                                        : 'cursor-not-allowed bg-white/[0.06] text-neutral-500',
                                ].join(' ')}
                            >
                                {allDone ? 'Finish setup' : 'Complete all steps to finish'}
                            </button>

                            <div className="mt-3 flex items-center justify-between gap-3">
                                <button
                                    type="button"
                                    onClick={() => setPhase('welcome')}
                                    className="text-xs font-medium text-neutral-500 transition hover:text-neutral-300"
                                >
                                    Back
                                </button>
                                <button
                                    type="button"
                                    onClick={() => openWebDashboard()}
                                    className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 transition hover:text-sky-300"
                                >
                                    <ExternalLink size={12} />
                                    Open web dashboard
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
