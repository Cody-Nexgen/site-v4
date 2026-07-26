import { AnimatePresence, motion } from 'framer-motion';

type Props = {
    open: boolean;
    durationMin: number;
    blocklistCount: number;
    onClose: () => void;
    onConfirm: () => void;
};

export function NuclearConfirmModal({ open, durationMin, blocklistCount, onClose, onConfirm }: Props) {
    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                >
                    <motion.div
                        role="dialog"
                        aria-labelledby="nuke-modal-title"
                        className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
                        style={{
                            background: 'repeating-linear-gradient(-45deg, #1a1a1a, #1a1a1a 8px, #0d0d0d 8px, #0d0d0d 16px)',
                            border: '3px solid #facc15',
                            boxShadow: '0 0 40px rgba(250, 204, 21, 0.25), inset 0 0 0 1px rgba(0,0,0,0.8)',
                        }}
                        initial={{ scale: 0.92, y: 12 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.92, y: 12 }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="bg-yellow-400 px-5 py-3 flex items-center gap-3 border-b-4 border-black">
                            <span className="text-2xl" aria-hidden>☢</span>
                            <h2 id="nuke-modal-title" className="text-lg font-black text-black uppercase tracking-wide">
                                Confirm nuclear lockdown
                            </h2>
                        </div>

                        <div className="p-6 space-y-4 bg-[#111]">
                            <p className="text-sm text-neutral-300 leading-relaxed">
                                Block your <span className="font-bold text-yellow-400">{blocklistCount} blocklist site{blocklistCount === 1 ? '' : 's'}</span> for{' '}
                                <span className="font-bold text-white">{durationMin} minute{durationMin === 1 ? '' : 's'}</span>.
                            </p>
                            <p className="text-sm text-neutral-500 leading-relaxed">
                                This cannot be cancelled early — not even by disabling the extension — until the timer expires.
                            </p>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-1 py-3 rounded-xl border border-white/15 bg-white/5 text-neutral-300 text-sm font-bold hover:bg-white/10 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={onConfirm}
                                    className="flex-1 py-3 rounded-xl text-sm font-black uppercase tracking-wide transition-all hover:brightness-110 active:scale-[0.98]"
                                    style={{
                                        background: 'linear-gradient(180deg, #fde047 0%, #eab308 100%)',
                                        color: '#000',
                                        border: '2px solid #000',
                                        boxShadow: '0 0 16px rgba(250, 204, 21, 0.4), inset 0 1px 0 rgba(255,255,255,0.35)',
                                    }}
                                >
                                    ☢ Nuke em!
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
