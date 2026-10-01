import { getLevelProgress, FOCUS_RANKS, milestoneLabel } from '../lib/focusProgression';
import type { FocusProgressionState } from '../lib/focusProgression';
import { badgeMark } from '../lib/focusShop';
import { ProgressRing } from './fz/ProgressRing';

type Props = {
    progression: FocusProgressionState;
    compact?: boolean;
    className?: string;
};

export function FocusLevelCard({ progression, compact = false, className = '' }: Props) {
    const progress = getLevelProgress(progression.xp);
    const nextRank = FOCUS_RANKS.find((r) => r.level > progress.level);
    const milestone = milestoneLabel(progression.xp);
    const frameClass = progression.equippedCosmetics.frame
        ? `focus-equipped-${progression.equippedCosmetics.frame.replace('_', '-')}`
        : '';

    if (compact) {
        return (
            <div className={`flex items-center gap-4 ${className}`}>
                <div
                    className={`w-11 h-11 rounded-lg bg-white/6 border border-white/8 flex items-center justify-center font-medium text-neutral-300 tabular-nums ${frameClass}`}
                >
                    {progress.level}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-white truncate">
                            Focuz Level {progress.level}
                        </p>
                        <span
                            className="text-xs text-neutral-400 font-medium shrink-0 tabular-nums"
                            title="Coins earned from real sessions, blocks, and habits"
                        >
                            {progression.coins} coins
                        </span>
                    </div>
                    <p className="text-[11px] text-neutral-500 mt-0.5 truncate">{milestone}</p>
                    <div className="h-1.5 bg-white/6 rounded-full overflow-hidden mt-1.5">
                        <div
                            className="h-full pro-xp-fill rounded-full transition-all"
                            style={{ width: `${progress.progressPct}%` }}
                        />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`p-6 rounded-[var(--fz-radius-lg)] border border-[var(--fz-border)] bg-[var(--fz-bg-panel)] ${className}`}>
            <div className="flex items-start justify-between gap-4 mb-5">
                <div>
                    <p className="text-label text-[var(--fz-text-3)] mb-2">Focuz level</p>
                    <div className="flex items-center gap-3">
                        <div className={`relative ${frameClass}`}>
                            <ProgressRing value={progress.progressPct / 100} size={56} stroke={4}>
                                <span className="text-title-3 text-[var(--fz-text-1)] tabular-nums">{progress.level}</span>
                            </ProgressRing>
                        </div>
                        <div>
                            <h3 className="text-title-2 text-[var(--fz-text-1)]">Level {progress.level}</h3>
                            <p className="text-meta text-[var(--fz-text-3)] mt-0.5">
                                {progress.isMaxLevel
                                    ? 'Maximum level reached'
                                    : nextRank
                                      ? `${milestone} · next rank ${nextRank.name}`
                                      : milestone}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-label text-[var(--fz-text-3)]">Coins</p>
                    <p className="text-stat text-[var(--fz-text-1)] tabular-nums mt-1">{progression.coins}</p>
                    <p className="text-meta text-[var(--fz-text-3)] mt-1 max-w-[8rem]">Earned from sessions &amp; habits</p>
                    {progression.equippedCosmetics.badge && (
                        <span
                            className="mt-2 inline-block text-meta font-medium text-[var(--fz-text-3)] border border-[var(--fz-border)] rounded px-1.5 py-0.5"
                            title="Equipped badge"
                        >
                            {badgeMark(progression.equippedCosmetics.badge)}
                        </span>
                    )}
                </div>
            </div>

            <div className="space-y-2">
                <div className="flex justify-between text-xs">
                    <span className="text-neutral-400">{progress.xp.toLocaleString()} XP from real focus work</span>
                    <span className="text-neutral-400 font-medium tabular-nums">{progress.progressPct}%</span>
                </div>
                <div className="h-2.5 bg-white/6 rounded-full overflow-hidden">
                    <div
                        className="h-full pro-xp-fill rounded-full transition-all duration-500"
                        style={{ width: `${progress.progressPct}%` }}
                    />
                </div>
            </div>
        </div>
    );
}
