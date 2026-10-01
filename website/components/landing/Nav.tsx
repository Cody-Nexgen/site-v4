import { useState } from 'react';
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { Mark } from './Mark';
import { DUR, EASE } from './motion';
import { jumpToScene, scrollToId, scrollToY } from './scroll';

type NavProps = {
    signedIn: boolean;
    onPrimary: () => void;
    onLogin: () => void;
};

const LINKS: { label: string; go: () => void }[] = [
    { label: 'Product', go: () => scrollToId('product') },
    { label: 'Features', go: () => scrollToId('features') },
    { label: 'FocuzPass', go: () => jumpToScene(3) },
    { label: 'Pricing', go: () => scrollToId('pricing') },
    { label: 'FAQ', go: () => scrollToId('faq') },
];

export function Nav({ signedIn, onPrimary, onLogin }: NavProps) {
    const { scrollY } = useScroll();
    const [scrolled, setScrolled] = useState(false);
    const [open, setOpen] = useState(false);
    useMotionValueEvent(scrollY, 'change', (y) => setScrolled(y > 12));

    const go = (fn: () => void) => {
        setOpen(false);
        fn();
    };

    return (
        <header className="fixed inset-x-0 top-0 z-50">
            <div
                className="absolute inset-0 transition-[background-color,box-shadow,backdrop-filter] duration-500"
                style={{
                    backgroundColor: scrolled || open ? 'oklch(0.118 0.003 275 / 0.72)' : 'transparent',
                    boxShadow: scrolled || open ? 'inset 0 -1px 0 var(--l-border)' : 'none',
                    backdropFilter: scrolled || open ? 'blur(18px) saturate(1.4)' : 'none',
                    WebkitBackdropFilter: scrolled || open ? 'blur(18px) saturate(1.4)' : 'none',
                }}
            />
            <nav aria-label="Main" className="relative mx-auto flex h-16 max-w-[1200px] items-center gap-6 px-5 sm:px-8">
                <button
                    type="button"
                    onClick={() => go(() => scrollToY(0))}
                    className="flex items-center gap-2.5 rounded-lg"
                    aria-label="FocuzNow, back to top"
                >
                    <Mark size={28} />
                    <span className="text-[16px] font-[620] tracking-[-0.03em]">FocuzNow</span>
                </button>

                <div className="ml-4 hidden items-center gap-1 lg:flex">
                    {LINKS.map((link) => (
                        <button
                            key={link.label}
                            type="button"
                            onClick={link.go}
                            className="fzl-link rounded-full px-3 py-1.5 text-[14px] font-[500]"
                        >
                            {link.label}
                        </button>
                    ))}
                </div>

                <div className="ml-auto flex items-center gap-2">
                    {!signedIn && (
                        <button type="button" onClick={onLogin} className="fzl-link hidden whitespace-nowrap rounded-full px-3 py-1.5 text-[14px] font-[500] sm:block">
                            Log in
                        </button>
                    )}
                    <button type="button" onClick={onPrimary} className="fzl-btn fzl-btn-primary fzl-btn-sm">
                        {signedIn ? 'Open dashboard' : 'Get FocuzNow'}
                    </button>
                    <button
                        type="button"
                        onClick={() => setOpen((v) => !v)}
                        className="fzl-btn fzl-btn-ghost fzl-btn-sm w-9 px-0 lg:hidden"
                        aria-label={open ? 'Close menu' : 'Open menu'}
                        aria-expanded={open}
                    >
                        {open ? <X size={16} /> : <Menu size={16} />}
                    </button>
                </div>
            </nav>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: DUR.fast, ease: EASE }}
                        className="relative px-5 pb-5 lg:hidden"
                    >
                        <div className="flex flex-col gap-1">
                            {LINKS.map((link) => (
                                <button
                                    key={link.label}
                                    type="button"
                                    onClick={() => go(link.go)}
                                    className="rounded-xl px-3 py-3 text-left text-[16px] font-[500] text-[var(--l-text-2)] hover:bg-white/5"
                                >
                                    {link.label}
                                </button>
                            ))}
                            {!signedIn && (
                                <button
                                    type="button"
                                    onClick={() => go(onLogin)}
                                    className="rounded-xl px-3 py-3 text-left text-[16px] font-[500] text-[var(--l-text-2)] hover:bg-white/5"
                                >
                                    Log in
                                </button>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </header>
    );
}
