/**
 * Context-aware greeting for the AI Coach empty state. Picks the most specific
 * line that applies (special dates, lockdowns, odd hours, streaks, today's
 * activity, weekday flavour) and falls back to a time-of-day hello. Pure so it
 * can be unit-tested; pass `rand` for deterministic picks.
 */

export type GreetingContext = {
    now: Date;
    name: string;
    streak: number;
    bestStreak: number;
    nuclearActive: boolean;
    pomodorosToday: number;
    planDone: number;
    planTotal: number;
    screenMsToday: number;
    topSite?: { domain: string; ms: number };
    chatCount: number;
};

export type Greeting = { title: string; sub: string; id: string };

type Candidate = Greeting & { tier: number };

const HOUR = 3_600_000;

export function formatShortDuration(ms: number): string {
    const totalMin = Math.round(ms / 60_000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h && m) return `${h}h ${m}m`;
    if (h) return `${h}h`;
    return `${m}m`;
}

/** Display name for a domain ("www.youtube.com" → "YouTube"). */
export function prettyDomain(domain: string): string {
    const d = domain.replace(/^www\./, '');
    const base = d.split('.')[0] ?? d;
    const known: Record<string, string> = {
        youtube: 'YouTube', reddit: 'Reddit', instagram: 'Instagram', tiktok: 'TikTok',
        twitter: 'Twitter', x: 'X', netflix: 'Netflix', twitch: 'Twitch', facebook: 'Facebook',
        discord: 'Discord', linkedin: 'LinkedIn', pinterest: 'Pinterest', github: 'GitHub',
    };
    return known[base] ?? base.charAt(0).toUpperCase() + base.slice(1);
}

/** Work tools and our own pages never count as a "distraction". */
const NOT_DISTRACTING =
    /(^|\.)(focuznow\.com|localhost|newtab|extensions|github\.com|gitlab\.com|stackoverflow\.com|notion\.so|figma\.com|linear\.app|docs\.google\.com|drive\.google\.com|mail\.google\.com|calendar\.google\.com|canvas\.[a-z.]+|instructure\.com|overleaf\.com|vercel\.com|supabase\.com|chatgpt\.com|claude\.ai)$/;

export function isLikelyDistraction(domain: string): boolean {
    return !NOT_DISTRACTING.test(domain.replace(/^www\./, ''));
}

/** Biggest likely-distraction site in a domain→ms map. */
export function topDistraction(sites: Record<string, number> | undefined): { domain: string; ms: number } | undefined {
    const [domain, ms] =
        Object.entries(sites ?? {})
            .filter(([d, v]) => v > 0 && isLikelyDistraction(d))
            .sort((a, b) => b[1] - a[1])[0] ?? [];
    return domain ? { domain, ms: ms as number } : undefined;
}

