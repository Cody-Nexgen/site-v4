import { useMemo } from 'react';
import { capDayScreenMs } from '../lib/screenTimeCap';
import { computeFocusScore } from '../lib/focusScore';

type DayStat = { date: string; total: number; sites?: Record<string, number> };

type Props = {
    stats: DayStat[];
    weeks?: number;
    className?: string;
};

function scoreForDay(day: DayStat): number {
    return computeFocusScore({
        todaySites: day.sites,
        todayTotalMs: day.total,
    }).score;
}

function levelColor(score: number, hasData: boolean): string {
    if (!hasData) return 'bg-white/[0.04]';
    if (score >= 85) return 'bg-emerald-500';
    if (score >= 70) return 'bg-emerald-500/70';
    if (score >= 50) return 'bg-purple-500/60';
    if (score >= 30) return 'bg-amber-500/50';
    return 'bg-red-500/40';
}

/** GitHub-style contribution grid — color intensity = daily focus score. */
export function FocusActivityChart({ stats, weeks = 12, className = '' }: Props) {
    const columns = useMemo(() => {
        const totalDays = weeks * 7;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const byDate = new Map(stats.map((s) => [s.date, s]));

        const cols: { date: Date; score: number; hasData: boolean }[][] = [];
        for (let w = 0; w < weeks; w++) cols.push(new Array(7).fill(null));

        for (let i = totalDays - 1; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const key = d.toDateString();
            const day = byDate.get(key);
            const total = capDayScreenMs(day?.total ?? 0);
            const weekIdx = Math.floor((totalDays - 1 - i) / 7);
            const dow = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
            if (weekIdx < weeks) {
                cols[weekIdx][dow] = {
                    date: d,
                    score: day ? scoreForDay(day) : 0,
                    hasData: total > 0,
                };
            }
        }
        return cols;
    }, [stats, weeks]);

    const dayLabels = ['M', '', 'W', '', 'F', '', 'S'];

    return (
        <div className={`overflow-x-auto ${className}`}>
            <div className="inline-flex gap-[3px] min-w-0">
                <div className="flex flex-col gap-[3px] pt-0.5 shrink-0">
                    {dayLabels.map((label, i) => (
                        <span key={i} className="h-[11px] text-[9px] text-neutral-600 leading-[11px] w-3">
                            {label}
                        </span>
                    ))}
                </div>
                <div className="flex gap-[3px]">
                    {columns.map((col, ci) => (
                        <div key={ci} className="flex flex-col gap-[3px]">
                            {col.map((cell, ri) =>
                                cell ? (
                                    <div
                                        key={ri}
                                        title={`${cell.date.toLocaleDateString()} — Focus: ${cell.hasData ? cell.score : '—'}`}
                                        className={`w-[11px] h-[11px] rounded-[2px] ${levelColor(cell.score, cell.hasData)}`}
                                    />
                                ) : (
                                    <div key={ri} className="w-[11px] h-[11px] rounded-[2px] bg-white/[0.02]" />
                                ),
                            )}
                        </div>
                    ))}
                </div>
            </div>
            <div className="flex items-center gap-1.5 mt-3 text-[9px] text-neutral-600">
                <span>Less focus</span>
                {['bg-white/[0.04]', 'bg-red-500/40', 'bg-amber-500/50', 'bg-purple-500/60', 'bg-emerald-500'].map((c) => (
                    <div key={c} className={`w-[11px] h-[11px] rounded-[2px] ${c}`} />
                ))}
                <span>More focus</span>
            </div>
        </div>
    );
}
