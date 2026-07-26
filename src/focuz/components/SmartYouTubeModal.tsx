import { AnimatePresence, motion } from 'framer-motion';
import { X, Youtube, Shield } from 'lucide-react';
import { useEffect, useState } from 'react';
import ModalPortal from './ModalPortal';
import {
    DEFAULT_BLOCKED_CATEGORY_IDS,
    YOUTUBE_CATEGORIES,
} from '../lib/youtubeDataApi';
import type { SmartYouTubeSettings } from '../lib/youtubeSmartMode';
import { DEFAULT_SMART_YOUTUBE } from '../lib/youtubeSmartMode';

type Props = {
    open: boolean;
    onClose: () => void;
    settings: SmartYouTubeSettings;
    onSave: (next: SmartYouTubeSettings) => Promise<void>;
};

export default function SmartYouTubeModal({ open, onClose, settings, onSave }: Props) {
    const [draft, setDraft] = useState<SmartYouTubeSettings>(settings);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open) setDraft(settings);
    }, [open, settings]);

    const toggleCategory = (id: string) => {
        const blocked = new Set(draft.blockedCategoryIds);
        if (blocked.has(id)) blocked.delete(id);
        else blocked.add(id);
        setDraft({ ...draft, blockedCategoryIds: Array.from(blocked) });
    };

    const handleSave = async () => {
        setSaving(true);
        await onSave({ ...draft, useDataApi: true });
        setSaving(false);
        onClose();
    };

    if (!open) return null;

    return (
        <ModalPortal>
            <AnimatePresence>
                <motion.div
                    className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/80"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onMouseDown={(e) => e.target === e.currentTarget && onClose()}
                >
                    <motion.div
                        className="focuz-modal-panel max-w-lg w-full max-h-[90vh]"
                        initial={{ opacity: 0, y: 16, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.98 }}
                    >
                        <div className="focuz-modal-header flex items-start justify-between gap-3">
                            <div>
                                <div className="flex items-center gap-2 text-neutral-500 mb-1">
                                    <Youtube size={18} />
                                    <span className="text-[10px] font-bold uppercase tracking-widest">Smart YouTube</span>
                                </div>
                                <h2 className="text-lg font-bold text-white">Category blocking</h2>
                                <p className="text-sm text-neutral-400 mt-1 leading-relaxed">
                                    Videos are classified via the YouTube Data API. Education and Science are always allowed.
                                </p>
                            </div>
                            <button type="button" onClick={onClose} className="p-2 rounded-lg text-neutral-500 hover:text-white hover:bg-white/5">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="focuz-modal-body space-y-4">
                            <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/8">
                                <span className="text-sm text-white font-medium">Block Shorts</span>
                                <button
                                    type="button"
                                    onClick={() => setDraft({ ...draft, blockShorts: !draft.blockShorts })}
                                    className={`w-10 h-5 rounded-full relative transition-colors ${draft.blockShorts ? 'bg-neutral-200' : 'bg-neutral-800'}`}
                                >
                                    <div className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${draft.blockShorts ? 'left-5 bg-neutral-950' : 'left-0.5 bg-neutral-500'}`} />
                                </button>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <label className="focuz-section-label">Categories to block</label>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setDraft({
                                                ...draft,
                                                blockedCategoryIds: [...DEFAULT_BLOCKED_CATEGORY_IDS],
                                            })
                                        }
                                        className="text-[10px] font-medium text-neutral-500"
                                    >
                                        Reset defaults
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[min(50vh,360px)] overflow-y-auto pr-1">
                                    {YOUTUBE_CATEGORIES.map((cat) => {
                                        const blocked = draft.blockedCategoryIds.includes(cat.id);
                                        const forcedAllow = cat.id === '27' || cat.id === '28';
                                        return (
                                            <button
                                                key={cat.id}
                                                type="button"
                                                disabled={forcedAllow}
                                                onClick={() => !forcedAllow && toggleCategory(cat.id)}
                                                className={`focuz-category-chip text-left ${forcedAllow ? 'is-allowed opacity-70' : blocked ? 'is-blocked' : 'is-allowed'}`}
                                            >
                                                <span className="text-lg">{cat.icon}</span>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-semibold text-white truncate">{cat.title}</p>
                                                    <p className="text-[10px] text-neutral-500 truncate">
                                                        {forcedAllow ? 'Always allowed' : blocked ? 'Blocked' : 'Allowed'}
                                                    </p>
                                                </div>
                                                {!forcedAllow && (
                                                    <Shield size={14} className={blocked ? 'text-red-400' : 'text-emerald-400/60'} />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="focuz-modal-footer">
                            <button type="button" className="focuz-btn-ghost" onClick={onClose}>
                                Cancel
                            </button>
                            <button type="button" className="focuz-btn-primary !bg-neutral-100 !text-neutral-950" disabled={saving} onClick={() => void handleSave()}>
                                {saving ? 'Saving…' : 'Save & apply'}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            </AnimatePresence>
        </ModalPortal>
    );
}

export function normalizeSmartYouTubeSettings(raw?: Partial<SmartYouTubeSettings>): SmartYouTubeSettings {
    return {
        ...DEFAULT_SMART_YOUTUBE,
        ...raw,
        blockedCategoryIds:
            raw?.blockedCategoryIds?.length
                ? raw.blockedCategoryIds
                : DEFAULT_BLOCKED_CATEGORY_IDS,
        useDataApi: true,
    };
}
