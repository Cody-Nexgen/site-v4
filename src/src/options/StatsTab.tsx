import { useMemo, useState, type ReactNode } from 'react';
import {
    ArrowDownRight,
    ArrowUpRight,
    BarChart3,
    Dices,
    Gamepad2,
    Globe,
    Heart,
    Minus,
    Newspaper,
    ShoppingBag,
    Tv,
    Users,
    X,
    type LucideIcon,
} from 'lucide-react';
import { useAuthStore } from '../lib/store';
import { isDistractionDomain } from '../lib/focusScore';
import {
    SAFE_BLOCK_CATEGORIES,
    SAFE_BLOCK_CATEGORY_KEYS,
    SAFE_BLOCK_CATEGORY_LABELS,
    type SafeBlockCategoryKey,
} from '../lib/blockCategories';
import { GlassCard } from './OptionsApp';
import { SegmentedControl } from '../components/fz/SegmentedControl';
import { EmptyState } from '../components/fz/EmptyState';
import { IconButton } from '../components/fz/IconButton';

type Day = { date: string; total: number; sites: Record<string, number>; focusMs?: number };
type Range = '7' | '30' | '90';
type Metric = 'screen' | 'focus';

/* ── helpers ────────────────────────────────────────────────────────── */

function fmt(ms: number): string {
    const m = Math.round(ms / 60000);
    if (m <= 0) return ms > 0 ? '<1m' : '0m';
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    const r = m % 60;
    // Over a day, minutes are noise and just make the column wrap.
    if (h >= 24) return `${Math.round(m / 60)}h`;
    return r ? `${h}h ${r}m` : `${h}h`;
}

const CATEGORY_OF = (() => {
    const map = new Map<string, SafeBlockCategoryKey>();
    for (const key of SAFE_BLOCK_CATEGORY_KEYS) {
        for (const d of SAFE_BLOCK_CATEGORIES[key]) if (!d.includes('/') && !map.has(d)) map.set(d, key);
    }
    return map;
})();

function categoryOf(domain: string): SafeBlockCategoryKey | null {
    let d = domain.toLowerCase().replace(/^www\./, '');
    while (d.includes('.')) {
        const hit = CATEGORY_OF.get(d);
        if (hit) return hit;
        d = d.slice(d.indexOf('.') + 1);
    }
    return null;
}

const CATEGORY_ICONS: Record<SafeBlockCategoryKey | 'other', LucideIcon> = {
    social: Users,
    gambling: Dices,
    news: Newspaper,
    shopping: ShoppingBag,
    streaming: Tv,
    gaming: Gamepad2,
    dating: Heart,
    other: Globe,
};

function distractingMs(day: Day) {
    let ms = 0;
    for (const [domain, t] of Object.entries(day.sites ?? {})) if (isDistractionDomain(domain)) ms += t;
    return Math.min(ms, day.total || ms);
}

function sumSites(days: Day[]) {
    const out = new Map<string, number>();
    for (const day of days) for (const [d, t] of Object.entries(day.sites ?? {})) if (t > 0) out.set(d, (out.get(d) ?? 0) + t);
    return [...out.entries()].sort((a, b) => b[1] - a[1]);
}

/** Chart box height and the strip under it for day labels (px). */
const CHART_H = 300;
const LABEL_H = 24;
const PLOT_H = CHART_H - LABEL_H;

const shortDate = (ds: string, opts: Intl.DateTimeFormatOptions) => new Date(ds).toLocaleDateString('en-US', opts);

/** Share shades, darkest first — monochrome like the rest of the dashboard. */
const SHADES = [95, 72, 54, 40, 30, 22, 16, 11];
const shade = (i: number) => `color-mix(in oklab, var(--fz-text-1) ${SHADES[Math.min(i, SHADES.length - 1)]}%, transparent)`;

/* ── small pieces ───────────────────────────────────────────────────── */

