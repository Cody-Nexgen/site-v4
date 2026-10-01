import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Copy, Download, FileArchive, Loader2, QrCode, RefreshCw, ShieldCheck, TriangleAlert, Wifi } from 'lucide-react';
import { Dialog } from '../../components/fz/Dialog';
import { Button } from '../../components/fz/Button';
import { focuzPassExportPackage } from '../../lib/focuzPass/client';
import { CODE_TTL_MS, formatTransferCode, newTransferCode, transferLink } from '../../lib/focuzPass/transfer/code';
import { sendVault, type TransferStatus } from '../../lib/focuzPass/transfer/peer';
import { encodeQr, qrPath } from '../../lib/focuzPass/transfer/qr';

type Tab = 'code' | 'file';

const EASE = [0.16, 1, 0.3, 1] as const;

function useNow(active: boolean) {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        if (!active) return;
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, [active]);
    return now;
}

function QrSymbol({ text }: { text: string }) {
    const { d, viewBox } = useMemo(() => qrPath(encodeQr(text)), [text]);
    // Always dark on white: phone cameras read that most reliably, whatever the theme.
    return (
        <svg viewBox={`0 0 ${viewBox} ${viewBox}`} role="img" aria-label="QR code for this transfer" className="block size-full" shapeRendering="crispEdges">
            <rect width={viewBox} height={viewBox} fill="#fff" />
            <path d={d} fill="#111114" />
        </svg>
    );
}

