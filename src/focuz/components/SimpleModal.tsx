import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import ModalPortal from './ModalPortal';

type Props = {
    open: boolean;
    title: string;
    description?: string;
    onClose: () => void;
    children: ReactNode;
    maxWidth?: string;
    danger?: boolean;
};

export default function SimpleModal({
    open,
    title,
    description,
    onClose,
    children,
    maxWidth = 'max-w-md',
    danger = false,
}: Props) {
    if (!open) return null;

    return (
        <ModalPortal>
            <div
                className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/80"
                role="dialog"
                aria-modal="true"
                aria-labelledby="simple-modal-title"
                onMouseDown={(e) => {
                    if (e.target === e.currentTarget) onClose();
                }}
            >
                <div
                    className={`surface-card w-full ${maxWidth} p-5 space-y-4 border ${
                        danger ? 'border-red-500/30' : 'border-white/10'
                    }`}
                >
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <h3
                                id="simple-modal-title"
                                className={`text-base font-semibold tracking-tight ${
                                    danger ? 'text-red-400' : 'text-white'
                                }`}
                            >
                                {title}
                            </h3>
                            {description && (
                                <p className="text-sm text-neutral-400 mt-1 leading-relaxed">{description}</p>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 rounded-md text-neutral-500 hover:text-white hover:bg-white/[0.05] shrink-0"
                            aria-label="Close"
                        >
                            <X size={18} />
                        </button>
                    </div>
                    {children}
                </div>
            </div>
        </ModalPortal>
    );
}