function CardHeader({ title, meta, action }: { title: string; meta?: ReactNode; action?: ReactNode }) {
    return (
        <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-4">
            <div className="min-w-0">
                <h3 className="text-[14px] font-semibold text-[var(--fz-text-1)]">{title}</h3>
                {meta && <p className="text-meta mt-0.5">{meta}</p>}
            </div>
            {action}
        </div>
    );
}

function Favicon({ domain, size = 16 }: { domain: string; size?: number }) {
    return (
        <img
            src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
            alt=""
            className="shrink-0 rounded-[4px]"
            style={{ width: size, height: size }}
            loading="lazy"
        />
    );
}

/** Stat tile with a change chip; `goodWhen` decides whether up is green-worthy. */
function StatTile({
    label,
    value,
    caption,
    change,
    goodWhen,
    unit = '%',
}: {
    label: string;
    value: ReactNode;
    caption?: ReactNode;
    change?: number | null;
    goodWhen?: 'up' | 'down';
    unit?: string;
}) {
    const hasChange = typeof change === 'number' && Number.isFinite(change);
    const rounded = hasChange ? Math.round(change!) : 0;
    const good = hasChange && rounded !== 0 && (goodWhen === 'up' ? rounded > 0 : rounded < 0);
    const Icon = !hasChange || rounded === 0 ? Minus : rounded > 0 ? ArrowUpRight : ArrowDownRight;
    return (
        <GlassCard className="p-4">
            <div className="flex items-start justify-between gap-2">
                <p className="text-label text-[var(--fz-text-3)]">{label}</p>
                {hasChange && (
                    <span
                        className={`flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-medium tabular-nums ${
                            rounded === 0
                                ? 'bg-[var(--fz-bg-hover)] text-[var(--fz-text-3)]'
                                : good
                                  ? 'bg-emerald-500/12 text-emerald-500'
                                  : 'bg-[var(--fz-danger-soft)] text-[var(--fz-danger)]'
                        }`}
                        title="Compared with the previous period"
                    >
                        <Icon size={11} strokeWidth={2.25} />
                        {rounded > 0 ? '+' : ''}
                        {rounded}
                        {unit}
                    </span>
                )}
            </div>
            <div className="mt-2 flex min-w-0 items-center gap-2 text-[24px] font-semibold leading-8 tracking-[-0.02em] tabular-nums text-[var(--fz-text-1)]">
                {value}
            </div>
            {caption && <p className="text-meta mt-1 truncate">{caption}</p>}
        </GlassCard>
    );
}

/* ── page ───────────────────────────────────────────────────────────── */