function SendByCode({ itemCount }: { itemCount: number }) {
    const [code, setCode] = useState(() => newTransferCode());
    const [startedAt, setStartedAt] = useState(() => Date.now());
    const [status, setStatus] = useState<TransferStatus>({ phase: 'connecting' });
    const [copied, setCopied] = useState(false);
    const live = status.phase === 'waiting' || status.phase === 'connecting' || status.phase === 'sending';
    const now = useNow(live);
    const left = Math.max(0, CODE_TTL_MS - (now - startedAt));
    const link = transferLink(code);

    useEffect(() => sendVault({ code, getPackage: focuzPassExportPackage, onStatus: setStatus }), [code]);

    const renew = () => {
        setStatus({ phase: 'connecting' });
        setCode(newTransferCode());
        setStartedAt(Date.now());
    };

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(link);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1600);
        } catch {
            /* the link is on screen to copy by hand */
        }
    };

    const finished = status.phase === 'done' || status.phase === 'failed';

    return (
        <div className="grid gap-5 sm:grid-cols-[200px_1fr]">
            <div className="relative mx-auto w-[200px] sm:mx-0">
                <div className={`overflow-hidden rounded-[14px] p-1.5 transition-opacity duration-200 ${finished ? 'opacity-25' : ''}`} style={{ background: '#fff', boxShadow: 'inset 0 0 0 1px var(--fz-border-strong)' }}>
                    <QrSymbol text={link} />
                </div>
                {status.phase === 'done' && (
                    <motion.span
                        initial={{ scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.3, ease: EASE }}
                        className="absolute inset-0 m-auto flex size-14 items-center justify-center rounded-full bg-[var(--fz-bg-panel)] text-[var(--fz-success)]"
                        style={{ boxShadow: 'inset 0 0 0 1px currentColor' }}
                    >
                        <Check size={24} strokeWidth={2.5} />
                    </motion.span>
                )}
            </div>

            <div className="min-w-0 space-y-4">
                <div>
                    <p className="mb-1 text-[12px] font-medium text-[var(--fz-text-4)]">Transfer code</p>
                    <p className={`font-mono text-[26px] font-semibold tracking-[0.14em] text-[var(--fz-text-1)] ${finished ? 'opacity-40' : ''}`} data-transfer-code={code}>
                        {formatTransferCode(code)}
                    </p>
                    <button
                        type="button"
                        onClick={() => void copyLink()}
                        className="mt-1 inline-flex items-center gap-1.5 text-[12.5px] text-[var(--fz-text-3)] transition-colors hover:text-[var(--fz-text-1)]"
                    >
                        {copied ? <Check size={12} /> : <Copy size={12} />}
                        {copied ? 'Link copied' : 'Copy link'}
                    </button>
                </div>

                <ol className="space-y-2 text-[13px] leading-[1.5] text-[var(--fz-text-2)]">
                    {[
                        'Scan the QR with the other device\'s camera, or open focuznow.com/pwcode and type the code.',
                        'In FocuzPass there, you can also use Import › Another device.',
                        'Enter this vault\'s master password on that device to finish.',
                    ].map((text, i) => (
                        <li key={i} className="flex gap-2.5">
                            <span className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--fz-bg-active)] text-[11px] font-semibold tabular-nums">{i + 1}</span>
                            {text}
                        </li>
                    ))}
                </ol>

                <div className="rounded-[10px] border border-[var(--fz-border)] bg-[var(--fz-bg-panel)] px-3 py-2.5 text-[13px]" aria-live="polite">
                    {(status.phase === 'waiting' || status.phase === 'connecting') && (
                        <p className="flex items-center gap-2 text-[var(--fz-text-2)]">
                            {status.phase === 'waiting' ? (
                                <span className="relative flex size-2">
                                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--fz-success)] opacity-60" />
                                    <span className="relative inline-flex size-2 rounded-full bg-[var(--fz-success)]" />
                                </span>
                            ) : (
                                <Loader2 size={12} className="animate-spin text-[var(--fz-text-4)]" />
                            )}
                            {status.phase === 'connecting' ? 'Getting ready…' : 'Waiting for the other device'}
                            <span className="ml-auto tabular-nums text-[var(--fz-text-4)]">
                                {Math.floor(left / 60000)}:{String(Math.floor((left % 60000) / 1000)).padStart(2, '0')}
                            </span>
                        </p>
                    )}
                    {status.phase === 'sending' && (
                        <div className="space-y-2">
                            <p className="flex items-center gap-2 text-[var(--fz-text-2)]">
                                <Wifi size={13} />
                                {status.route === 'direct' ? 'Sending directly to the other device' : 'Sending through the FocuzNow relay (still encrypted)'}
                                <span className="ml-auto tabular-nums text-[var(--fz-text-4)]">{Math.round(status.progress * 100)}%</span>
                            </p>
                            <div className="h-1 overflow-hidden rounded-full bg-[var(--fz-bg-active)]">
                                <div className="h-full rounded-full bg-[var(--fz-text-1)] transition-[width] duration-200" style={{ width: `${Math.round(status.progress * 100)}%` }} />
                            </div>
                        </div>
                    )}
                    {status.phase === 'done' && (
                        <p className="flex items-center gap-2 text-[var(--fz-text-2)]">
                            <Check size={13} className="text-[var(--fz-success)]" />
                            Sent {itemCount ? `${itemCount.toLocaleString()} ${itemCount === 1 ? 'item' : 'items'}` : 'your vault'}. Finish on the other device.
                        </p>
                    )}
                    {status.phase === 'failed' && (
                        <p className="flex gap-2 text-[var(--fz-danger)]" role="alert">
                            <TriangleAlert size={13} className="mt-[3px] shrink-0" />
                            {status.error}
                        </p>
                    )}
                </div>

                <div className="flex items-start justify-between gap-3">
                    <p className="flex gap-2 text-[12px] leading-[1.5] text-[var(--fz-text-4)]">
                        <ShieldCheck size={13} className="mt-0.5 shrink-0" />
                        The vault stays encrypted with your master password the whole way. The code only finds the other device.
                    </p>
                    {finished && (
                        <Button size="sm" variant="secondary" onClick={renew} iconLeft={<RefreshCw size={13} />}>
                            New code
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}

function SaveBackupFile() {
    const [state, setState] = useState<{ busy?: boolean; saved?: string; error?: string }>({});
    const save = async () => {
        setState({ busy: true });
        try {
            const pkg = await focuzPassExportPackage();
            const d = new Date();
            const name = `FocuzPass-backup-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.focuzpass`;
            const url = URL.createObjectURL(new Blob([JSON.stringify(pkg)], { type: 'application/json' }));
            const a = document.createElement('a');
            a.href = url;
            a.download = name;
            a.click();
            window.setTimeout(() => URL.revokeObjectURL(url), 1000);
            setState({ saved: name });
        } catch (error) {
            setState({ error: error instanceof Error ? error.message : 'Couldn\'t make the backup.' });
        }
    };
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-[10px] border border-[var(--fz-border)] bg-[var(--fz-bg-panel)] px-3.5 py-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-[9px] bg-[var(--fz-bg-active)] text-[var(--fz-text-2)]">
                    <FileArchive size={16} />
                </span>
                <div className="min-w-0">
                    <p className="text-[14px] font-medium text-[var(--fz-text-1)]">One encrypted file with everything</p>
                    <p className="text-[12.5px] text-[var(--fz-text-3)]">Open it on any device with Import › Backup file and this vault&apos;s master password.</p>
                </div>
            </div>
            <ul className="space-y-1.5 text-[13px] leading-[1.5] text-[var(--fz-text-2)]">
                {['Every item, vault and tag, except the trash.', 'Encrypted with your master password, so it\'s safe to keep in cloud storage or on a USB drive.', 'If you change your master password later, this backup still opens with the one you have now.'].map((text) => (
                    <li key={text} className="flex gap-2">
                        <span className="mt-[8px] size-1 shrink-0 rounded-full bg-[var(--fz-text-4)]" />
                        {text}
                    </li>
                ))}
            </ul>
            {state.error && (
                <p role="alert" className="flex gap-2 rounded-[8px] bg-[var(--fz-danger-soft)] px-3 py-2.5 text-[13px] leading-[1.5] text-[var(--fz-danger)]">
                    <TriangleAlert size={14} className="mt-0.5 shrink-0" />
                    {state.error}
                </p>
            )}
            <div className="flex items-center justify-end gap-3">
                {state.saved && (
                    <span className="flex items-center gap-1.5 truncate text-[12.5px] text-[var(--fz-text-3)]">
                        <Check size={13} className="text-[var(--fz-success)]" />
                        Saved {state.saved}
                    </span>
                )}
                <Button variant="primary" loading={state.busy} onClick={() => void save()} iconLeft={<Download size={14} />}>
                    Download backup
                </Button>
            </div>
        </div>
    );
}