export function greetingCandidates(ctx: GreetingContext): Candidate[] {
    const { now, name, streak, bestStreak } = ctx;
    const h = now.getHours() + now.getMinutes() / 60;
    const day = now.getDay();
    const month = now.getMonth() + 1;
    const date = now.getDate();
    const out: Candidate[] = [];
    const add = (tier: number, id: string, title: string, sub: string) => out.push({ tier, id, title, sub });

    // Tier 6 — special dates
    if (month === 1 && date === 1) add(6, 'new-year', `New year, new streak, ${name}?`, 'Day one is the easiest one to win.');
    if (month === 2 && date === 14) add(6, 'valentines', `Showing your goals some love, ${name}?`, 'What are we working on today?');
    if (month === 3 && date === 14) add(6, 'pi-day', `Happy π day, ${name}.`, 'Irrational amounts of focus, coming right up.');
    if (month === 4 && date === 1) add(6, 'april-fools', `No pranks here, ${name}.`, 'Just focus. Probably.');
    if (month === 10 && date === 31) add(6, 'halloween', `Boo, ${name}. Scared of your to-do list?`, "Let's make it less spooky.");
    if (month === 12 && (date === 24 || date === 25)) add(6, 'holidays', `Happy holidays, ${name}.`, 'Taking it easy, or sneaking in some work?');
    if (month === 12 && date === 31) add(6, 'nye', `Last day of the year, ${name}.`, "Let's close it out strong.");
    if (day === 5 && date === 13) add(6, 'friday-13', `Friday the 13th, ${name}.`, 'Good thing focus isn’t about luck.');

    // Tier 5 — active lockdown
    if (ctx.nuclearActive) add(5, 'nuclear', `Locked in, ${name}.`, 'Nuclear mode is on. Let’s make it count.');

    // Tier 4 — odd hours
    if (h < 4) {
        add(4, 'late-1', `Up late, ${name}?`, 'Let’s make this quick so you can get some sleep.');
        add(4, 'late-2', `Burning the midnight oil, ${name}?`, 'What’s keeping you up?');
        add(4, 'late-3', `Still up, ${name}?`, 'Tomorrow-you says hi.');
    } else if (h < 6.5) {
        add(4, 'early-1', 'Someone’s an early bird!', `The quiet hours are the best ones, ${name}.`);
        add(4, 'early-2', `Up before the sun, ${name}?`, 'Perfect time for deep work.');
    }

    // Tier 3 — streaks and wins
    if (streak >= 3 && streak >= bestStreak && bestStreak > 0) {
        add(3, 'pb', `New personal best, ${name}.`, `${streak} days in a row. Keep it rolling.`);
    } else if ([7, 14, 30, 50, 100, 365].includes(streak)) {
        add(3, 'milestone', `${streak}-day streak, ${name}.`, 'That’s a real habit now.');
    } else if (streak >= 3) {
        add(2, 'streak', `${streak} days strong, ${name}.`, 'What’s on for today?');
    } else if (streak === 0 && bestStreak >= 5) {
        add(2, 'fresh-start', `Fresh start, ${name}.`, `Your best was ${bestStreak} days. Day one starts now.`);
    }
    if (ctx.pomodorosToday >= 4) add(3, 'pomo', `${ctx.pomodorosToday} Pomodoros today? On fire, ${name}.`, 'Want to plan the rest of the day?');
    if (ctx.planTotal > 0 && ctx.planDone === ctx.planTotal) add(3, 'plan-clear', `Plan cleared. Nice work, ${name}.`, 'Bonus round, or call it a day?');

    // Tier 2 — nudges from today's activity
    if (ctx.topSite && ctx.topSite.ms >= HOUR) {
        add(2, 'top-site', `${prettyDomain(ctx.topSite.domain)} again, ${name}?`, `${formatShortDuration(ctx.topSite.ms)} today. Want a hand with that?`);
    }
    if (ctx.screenMsToday >= 5 * HOUR) add(2, 'screens', `Long day on screens, ${name}?`, 'Let’s make the next hour count.');

    // Tier 1 — first meeting, weekday flavour
    if (ctx.chatCount === 0) add(1, 'first', `Nice to meet you, ${name}.`, 'I’m FocuzAI, your focus coach. Ask me anything.');
    if (day === 1 && h < 12) add(1, 'monday', `New week, clean slate, ${name}.`, 'What’s the one thing that matters this week?');
    if (day === 5 && h >= 12) add(1, 'friday', `Almost the weekend, ${name}.`, 'Let’s finish the week strong.');
    if (day === 0 && h >= 17) add(1, 'sunday-reset', `Sunday reset, ${name}?`, 'Plan the week before it plans you.');
    if ((day === 6 || (day === 0 && h < 17)) && h >= 6.5) add(1, 'weekend', `Weekend mode, ${name}?`, 'Light work or a real push?');

    // Tier 0 — rotating hellos; a different one is picked each visit
    const tod = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    add(0, 'tod', `${tod}, ${name}`, 'What should we work on?');
    add(0, 'hey', `Hey, ${name}.`, 'What’s on your mind?');
    add(0, 'back', `Welcome back, ${name}.`, 'Ready when you are.');
    add(0, 'plan', `What’s the plan, ${name}?`, 'Big push or small wins?');
    if (h < 12) add(0, 'fresh', `Fresh page, ${name}.`, 'What’s first on it?');
    if (h >= 17) add(0, 'wind', `Wrapping up, ${name}?`, 'Or one more push?');
    return out;
}

const RARE: Greeting[] = [
    { id: 'rare-1', title: 'Plot twist: we actually do the task.', sub: 'I’ll keep you honest.' },
    { id: 'rare-2', title: 'Ready when you are, {name}.', sub: 'What’s first?' },
    { id: 'rare-3', title: 'One thing at a time, {name}.', sub: 'What’s the one thing?' },
    { id: 'rare-4', title: 'Future you is already grateful, {name}.', sub: 'Let’s give them a reason.' },
    { id: 'rare-5', title: 'Ah, my favourite human.', sub: 'What are we focusing on, {name}?' },
    { id: 'rare-6', title: 'Less scrolling, more doing, {name}.', sub: 'Deal?' },
];

/** Highest tier wins; ties are broken randomly. Plain greetings sometimes become a rare line. */
export function pickGreeting(ctx: GreetingContext, rand: () => number = Math.random): Greeting {
    const cands = greetingCandidates(ctx);
    const top = Math.max(...cands.map((c) => c.tier));
    if (top <= 1 && rand() < 0.08) {
        const r = RARE[Math.floor(rand() * RARE.length)];
        return { ...r, title: r.title.replace('{name}', ctx.name) };
    }
    const pool = cands.filter((c) => c.tier === top);
    const { tier: _tier, ...g } = pool[Math.floor(rand() * pool.length)];
    return g;
}
