import { getLevelProgress, FOCUS_RANKS } from '../lib/focusProgression';
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
    const frameClass = progression.equippedCosmetics.frame
        ? `focus-equipped-${progression.equippedCosmetics.frame.replace('_', '-')}`
        : '';

    if (compact) {
        return (
            <div className={`flex items-center gap-3 ${className}`}>
                <div
                    className={`w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center font-black text-purple-300 ${frameClass}`}
                >
                    {progress.level}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-white truncate">{progress.rank}</p>
                        <span className="text-xs text-amber-400 font-bold shrink-0">🪙 {progression.coins}</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mt-1">
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
        <div className={`p-6 rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-500/10 to-transparent ${className}`}>
            <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                    <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Focus Level</p>
                    <div className="flex items-center gap-3">
                        <div
                            className={`w-14 h-14 rounded-2xl bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-2xl font-black text-white ${frameClass}`}
                        >
                            {progress.level}
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-white">{progress.rank}</h3>
                            <p className="text-xs text-neutral-400">
                                {progress.isMaxLevel
                                    ? 'Maximum level reached'
                                    : nextRank
                                      ? `Next rank: ${nextRank.name} at Lv ${nextRank.level}`
                                      : `${progress.xpIntoLevel} / ${progress.xpForNextLevel} XP to next level`}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Coins</p>
                    <p className="text-2xl font-black text-amber-400">🪙 {progression.coins}</p>
                    {progression.equippedCosmetics.badge && (
                        <span className="text-lg" title="Equipped badge">
                            {badgeEmoji(progression.equippedCosmetics.badge)}
                        </span>
                    )}
                </div>
            </div>

            <div className="space-y-2">
                <div className="flex justify-between text-xs">
                    <span className="text-neutral-400">{progress.xp.toLocaleString()} XP total</span>
                    <span className="text-purple-400 font-bold">{progress.progressPct}%</span>
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
