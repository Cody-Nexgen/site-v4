import { motion } from 'framer-motion';
import { Ban, BarChart3, Check, Loader2, Sparkles, X, Zap } from 'lucide-react';
import type { CoachAction } from '../lib/aiCoachTypes';
import { describeCoachAction } from '../lib/coachActionLabels';

export type CoachActionUiItem = {
    id: string;
    action: CoachAction;
    status: 'pending' | 'running' | 'done' | 'denied' | 'error';
    error?: string;
};

function iconForAction(action: CoachAction) {
    switch (action.action_type) {
        case 'block':
        case 'unblock':
        case 'blocks_list':
            return Ban;
        case 'nuclear_start':
            return Zap;
        case 'read_analytics':
            return BarChart3;
        default:
            return Sparkles;
    }
}

export function CoachActionConfirmCard({
    items,
    onAllowAll,
    onDenyAll,
}: {
    items: CoachActionUiItem[];
    onAllowAll: () => void;
    onDenyAll: () => void;
}) {
    const pending = items.filter((i) => i.status === 'pending');
    const running = items.some((i) => i.status === 'running');
    const finished = items.filter((i) => i.status !== 'pending' && i.status !== 'running');

    if (pending.length === 0 && finished.length === 0) return null;

    const analyticsOnly =
        pending.length === 1 && pending[0].action.action_type === 'read_analytics';

    return (
        <motion.div
            initial={{ scale: 0.96, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            className="mt-3 rounded-xl border border-white/10 bg-[#1e1e1e] overflow-hidden shadow-lg"
        >
            {pending.length > 0 && (
                <div className="p-4">
                    <p className="text-sm font-semibold text-white mb-1">
                        {analyticsOnly
                            ? 'Allow AI Coach to access your analytics?'
                            : 'Allow AI Coach to do this?'}
                    </p>
                    <p className="text-xs text-neutral-500 mb-4">
                        {analyticsOnly
                            ? 'Your last 7 days of screen time (sites and minutes, summarized) will be used for personalized advice. Nothing else is shared.'
                            : 'Review what the coach wants to change in FocuzNow.'}
                    </p>
                    <ul className="space-y-2 mb-4">
                        {pending.map((item) => {
                            const { title, detail } = describeCoachAction(item.action);
                            const Icon = iconForAction(item.action);
                            return (
                                <li
                                    key={item.id}
                                    className="flex items-start gap-2.5 p-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06]"
                                >
                                    <Icon className="w-4 h-4 shrink-0 mt-0.5 text-violet-400" />
                                    <div className="min-w-0">
                                        <p className="text-xs font-medium text-white">{title}</p>
                                        {detail ? (
                                            <p className="text-xs text-neutral-500 mt-0.5 break-words">
                                                {detail}
                                            </p>
                                        ) : null}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            disabled={running}
                            onClick={onDenyAll}
                            className="flex-1 py-2.5 rounded-lg border border-white/10 text-sm text-neutral-300 hover:bg-white/5 disabled:opacity-40"
                        >
                            No
                        </button>
                        <button
                            type="button"
                            disabled={running}
                            onClick={onAllowAll}
                            className="flex-1 py-2.5 rounded-lg bg-white text-black text-sm font-semibold hover:bg-neutral-200 disabled:opacity-40 flex items-center justify-center gap-2"
                        >
                            {running ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Applying…
                                </>
                            ) : analyticsOnly ? (
                                'Yes, share analytics'
                            ) : (
                                'Yes, allow'
                            )}
                        </button>
                    </div>
                </div>
            )}

            {finished.map((item) => {
                const { title } = describeCoachAction(item.action);
                const ok = item.status === 'done';
                const analyticsDone =
                    item.action.action_type === 'read_analytics' && item.status === 'done';
                return (
                    <div
                        key={item.id}
                        className={`flex items-center gap-2 px-4 py-2.5 border-t border-white/[0.06] text-xs ${
                            ok ? 'text-emerald-400/90' : 'text-neutral-500'
                        }`}
                    >
                        {ok ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                        <span>
                            {analyticsDone
                                ? 'Approved'
                                : item.status === 'denied'
                                  ? `${title} — not allowed`
                                  : item.status === 'error'
                                    ? `${title} — failed${item.error ? `: ${item.error}` : ''}`
                                    : `${title} — done`}
                        </span>
                    </div>
                );
            })}
        </motion.div>
    );
}
