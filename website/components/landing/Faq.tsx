import { useId, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { FAQ } from './content';
import { EASE, focusIn, stagger } from './motion';
import { SectionHeader } from './SectionHeader';

export function Faq() {
    const [open, setOpen] = useState<number | null>(0);
    const baseId = useId();

    return (
        <section id="faq" className="mx-auto max-w-[1200px] px-5 py-28 sm:px-8 sm:py-36">
            <div className="grid gap-12 lg:grid-cols-[1fr_1.5fr] lg:gap-20">
                <SectionHeader
                    align="left"
                    eyebrow="FAQ"
                    title="Questions, answered."
                    lead={
                        <>
                            Can’t find yours? Email{' '}
                            <a className="text-[var(--l-text-1)] underline decoration-[var(--l-border-strong)] underline-offset-4 hover:decoration-[var(--l-text-1)]" href="mailto:support@focuznow.com">
                                support@focuznow.com
                            </a>
                            .
                        </>
                    }
                />
                <motion.div variants={stagger(0.05)} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }}>
                    {FAQ.map((item, i) => {
                        const expanded = open === i;
                        const panelId = `${baseId}-panel-${i}`;
                        const buttonId = `${baseId}-button-${i}`;
                        return (
                            <motion.div key={item.q} variants={focusIn} style={{ boxShadow: 'inset 0 -1px 0 var(--l-border)' }}>
                                <h3>
                                    <button
                                        id={buttonId}
                                        type="button"
                                        aria-expanded={expanded}
                                        aria-controls={panelId}
                                        onClick={() => setOpen(expanded ? null : i)}
                                        className="group flex w-full items-center gap-6 py-6 text-left"
                                    >
                                        <span
                                            className="flex-1 text-[17px] font-[560] tracking-[-0.015em] transition-colors duration-300"
                                            style={{ color: expanded ? 'var(--l-text-1)' : 'var(--l-text-2)' }}
                                        >
                                            {item.q}
                                        </span>
                                        <motion.span
                                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--l-text-2)] shadow-[inset_0_0_0_1px_var(--l-border-strong)] transition-colors group-hover:text-[var(--l-text-1)]"
                                            animate={{ rotate: expanded ? 45 : 0 }}
                                            transition={{ duration: 0.4, ease: EASE }}
                                        >
                                            <Plus size={15} />
                                        </motion.span>
                                    </button>
                                </h3>
                                <AnimatePresence initial={false}>
                                    {expanded && (
                                        <motion.div
                                            id={panelId}
                                            role="region"
                                            aria-labelledby={buttonId}
                                            className="overflow-hidden"
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.45, ease: EASE }}
                                        >
                                            <p className="max-w-[60ch] pb-7 pr-14 text-[15.5px] leading-[1.65] text-[var(--l-text-3)]">{item.a}</p>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        );
                    })}
                </motion.div>
            </div>
        </section>
    );
}
