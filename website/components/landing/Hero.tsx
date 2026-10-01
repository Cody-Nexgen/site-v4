import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, ArrowUpRight, BarChart3, CalendarDays, KeyRound, ShieldBan, Timer } from 'lucide-react';
import { SCENES } from './content';
import { EASE, focusIn, stagger } from './motion';
import { jumpToScene, scrollToId } from './scroll';

const Lighthouse = lazy(() => import('./lighthouse/Lighthouse'));

/** Mount the 3D scene once the headline has painted. */
function useAfterPaint() {
    const [ready, setReady] = useState(false);
    useEffect(() => {
        const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 120));
        const cancel = window.cancelIdleCallback ?? window.clearTimeout;
        const id = idle(() => setReady(true));
        return () => cancel(id);
    }, []);
    return ready;
}

function Rise({ children, delay, className = '' }: { children: ReactNode; delay: number; className?: string }) {
    const reduce = useReducedMotion();
    return (
        <motion.div
            className={className}
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: EASE, delay }}
        >
            {children}
        </motion.div>
    );
}

const LINES = ['Everything else', 'can wait.'];

/** One line each, matching the stage scenes they jump to. */
const FEATURES = [
    { icon: ShieldBan, line: 'Sites, categories, and Shorts' },
    { icon: Timer, line: 'A Pomodoro that blocks while it runs' },
    { icon: CalendarDays, line: 'Calendar, lists, and booking links' },
    { icon: KeyRound, line: 'Passwords, encrypted on your device' },
    { icon: BarChart3, line: 'Screen time and an AI coach' },
];

/** The paper panel that anchors the bottom of the hero. */
function FeaturePanel() {
    return (
        <div className="absolute inset-x-0 bottom-[-26px] z-10 px-8">
            <motion.div
                className="mx-auto max-w-[1120px] rounded-[26px] px-6 pb-6 pt-6 text-[#0b0b0d]"
                style={{ background: '#ecE9e2', boxShadow: '0 40px 120px -40px rgb(0 0 0 / 0.9)' }}
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1.1, ease: EASE, delay: 0.7 }}
            >
                <p className="text-center text-[15px] leading-[1.5] text-[#3a3936]">
                    One extension for your whole focus system. <span className="text-[#0b0b0d]">Free to start.</span>
                </p>
                <motion.div className="mt-5 grid grid-cols-5 gap-3" variants={stagger(0.06, 0.9)} initial="hidden" animate="show">
                    {SCENES.map((scene, i) => {
                        const { icon: Icon, line } = FEATURES[i];
                        return (
                            <motion.button
                                key={scene.id}
                                type="button"
                                variants={focusIn}
                                onClick={() => jumpToScene(i)}
                                className="group relative flex min-h-[112px] flex-col rounded-[14px] p-3.5 text-left transition-colors duration-300"
                                style={{ background: '#e2dfd7' }}
                                whileHover={{ y: -3, backgroundColor: '#d9d5cc' }}
                                transition={{ duration: 0.3, ease: EASE }}
                            >
                                <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-[#0b0b0d] text-[#ecE9e2]">
                                    <Icon size={16} strokeWidth={1.8} />
                                </span>
                                <span className="mt-auto pt-3 text-[15px] font-[650] tracking-[-0.01em]">{scene.label}</span>
                                <span className="mt-0.5 text-[13px] leading-[1.4] text-[#55534e]">{line}</span>
                                <ArrowUpRight
                                    size={15}
                                    className="absolute right-3.5 top-3.5 text-[#8a877f] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                                />
                            </motion.button>
                        );
                    })}
                </motion.div>
            </motion.div>
        </div>
    );
}

export function Hero({ signedIn, onPrimary }: { signedIn: boolean; onPrimary: () => void }) {
    const reduce = useReducedMotion();
    const sceneReady = useAfterPaint();
    const sectionRef = useRef<HTMLElement>(null);
    const textRef = useRef<HTMLDivElement>(null);

    // 0 at the top of the page, 1 once the hero has scrolled out of view.
    const getScroll = useCallback(() => {
        const el = sectionRef.current;
        return el ? window.scrollY / el.offsetHeight : 0;
    }, []);

    return (
        <section ref={sectionRef} className="relative h-[max(760px,100svh)]">
            <div className="absolute inset-0 isolate overflow-hidden">
                <div aria-hidden className="absolute inset-0 -z-10">
                    {sceneReady && (
                        <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.6, ease: EASE }}>
                            <Suspense fallback={null}>
                                <Lighthouse getScroll={getScroll} clearingRef={textRef} />
                            </Suspense>
                        </motion.div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 h-[22%] bg-gradient-to-b from-transparent to-[var(--l-bg)]" />
                </div>

                {/* The headline sits in the calm water the beam has cleared; the camera pivots on this spot. */}
                <div className="absolute inset-x-0 top-[45%]">
                    <div ref={textRef} className="mx-auto grid max-w-[1180px] grid-cols-[1.25fr_1fr] gap-16 px-8">
                        <h1 className="fzl-display text-[clamp(2.8rem,min(4.6vw,8.2vh),5rem)] [text-shadow:0_2px_24px_rgb(0_0_0/0.6)]">
                            {LINES.map((line, i) => (
                                <span key={line} className="block overflow-hidden pb-[0.08em]">
                                    <motion.span
                                        className="block"
                                        initial={reduce ? false : { y: '110%' }}
                                        animate={{ y: '0%' }}
                                        transition={{ duration: 1.05, ease: EASE, delay: 0.15 + i * 0.09 }}
                                    >
                                        {line}
                                    </motion.span>
                                </span>
                            ))}
                        </h1>
                        {/* Top of the paragraph lines up with the headline's cap height, the buttons with its baseline. */}
                        <div className="flex flex-col justify-between pb-[0.55rem] pt-[0.7rem] [text-shadow:0_1px_18px_rgb(0_0_0/0.7)]">
                            <Rise delay={0.5}>
                                <p className="fzl-lead max-w-[28rem] leading-[1.5]">
                                    Blocks distractions, runs your focus sessions, and keeps your plans and passwords in one
                                    place.
                                </p>
                            </Rise>
                            <Rise delay={0.62} className="mt-4 flex items-center gap-6 [text-shadow:none]">
                                <button type="button" onClick={onPrimary} className="fzl-btn fzl-btn-primary">
                                    {signedIn ? 'Open dashboard' : 'Get FocuzNow'}
                                    <ArrowRight size={16} className="fzl-arrow" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => scrollToId('product')}
                                    className="text-[15px] font-[540] text-[var(--l-text-2)] transition-colors hover:text-[var(--l-text-1)]"
                                >
                                    See how it works
                                </button>
                            </Rise>
                        </div>
                    </div>
                </div>
            </div>

            <FeaturePanel />
        </section>
    );
}
