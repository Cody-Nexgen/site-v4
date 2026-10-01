import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { dismissWhatsNew, newestVisible, readDismissed, type WhatsNewEntry } from '../lib/whatsNew';
import { DUR, EASE, reducedMotion } from '../lib/motion';
import { IconChevronUp, IconX } from '../components/fz/icons';

function useWhatsNew() {
    const [dismissed, setDismissed] = useState<string[] | null>(null);
    useEffect(() => {
        void readDismissed().then(setDismissed);
    }, []);
    const entry = dismissed ? newestVisible(dismissed) : null;
    const dismiss = (id: string) => {
        setDismissed((d) => (d ? [...d, id] : d));
        void dismissWhatsNew(id);
    };
    return { entry, ready: dismissed !== null, dismiss };
}

/** Expanded sidebar footer card (§3.5). */
export function WhatsNewCard({ onNavigate, defaultExpanded = false }: { onNavigate?: (tab: string) => void; defaultExpanded?: boolean }) {
    const { entry, ready, dismiss } = useWhatsNew();
    const [expanded, setExpanded] = useState(defaultExpanded);
    const [imgOk, setImgOk] = useState(true);

    if (!ready) return null;

    return (
        <AnimatePresence initial={false}>
            {entry && (
                <motion.div
                    key={entry.id}
                    className="sb-whatsnew"
                    initial={false}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0, transition: { duration: DUR.base, ease: [...EASE.in] } }}
                    transition={reducedMotion.safe({ duration: DUR.slow, ease: [...EASE.out] })}
                >
                    <button
                        type="button"
                        className="sb-whatsnew-dismiss"
                        aria-label="Dismiss"
                        onClick={() => dismiss(entry.id)}
                    >
                        <IconX size={11} />
                    </button>
                    {imgOk && (
                        <img
                            className="sb-whatsnew-img"
                            src={entry.image}
                            alt=""
                            onLoad={(e) => ((e.target as HTMLImageElement).dataset.loaded = 'true')}
                            onError={() => setImgOk(false)}
                        />
                    )}
                    <div className="sb-whatsnew-body">
                        <span className="sb-whatsnew-pill">New</span>
                        <p className="sb-whatsnew-title">{entry.title}</p>
                        <p className="sb-whatsnew-short" data-expanded={expanded || undefined}>{entry.short}</p>
                        <AnimatePresence initial={false}>
                            {expanded && (
                                <motion.div
                                    key="long"
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto', transition: { ...reducedMotion.safe({ duration: DUR.slow, ease: [...EASE.out] }), opacity: { delay: 0.06, duration: DUR.base } } }}
                                    exit={{ opacity: 0, height: 0, transition: { duration: DUR.base * 0.7, ease: [...EASE.in] } }}
                                    style={{ overflow: 'hidden' }}
                                >
                                    <p className="sb-whatsnew-long">{entry.long}</p>
                                    {entry.cta && (
                                        <button
                                            type="button"
                                            className="sb-whatsnew-cta"
                                            onClick={() => entry.cta && onNavigate?.(entry.cta.tab)}
                                        >
                                            {entry.cta.label}
                                        </button>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                        <button
                            type="button"
                            className="sb-whatsnew-more"
                            onClick={() => setExpanded((v) => !v)}
                        >
                            {expanded ? 'Show less' : 'Learn more'}
                            <IconChevronUp size={12} className="sb-whatsnew-chev" data-expanded={expanded || undefined} />
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

/** Rail-mode: whether a non-dismissed entry exists (drives the accent dot). */
export function useHasWhatsNew(): { hasNew: boolean; entry: WhatsNewEntry | null; dismiss: (id: string) => void } {
    const { entry, ready, dismiss } = useWhatsNew();
    return { hasNew: ready && entry !== null, entry, dismiss };
}
