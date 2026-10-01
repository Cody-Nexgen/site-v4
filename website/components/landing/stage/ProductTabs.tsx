import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion';
import { BarChart3, CalendarDays, KeyRound, ShieldBan, Timer } from 'lucide-react';
import { SCENES, type SceneId } from '../content';
import { EASE, focusIn } from '../motion';
import { STAGE_JUMP_EVENT, scrollToId } from '../scroll';
import { DemoFrame } from './DemoFrame';
import { BrowserWindow, CANVAS_W, ScaledCanvas, VIEWPORT_H } from './kit';

/** What each tab shows: the real extension UI from /demo.html. */
const FRAMES: Record<SceneId, { url: string; query: string; icon: typeof Timer }> = {
    block: { url: 'youtube.com/shorts', query: 'view=blocked&source=manual&url=https%3A%2F%2Fwww.youtube.com%2Fshorts%2Fdemo', icon: ShieldBan },
    focus: { url: 'focuznow.com/app/pomodoro', query: 'tab=sessions&pomodoro=1', icon: Timer },
    plan: { url: 'focuznow.com/app/calendar', query: 'tab=calendar', icon: CalendarDays },
    pass: { url: 'northwind.app/login', query: 'view=login', icon: KeyRound },
    insights: { url: 'focuznow.com/app/stats', query: 'tab=statistics', icon: BarChart3 },
};

const POPUP = { width: 380, height: 334 };
/** How long each tab stays before moving on, while the section is on screen. */
const DWELL_MS = 9000;
const N = SCENES.length;

