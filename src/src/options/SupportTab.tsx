import { PALETTE_SHORTCUT_LABEL } from '../lib/shortcuts';
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { GlassCard } from './OptionsApp';
import { Mail, BookOpen, Sparkles, ChevronDown, ArrowRight } from 'lucide-react';

type Props = {
    onOpenAiCoach: () => void;
    isPro: boolean;
};

const FAQS = [
    { q: 'How is focus score calculated?', a: 'Your focus score (0–100) weighs distraction ratio, task completion, habit check-ins, blocks resisted, pomodoro sessions, and streak — not raw screen time. Less time on distracting sites and more completed tasks raises your score.' },
    { q: 'What counts toward my dashboard streak?', a: 'Your sidebar streak tracks consecutive days you open the FocuzNow dashboard or settings. Opening the extension popup alone does not count — open the full dashboard at least once per day.' },
    { q: 'How do I turn off the site clock?', a: 'Go to Settings → Focus Engine Features → toggle off Site Clock. This hides the per-site time bubble on web pages.' },
    { q: 'What is Nuclear Lockdown?', a: 'Nuclear Lockdown blocks all sites in your blocklist for a set duration with no easy override. Use it when you need maximum focus for deep work.' },
    { q: 'How does the command palette work?', a: 'Press Alt+K (⌥K on Mac) on any webpage to open the command palette. You can change the key on your browser’s extension shortcuts page. From there you can start focus sessions, add tasks, block sites, and jump to dashboard sections.' },
    { q: 'Where is my data stored?', a: 'Browsing analytics and block settings are stored locally on your device. We do not sell your browsing history. Pro AI Coach sends only the context you consent to share.' },
    { q: 'What is the difference between Patterns and Statistics?', a: 'Patterns shows your focus activity heatmap, trends, and AI-detected procrastination insights. Statistics provides detailed per-site breakdowns and weekly line charts.' },
    { q: 'How do achievements unlock?', a: 'Achievements unlock automatically when you hit milestones — streaks, focus scores, blocks prevented, habits tracked, and pomodoro sessions completed. View them on the Achievements page.' },
    { q: 'How does the Pomodoro timer work?', a: 'Open the Sessions tab to choose focus and break lengths, then start the timer. FocuzNow tracks completed focus sessions and automatically moves between work and break periods.' },
    { q: 'How do I block YouTube Shorts only?', a: 'Settings → In-App Distraction Blocking → enable Block YouTube Shorts. Regular YouTube videos still work; Shorts URLs and feed entries are blocked.' },
    { q: 'What is challenge mode?', a: 'When enabled in Settings, unblocking a site requires typing a focus phrase. This adds friction so you pause before visiting distracting sites.' },
    { q: 'How do habits work?', a: 'Add habits on the Habits or Dashboard tab and check in daily. Habit streaks are separate from your dashboard streak — they track consistency on specific routines.' },
    { q: 'What is AI Coach (Pro)?', a: 'AI Coach is a Pro feature that can block sites, configure pomodoro, change themes, read your analytics (with consent), and help plan your day — all via natural language.' },
    { q: 'How do I upgrade or cancel Pro?', a: 'Account → Manage Subscription opens the Stripe billing portal where you can upgrade, update payment, or cancel anytime.' },
    { q: 'The extension isn\'t blocking sites — what should I check?', a: 'Confirm the site is on your blocklist, blocking is not paused, Nuclear Lockdown is not expired, and the schedule (if any) is active. Reload the page after changing block settings.' },
    { q: 'Can I use FocuzNow on multiple devices?', a: 'Sign in with the same account to sync your profile and Pro subscription. Blocklists and analytics remain local-first per browser unless cloud sync features are enabled.' },
    { q: 'How do I contact support?', a: 'Email support@focuznow.com or use the AI chat widget on focuznow.com. Pro users can also ask AI Coach for in-app help.' },
];

function FaqItem({ q, a }: { q: string; a: string }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="border-b border-white/8 last:border-0">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="w-full flex items-center justify-between gap-3 py-4 text-left group"
            >
                <span className="text-sm font-medium text-neutral-200 group-hover:text-white transition-colors pr-2">{q}</span>
                <ChevronDown
                    size={16}
                    className={`shrink-0 text-neutral-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                />
            </button>
            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <p className="text-sm text-neutral-500 leading-relaxed pb-4">{a}</p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default function SupportTab({ onOpenAiCoach, isPro }: Props) {
    return (
        <div className="space-y-6 animate-fade-in-up">

            <div className="grid gap-4 sm:grid-cols-3">
                <button type="button" onClick={onOpenAiCoach} className="group text-left">
                    <GlassCard className="flex h-full flex-col p-5 transition-colors group-hover:border-white/16">
                        <Sparkles size={18} className="text-[var(--fz-text-3)]" />
                        <h3 className="mt-3 text-title-3">Ask AI Coach{isPro ? '' : ' (Pro)'}</h3>
                        <p className="mt-1 flex-1 text-body-sm text-[var(--fz-text-3)]">
                            Your personal focus assistant — block sites, start pomodoros, analyze patterns.
                        </p>
                        <span className="mt-4 inline-flex items-center gap-1.5 text-meta text-[var(--fz-text-3)] transition-colors group-hover:text-[var(--fz-text-1)]">
                            {isPro ? 'Open AI Coach' : 'Learn about Pro'} <ArrowRight size={12} />
                        </span>
                    </GlassCard>
                </button>

                <a href="https://focuznow.com" target="_blank" rel="noreferrer" className="group">
                    <GlassCard className="flex h-full flex-col p-5 transition-colors group-hover:border-white/16">
                        <BookOpen size={18} className="text-[var(--fz-text-3)]" />
                        <h3 className="mt-3 text-title-3">Guides</h3>
                        <p className="mt-1 flex-1 text-body-sm text-[var(--fz-text-3)]">
                            Quick tips: press <kbd className="kbd">{PALETTE_SHORTCUT_LABEL}</kbd> for the palette, manage the site clock, and more.
                        </p>
                        <span className="mt-4 inline-flex items-center gap-1.5 text-meta text-[var(--fz-text-3)] transition-colors group-hover:text-[var(--fz-text-1)]">
                            Browse guides <ArrowRight size={12} />
                        </span>
                    </GlassCard>
                </a>

                <a href="mailto:support@focuznow.com?subject=FocuzNow%20Help" className="group">
                    <GlassCard className="flex h-full flex-col p-5 transition-colors group-hover:border-white/16">
                        <Mail size={18} className="text-[var(--fz-text-3)]" />
                        <h3 className="mt-3 text-title-3">Contact</h3>
                        <p className="mt-1 flex-1 text-body-sm text-[var(--fz-text-3)]">
                            Email support — we typically respond within 24 hours.
                        </p>
                        <span className="mt-4 inline-flex items-center gap-1.5 text-meta text-[var(--fz-text-3)] transition-colors group-hover:text-[var(--fz-text-1)]">
                            support@focuznow.com <ArrowRight size={12} />
                        </span>
                    </GlassCard>
                </a>
            </div>

            <GlassCard className="p-6">
                <h3 className="font-semibold text-white mb-1">Frequently asked questions</h3>
                <p className="text-xs text-neutral-500 mb-4">{FAQS.length} topics — tap to expand</p>
                <div>
                    {FAQS.map(({ q, a }) => (
                        <FaqItem key={q} q={q} a={a} />
                    ))}
                </div>
            </GlassCard>
        </div>
    );
}