export default function StatsTab() {
    const { last7DaysStats } = useAuthStore();
    const all: Day[] = useMemo(() => (last7DaysStats || []) as Day[], [last7DaysStats]);
    const [range, setRange] = useState<Range>('7');
    const [metric, setMetric] = useState<Metric>('screen');
    const [selected, setSelected] = useState<string | null>(null);
    const [hover, setHover] = useState<number | null>(null);

    const n = Number(range);
    const days = all.slice(-n);
    const prev = all.length >= n * 2 ? all.slice(-n * 2, -n) : [];
    const todayStr = new Date().toDateString();

    const totals = (list: Day[]) => {
        const active = list.filter((d) => d.total > 0);
        const screen = list.reduce((s, d) => s + (d.total || 0), 0);
        const distract = list.reduce((s, d) => s + distractingMs(d), 0);
        const focus = list.reduce((s, d) => s + (d.focusMs || 0), 0);
        return {
            active: active.length,
            screen,
            avg: active.length ? screen / active.length : 0,
            distractShare: screen ? (distract / screen) * 100 : 0,
            focus,
        };
    };
    const cur = totals(days);
    const before = totals(prev);
    const pct = (a: number, b: number) => (b > 0 ? ((a - b) / b) * 100 : null);

    const selectedDay = selected ? all.find((d) => d.date === selected) : undefined;
    const scopeDays = selectedDay ? [selectedDay] : days;
    const sites = sumSites(scopeDays);
    const scopeTotal = Math.max(
        scopeDays.reduce((s, d) => s + (d.total || 0), 0),
        sites.reduce((s, [, t]) => s + t, 0),
        1,
    );
    const topSites = sites.slice(0, 8);
    const otherMs = Math.max(0, scopeTotal - topSites.reduce((s, [, t]) => s + t, 0));
    const topRange = sumSites(days)[0];

    const categories = (() => {
        const acc = new Map<SafeBlockCategoryKey | 'other', number>();
        for (const [domain, t] of sites) {
            const c = categoryOf(domain) ?? 'other';
            acc.set(c, (acc.get(c) ?? 0) + t);
        }
        // Named categories by time, "Other" always last.
        return [...acc.entries()].sort((a, b) => (a[0] === 'other' ? 1 : b[0] === 'other' ? -1 : b[1] - a[1]));
    })();
    const catTotal = Math.max(1, categories.reduce((s, [, t]) => s + t, 0));

    const hasData = all.some((d) => d.total > 0 || (d.focusMs ?? 0) > 0);

    /* chart */
    const value = (d: Day) => (metric === 'screen' ? d.total || 0 : d.focusMs || 0);
    const max = Math.max(...days.map(value), 1);
    const niceStep = (() => {
        const hour = 3600000;
        const steps = [5, 10, 15, 30, 60, 120, 180, 240, 360].map((m) => m * 60000);
        return steps.find((s) => max / s <= 4) ?? 6 * hour;
    })();
    const top = Math.max(niceStep, Math.ceil((max * 1.05) / niceStep) * niceStep);
    const ticks = Array.from({ length: Math.round(top / niceStep) + 1 }, (_, i) => i * niceStep);
    const avgVal = metric === 'screen' ? cur.avg : days.length ? cur.focus / Math.max(1, days.filter((d) => (d.focusMs ?? 0) > 0).length) : 0;
    const xLabels = (() => {
        if (n === 7) return days.map((d) => shortDate(d.date, { weekday: 'short' }));
        if (n === 30) return days.map((d, i) => (i % 5 === 0 ? shortDate(d.date, { month: 'short', day: 'numeric' }) : ''));
        // 90 days: month names where months start, never crowded together.
        const out = days.map(() => '');
        let lastAt = -99;
        days.forEach((d, i) => {
            const monthStart = new Date(d.date).getDate() === 1;
            const nextStartSoon = days.slice(i + 1, i + 10).some((x) => new Date(x.date).getDate() === 1);
            if ((monthStart || (i === 0 && !nextStartSoon)) && i - lastAt >= 10) {
                out[i] = shortDate(d.date, { month: 'short' });
                lastAt = i;
            }
        });
        return out;
    })();
    const hovered = hover != null ? days[hover] : undefined;

    /* heatmap: last 90 days, weeks as columns */
    const heat = (() => {
        const last = all.slice(-91);
        if (!last.length) return { cols: [] as (Day | null)[][], labels: {} as Record<number, string>, max: 1 };
        const lead = new Date(last[0].date).getDay();
        const cells: (Day | null)[] = [...Array.from({ length: lead }, () => null), ...last];
        const cols: (Day | null)[][] = [];
        for (let i = 0; i < cells.length; i += 7) cols.push(cells.slice(i, i + 7));
        // A month label where a month starts, but never two within 3 columns.
        const labels: Record<number, string> = {};
        let lastAt = -9;
        cols.forEach((col, ci) => {
            const first = col.find(Boolean);
            if (!first) return;
            const starts = ci === 0 || col.some((d) => d && new Date(d.date).getDate() === 1);
            if (starts && ci - lastAt >= 3) {
                const d = col.find((x) => x && new Date(x.date).getDate() === 1) ?? first;
                labels[ci] = shortDate(d!.date, { month: 'short' });
                lastAt = ci;
            }
        });
        return { cols, labels, max: Math.max(...last.map(value), 1) };
    })();
    const insights = (() => {
        const active = all.slice(-91).filter((d) => value(d) > 0);
        if (!active.length) return null;
        const busiest = active.reduce((a, b) => (value(b) > value(a) ? b : a));
        const lightest = active.reduce((a, b) => (value(b) < value(a) ? b : a));
        const byWeekday = Array.from({ length: 7 }, () => ({ sum: 0, n: 0 }));
        for (const d of active) {
            const w = new Date(d.date).getDay();
            byWeekday[w].sum += value(d);
            byWeekday[w].n += 1;
        }
        const avgs = byWeekday.map((w) => (w.n ? w.sum / w.n : 0));
        const topWeekday = avgs.indexOf(Math.max(...avgs));
        const names = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];
        return [
            { label: metric === 'screen' ? 'Busiest day' : 'Most focused day', value: fmt(value(busiest)), sub: shortDate(busiest.date, { weekday: 'short', month: 'short', day: 'numeric' }), date: busiest.date },
            { label: metric === 'screen' ? 'Lightest day' : 'Least focused day', value: fmt(value(lightest)), sub: shortDate(lightest.date, { weekday: 'short', month: 'short', day: 'numeric' }), date: lightest.date },
            { label: metric === 'screen' ? 'Heaviest weekday' : 'Best weekday', value: names[topWeekday], sub: `${fmt(avgs[topWeekday])} on average`, date: null as string | null },
        ];
    })();
    const heatLevel = (v: number) => (v <= 0 ? 0 : Math.min(4, Math.ceil((v / heat.max) * 4)));
    const HEAT = ['var(--fz-bg-hover)', ...[22, 42, 66, 92].map((p) => `color-mix(in oklab, var(--fz-text-1) ${p}%, transparent)`)];

    if (!hasData) {
        return (
            <GlassCard>
                <EmptyState
                    className="py-20"
                    icon={<BarChart3 size={15} />}
                    title="No activity yet"
                    description="Keep FocuzNow running while you browse — your screen time, top sites and focus time will build up here day by day."
                />
            </GlassCard>
        );
    }

    return (
        <div className="space-y-4 animate-fade-in-up">
            {/* Range */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <SegmentedControl
                    idPrefix="stats-range"
                    value={range}
                    onChange={(v) => {
                        setRange(v);
                        setHover(null);
                    }}
                    options={[
                        { value: '7', label: '7\u00a0days' },
                        { value: '30', label: '30\u00a0days' },
                        { value: '90', label: '90\u00a0days' },
                    ]}
                />
                <p className="text-meta">
                    {shortDate(days[0].date, { month: 'short', day: 'numeric' })} – {shortDate(days[days.length - 1].date, { month: 'short', day: 'numeric' })}
                    {prev.length ? ` · compared with the ${n} days before` : ''}
                </p>
            </div>

            {/* Stat tiles */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatTile
                    label="Daily screen time"
                    value={fmt(cur.avg)}
                    caption={`Average of ${cur.active} active ${cur.active === 1 ? 'day' : 'days'}`}
                    change={prev.length ? pct(cur.avg, before.avg) : null}
                    goodWhen="down"
                />
                <StatTile
                    label="Focus time"
                    value={fmt(cur.focus)}
                    caption="From Pomodoro sessions"
                    change={prev.length ? pct(cur.focus, before.focus) : null}
                    goodWhen="up"
                />
                <StatTile
                    label="Distracting"
                    value={`${Math.round(cur.distractShare)}%`}
                    caption="Share of screen time"
                    change={prev.length ? cur.distractShare - before.distractShare : null}
                    goodWhen="down"
                    unit=" pts"
                />
                <StatTile
                    label="Top site"
                    value={
                        topRange ? (
                            <>
                                <Favicon domain={topRange[0]} size={20} />
                                <span className="truncate text-[19px]">{topRange[0].replace(/^www\./, '')}</span>
                            </>
                        ) : (
                            '—'
                        )
                    }
                    caption={topRange ? `${fmt(topRange[1])} in ${n} days` : 'Nothing tracked yet'}
                />
            </div>

            {/* Chart + breakdown */}
            <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
                <GlassCard>
                    <CardHeader
                        title={metric === 'screen' ? 'Screen time' : 'Focus time'}
                        meta={
                            metric === 'screen'
                                ? `${fmt(cur.screen)} total · ${fmt(cur.avg)} a day`
                                : `${fmt(cur.focus)} total`
                        }
                        action={
                            <SegmentedControl
                                size="sm"
                                idPrefix="stats-metric"
                                value={metric}
                                onChange={setMetric}
                                options={[
                                    { value: 'screen', label: 'Screen' },
                                    { value: 'focus', label: 'Focus' },
                                ]}
                            />
                        }
                    />
                    <div className="px-5 pb-4">
                        <div className="relative mt-3 flex gap-3" style={{ height: CHART_H }}>
                            {/* y axis */}
                            <div className="relative w-10 shrink-0 text-right">
                                {ticks.map((t) => (
                                    <span
                                        key={t}
                                        className="absolute right-0 -translate-y-1/2 text-[10.5px] tabular-nums text-[var(--fz-text-4)]"
                                        style={{ bottom: (t / top) * PLOT_H + LABEL_H }}
                                    >
                                        {fmt(t)}
                                    </span>
                                ))}
                            </div>
                            {/* plot */}
                            <div className="relative flex-1">
                                <div className="absolute inset-x-0 bottom-6 top-0">
                                    {ticks.map((t) => (
                                        <div
                                            key={t}
                                            className="absolute inset-x-0 border-t border-[var(--fz-border)]"
                                            style={{ bottom: `${(t / top) * 100}%`, borderStyle: t === 0 ? 'solid' : 'dashed' }}
                                        />
                                    ))}
                                    {avgVal > 0 && (
                                        <div
                                            className="pointer-events-none absolute inset-x-0 z-[2] border-t border-dashed border-[var(--fz-text-3)]"
                                            style={{ bottom: `${(avgVal / top) * 100}%` }}
                                        >
                                            <span className="absolute -top-[18px] right-0 rounded bg-[var(--fz-bg-raised)] px-1 text-[10.5px] font-medium tabular-nums text-[var(--fz-text-3)]">
                                                avg {fmt(avgVal)}
                                            </span>
                                        </div>
                                    )}
                                    <div className={`absolute inset-0 flex items-end ${n === 7 ? 'gap-4 px-2' : n === 30 ? 'gap-1.5' : 'gap-[3px]'}`}>
                                        {days.map((d, i) => {
                                            const v = value(d);
                                            const h = (v / top) * 100;
                                            const dis = metric === 'screen' ? distractingMs(d) : 0;
                                            const disH = v > 0 ? (dis / v) * 100 : 0;
                                            const isSel = d.date === selected;
                                            const dim = selected && !isSel;
                                            return (
                                                <button
                                                    key={d.date}
                                                    type="button"
                                                    onClick={() => setSelected(isSel ? null : d.date)}
                                                    onMouseEnter={() => setHover(i)}
                                                    onMouseLeave={() => setHover(null)}
                                                    onFocus={() => setHover(i)}
                                                    onBlur={() => setHover(null)}
                                                    aria-pressed={isSel}
                                                    aria-label={`${shortDate(d.date, { weekday: 'long', month: 'short', day: 'numeric' })}: ${fmt(v)}`}
                                                    className="group/bar relative flex h-full min-w-0 flex-1 items-end rounded-t-[5px] outline-none"
                                                >
                                                    <span
                                                        className={`absolute inset-x-0 bottom-0 top-0 rounded-md transition-colors ${
                                                            hover === i || isSel ? 'bg-[var(--fz-bg-hover)]' : ''
                                                        }`}
                                                    />
                                                    <span
                                                        className={`relative flex w-full flex-col-reverse overflow-hidden rounded-t-[5px] transition-[height,opacity] duration-500 ease-out ${
                                                            dim ? 'opacity-35' : ''
                                                        }`}
                                                        style={{ height: `${Math.max(v > 0 ? 1.5 : 0, h)}%` }}
                                                    >
                                                        {metric === 'screen' ? (
                                                            <>
                                                                <span className="w-full bg-[var(--fz-text-1)]" style={{ height: `${disH}%` }} />
                                                                <span
                                                                    className="w-full flex-1"
                                                                    style={{ background: 'color-mix(in oklab, var(--fz-text-1) 30%, transparent)' }}
                                                                />
                                                            </>
                                                        ) : (
                                                            <span className="h-full w-full bg-[var(--fz-text-1)]" />
                                                        )}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                {/* x labels */}
                                <div
                                    className={`absolute inset-x-0 bottom-0 flex h-5 ${n === 7 ? 'gap-4 px-2' : n === 30 ? 'gap-1.5' : 'gap-[3px]'}`}
                                >
                                    {days.map((d, i) => (
                                        <span
                                            key={d.date}
                                            className={`min-w-0 flex-1 overflow-visible whitespace-nowrap text-center text-[11px] ${
                                                d.date === todayStr || d.date === selected
                                                    ? 'font-semibold text-[var(--fz-text-1)]'
                                                    : 'text-[var(--fz-text-4)]'
                                            }`}
                                        >
                                            {xLabels[i]}
                                        </span>
                                    ))}
                                </div>
                                {/* tooltip */}
                                {hovered && (
                                    <div
                                        className="pointer-events-none absolute z-10 w-[190px] -translate-x-1/2 rounded-lg border border-[var(--fz-border)] bg-[var(--fz-bg-overlay)] px-3 py-2.5 shadow-[var(--fz-shadow-overlay)]"
                                        style={{
                                            left: `clamp(95px, ${((hover! + 0.5) / days.length) * 100}%, calc(100% - 95px))`,
                                            bottom: Math.min(PLOT_H - 60, (value(hovered) / top) * PLOT_H) + LABEL_H + 10,
                                        }}
                                    >
                                        <p className="text-[12px] font-medium text-[var(--fz-text-1)]">
                                            {shortDate(hovered.date, { weekday: 'long', month: 'short', day: 'numeric' })}
                                        </p>
                                        <div className="mt-1.5 space-y-0.5 text-[12px] tabular-nums">
                                            <p className="flex justify-between text-[var(--fz-text-2)]">
                                                <span>Screen time</span>
                                                <span>{fmt(hovered.total)}</span>
                                            </p>
                                            <p className="flex justify-between text-[var(--fz-text-3)]">
                                                <span>Distracting</span>
                                                <span>{fmt(distractingMs(hovered))}</span>
                                            </p>
                                            <p className="flex justify-between text-[var(--fz-text-3)]">
                                                <span>Focus</span>
                                                <span>{fmt(hovered.focusMs || 0)}</span>
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        {metric === 'screen' && (
                            <div className="mt-3 flex items-center gap-4 pl-[52px] text-meta">
                                <span className="flex items-center gap-1.5">
                                    <span className="size-2.5 rounded-sm bg-[var(--fz-text-1)]" />
                                    Distracting
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <span className="size-2.5 rounded-sm" style={{ background: 'color-mix(in oklab, var(--fz-text-1) 30%, transparent)' }} />
                                    Everything else
                                </span>
                                <span className="ml-auto">Click a day to see its sites</span>
                            </div>
                        )}
                    </div>
                </GlassCard>

                {/* Sites */}
                <GlassCard>
                    <CardHeader
                        title={selectedDay ? shortDate(selectedDay.date, { weekday: 'long', month: 'short', day: 'numeric' }) : 'Top sites'}
                        meta={`${fmt(scopeTotal)} ${selectedDay ? 'that day' : `over ${n} days`}`}
                        action={
                            selectedDay ? (
                                <IconButton icon={<X size={14} />} tooltip={`Back to ${n} days`} onClick={() => setSelected(null)} />
                            ) : undefined
                        }
                    />
                    {topSites.length === 0 ? (
                        <p className="px-5 pb-6 text-[13px] text-[var(--fz-text-3)]">Nothing tracked for this day.</p>
                    ) : (
                        <div className="px-5 pb-4">
                            {/* share bar */}
                            <div className="mb-3 flex h-2 overflow-hidden rounded-full bg-[var(--fz-bg-active)]">
                                {topSites.map(([domain, t], i) => (
                                    <span key={domain} style={{ width: `${(t / scopeTotal) * 100}%`, background: shade(i) }} title={domain} />
                                ))}
                            </div>
                            <div className="-mx-2">
                                {topSites.map(([domain, t], i) => {
                                    const c = categoryOf(domain);
                                    return (
                                        <div key={domain} className="flex h-10 items-center gap-2.5 rounded-lg px-2 transition-colors hover:bg-[var(--fz-bg-hover)]">
                                            <span className="size-2 shrink-0 rounded-full" style={{ background: shade(i) }} />
                                            <Favicon domain={domain} />
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-[13px] text-[var(--fz-text-1)]">{domain.replace(/^www\./, '')}</span>
                                            </span>
                                            {c && (
                                                <span className="hidden shrink-0 rounded-md bg-[var(--fz-bg-hover)] px-1.5 py-px text-[10.5px] text-[var(--fz-text-3)] sm:inline">
                                                    {SAFE_BLOCK_CATEGORY_LABELS[c]}
                                                </span>
                                            )}
                                            <span className="w-16 shrink-0 whitespace-nowrap text-right text-[12.5px] tabular-nums text-[var(--fz-text-2)]">{fmt(t)}</span>
                                            <span className="w-9 shrink-0 text-right text-[12px] tabular-nums text-[var(--fz-text-4)]">
                                                {Math.round((t / scopeTotal) * 100)}%
                                            </span>
                                        </div>
                                    );
                                })}
                                {otherMs > 60000 && (
                                    <div className="flex h-10 items-center gap-2.5 px-2 text-[13px] text-[var(--fz-text-3)]">
                                        <span className="size-2 shrink-0 rounded-full bg-[var(--fz-bg-active)]" />
                                        <span className="size-4 shrink-0" />
                                        <span className="flex-1">Everything else</span>
                                        <span className="w-16 whitespace-nowrap text-right text-[12.5px] tabular-nums">{fmt(otherMs)}</span>
                                        <span className="w-9 text-right text-[12px] tabular-nums text-[var(--fz-text-4)]">
                                            {Math.round((otherMs / scopeTotal) * 100)}%
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </GlassCard>
            </div>

            {/* Categories + calendar */}
            <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
                <GlassCard>
                    <CardHeader title="By category" meta={selectedDay ? 'For the selected day' : `Across ${n} days`} />
                    <div className="space-y-1 px-5 pb-5">
                        {categories.length === 0 ? (
                            <p className="text-[13px] text-[var(--fz-text-3)]">Nothing tracked yet.</p>
                        ) : (
                            categories.map(([c, t]) => {
                                const Icon = CATEGORY_ICONS[c];
                                const share = (t / catTotal) * 100;
                                return (
                                    <div key={c} className="flex items-center gap-3 py-1.5">
                                        <Icon size={15} strokeWidth={1.75} className="shrink-0 text-[var(--fz-text-3)]" />
                                        <span className="w-24 shrink-0 truncate text-[13px] text-[var(--fz-text-1)]">
                                            {c === 'other' ? 'Other' : SAFE_BLOCK_CATEGORY_LABELS[c]}
                                        </span>
                                        <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-[var(--fz-bg-active)]">
                                            <span
                                                className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500"
                                                style={{
                                                    width: `${Math.max(1.5, share)}%`,
                                                    background: c === 'other' ? 'color-mix(in oklab, var(--fz-text-1) 30%, transparent)' : 'var(--fz-text-1)',
                                                }}
                                            />
                                        </span>
                                        <span className="w-16 shrink-0 whitespace-nowrap text-right text-[12.5px] tabular-nums text-[var(--fz-text-2)]">{fmt(t)}</span>
                                        <span className="w-9 shrink-0 text-right text-[12px] tabular-nums text-[var(--fz-text-4)]">{Math.round(share)}%</span>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </GlassCard>

                <GlassCard>
                    <CardHeader
                        title={metric === 'screen' ? 'Screen time calendar' : 'Focus calendar'}
                        meta="Last 13 weeks · click a day"
                    />
                    <div className="flex flex-col gap-5 px-5 pb-5 sm:flex-row sm:items-start">
                    <div className="min-w-0 overflow-x-auto">
                        <div className="flex gap-3">
                            <div className="flex flex-col gap-[3px] pt-[18px] text-[10px] text-[var(--fz-text-4)]">
                                {['', 'Mon', '', 'Wed', '', 'Fri', ''].map((l, i) => (
                                    <span key={i} className="flex h-[15px] items-center">
                                        {l}
                                    </span>
                                ))}
                            </div>
                            <div className="flex gap-[3px]">
                                {heat.cols.map((col, ci) => {
                                    const monthLabel = heat.labels[ci] ?? '';
                                    return (
                                        <div key={ci} className="flex flex-col gap-[3px]">
                                            <span className="h-[15px] whitespace-nowrap text-[10px] leading-[15px] text-[var(--fz-text-4)]">
                                                {monthLabel}
                                            </span>
                                            {col.map((d, ri) =>
                                                d ? (
                                                    <button
                                                        key={d.date}
                                                        type="button"
                                                        title={`${shortDate(d.date, { weekday: 'short', month: 'short', day: 'numeric' })} · ${fmt(value(d))}`}
                                                        onClick={() => {
                                                            if (!days.some((x) => x.date === d.date)) setRange('90');
                                                            setSelected(d.date === selected ? null : d.date);
                                                        }}
                                                        className={`size-[15px] rounded-[4px] transition-transform hover:scale-110 ${
                                                            d.date === selected
                                                                ? 'ring-2 ring-[var(--fz-text-1)] ring-offset-1 ring-offset-[var(--fz-bg-raised)]'
                                                                : d.date === todayStr
                                                                  ? 'ring-1 ring-[var(--fz-border-strong)]'
                                                                  : ''
                                                        }`}
                                                        style={{ background: HEAT[heatLevel(value(d))] }}
                                                    />
                                                ) : (
                                                    <span key={`e-${ri}`} className="size-[15px]" />
                                                ),
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="mt-3 flex items-center justify-end gap-1.5 text-[10.5px] text-[var(--fz-text-4)]">
                            Less
                            {HEAT.map((bg, i) => (
                                <span key={i} className="size-[11px] rounded-[3px]" style={{ background: bg }} />
                            ))}
                            More
                        </div>
                    </div>
                    {insights && (
                        <div className="flex flex-1 flex-col gap-2 sm:border-l sm:border-[var(--fz-border)] sm:pl-5">
                            {insights.map((it) => (
                                <button
                                    key={it.label}
                                    type="button"
                                    disabled={!it.date}
                                    onClick={() => {
                                        if (!it.date) return;
                                        if (!days.some((x) => x.date === it.date)) setRange('90');
                                        setSelected(it.date);
                                    }}
                                    className="rounded-lg px-2.5 py-2 text-left transition-colors enabled:hover:bg-[var(--fz-bg-hover)]"
                                >
                                    <p className="text-meta">{it.label}</p>
                                    <p className="mt-0.5 text-[15px] font-semibold tabular-nums text-[var(--fz-text-1)]">{it.value}</p>
                                    <p className="text-meta">{it.sub}</p>
                                </button>
                            ))}
                        </div>
                    )}
                    </div>
                </GlassCard>
            </div>
        </div>
    );
}
