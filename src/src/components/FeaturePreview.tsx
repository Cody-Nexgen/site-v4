import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, CalendarDays, Command } from 'lucide-react';
import { AuthShell } from './shell/AuthShell';
import { Brand } from './shell/Brand';
import {
    ShellCard,
    Eyebrow,
    ShellTitle,
    ShellDescription,
    StepDots,
    NextButton,
    ShellButton,
} from './shell/ui';

const SLIDES = [
    {
        id: 'nuclear',
        tint: 'red' as const,
        eyebrow: 'Blocking',
        title: 'Nuclear Lockdown',
        description:
            'Block your blocklist—or the entire web—for a fixed window. The timer cannot be stopped early.',
        icon: Zap,
        iconClass: 'text-red-400 bg-red-500/10 ring-red-500/20',
        preview: (
            <motion.div
                className="focuz-preview-frame p-4 text-center"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
            >
                <div className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-2.5 py-1 text-[11px] font-medium text-red-300 ring-1 ring-red-500/25">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
                    Lockdown active
                </div>
                <p className="mt-3 text-3xl font-semibold tabular-nums text-white tracking-tight">47:32</p>
                <p className="mt-1 text-xs text-neutral-500">142 sites blocked</p>
            </motion.div>
        ),
    },
    {
        id: 'calendar',
        tint: 'blue' as const,
        eyebrow: 'Scheduling',
        title: 'Focus Calendar',
        description:
            'Drag focus blocks onto your week, sync Google Calendar, and auto-block distractions during sessions.',
        icon: CalendarDays,
        iconClass: 'text-sky-400 bg-sky-500/10 ring-sky-500/20',
        preview: (
            <motion.div
                className="focuz-preview-frame p-3"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
            >
                <motion.div className="grid grid-cols-7 gap-1 mb-2">
                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                        <div key={i} className="text-[9px] font-medium text-neutral-600 text-center py-0.5">
                            {d}
                        </div>
                    ))}
                </motion.div>
                <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: 7 }).map((_, i) => (
                        <div
                            key={i}
                            className={`h-7 rounded-md ${i >= 2 && i <= 4 ? 'bg-violet-500/40 ring-1 ring-violet-400/30' : 'bg-white/[0.04]'}`}
                        />
                    ))}
                </div>
                <p className="mt-2.5 text-[10px] text-neutral-500 text-center">Wed · Deep work 9:00–12:00</p>
            </motion.div>
        ),
    },
    {
        id: 'palette',
        tint: 'violet' as const,
        eyebrow: 'Navigation',
        title: 'Command Palette',
        description: 'Press ⌘K to jump anywhere—sessions, blocklist, calendar, or AI Coach—in one keystroke.',
        icon: Command,
        iconClass: 'text-violet-400 bg-violet-500/10 ring-violet-500/20',
        preview: (
            <motion.div
                className="focuz-preview-frame overflow-hidden"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
            >
                <div className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-2.5 bg-white/[0.02]">
                    <Command size={13} className="text-neutral-500 shrink-0" />
                    <span className="text-xs text-neutral-400">Go to calendar…</span>
                </div>
                <div className="py-1">
                    {[
                        { label: 'Overview', active: true },
                        { label: 'Start 25m focus session', active: false },
                        { label: 'Blocklist', active: false },
                    ].map((row) => (
                        <div
                            key={row.label}
                            className={`px-3 py-2 text-xs ${row.active ? 'bg-violet-500/15 text-violet-200' : 'text-neutral-500'}`}
                        >
                            {row.label}
                        </div>
                    ))}
                </div>
            </motion.div>
        ),
    },
] as const;

interface FeaturePreviewProps {
    onComplete: () => void;
}

export function FeaturePreview({ onComplete }: FeaturePreviewProps) {
    const [step, setStep] = useState(0);
    const slide = SLIDES[step];
    const Icon = slide.icon;
    const isLast = step === SLIDES.length - 1;

    return (
        <AuthShell tint={slide.tint}>
            <ShellCard>
                <div className="flex items-center justify-between mb-6">
                    <Brand size="sm" />
                    <button
                        type="button"
                        onClick={onComplete}
                        className="text-xs font-medium text-neutral-500 hover:text-neutral-300 transition-colors"
                    >
                        Skip tour
                    </button>
                </div>

                <div className="h-0.5 w-full rounded-full bg-neutral-800/80 mb-6 overflow-hidden">
                    <motion.div
                        className="h-full bg-violet-500 rounded-full"
                        animate={{ width: `${((step + 1) / SLIDES.length) * 100}%` }}
                        transition={{ duration: 0.3, ease: 'easeOut' }}
                    />
                </div>

                <AnimatePresence mode="wait">
                    <motion.div
                        key={slide.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.22, ease: 'easeOut' }}
                        className="space-y-5"
                    >
                        <motion.div className="flex justify-center py-1">{slide.preview}</motion.div>

                        <div className="flex items-start gap-3">
                            <div
                                className={`shrink-0 w-10 h-10 rounded-xl ring-1 flex items-center justify-center ${slide.iconClass}`}
                            >
                                <Icon size={20} strokeWidth={2} />
                            </div>
                            <div className="space-y-1.5 min-w-0 pt-0.5">
                                <Eyebrow>{slide.eyebrow}</Eyebrow>
                                <ShellTitle>{slide.title}</ShellTitle>
                                <ShellDescription>{slide.description}</ShellDescription>
                            </div>
                        </div>
                    </motion.div>
                </AnimatePresence>

                <div className="mt-7 space-y-4">
                    <StepDots total={SLIDES.length} current={step} onSelect={setStep} />
                    <NextButton
                        isLast={isLast}
                        label={isLast ? 'Continue to sign in' : undefined}
                        onClick={() => (isLast ? onComplete() : setStep((s) => s + 1))}
                    />
                    {step > 0 && (
                        <ShellButton variant="ghost" onClick={() => setStep((s) => s - 1)}>
                            Back
                        </ShellButton>
                    )}
                </div>
            </ShellCard>
        </AuthShell>
    );
}
