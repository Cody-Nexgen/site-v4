import { useEffect, useRef, useState, type PointerEvent, type ReactNode, type RefObject } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { CalendarDays, EyeOff, Lock, Play, Search, ShieldBan, Timer, ListPlus } from 'lucide-react';
import { PALETTE_SHORTCUT_LABEL } from '@focuz/lib/shortcuts';
import { EASE, focusIn, stagger } from './motion';
import { openPaletteDemo } from './PaletteDemo';
import { SectionHeader } from './SectionHeader';

/* ---------------- tile ---------------- */

function Tile({
    className = '',
    visual,
    title,
    body,
    pro,
    footer,
}: {
    className?: string;
    visual: ReactNode;
    title: string;
    body: string;
    pro?: boolean;
    footer?: ReactNode;
}) {
    const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();
        event.currentTarget.style.setProperty('--mx', `${event.clientX - rect.left}px`);
        event.currentTarget.style.setProperty('--my', `${event.clientY - rect.top}px`);
    };
    return (
        <motion.div variants={focusIn} onPointerMove={onPointerMove} className={`fzl-tile flex flex-col ${className}`}>
            <div aria-hidden className="relative h-[210px] overflow-hidden">
                {visual}
            </div>
            <div className="flex flex-1 flex-col px-6 pb-6 pt-1 sm:px-7 sm:pb-7">
                <div className="flex items-center gap-2">
                    <h3 className="text-[17px] font-[600] tracking-[-0.02em]">{title}</h3>
                    {pro && (
                        <span className="rounded-full px-2 py-px text-[11px] font-[600] text-[var(--l-text-2)] shadow-[inset_0_0_0_1px_var(--l-border-strong)]">
                            Pro
                        </span>
                    )}
                </div>
                <p className="mt-1.5 max-w-[36ch] text-[14.5px] leading-[1.55] text-[var(--l-text-3)]">{body}</p>
                {footer}
            </div>
        </motion.div>
    );
}

/** Runs an interval only while the visual is on screen (and not at all with reduced motion). */
function useTicker(ref: RefObject<Element | null>, ms: number, tick: () => void) {
    const inView = useInView(ref, { amount: 0.4 });
    const reduce = useReducedMotion();
    const tickRef = useRef(tick);
    tickRef.current = tick;
    useEffect(() => {
        if (!inView || reduce) return;
        const id = window.setInterval(() => tickRef.current(), ms);
        return () => window.clearInterval(id);
    }, [inView, reduce, ms]);
    return inView;
}

/* ---------------- visuals ---------------- */

const PALETTE_ITEMS = [
    { icon: Timer, label: 'Start a focus session' },
    { icon: ShieldBan, label: 'Block this site' },
    { icon: ListPlus, label: 'Add a task' },
    { icon: CalendarDays, label: 'Open calendar' },
];

