import { motion } from 'framer-motion';
import { ArrowRight, Check } from 'lucide-react';
import { FREE_FEATURES, PRO_FEATURES, PRO_PRICE } from './content';
import { focusIn, stagger } from './motion';
import { SectionHeader } from './SectionHeader';

type PricingProps = { signedIn: boolean; onPrimary: () => void };

function FeatureList({ items, strong }: { items: string[]; strong?: boolean }) {
    return (
        <ul className="flex flex-col gap-3">
            {items.map((item) => (
                <li key={item} className="flex gap-3 text-[14.5px] leading-[1.45]">
                    <Check size={16} strokeWidth={2.2} className="mt-[2px] shrink-0" style={{ color: strong ? 'var(--l-text-1)' : 'var(--l-text-3)' }} />
                    <span style={{ color: strong ? 'var(--l-text-1)' : 'var(--l-text-2)' }}>{item}</span>
                </li>
            ))}
        </ul>
    );
}

export function Pricing({ signedIn, onPrimary }: PricingProps) {
    return (
        <section id="pricing" className="mx-auto max-w-[1200px] px-5 py-28 sm:px-8 sm:py-36">
            <SectionHeader eyebrow="Pricing" title="Start free. Go Pro when you’re ready." lead="Everything you need to focus is free. Pro adds a coach." />

            <motion.div
                className="mx-auto mt-16 grid max-w-[940px] gap-4 md:grid-cols-2"
                variants={stagger(0.1)}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, amount: 0.25 }}
            >
                <motion.div variants={focusIn} className="fzl-tile flex flex-col p-8 sm:p-9">
                    <h3 className="text-[18px] font-[600] tracking-[-0.02em]">Free</h3>
                    <p className="mt-1 text-[14.5px] text-[var(--l-text-3)]">The whole focus toolkit.</p>
                    <div className="mt-7 flex items-baseline gap-2">
                        <span className="text-[52px] font-[620] leading-none tracking-[-0.05em]">$0</span>
                        <span className="text-[14px] text-[var(--l-text-4)]">no card needed</span>
                    </div>
                    <div className="my-8 h-px bg-[var(--l-border)]" />
                    <FeatureList items={FREE_FEATURES} />
                    <button type="button" onClick={onPrimary} className="fzl-btn fzl-btn-ghost mt-10 w-full">
                        {signedIn ? 'Open dashboard' : 'Get started'}
                    </button>
                </motion.div>

                <motion.div
                    variants={focusIn}
                    className="fzl-tile flex flex-col p-8 sm:p-9"
                    style={{
                        boxShadow: 'inset 0 0 0 1px oklch(1 0 0 / 0.2), 0 40px 100px -40px oklch(1 0 0 / 0.12)',
                        background:
                            'radial-gradient(120% 60% at 50% 0%, oklch(1 0 0 / 0.07), transparent 60%), var(--l-surface)',
                    }}
                >
                    <div className="flex items-center justify-between">
                        <h3 className="text-[18px] font-[600] tracking-[-0.02em]">Pro</h3>
                        <span className="rounded-full px-2.5 py-0.5 text-[12px] font-[560] text-[var(--l-text-2)] shadow-[inset_0_0_0_1px_var(--l-border-strong)]">
                            For people who want a coach
                        </span>
                    </div>
                    <p className="mt-1 text-[14.5px] text-[var(--l-text-3)]">Everything in Free, plus:</p>
                    <div className="mt-7 flex items-baseline gap-2">
                        <span className="text-[52px] font-[620] leading-none tracking-[-0.05em]">{PRO_PRICE.amount}</span>
                        <span className="text-[14px] text-[var(--l-text-4)]">{PRO_PRICE.period}</span>
                    </div>
                    <div className="my-8 h-px bg-[var(--l-border-strong)]" />
                    <FeatureList items={PRO_FEATURES} strong />
                    <div className="flex-1" />
                    <button type="button" onClick={onPrimary} className="fzl-btn fzl-btn-primary mt-10 w-full">
                        {signedIn ? 'Upgrade from your dashboard' : 'Start with Pro'}
                        <ArrowRight size={16} className="fzl-arrow" />
                    </button>
                </motion.div>
            </motion.div>

            <p className="mt-8 text-center text-[13px] text-[var(--l-text-4)]">Cancel anytime from your account. Billing is handled by Stripe.</p>
        </section>
    );
}