/** FocuzPass › Transfer: move the whole vault to another device with a code or QR, or save a backup file. */
export function TransferVault({ open, onClose, itemCount }: { open: boolean; onClose: () => void; itemCount: number }) {
    const [tab, setTab] = useState<Tab>('code');
    // Each time the dialog opens it gets a fresh code (and closing it stops the transfer).
    const [session, setSession] = useState(0);
    const wasOpen = useRef(open);
    useEffect(() => {
        if (open && !wasOpen.current) {
            setSession((n) => n + 1);
            setTab('code');
        }
        wasOpen.current = open;
    }, [open]);
    const close = useCallback(() => onClose(), [onClose]);

    return (
        <Dialog
            open={open}
            onClose={close}
            title="Transfer FocuzPass"
            description="Copy every item to another device. It arrives encrypted and opens with this vault's master password."
            size="lg"
        >
            <div className="mb-5 inline-flex rounded-[9px] bg-[var(--fz-bg-active)] p-0.5" role="tablist">
                {([
                    { id: 'code', label: 'Code or QR', icon: QrCode },
                    { id: 'file', label: 'Backup file', icon: FileArchive },
                ] as const).map((t) => (
                    <button
                        key={t.id}
                        type="button"
                        role="tab"
                        aria-selected={tab === t.id}
                        onClick={() => setTab(t.id)}
                        className={`relative flex items-center gap-1.5 rounded-[7px] px-3 py-1.5 text-[13px] font-medium transition-colors ${
                            tab === t.id ? 'text-[var(--fz-text-1)]' : 'text-[var(--fz-text-3)] hover:text-[var(--fz-text-2)]'
                        }`}
                    >
                        {tab === t.id && (
                            <motion.span
                                layoutId="transfer-tab"
                                className="absolute inset-0 rounded-[7px] bg-[var(--fz-bg-panel)]"
                                style={{ boxShadow: '0 1px 2px oklch(0 0 0 / 0.12), inset 0 0 0 1px var(--fz-border)' }}
                                transition={{ duration: 0.22, ease: EASE }}
                            />
                        )}
                        <t.icon size={13} className="relative" />
                        <span className="relative">{t.label}</span>
                    </button>
                ))}
            </div>
            <AnimatePresence mode="wait" initial={false}>
                <motion.div
                    key={tab}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2, ease: EASE }}
                >
                    {open && tab === 'code' ? <SendByCode key={session} itemCount={itemCount} /> : null}
                    {tab === 'file' ? <SaveBackupFile /> : null}
                </motion.div>
            </AnimatePresence>
        </Dialog>
    );
}