function PaletteVisual() {
    const ref = useRef<HTMLDivElement>(null);
    const [cursor, setCursor] = useState(0);
    useTicker(ref, 1500, () => setCursor((c) => (c + 1) % PALETTE_ITEMS.length));
    return (
        <div
            ref={ref}
            className="absolute inset-x-6 top-7 sm:inset-x-10"
            style={{ maskImage: 'linear-gradient(180deg, #000 72%, transparent 96%)', WebkitMaskImage: 'linear-gradient(180deg, #000 72%, transparent 96%)' }}
        >
            <div
                className="rounded-[14px]"
                style={{ background: 'var(--l-surface-2)', boxShadow: '0 0 0 1px var(--l-border-strong), 0 24px 60px -20px rgb(0 0 0 / 0.8)' }}
            >
                <div className="flex items-center gap-2.5 px-4 py-3 text-[13.5px] text-[var(--l-text-4)]" style={{ boxShadow: 'inset 0 -1px 0 var(--l-border)' }}>
                    <Search size={15} />
                    Search or run a command
                    <span className="fzl-kbd ml-auto">{PALETTE_SHORTCUT_LABEL}</span>
                </div>
                <div className="relative p-1.5">
                    <motion.span
                        className="absolute inset-x-1.5 h-[36px] rounded-[9px]"
                        style={{ background: 'oklch(1 0 0 / 0.07)' }}
                        animate={{ y: cursor * 36 }}
                        transition={{ duration: 0.45, ease: EASE }}
                    />
                    {PALETTE_ITEMS.map(({ icon: Icon, label }, i) => (
                        <div
                            key={label}
                            className="relative flex h-[36px] items-center gap-3 px-3 text-[13.5px] transition-colors duration-300"
                            style={{ color: i === cursor ? 'var(--l-text-1)' : 'var(--l-text-3)' }}
                        >
                            <Icon size={15} />
                            {label}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

const clock = (s: number) =>
    `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

function NuclearVisual() {
    const ref = useRef<HTMLDivElement>(null);
    const [left, setLeft] = useState(7182);
    useTicker(ref, 1000, () => setLeft((s) => Math.max(0, s - 1)));
    const r = 62;
    const c = 2 * Math.PI * r;
    return (
        <div ref={ref} className="absolute inset-0 flex items-center justify-center">
            <div className="absolute h-[220px] w-[220px] rounded-full" style={{ background: 'radial-gradient(circle, oklch(1 0 0 / 0.07), transparent 65%)' }} />
            <svg width="170" height="170" viewBox="0 0 170 170" className="relative -rotate-90">
                {Array.from({ length: 60 }, (_, i) => {
                    const a = (i / 60) * Math.PI * 2;
                    const inner = i % 5 === 0 ? 74 : 77;
                    return (
                        <line
                            key={i}
                            x1={85 + Math.cos(a) * inner}
                            y1={85 + Math.sin(a) * inner}
                            x2={85 + Math.cos(a) * 81}
                            y2={85 + Math.sin(a) * 81}
                            stroke="oklch(1 0 0 / 0.16)"
                            strokeWidth={1}
                        />
                    );
                })}
                <circle cx="85" cy="85" r={r} fill="none" stroke="oklch(1 0 0 / 0.08)" strokeWidth="4" />
                <circle
                    cx="85"
                    cy="85"
                    r={r}
                    fill="none"
                    stroke="var(--l-text-1)"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={c}
                    strokeDashoffset={c * (1 - left / 10800)}
                    style={{ transition: 'stroke-dashoffset 1s linear' }}
                />
            </svg>
            <div className="absolute flex flex-col items-center">
                <Lock size={16} className="text-[var(--l-text-2)]" />
                <span className="tnum mt-2 text-[22px] font-[600] tracking-[-0.03em]">{clock(left)}</span>
                <span className="mt-0.5 text-[11.5px] text-[var(--l-text-4)]">until 4:00 PM</span>
            </div>
        </div>
    );
}

const VIDEOS = [
    { label: 'Education', ok: true },
    { label: 'Gaming', ok: false },
    { label: 'Science', ok: true },
    { label: 'Shorts', ok: false },
    { label: 'Entertainment', ok: false },
    { label: 'Music', ok: false },
];

function YouTubeVisual() {
    const ref = useRef<HTMLDivElement>(null);
    const inView = useInView(ref, { once: true, amount: 0.5 });
    return (
        <div ref={ref} className="absolute inset-x-6 top-8 grid grid-cols-3 gap-x-3 gap-y-4">
            {VIDEOS.map((v, i) => (
                <div key={v.label}>
                    <div className="relative aspect-video overflow-hidden rounded-[8px]" style={{ boxShadow: 'inset 0 0 0 1px var(--l-border)' }}>
                        <motion.div
                            className="absolute inset-0"
                            style={{ background: 'linear-gradient(135deg, oklch(0.3 0.004 275), oklch(0.2 0.004 275))' }}
                            animate={!v.ok && inView ? { filter: 'blur(6px)', opacity: 0.35 } : { filter: 'blur(0px)', opacity: 1 }}
                            transition={{ duration: 0.7, ease: EASE, delay: 0.3 + i * 0.1 }}
                        />
                        <span className="absolute inset-0 flex items-center justify-center text-[var(--l-text-2)]">
                            {v.ok ? <Play size={14} fill="currentColor" /> : inView && <EyeOff size={14} className="text-[var(--l-text-3)]" />}
                        </span>
                    </div>
                    <div className="mt-1.5 truncate text-[11.5px]" style={{ color: v.ok ? 'var(--l-text-2)' : 'var(--l-text-4)' }}>
                        {v.label}
                    </div>
                </div>
            ))}
        </div>
    );
}

const TREES = [
    { x: 22, h: 54 },
    { x: 52, h: 78 },
    { x: 84, h: 44 },
    { x: 112, h: 92 },
    { x: 146, h: 64 },
    { x: 176, h: 104 },
    { x: 210, h: 58 },
    { x: 240, h: 84 },
    { x: 272, h: 48 },
    { x: 302, h: 70 },
];

function ForestVisual() {
    const ref = useRef<SVGSVGElement>(null);
    const inView = useInView(ref, { once: true, amount: 0.5 });
    return (
        <svg ref={ref} viewBox="0 0 324 170" className="absolute inset-x-6 bottom-2 w-[calc(100%-3rem)]">
            <line x1="0" y1="150" x2="324" y2="150" stroke="oklch(1 0 0 / 0.14)" />
            {TREES.map((t, i) => (
                <motion.g
                    key={t.x}
                    style={{ transformBox: 'fill-box', transformOrigin: '50% 100%' }}
                    initial={{ scaleY: 0, opacity: 0 }}
                    animate={inView ? { scaleY: 1, opacity: 1 } : {}}
                    transition={{ duration: 0.9, ease: EASE, delay: 0.1 + i * 0.07 }}
                >
                    <rect x={t.x - 1.5} y={150 - t.h * 0.3} width="3" height={t.h * 0.3} fill="oklch(1 0 0 / 0.3)" />
                    <path
                        d={`M${t.x} ${150 - t.h} L${t.x + t.h * 0.2} ${150 - t.h * 0.28} L${t.x - t.h * 0.2} ${150 - t.h * 0.28} Z`}
                        fill={i % 3 === 1 ? 'var(--l-text-1)' : i % 3 === 0 ? 'oklch(1 0 0 / 0.55)' : 'oklch(1 0 0 / 0.32)'}
                    />
                </motion.g>
            ))}
        </svg>
    );
}

const SIGNATURE =
    'M6 44 C 14 14, 26 10, 28 36 S 38 62, 46 32 S 58 8, 64 34 S 76 54, 86 28 C 92 14, 100 22, 101 34 C 102 46, 112 42, 122 26 S 142 30, 158 30';

function FutureSelfVisual() {
    const ref = useRef<HTMLDivElement>(null);
    const inView = useInView(ref, { once: true, amount: 0.5 });
    return (
        <div ref={ref} className="absolute inset-0 flex items-center justify-center">
            <div
                className="w-[78%] max-w-[300px] -rotate-2 rounded-[12px] px-5 py-4"
                style={{ background: 'var(--l-surface-2)', boxShadow: '0 0 0 1px var(--l-border-strong), 0 24px 50px -20px rgb(0 0 0 / 0.8)' }}
            >
                <div className="text-[11.5px] text-[var(--l-text-4)]">Dear future me,</div>
                <div className="mt-1.5 text-[15px] font-[560] leading-[1.35] tracking-[-0.01em] text-[var(--l-text-1)]">
                    No Reddit before 6 PM. You’ll thank me tonight.
                </div>
                <div className="mt-3 flex items-end justify-between">
                    <svg width="120" height="44" viewBox="0 0 164 64" fill="none">
                        <motion.path
                            d={SIGNATURE}
                            stroke="var(--l-text-1)"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            initial={{ pathLength: 0 }}
                            animate={inView ? { pathLength: 1 } : {}}
                            transition={{ duration: 1.6, ease: [0.45, 0, 0.2, 1], delay: 0.3 }}
                        />
                    </svg>
                    <span className="pb-1 text-[11px] text-[var(--l-text-4)]">Signed 8:12 AM</span>
                </div>
            </div>
        </div>
    );
}

const HABITS = [
    { name: 'Read 20 pages', days: [1, 1, 1, 0, 1, 1, 1], streak: '12 days' },
    { name: 'Walk outside', days: [1, 1, 1, 1, 1, 1, 0], streak: '6 days' },
    { name: 'No phone in bed', days: [0, 1, 1, 1, 1, 1, 1], streak: '5 days' },
];

function HabitsVisual() {
    const ref = useRef<HTMLDivElement>(null);
    const inView = useInView(ref, { once: true, amount: 0.5 });
    return (
        <div ref={ref} className="absolute inset-x-6 top-8 flex flex-col gap-3.5 sm:inset-x-8">
            <div className="flex justify-end gap-[10px] text-[10.5px] text-[var(--l-text-4)]">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                    <span key={i} className="w-[16px] text-center">
                        {d}
                    </span>
                ))}
            </div>
            {HABITS.map((h, row) => (
                <div key={h.name} className="flex items-center gap-[10px]">
                    <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] text-[var(--l-text-2)]">{h.name}</span>
                        <span className="tnum block text-[11.5px] text-[var(--l-text-4)]">{h.streak} streak</span>
                    </span>
                    {h.days.map((on, i) => (
                        <motion.span
                            key={i}
                            className="h-[16px] w-[16px] rounded-[5px]"
                            style={{ boxShadow: 'inset 0 0 0 1px var(--l-border-strong)' }}
                            animate={inView && on ? { backgroundColor: 'oklch(0.985 0.002 275)' } : { backgroundColor: 'oklch(1 0 0 / 0)' }}
                            transition={{ duration: 0.4, ease: EASE, delay: 0.2 + row * 0.12 + i * 0.05 }}
                        />
                    ))}
                </div>
            ))}
        </div>
    );
}

const FRIENDS = [
    { name: 'Maya', time: '14h 20m', share: 0.96 },
    { name: 'You', time: '12h 05m', share: 0.8, you: true },
    { name: 'Sam', time: '9h 40m', share: 0.64 },
];

function FriendsVisual() {
    const ref = useRef<HTMLDivElement>(null);
    const inView = useInView(ref, { once: true, amount: 0.5 });
    return (
        <div ref={ref} className="absolute inset-x-6 top-8 sm:inset-x-8">
            <div className="mb-4 flex items-center justify-between text-[12px] text-[var(--l-text-4)]">
                <span>Weekly challenge</span>
                <span>Goal: 15 hours</span>
            </div>
            <div className="flex flex-col gap-3.5">
                {FRIENDS.map((f, i) => (
                    <div key={f.name} className="flex items-center gap-3">
                        <span className="tnum w-3 text-[12px] text-[var(--l-text-4)]">{i + 1}</span>
                        <span
                            className="flex h-[28px] w-[28px] items-center justify-center rounded-full text-[12px] font-[600]"
                            style={{
                                background: f.you ? 'var(--l-text-1)' : 'var(--l-surface-2)',
                                color: f.you ? 'var(--l-on-light)' : 'var(--l-text-2)',
                                boxShadow: f.you ? 'none' : 'inset 0 0 0 1px var(--l-border-strong)',
                            }}
                        >
                            {f.name[0]}
                        </span>
                        <span className="w-[42px] text-[13.5px]" style={{ color: f.you ? 'var(--l-text-1)' : 'var(--l-text-2)' }}>
                            {f.name}
                        </span>
                        <span className="h-[6px] flex-1 overflow-hidden rounded-full" style={{ background: 'oklch(1 0 0 / 0.06)' }}>
                            <motion.span
                                className="block h-full rounded-full"
                                style={{ background: f.you ? 'var(--l-text-1)' : 'oklch(1 0 0 / 0.35)' }}
                                initial={{ width: 0 }}
                                animate={inView ? { width: `${f.share * 100}%` } : {}}
                                transition={{ duration: 1, ease: EASE, delay: 0.2 + i * 0.1 }}
                            />
                        </span>
                        <span className="tnum w-[58px] text-right text-[12.5px] text-[var(--l-text-3)]">{f.time}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ---------------- section ---------------- */

export function Bento() {
    return (
        <section id="features" className="mx-auto max-w-[1200px] px-5 py-28 sm:px-8 sm:py-36">
            <SectionHeader eyebrow="Features" title="Everything else, built in." lead="The small things that make focus stick." />

            <motion.div
                className="mt-16 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-6"
                variants={stagger(0.07)}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, amount: 0.1 }}
            >
                <Tile
                    className="md:col-span-2 lg:col-span-3"
                    visual={<PaletteVisual />}
                    title="Everything is one shortcut away"
                    body="Start a session, block a site, or add a task from any page, without opening the dashboard."
                    footer={
                        <button
                            type="button"
                            onClick={openPaletteDemo}
                            className="fzl-link mt-4 inline-flex w-fit items-center gap-2 rounded-full text-[13.5px] font-[520]"
                        >
                            Try it here: press <span className="fzl-kbd">{PALETTE_SHORTCUT_LABEL}</span>
                        </button>
                    }
                />
                <Tile
                    className="lg:col-span-3"
                    visual={<NuclearVisual />}
                    title="Nuclear Lockdown"
                    body="Lock your blocklist for a set time. No easy override, no talking yourself out of it."
                />
                <Tile
                    className="lg:col-span-2"
                    visual={<YouTubeVisual />}
                    title="Smart YouTube"
                    body="Learning videos still play. Shorts and the entertainment spiral don’t."
                />
                <Tile
                    className="lg:col-span-2"
                    visual={<ForestVisual />}
                    title="Grow a forest"
                    body="Every focus session grows your forest, one tree at a time."
                />
                <Tile
                    className="lg:col-span-2"
                    visual={<FutureSelfVisual />}
                    title="Future Self contracts"
                    body="Make a promise in the morning. FocuzNow holds you to it all day."
                    pro
                />
                <Tile
                    className="lg:col-span-3"
                    visual={<HabitsVisual />}
                    title="Habits and streaks"
                    body="Check in once a day and watch the streak build."
                />
                <Tile
                    className="lg:col-span-3"
                    visual={<FriendsVisual />}
                    title="Focus with friends"
                    body="Add friends, join a challenge, and see who focused most this week."
                />
            </motion.div>
        </section>
    );
}