export function ProductTabs() {
    const reduce = useReducedMotion();
    const sectionRef = useRef<HTMLElement>(null);
    const inView = useInView(sectionRef, { amount: 0.35 });
    const near = useInView(sectionRef, { margin: '0px 0px 80% 0px', once: true });
    const [active, setActive] = useState(0);
    const [plays, setPlays] = useState(1);
    const [paused, setPaused] = useState(false);
    const [cycle, setCycle] = useState(0);
    const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

    const select = useCallback((index: number) => {
        setActive((index + N) % N);
        setPlays((p) => p + 1);
    }, []);

    // Advance on a timer while visible; hovering the window or the tabs holds it.
    const running = inView && !paused && !reduce;
    // Resuming starts the current tab's countdown (and its progress fill) over.
    useEffect(() => {
        if (running) setCycle((c) => c + 1);
    }, [running]);
    useEffect(() => {
        if (!running) return;
        const id = window.setTimeout(() => select(active + 1), DWELL_MS);
        return () => window.clearTimeout(id);
    }, [running, active, plays, cycle, select]);

    // Nav, hero cards and the palette jump straight to a tab.
    useEffect(() => {
        const onJump = (event: Event) => {
            select((event as CustomEvent<number>).detail);
            scrollToId('product', 40);
        };
        window.addEventListener(STAGE_JUMP_EVENT, onJump);
        return () => window.removeEventListener(STAGE_JUMP_EVENT, onJump);
    }, [select]);

    const onTabKey = (event: KeyboardEvent) => {
        if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
        event.preventDefault();
        const next = (active + (event.key === 'ArrowRight' ? 1 : -1) + N) % N;
        select(next);
        tabRefs.current[next]?.focus();
    };

    // The active tab's window plus the next one, loaded ahead so switching is instant.
    const loaded = near ? new Set([active, (active + 1) % N]) : new Set<number>();
    const scene = SCENES[active];

    return (
        <section id="product" ref={sectionRef} className="relative pb-24 pt-44">
            <motion.div
                className="mx-auto flex max-w-[760px] flex-col items-center px-8 text-center"
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, amount: 0.6 }}
                variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
            >
                <motion.span variants={focusIn} className="fzl-eyebrow">
                    The real thing
                </motion.span>
                <motion.h2 variants={focusIn} className="fzl-h2 mt-5">
                    One extension. Your whole focus system.
                </motion.h2>
                <motion.p variants={focusIn} className="fzl-lead mt-5 max-w-[34rem]">
                    Everything below is FocuzNow itself, running right here on demo data.
                </motion.p>
            </motion.div>

            <div
                role="tablist"
                aria-label="What FocuzNow does"
                className="mx-auto mt-12 flex max-w-max items-center gap-2 px-8"
                onMouseEnter={() => setPaused(true)}
                onMouseLeave={() => setPaused(false)}
            >
                {SCENES.map((s, i) => {
                    const Icon = FRAMES[s.id].icon;
                    const selected = i === active;
                    return (
                        <button
                            key={s.id}
                            ref={(el) => {
                                tabRefs.current[i] = el;
                            }}
                            type="button"
                            role="tab"
                            id={`fzl-tab-${s.id}`}
                            aria-selected={selected}
                            aria-controls="fzl-tabpanel"
                            tabIndex={selected ? 0 : -1}
                            onClick={() => select(i)}
                            onKeyDown={onTabKey}
                            className="relative flex h-11 items-center gap-2 overflow-hidden rounded-full px-5 text-[14.5px] font-[560] transition-colors duration-300"
                            style={{
                                background: selected ? '#ecE9e2' : 'oklch(1 0 0 / 0.04)',
                                color: selected ? '#0b0b0d' : 'var(--l-text-3)',
                                boxShadow: selected ? 'none' : 'inset 0 0 0 1px var(--l-border-strong)',
                            }}
                        >
                            {selected && !reduce && (
                                <span
                                    key={`${active}-${plays}-${cycle}`}
                                    aria-hidden
                                    className="fzl-fill absolute inset-y-0 left-0 bg-black/[0.08]"
                                    style={{ animationDuration: `${DWELL_MS}ms`, animationPlayState: running ? 'running' : 'paused' }}
                                />
                            )}
                            <Icon size={15} strokeWidth={1.9} className="relative" />
                            <span className="relative">{s.label}</span>
                        </button>
                    );
                })}
            </div>

            <div className="mx-auto mt-6 h-[52px] max-w-[640px] px-8 text-center">
                <AnimatePresence mode="wait">
                    <motion.p
                        key={scene.id}
                        className="text-[15.5px] leading-[1.6] text-[var(--l-text-3)]"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.3, ease: EASE }}
                    >
                        {scene.body}
                    </motion.p>
                </AnimatePresence>
            </div>

            {/* The window sits on a paper slab, like the hero's panel. */}
            <div
                id="fzl-tabpanel"
                role="tabpanel"
                aria-labelledby={`fzl-tab-${scene.id}`}
                className="relative mx-auto mt-8 max-w-[1240px] px-8"
                onMouseEnter={() => setPaused(true)}
                onMouseLeave={() => setPaused(false)}
            >
                <div aria-hidden className="absolute inset-x-8 bottom-[-44px] top-[16%] rounded-[32px]" style={{ background: '#ecE9e2' }} />
                <div
                    className="relative mx-auto"
                    // Fits the whole window on screen under the tabs.
                    style={{ width: 'min(86%, calc((100svh - 250px) * 1.58))', filter: 'drop-shadow(0 40px 60px rgb(0 0 0 / 0.35))' }}
                >
                    <ScaledCanvas>
                        <BrowserWindow url={FRAMES[scene.id].url}>
                            {SCENES.map((s, i) =>
                                loaded.has(i) ? (
                                    <motion.div
                                        key={s.id}
                                        className="absolute inset-0"
                                        initial={false}
                                        animate={{ opacity: i === active ? 1 : 0 }}
                                        transition={{ duration: 0.45, ease: EASE }}
                                        style={{ zIndex: i === active ? 1 : 0 }}
                                    >
                                        <DemoFrame
                                            query={FRAMES[s.id].query}
                                            width={CANVAS_W}
                                            height={VIEWPORT_H}
                                            replay={s.id === 'pass' && i === active ? plays : 0}
                                        />
                                    </motion.div>
                                ) : null,
                            )}
                        </BrowserWindow>
                    </ScaledCanvas>

                    {/* The real toolbar popup, floating over the window on the Block tab. */}
                    {near && (
                        <motion.div
                            className="absolute -right-[7%] top-[9%] origin-top-right overflow-hidden rounded-[14px]"
                            style={{
                                width: POPUP.width * 0.9,
                                height: POPUP.height * 0.9,
                                boxShadow: '0 0 0 1px var(--l-border-strong), 0 40px 80px -20px rgb(0 0 0 / 0.8)',
                            }}
                            initial={false}
                            animate={
                                scene.id === 'block'
                                    ? { opacity: 1, y: 0, scale: 1, transition: { duration: 0.6, ease: EASE, delay: 0.9 } }
                                    : { opacity: 0, y: -10, scale: 0.96, transition: { duration: 0.3, ease: EASE } }
                            }
                        >
                            <div style={{ transform: 'scale(0.9)', transformOrigin: '0 0' }}>
                                <DemoFrame query="view=popup" width={POPUP.width} height={POPUP.height} />
                            </div>
                        </motion.div>
                    )}
                </div>
            </div>
        </section>
    );
}
