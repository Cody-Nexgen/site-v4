import { AnimatePresence, motion } from 'framer-motion';
import { X, Trees, Sprout, Clock, Gauge } from 'lucide-react';
import ModalPortal from './ModalPortal';
import type { ForestDisplay } from '../lib/forest';

type Props = {
    open: boolean;
    onClose: () => void;
    display: ForestDisplay;
    fmtClean: (min: number) => string;
};

export default function ForestStatsModal({ open, onClose, display, fmtClean }: Props) {
    const recovering = display.recoveryRemainingMin > 0;
    const growthPct = Math.round(display.multiplier * 100);

    return (
        <ModalPortal>
            <AnimatePresence>
                {open && (
                    <motion.div
                        className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onMouseDown={(e) => e.target === e.currentTarget && onClose()}
                    >
                        <motion.div
                            className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#1a1a1e] shadow-2xl overflow-hidden"
                            initial={{ opacity: 0, y: 12, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 8, scale: 0.98 }}
                        >
                            <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
                                <h2 className="text-lg font-bold text-white">Forest stats</h2>
                                <button type="button" onClick={onClose} className="p-2 rounded-lg text-neutral-500 hover:text-white hover:bg-white/5">
                                    <X size={18} />
                                </button>
                            </div>
                            <div className="p-5 grid grid-cols-2 gap-3">
                                <Stat icon={<Trees size={14} className="text-emerald-400" />} label="Trees" value={display.trees.length} />
                                <Stat icon={<Sprout size={14} className="text-lime-400" />} label="Mature" value={display.matureCount} />
                                <Stat icon={<Clock size={14} className="text-purple-400" />} label="Clean growth" value={fmtClean(display.totalCleanMinutes)} />
                                <Stat
                                    icon={<Gauge size={14} className={recovering ? 'text-amber-400' : 'text-emerald-400'} />}
                                    label="Growth rate"
                                    value={`${growthPct}%`}
                                    sub={recovering ? `Recovering · ${Math.ceil(display.recoveryRemainingMin)}m` : 'Full speed'}
                                />
                            </div>
                            <div className="px-5 pb-5 text-xs text-neutral-500 leading-relaxed">
                                Every focus session plants a tree. Slip-ups slow growth — they never destroy your forest.
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </ModalPortal>
    );
}

function Stat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string | number; sub?: string }) {
    return (
        <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                {icon} {label}
            </div>
            <div className="text-xl font-bold text-white mt-1.5">{value}</div>
            {sub && <div className="text-[10px] text-neutral-600 mt-0.5">{sub}</div>}
        </div>
    );
}
