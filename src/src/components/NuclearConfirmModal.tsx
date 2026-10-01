import { useEffect, useRef, useState } from 'react';
import { Dialog } from './fz/Dialog';
import { Button } from './fz/Button';
import { SegmentedControl } from './fz/SegmentedControl';

type Props = {
    open: boolean;
    durationMin: number;
    blocklistCount: number;
    onClose: () => void;
    onConfirm: () => void;
    onDurationChange?: (minutes: number) => void;
};

const HOLD_MS = 1200;
const DURATIONS = ['15', '30', '60', '120'];

export function NuclearConfirmModal({ open, durationMin, blocklistCount, onClose, onConfirm, onDurationChange }: Props) {
    const [holding, setHolding] = useState(false);
    const timerRef = useRef<number>(0);

    const stopHold = () => {
        window.clearTimeout(timerRef.current);
        setHolding(false);
    };
    const startHold = () => {
        stopHold();
        setHolding(true);
        timerRef.current = window.setTimeout(() => {
            setHolding(false);
            onConfirm();
        }, HOLD_MS);
    };

    useEffect(() => {
        if (!open) stopHold();
        return stopHold;
    }, [open]);

    return (
        <Dialog
            open={open}
            onClose={onClose}
            size="sm"
            title={<span className="text-[var(--fz-danger)]">Confirm nuclear lockdown</span>}
            description="This cannot be cancelled early — not even by disabling the extension — until the timer expires."
        >
            <div className="space-y-4">
                <p className="text-body-sm text-[var(--fz-text-2)] leading-relaxed">
                    Block your <span className="font-semibold text-[var(--fz-text-1)]">{blocklistCount} blocklist site{blocklistCount === 1 ? '' : 's'}</span> for{' '}
                    <span className="font-semibold text-[var(--fz-text-1)]">{durationMin} minute{durationMin === 1 ? '' : 's'}</span>.
                </p>

                {onDurationChange && (
                    <div className="space-y-1.5">
                        <span className="text-label text-[var(--fz-text-3)]">Duration</span>
                        <div>
                            <SegmentedControl
                                idPrefix="nuke-duration"
                                value={DURATIONS.includes(String(durationMin)) ? String(durationMin) : ''}
                                onChange={(v) => onDurationChange(Number(v) || durationMin)}
                                options={DURATIONS.map((m) => ({ value: m, label: `${m} min` }))}
                            />
                            {!DURATIONS.includes(String(durationMin)) && (
                                <span className="text-meta text-[var(--fz-text-3)] ml-2">{durationMin} min</span>
                            )}
                        </div>
                    </div>
                )}

                <div className="flex gap-2 pt-1">
                    <Button variant="secondary" className="flex-1" onClick={onClose}>
                        Cancel
                    </Button>
                    <button
                        type="button"
                        onPointerDown={startHold}
                        onPointerUp={stopHold}
                        onPointerLeave={stopHold}
                        onKeyDown={(e) => {
                            if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) startHold();
                        }}
                        onKeyUp={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') stopHold();
                        }}
                        className="relative flex-1 overflow-hidden rounded-lg border border-[var(--fz-danger)]/40 bg-[var(--fz-danger-soft)] py-2 text-[13px] font-semibold text-[var(--fz-danger)] transition-colors select-none"
                        aria-label={`Hold ${HOLD_MS / 1000} seconds to start lockdown`}
                    >
                        <span
                            aria-hidden
                            className="absolute inset-y-0 left-0 bg-[var(--fz-danger)]/25"
                            style={{
                                width: holding ? '100%' : '0%',
                                transition: holding ? `width ${HOLD_MS}ms linear` : 'width 160ms ease-out',
                            }}
                        />
                        <span className="relative">{holding ? 'Keep holding…' : 'Hold to lock down'}</span>
                    </button>
                </div>
            </div>
        </Dialog>
    );
}
