import { motion } from 'framer-motion';
import { Download, HardDrive, LockKeyhole, Sparkles } from 'lucide-react';
import { focusIn } from './motion';
import { SectionHeader } from './SectionHeader';

const POINTS = [
    {
        icon: LockKeyhole,
        title: 'Your vault stays sealed',
        body: 'FocuzPass encrypts every login with AES-256 and your master password, on your device. It never leaves your browser.',
    },
    {
        icon: HardDrive,
        title: 'Blocking runs locally',
        body: 'Your blocklist and browsing analytics are stored on your device. We don’t sell your browsing history.',
    },
    {
        icon: Sparkles,
        title: 'AI sees only what you share',
        body: 'AI Coach only uses the context you agree to share with it, and only when you ask.',
    },
    {
        icon: Download,
        title: 'Your data, your call',
        body: 'Export your stats or delete your account from settings whenever you want.',
    },
];

export function Privacy() {
    return (
        <section id="privacy" className="mx-auto max-w-[1200px] px-5 py-28 sm:px-8 sm:py-36">
            <div className="grid gap-14 lg:grid-cols-[1fr_1.35fr] lg:gap-20">
                <SectionHeader
                    align="left"
                    eyebrow="Privacy"
                    title="Private by design."
                    lead="FocuzNow does its work where your browsing already happens: in your browser."
                />
                {/* The hairlines are the grid's gap showing through, so the grid itself fades in as one piece. */}
                <motion.div
                    className="grid gap-px overflow-hidden rounded-[22px] sm:grid-cols-2"
                    style={{ background: 'var(--l-border)', boxShadow: '0 0 0 1px var(--l-border)' }}
                    variants={focusIn}
                    initial="hidden"
                    whileInView="show"
                    viewport={{ once: true, amount: 0.3 }}
                >
                    {POINTS.map(({ icon: Icon, title, body }) => (
                        <div key={title} className="bg-[var(--l-bg)] p-7 sm:p-8">
                            <span
                                className="flex h-10 w-10 items-center justify-center rounded-[11px] text-[var(--l-text-1)]"
                                style={{ background: 'var(--l-surface)', boxShadow: 'inset 0 0 0 1px var(--l-border-strong)' }}
                            >
                                <Icon size={18} strokeWidth={1.8} />
                            </span>
                            <h3 className="mt-5 text-[16.5px] font-[600] tracking-[-0.02em]">{title}</h3>
                            <p className="mt-2 text-[14.5px] leading-[1.6] text-[var(--l-text-3)]">{body}</p>
                        </div>
                    ))}
                </motion.div>
            </div>
        </section>
    );
}
