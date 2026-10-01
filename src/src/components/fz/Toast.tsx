import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { DUR, EASE, reducedMotion } from '../../lib/motion';
import { Button } from './Button';

export type ToastData = {
    id: number;
    message: ReactNode;
    action?: { label: string; onClick: () => void };
};

type ToastCtx = {
    toast: (message: ReactNode, opts?: { action?: { label: string; onClick: () => void } }) => void;
};

const Ctx = createContext<ToastCtx>({ toast: () => {} });
export const useToast = () => useContext(Ctx);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<ToastData[]>([]);

    const toast = useCallback((message: ReactNode, opts?: { action?: { label: string; onClick: () => void } }) => {
        const id = nextId++;
        setToasts((t) => [...t.slice(-3), { id, message, action: opts?.action }]);
    }, []);

    const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

    return (
        <Ctx.Provider value={{ toast }}>
            {children}
            {createPortal(
                <div className="pointer-events-none fixed bottom-6 left-1/2 z-[70] flex -translate-x-1/2 flex-col items-center gap-2">
                    <AnimatePresence>
                        {toasts.map((t) => (
                            <ToastItem key={t.id} data={t} onDone={() => dismiss(t.id)} />
                        ))}
                    </AnimatePresence>
                </div>,
                document.body,
            )}
        </Ctx.Provider>
    );
}

/** Standalone single toast for imperative use (ActionToast replacement). */
export function Toast({ message, action, onDone }: { message: ReactNode; action?: ToastData['action']; onDone: () => void }) {
    if (!message) return null;
    return createPortal(
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[300] flex justify-center px-4">
            <AnimatePresence>
                <ToastItem data={{ id: 0, message, action }} onDone={onDone} />
            </AnimatePresence>
        </div>,
        document.body,
    );
}

function ToastItem({ data, onDone }: { data: ToastData; onDone: () => void }) {
    const [paused, setPaused] = useState(false);
    const timer = useRef<number | null>(null);

    useEffect(() => {
        if (paused) return;
        timer.current = window.setTimeout(onDone, 3200);
        return () => { if (timer.current) window.clearTimeout(timer.current); };
    }, [paused, onDone]);

    return (
        <motion.div
            role="status"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={reducedMotion.safe({ duration: DUR.base, ease: [...EASE.out] })}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            className={cn(
                'pointer-events-auto flex max-w-md items-center gap-3 rounded-lg border border-[var(--fz-border)]',
                'bg-[var(--fz-bg-overlay)] px-4 py-2.5 text-[13px] text-[var(--fz-text-1)] shadow-[var(--fz-shadow-overlay)]',
            )}
        >
            <span className="min-w-0 truncate">{data.message}</span>
            {data.action && (
                <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0"
                    onClick={() => {
                        data.action?.onClick();
                        onDone();
                    }}
                >
                    {data.action.label}
                </Button>
            )}
        </motion.div>
    );
}
