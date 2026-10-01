import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Camera, Check, KeyRound, Loader2, Lock, TriangleAlert, Wifi, X } from 'lucide-react';
import { Button } from '../../components/fz/Button';
import { focuzPassImportPackage, type VaultCollection } from '../../lib/focuzPass/client';
import { codeFromText, formatTransferCode } from '../../lib/focuzPass/transfer/code';
import { receiveVault, type TransferRoute } from '../../lib/focuzPass/transfer/peer';
import type { VaultExportPackage } from '../../lib/focuzPass/types';

type Step =
    | { kind: 'code'; error?: string }
    | { kind: 'connecting' }
    | { kind: 'receiving'; progress: number; route: TransferRoute }
    | { kind: 'password'; pkg: VaultExportPackage; route: TransferRoute | 'file'; error?: string; busy?: boolean }
    | { kind: 'done'; added: number; duplicates: number; failed: number };

const EASE = [0.16, 1, 0.3, 1] as const;

type BarcodeDetectorLike = { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> };
type BarcodeDetectorCtor = { new (options: { formats: string[] }): BarcodeDetectorLike; getSupportedFormats?: () => Promise<string[]> };

function barcodeDetector(): BarcodeDetectorCtor | null {
    const ctor = (globalThis as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
    return ctor ?? null;
}

/** Scans the other device's QR with this device's camera, where the browser can read QR codes. */
function QrScanner({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [error, setError] = useState('');
    useEffect(() => {
        let stream: MediaStream | null = null;
        let timer = 0;
        let alive = true;
        const Detector = barcodeDetector();
        if (!Detector) return;
        const detector = new Detector({ formats: ['qr_code'] });
        void navigator.mediaDevices
            .getUserMedia({ video: { facingMode: 'environment' } })
            .then(async (s) => {
                stream = s;
                if (!alive || !videoRef.current) return;
                videoRef.current.srcObject = s;
                await videoRef.current.play();
                const scan = async () => {
                    if (!alive || !videoRef.current) return;
                    try {
                        for (const found of await detector.detect(videoRef.current)) {
                            const code = codeFromText(found.rawValue);
                            if (code) return onCode(code);
                        }
                    } catch {
                        /* frame not ready */
                    }
                    timer = window.setTimeout(scan, 250);
                };
                void scan();
            })
            .catch(() => setError('FocuzPass can\'t use the camera. Type the code instead.'));
        return () => {
            alive = false;
            window.clearTimeout(timer);
            stream?.getTracks().forEach((track) => track.stop());
        };
    }, [onCode]);
    return (
        <div className="relative overflow-hidden rounded-[12px] border border-[var(--fz-border)] bg-black">
            {error ? (
                <p className="px-4 py-10 text-center text-[13px] text-[var(--fz-text-3)]">{error}</p>
            ) : (
                <video ref={videoRef} muted playsInline className="aspect-video w-full object-cover" />
            )}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="size-40 rounded-[18px] shadow-[0_0_0_2px_rgb(255_255_255/0.8),0_0_0_9999px_rgb(0_0_0/0.35)]" />
            </div>
            <button
                type="button"
                onClick={onClose}
                aria-label="Stop scanning"
                className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-black/60 text-white"
            >
                <X size={15} />
            </button>
        </div>
    );
}

/**
 * Getting a vault from another device: the code (typed or scanned), the transfer, then the
 * other vault's master password. Used in FocuzPass › Import and on focuznow.com/pwcode.
 */
export function ReceiveTransfer({
    initialCode,
    initialPackage,
    vaults,
    onImported,
}: {
    initialCode?: string;
    /** A package read from a .focuzpass backup file: skips straight to the password. */
    initialPackage?: VaultExportPackage;
    vaults?: VaultCollection[];
    onImported?: () => void | Promise<void>;
}) {
    // A code that came in the link (focuznow.com/pwcode#CODE) connects straight away.
    const [linkCode] = useState(() => (initialPackage || !initialCode ? null : codeFromText(initialCode)));
    const [step, setStep] = useState<Step>(() =>
        initialPackage ? { kind: 'password', pkg: initialPackage, route: 'file' } : linkCode ? { kind: 'connecting' } : { kind: 'code' },
    );
    const [input, setInput] = useState(linkCode ? formatTransferCode(linkCode) : '');
    const [password, setPassword] = useState('');
    const [vaultId, setVaultId] = useState('');
    const [scanning, setScanning] = useState(false);
    const cancelRef = useRef<(() => void) | null>(null);
    const canScan = !!barcodeDetector() && typeof navigator !== 'undefined' && !!navigator.mediaDevices;

    /** Joins the other device; every step after this arrives through the callbacks. */
    const connect = (code: string) => {
        cancelRef.current?.();
        cancelRef.current = receiveVault({
            code,
            onStatus: (status) => {
                if (status.phase === 'receiving') setStep({ kind: 'receiving', progress: status.progress, route: status.route });
                else if (status.phase === 'failed') setStep({ kind: 'code', error: status.error });
            },
            onPackage: (pkg) => setStep((current) => ({ kind: 'password', pkg, route: current.kind === 'receiving' ? current.route : 'direct' })),
        });
    };

    const start = (raw: string) => {
        const code = codeFromText(raw);
        if (!code) {
            setStep({ kind: 'code', error: 'That doesn\'t look like a transfer code. It has 10 letters and numbers, like K7Q4M-Z8TR1.' });
            return;
        }
        setScanning(false);
        setInput(formatTransferCode(code));
        setStep({ kind: 'connecting' });
        connect(code);
    };

    useEffect(() => {
        if (linkCode) connect(linkCode);
        return () => cancelRef.current?.();
        // Once, for the code in the link; `connect` only reads refs and setters.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const unlock = async () => {
        if (step.kind !== 'password' || !password) return;
        setStep({ ...step, busy: true, error: undefined });
        try {
            const result = await focuzPassImportPackage(step.pkg, password, { vaultId: vaultId || undefined });
            setPassword('');
            setStep({ kind: 'done', ...result });
            await onImported?.();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Couldn\'t import.';
            setStep({ ...step, busy: false, error: /master password/i.test(message) ? `That's not the master password of the vault ${step.route === 'file' ? 'this backup came from' : 'on the other device'}.` : message });
        }
    };

    return (
        <AnimatePresence mode="wait" initial={false}>
            <motion.div
                key={step.kind}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.22, ease: EASE }}
                className="space-y-4"
                data-focuzpass-ignore=""
            >
                {step.kind === 'code' && (
                    <>
                        <ol className="space-y-2 text-[13.5px] leading-[1.5] text-[var(--fz-text-2)]">
                            {['On the device that has your passwords, open FocuzPass and choose Transfer.', 'Type the code it shows, or scan its QR code.', 'Enter that vault\'s master password here to finish.'].map((text, i) => (
                                <li key={i} className="flex gap-3">
                                    <span className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--fz-bg-active)] text-[11px] font-semibold tabular-nums">{i + 1}</span>
                                    {text}
                                </li>
                            ))}
                        </ol>
                        {scanning ? (
                            <QrScanner onCode={start} onClose={() => setScanning(false)} />
                        ) : (
                            <form
                                className="flex gap-2"
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    start(input);
                                }}
                            >
                                <input
                                    value={input}
                                    onChange={(event) => setInput(event.target.value.toUpperCase())}
                                    onPaste={(event) => {
                                        const pasted = codeFromText(event.clipboardData.getData('text'));
                                        if (pasted) {
                                            event.preventDefault();
                                            start(pasted);
                                        }
                                    }}
                                    placeholder="K7Q4M-Z8TR1"
                                    autoFocus
                                    spellCheck={false}
                                    autoComplete="off"
                                    aria-label="Transfer code"
                                    className="h-11 min-w-0 flex-1 rounded-[10px] border border-[var(--fz-border)] bg-[var(--fz-bg-panel)] px-3.5 font-mono text-[17px] tracking-[0.18em] text-[var(--fz-text-1)] outline-none placeholder:text-[var(--fz-text-4)] focus:border-[var(--fz-border-strong)]"
                                />
                                {canScan && (
                                    <Button variant="secondary" onClick={() => setScanning(true)} iconLeft={<Camera size={14} />}>
                                        Scan
                                    </Button>
                                )}
                                <Button type="submit" variant="primary" iconRight={<ArrowRight size={14} />}>
                                    Connect
                                </Button>
                            </form>
                        )}
                        {step.error && (
                            <p role="alert" className="flex gap-2 rounded-[8px] bg-[var(--fz-danger-soft)] px-3 py-2.5 text-[13px] leading-[1.5] text-[var(--fz-danger)]">
                                <TriangleAlert size={14} className="mt-0.5 shrink-0" />
                                {step.error}
                            </p>
                        )}
                    </>
                )}

                {(step.kind === 'connecting' || step.kind === 'receiving') && (
                    <div className="flex flex-col items-center gap-3 py-8 text-center">
                        {step.kind === 'connecting' ? (
                            <Loader2 size={22} className="animate-spin text-[var(--fz-text-3)]" />
                        ) : (
                            <div className="h-1.5 w-56 overflow-hidden rounded-full bg-[var(--fz-bg-active)]">
                                <div className="h-full rounded-full bg-[var(--fz-text-1)] transition-[width] duration-200" style={{ width: `${Math.round(step.progress * 100)}%` }} />
                            </div>
                        )}
                        <p className="text-[14px] text-[var(--fz-text-2)]">{step.kind === 'connecting' ? `Connecting to ${input}…` : 'Receiving your vault…'}</p>
                        {step.kind === 'receiving' && (
                            <p className="flex items-center gap-1.5 text-[12.5px] text-[var(--fz-text-4)]">
                                <Wifi size={13} />
                                {step.route === 'direct' ? 'Direct connection between your devices' : 'Through the FocuzNow relay, still end-to-end encrypted'}
                            </p>
                        )}
                    </div>
                )}

                {step.kind === 'password' && (
                    <form
                        className="space-y-4"
                        onSubmit={(event) => {
                            event.preventDefault();
                            void unlock();
                        }}
                    >
                        <div className="flex items-center gap-3 rounded-[10px] border border-[var(--fz-border)] bg-[var(--fz-bg-panel)] px-3.5 py-3">
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-[9px] bg-[var(--fz-bg-active)] text-[var(--fz-text-2)]">
                                <Lock size={16} />
                            </span>
                            <div className="min-w-0">
                                <p className="text-[14px] font-medium text-[var(--fz-text-1)]">
                                    {step.pkg.itemCount.toLocaleString()} {step.pkg.itemCount === 1 ? 'item' : 'items'} {step.route === 'file' ? 'in this backup' : 'received'}, still encrypted
                                </p>
                                <p className="text-[12.5px] text-[var(--fz-text-3)]">
                                    {step.route === 'file' ? 'Enter the master password of the vault it was made from.' : 'Enter the master password of the vault on the other device to open them.'}
                                </p>
                            </div>
                        </div>
                        <label className="block">
                            <span className="mb-1.5 block text-[12.5px] font-medium text-[var(--fz-text-2)]">{step.route === 'file' ? 'Master password of that vault' : 'Master password of the other vault'}</span>
                            <input
                                type="password"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                autoFocus
                                autoComplete="off"
                                className="h-10 w-full rounded-[8px] border border-[var(--fz-border)] bg-[var(--fz-bg-panel)] px-3 text-[14px] text-[var(--fz-text-1)] outline-none focus:border-[var(--fz-border-strong)]"
                            />
                        </label>
                        {vaults && vaults.length > 1 && (
                            <label className="block">
                                <span className="mb-1.5 block text-[12.5px] font-medium text-[var(--fz-text-2)]">Items from vaults that don&apos;t exist here go to</span>
                                <select
                                    value={vaultId || vaults[0]?.id}
                                    onChange={(event) => setVaultId(event.target.value)}
                                    className="h-9 w-full rounded-[8px] border border-[var(--fz-border)] bg-[var(--fz-bg-panel)] px-2.5 text-[13px] text-[var(--fz-text-1)] outline-none"
                                >
                                    {vaults.map((vault) => (
                                        <option key={vault.id} value={vault.id}>{vault.name}</option>
                                    ))}
                                </select>
                            </label>
                        )}
                        {step.error && (
                            <p role="alert" className="flex gap-2 rounded-[8px] bg-[var(--fz-danger-soft)] px-3 py-2.5 text-[13px] leading-[1.5] text-[var(--fz-danger)]">
                                <TriangleAlert size={14} className="mt-0.5 shrink-0" />
                                {step.error}
                            </p>
                        )}
                        <div className="flex justify-end">
                            <Button type="submit" variant="primary" loading={step.busy} disabled={!password} iconLeft={<KeyRound size={14} />}>
                                Open and import
                            </Button>
                        </div>
                    </form>
                )}

                {step.kind === 'done' && (
                    <div className="flex flex-col items-center gap-3 py-6 text-center">
                        <span className="flex size-12 items-center justify-center rounded-full text-[var(--fz-success)]" style={{ boxShadow: 'inset 0 0 0 1px currentColor' }}>
                            <Check size={22} strokeWidth={2.5} />
                        </span>
                        <p className="text-[16px] font-medium text-[var(--fz-text-1)]">
                            {step.added ? `Added ${step.added.toLocaleString()} ${step.added === 1 ? 'item' : 'items'} to FocuzPass` : 'Everything was already here'}
                        </p>
                        <p className="max-w-[26rem] text-[13px] leading-[1.55] text-[var(--fz-text-3)]">
                            {[
                                step.duplicates ? `${step.duplicates.toLocaleString()} ${step.duplicates === 1 ? 'was' : 'were'} already on this device.` : '',
                                step.failed ? `${step.failed.toLocaleString()} couldn't be saved.` : '',
                                'They\'re encrypted with this device\'s master password now.',
                            ]
                                .filter(Boolean)
                                .join(' ')}
                        </p>
                    </div>
                )}
            </motion.div>
        </AnimatePresence>
    );
}
