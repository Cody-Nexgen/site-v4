import { motion } from 'framer-motion';
import { BarChart3, X } from 'lucide-react';

export function AiCoachAnalyticsModal({
    open,
    onClose,
    onApprove,
    onDeny,
}: {
    open: boolean;
    onClose: () => void;
    onApprove: () => void;
    onDeny: () => void;
}) {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-md w-full rounded-2xl border border-white/10 bg-[#1a1a1a] p-6 shadow-2xl"
            >
                <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                            <BarChart3 className="w-5 h-5 text-emerald-400" />
                        </div>
                        <h2 className="text-lg font-semibold text-white">Share analytics with AI Coach?</h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 rounded-lg text-neutral-500 hover:text-white hover:bg-white/10"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <p className="text-sm text-neutral-400 leading-relaxed mb-6">
                    The coach can read your last 7 days of screen time (sites and minutes) to give personalized
                    advice. It never sends raw browsing history to anyone else — only summarized stats with
                    your Pro chat on Vertex AI. You can revoke this anytime by denying in Settings later.
                </p>
                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={onDeny}
                        className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-neutral-300 hover:bg-white/5"
                    >
                        Not now
                    </button>
                    <button
                        type="button"
                        onClick={onApprove}
                        className="flex-1 py-2.5 rounded-xl bg-white text-black text-sm font-semibold hover:bg-neutral-200"
                    >
                        Approve
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
