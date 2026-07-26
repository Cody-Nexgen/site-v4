import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { GlassCard } from './OptionsApp';
import { Mail, MessageCircle, BookOpen, ExternalLink, Sparkles, ChevronDown } from 'lucide-react';

type Props = {
    onOpenAiCoach: () => void;
    isPro: boolean;
};

const FAQS = [
    { q: 'How is focus score calculated?', a: 'Your focus score (0–100) weighs distraction ratio, task completion, habit check-ins, blocks resisted, pomodoro sessions, and streak — not raw screen time. Less time on distracting sites and more completed tasks raises your score.' },
    { q: 'What counts toward my dashboard streak?', a: 'Your sidebar streak tracks consecutive days you open the FocuzNow dashboard or settings. Opening the extension popup alone does not count — open the full dashboard at least once per day.' },
    { q: 'How do I turn off the site clock?', a: 'Go to Settings → Focus Engine Features → toggle off Site Clock. This hides the per-site time bubble on web pages.' },
    { q: 'What is Nuclear Lockdown?', a: 'Nuclear Lockdown blocks all sites in your blocklist for a set duration with no easy override. Use it when you need maximum focus for deep work.' },
    { q: 'How does the command palette work?', a: 'Press ⌘K (Mac) or Ctrl+K (Windows) on any webpage to open the command palette. From there you can start focus sessions, add tasks, block sites, and jump to dashboard sections.' },
    { q: 'Can I sync with Notion or Google Calendar?', a: 'Notion task sync and Google Calendar integration are rolling out. Use the built-in daily planner, Pomodoro timer, and scheduling calendar today.' },
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
        <div className="border-b border-white/5 last:border-0">
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
        <div className="space-y-8 pt-6 animate-fade-in-up max-w-3xl pb-20">
            <div>
                <p className="focuz-section-label mb-1">Support</p>
                <h1 className="text-3xl font-semibold text-white tracking-tight">Need help?</h1>
                <p className="text-sm text-neutral-500 mt-1">
                    Ask the AI Coach, browse guides, or reach our team directly.
                </p>
            </div>

            <GlassCard className="p-6 sm:p-8 border-white/[0.07] bg-[#121214]">
                <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-white/[0.04] border border-white/[0.07] flex items-center justify-center shrink-0">
                        <Sparkles size={18} className="text-neutral-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h2 className="text-lg font-semibold text-white mb-1">AI Coach {isPro ? '' : '(Pro)'}</h2>
                        <p className="text-sm text-neutral-400 mb-4 leading-relaxed">
                            Your personal focus assistant — block sites, start pomodoro sessions, analyze patterns, and build a daily plan.
                        </p>
                        <button
                            type="button"
                            onClick={onOpenAiCoach}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-neutral-100 hover:bg-white text-neutral-950 text-sm font-medium transition-colors duration-150"
                        >
                            <MessageCircle size={16} />
                            {isPro ? 'Open AI Coach' : 'Learn about Pro'}
                        </button>
                    </div>
                </div>
            </GlassCard>

            <div className="grid sm:grid-cols-2 gap-4">
                <GlassCard className="p-6">
                    <Mail size={20} className="text-neutral-400 mb-3" />
                    <h3 className="font-semibold text-white mb-1">Email support</h3>
                    <p className="text-sm text-neutral-500 mb-4">We typically respond within 24 hours.</p>
                    <a
                        href="mailto:support@focuznow.com?subject=FocuzNow%20Help"
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-neutral-200 transition-colors"
                    >
                        support@focuznow.com
                        <ExternalLink size={14} />
                    </a>
                </GlassCard>

                <GlassCard className="p-6">
                    <BookOpen size={20} className="text-neutral-400 mb-3" />
                    <h3 className="font-semibold text-white mb-1">Quick tips</h3>
                    <ul className="text-sm text-neutral-400 space-y-2 mt-2">
                        <li>Press <kbd className="kbd">⌘K</kbd> anywhere to open the command palette</li>
                        <li>Toggle the site clock in Settings → Site Clock</li>
                        <li>Check Patterns for activity heatmaps and AI insights</li>
                        <li>Your data stays local — we never sell browsing history</li>
                    </ul>
                </GlassCard>
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
