import { getLevelProgress, FOCUS_RANKS, milestoneLabel } from '../lib/focusProgression';
import type { FocusProgressionState } from '../lib/focusProgression';
import { badgeEmoji } from '../lib/focusShop';

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
                    className={`w-11 h-11 rounded-lg bg-white/[0.05] border border-white/[0.07] flex items-center justify-center font-medium text-neutral-300 tabular-nums ${frameClass}`}
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
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mt-1.5">
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
        <div className={`p-6 rounded-lg border border-white/[0.07] bg-[#121214] ${className}`}>
            <div className="flex items-start justify-between gap-4 mb-5">
                <div>
                    <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-2">Focuz Level</p>
                    <div className="flex items-center gap-3">
                        <div
                            className={`w-14 h-14 rounded-lg bg-white/[0.05] border border-white/[0.07] flex items-center justify-center text-2xl font-semibold text-neutral-200 tabular-nums ${frameClass}`}
                        >
                            {progress.level}
                        </div>
                        <div>
                            <h3 className="text-xl font-semibold text-white">Level {progress.level}</h3>
                            <p className="text-xs text-neutral-400 mt-0.5">
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
                    <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">Coins</p>
                    <p className="text-2xl font-semibold text-amber-400 tabular-nums mt-1">{progression.coins}</p>
                    <p className="text-[10px] text-neutral-500 mt-1 max-w-[8rem]">Earned from sessions &amp; habits</p>
                    {progression.equippedCosmetics.badge && (
                        <span className="text-lg" title="Equipped badge">
                            {badgeEmoji(progression.equippedCosmetics.badge)}
                        </span>
                    )}
                </div>
            </div>

            <div className="space-y-2">
                <div className="flex justify-between text-xs">
                    <span className="text-neutral-400">{progress.xp.toLocaleString()} XP from real focus work</span>
                    <span className="text-neutral-400 font-medium tabular-nums">{progress.progressPct}%</span>
                </div>
                <div className="h-2.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                        className="h-full pro-xp-fill rounded-full transition-all duration-500"
                        style={{ width: `${progress.progressPct}%` }}
                    />
                </div>
            </div>
        </div>
    );
}
