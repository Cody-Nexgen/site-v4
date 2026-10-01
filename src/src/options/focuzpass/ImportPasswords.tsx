import { useRef, useState, type DragEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Check, FileArchive, FileUp, Info, Loader2, QrCode, ShieldCheck, TriangleAlert } from 'lucide-react';
import { Dialog } from '../../components/fz/Dialog';
import { Button } from '../../components/fz/Button';
import { focuzPassImport, type VaultCollection } from '../../lib/focuzPass/client';
import { BRAND_MARKS } from '../../lib/focuzPass/importBrands';
import {
    IMPORT_SOURCES,
    parseImportFile,
    summarizeImport,
    type ImportParseResult,
    type ImportSource,
} from '../../lib/focuzPass/importers';
import type { VaultExportPackage } from '../../lib/focuzPass/types';
import { ReceiveTransfer } from './ReceiveTransfer';
import { readBackupFile } from '../../lib/focuzPass/transfer/backupFile';

type Step =
    | { kind: 'pick' }
    | { kind: 'device'; finished?: boolean }
    | { kind: 'backup'; pkg?: VaultExportPackage; fileName?: string; error?: string; finished?: boolean }
    | { kind: 'guide'; source: ImportSource; error?: string; reading?: boolean }
    | { kind: 'review'; source: ImportSource; fileName: string; parsed: ImportParseResult }
    | { kind: 'importing'; source: ImportSource; count: number; done?: number }
    | { kind: 'done'; source: ImportSource; added: number; duplicates: number; failed: number };

const EASE = [0.16, 1, 0.3, 1] as const;

/** Light brand colours (Keeper's yellow) need a dark glyph. */
function isLight(hex: string) {
    const n = parseInt(hex.slice(1), 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    return 0.299 * r + 0.587 * g + 0.114 * b > 170;
}

export function SourceMark({ source, size = 36 }: { source: ImportSource; size?: number }) {
    const mark = source.mark ? BRAND_MARKS[source.mark] : undefined;
    const ring = 'inset 0 0 0 1px oklch(1 0 0 / 0.1)';
    if (mark) {
        return (
            <span
                aria-hidden
                className="flex shrink-0 items-center justify-center"
                style={{ width: size, height: size, borderRadius: size * 0.26, background: mark.color, boxShadow: ring }}
            >
                <svg viewBox={mark.viewBox ?? '0 0 24 24'} width={size * 0.54} height={size * 0.54} fill={isLight(mark.color) ? '#16161a' : '#fff'}>
                    {mark.layers
                        ? mark.layers.map((layer, i) => (
                              <path key={i} d={layer.d} fill={layer.fill} fillRule={layer.evenOdd ? 'evenodd' : undefined} clipRule={layer.evenOdd ? 'evenodd' : undefined} />
                          ))
                        : <path d={mark.path} />}
                </svg>
            </span>
        );
    }
    return (
        <span
            aria-hidden
            className="flex shrink-0 items-center justify-center bg-[var(--fz-bg-active)] font-semibold tracking-[-0.02em] text-[var(--fz-text-2)]"
            style={{ width: size, height: size, borderRadius: size * 0.26, fontSize: size * (source.letters && source.letters.length > 2 ? 0.26 : 0.34), boxShadow: 'inset 0 0 0 1px var(--fz-border-strong)' }}
        >
            {source.letters}
        </span>
    );
}

function plural(n: number, one: string, many = `${one}s`) {
    return `${n.toLocaleString()} ${n === 1 ? one : many}`;
}

export function ImportPasswords({
    open,
    onClose,
    vaults,
    onImported,
}: {
    open: boolean;
    onClose: () => void;
    vaults: VaultCollection[];
    /** Called after a successful import so the list can reload. */
    onImported: () => Promise<void> | void;
}) {
    const [step, setStep] = useState<Step>({ kind: 'pick' });
    const [vaultId, setVaultId] = useState('');
    const [tagImport, setTagImport] = useState(true);
    const [dragging, setDragging] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const close = () => {
        if (step.kind === 'importing') return;
        onClose();
        // Drop parsed secrets as soon as the dialog goes away.
        window.setTimeout(() => setStep({ kind: 'pick' }), 250);
    };

    const readFile = async (source: ImportSource, file: File) => {
        setStep({ kind: 'guide', source, reading: true });
        try {
            const parsed = await parseImportFile(source.id, file);
            setStep({ kind: 'review', source, fileName: file.name, parsed });
        } catch (error) {
            setStep({ kind: 'guide', source, error: error instanceof Error ? error.message : 'FocuzPass couldn\'t read that file.' });
        }
    };

    const runImport = async (source: ImportSource, parsed: ImportParseResult) => {
        setStep({ kind: 'importing', source, count: parsed.items.length });
        try {
            const result = await focuzPassImport(
                parsed.items,
                { vaultId: vaultId || vaults[0]?.id, tagName: tagImport ? `Imported from ${source.name}` : undefined },
                (done, count) => setStep({ kind: 'importing', source, count, done }),
            );
            await onImported();
            setStep({ kind: 'done', source, ...result });
        } catch (error) {
            setStep({ kind: 'guide', source, error: error instanceof Error ? error.message : 'The import didn\'t finish. Nothing was changed.' });
        }
    };

    const onDrop = (event: DragEvent, source: ImportSource) => {
        event.preventDefault();
        setDragging(false);
        const file = event.dataTransfer.files?.[0];
        if (file) void readFile(source, file);
    };

    const readBackup = async (file: File) => {
        try {
            setStep({ kind: 'backup', pkg: await readBackupFile(file), fileName: file.name });
        } catch (error) {
            setStep({ kind: 'backup', error: error instanceof Error ? error.message : 'FocuzPass couldn\'t read that file.' });
        }
    };

    const title =
        step.kind === 'pick'
            ? 'Import passwords'
            : step.kind === 'device'
              ? 'Import from another device'
              : step.kind === 'backup'
                ? 'Open a FocuzPass backup'
                : step.kind === 'done'
                  ? 'Import complete'
                  : `Import from ${step.source.name}`;

    const description =
        step.kind === 'pick' ? 'Moving from another app? Choose it to get the steps to export from it, then pick the file.' : undefined;

    let footer = null;
    if (step.kind === 'device' || step.kind === 'backup') {
        footer = step.finished ? (
            <Button variant="primary" onClick={close}>
                Done
            </Button>
        ) : (
            <Button variant="secondary" onClick={() => setStep({ kind: 'pick' })} iconLeft={<ArrowLeft size={14} />}>
                All sources
            </Button>
        );
    } else if (step.kind === 'guide') {
        footer = (
            <>
                <Button variant="secondary" onClick={() => setStep({ kind: 'pick' })} iconLeft={<ArrowLeft size={14} />}>
                    All apps
                </Button>
                <Button variant="primary" onClick={() => fileRef.current?.click()} loading={step.reading} iconLeft={<FileUp size={14} />}>
                    Import {step.source.format}
                </Button>
            </>
        );
    } else if (step.kind === 'review') {
        const count = step.parsed.items.length;
        footer = (
            <>
                <Button variant="secondary" onClick={() => setStep({ kind: 'guide', source: step.source })}>
                    Choose another file
                </Button>
                <Button variant="primary" disabled={!count} onClick={() => void runImport(step.source, step.parsed)}>
                    {count ? `Import ${plural(count, 'item')}` : 'Nothing to import'}
                </Button>
            </>
        );
    } else if (step.kind === 'done') {
        footer = (
            <Button variant="primary" onClick={close}>
                Done
            </Button>
        );
    }

    return (
        <Dialog open={open} onClose={close} title={title} description={description} size="lg" footer={footer}>
            <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept={step.kind === 'guide' ? step.source.accept : step.kind === 'backup' ? '.focuzpass,application/json' : undefined}
                onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (file && step.kind === 'guide') void readFile(step.source, file);
                    if (file && step.kind === 'backup') void readBackup(file);
                }}
            />
            <AnimatePresence mode="wait" initial={false}>
                <motion.div
                    key={step.kind === 'pick' || step.kind === 'device' ? step.kind : step.kind === 'backup' ? `backup-${step.pkg ? 'open' : 'pick'}` : `${step.kind}-${step.source.id}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.22, ease: EASE }}
                >
                    {step.kind === 'pick' && (
                        <div className="space-y-4">
                            <div>
                                <p className="mb-2 text-[12px] font-medium text-[var(--fz-text-4)]">From FocuzPass</p>
                                <div className="grid gap-2 sm:grid-cols-2">
                                    {([
                                        { kind: 'device', icon: QrCode, name: 'Another device', detail: 'Type its code or scan its QR' },
                                        { kind: 'backup', icon: FileArchive, name: 'Backup file', detail: 'A .focuzpass file' },
                                    ] as const).map((option) => (
                                        <button
                                            key={option.kind}
                                            type="button"
                                            onClick={() => setStep({ kind: option.kind })}
                                            className="group flex items-center gap-3 rounded-[10px] border border-[var(--fz-border)] bg-[var(--fz-bg-panel)] p-2.5 text-left transition-colors hover:border-[var(--fz-border-strong)] hover:bg-[var(--fz-bg-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fz-focus-ring)]"
                                        >
                                            <span
                                                aria-hidden
                                                className="flex size-9 shrink-0 items-center justify-center rounded-[9px] bg-[var(--fz-bg-active)] text-[var(--fz-text-2)]"
                                                style={{ boxShadow: 'inset 0 0 0 1px var(--fz-border-strong)' }}
                                            >
                                                <option.icon size={17} />
                                            </span>
                                            <span className="min-w-0">
                                                <span className="block truncate text-[13.5px] font-medium text-[var(--fz-text-1)]">{option.name}</span>
                                                <span className="block truncate text-[12px] text-[var(--fz-text-4)]">{option.detail}</span>
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <p className="mb-2 text-[12px] font-medium text-[var(--fz-text-4)]">From another app</p>
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                            {IMPORT_SOURCES.map((source) => (
                                <button
                                    key={source.id}
                                    type="button"
                                    onClick={() => setStep({ kind: 'guide', source })}
                                    className="group flex items-center gap-3 rounded-[10px] border border-[var(--fz-border)] bg-[var(--fz-bg-panel)] p-2.5 text-left transition-colors hover:border-[var(--fz-border-strong)] hover:bg-[var(--fz-bg-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fz-focus-ring)]"
                                >
                                    <SourceMark source={source} />
                                    <span className="min-w-0">
                                        <span className="block truncate text-[13.5px] font-medium text-[var(--fz-text-1)]">{source.name}</span>
                                        <span className="block truncate text-[12px] text-[var(--fz-text-4)]">{source.format}</span>
                                    </span>
                                </button>
                            ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {step.kind === 'device' && (
                        <ReceiveTransfer
                            vaults={vaults}
                            onImported={async () => {
                                await onImported();
                                setStep({ kind: 'device', finished: true });
                            }}
                        />
                    )}

                    {step.kind === 'backup' && step.pkg && (
                        <ReceiveTransfer
                            initialPackage={step.pkg}
                            vaults={vaults}
                            onImported={async () => {
                                await onImported();
                                setStep((current) => (current.kind === 'backup' ? { ...current, finished: true } : current));
                            }}
                        />
                    )}

                    {step.kind === 'backup' && !step.pkg && (
                        <div className="space-y-4">
                            <p className="text-[13.5px] leading-[1.5] text-[var(--fz-text-2)]">
                                Choose a backup you saved from FocuzPass (Transfer, then Backup file). You&apos;ll need the master password of the vault it came from.
                            </p>
                            <button
                                type="button"
                                onClick={() => fileRef.current?.click()}
                                onDragOver={(event) => {
                                    event.preventDefault();
                                    setDragging(true);
                                }}
                                onDragLeave={() => setDragging(false)}
                                onDrop={(event) => {
                                    event.preventDefault();
                                    setDragging(false);
                                    const file = event.dataTransfer.files?.[0];
                                    if (file) void readBackup(file);
                                }}
                                className={`flex w-full flex-col items-center justify-center gap-1.5 rounded-[10px] border border-dashed px-4 py-7 text-center transition-colors ${
                                    dragging ? 'border-[var(--fz-text-3)] bg-[var(--fz-bg-hover)]' : 'border-[var(--fz-border-strong)] hover:bg-[var(--fz-bg-hover)]'
                                }`}
                            >
                                <FileArchive size={18} className="text-[var(--fz-text-3)]" />
                                <span className="text-[13px] text-[var(--fz-text-2)]">Drop the backup here, or click to choose it</span>
                                <span className="text-[12px] text-[var(--fz-text-4)]">.focuzpass</span>
                            </button>
                            {step.error && (
                                <p role="alert" className="flex gap-2 rounded-[8px] bg-[var(--fz-danger-soft)] px-3 py-2.5 text-[13px] leading-[1.5] text-[var(--fz-danger)]">
                                    <TriangleAlert size={14} className="mt-0.5 shrink-0" />
                                    {step.error}
                                </p>
                            )}
                        </div>
                    )}

                    {step.kind === 'guide' && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <SourceMark source={step.source} size={40} />
                                <div>
                                    <p className="text-[14px] font-medium text-[var(--fz-text-1)]">Export from {step.source.name}</p>
                                    <p className="text-[12.5px] text-[var(--fz-text-3)]">You need a {step.source.format}. Then import it here, it takes about a minute.</p>
                                </div>
                            </div>
                            <ol className="space-y-2.5">
                                {step.source.steps.map((text, i) => (
                                    <li key={i} className="flex gap-3 text-[13.5px] leading-[1.5] text-[var(--fz-text-2)]">
                                        <span className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--fz-bg-active)] text-[11px] font-semibold tabular-nums text-[var(--fz-text-2)]">
                                            {i + 1}
                                        </span>
                                        <span>{text}</span>
                                    </li>
                                ))}
                            </ol>
                            {step.source.tip && (
                                <p className="flex gap-2 rounded-[8px] bg-[var(--fz-bg-hover)] px-3 py-2.5 text-[12.5px] leading-[1.5] text-[var(--fz-text-3)]">
                                    <Info size={14} className="mt-0.5 shrink-0" />
                                    {step.source.tip}
                                </p>
                            )}
                            <button
                                type="button"
                                onClick={() => fileRef.current?.click()}
                                onDragOver={(event) => {
                                    event.preventDefault();
                                    setDragging(true);
                                }}
                                onDragLeave={() => setDragging(false)}
                                onDrop={(event) => onDrop(event, step.source)}
                                className={`flex w-full flex-col items-center justify-center gap-1.5 rounded-[10px] border border-dashed px-4 py-5 text-center transition-colors ${
                                    dragging
                                        ? 'border-[var(--fz-text-3)] bg-[var(--fz-bg-hover)]'
                                        : 'border-[var(--fz-border-strong)] hover:bg-[var(--fz-bg-hover)]'
                                }`}
                            >
                                {step.reading ? <Loader2 size={18} className="animate-spin text-[var(--fz-text-3)]" /> : <FileUp size={18} className="text-[var(--fz-text-3)]" />}
                                <span className="text-[13px] text-[var(--fz-text-2)]">{step.reading ? 'Reading the file…' : 'Drop the file here, or click to choose it'}</span>
                                <span className="text-[12px] text-[var(--fz-text-4)]">{step.source.accept.split(',').join('  ')}</span>
                            </button>
                            {step.error && (
                                <p role="alert" className="flex gap-2 rounded-[8px] bg-[var(--fz-danger-soft,oklch(0.72_0.14_25/0.12))] px-3 py-2.5 text-[13px] leading-[1.5] text-[var(--fz-danger)]">
                                    <TriangleAlert size={14} className="mt-0.5 shrink-0" />
                                    {step.error}
                                </p>
                            )}
                            <p className="flex gap-2 text-[12.5px] leading-[1.5] text-[var(--fz-text-4)]">
                                <ShieldCheck size={14} className="mt-0.5 shrink-0" />
                                The export isn&apos;t encrypted. FocuzPass reads it on this device and never uploads it. Delete it once you&apos;re done.
                            </p>
                        </div>
                    )}

                    {step.kind === 'review' && (() => {
                        const counts = summarizeImport(step.parsed.items);
                        const stats = [
                            { label: 'Logins', value: counts.logins },
                            { label: 'Cards', value: counts.cards },
                            { label: 'Identities', value: counts.identities },
                            ...(counts.other ? [{ label: 'Other', value: counts.other }] : []),
                        ];
                        return (
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <SourceMark source={step.source} size={40} />
                                    <div className="min-w-0">
                                        <p className="truncate text-[14px] font-medium text-[var(--fz-text-1)]">{step.fileName}</p>
                                        <p className="text-[12.5px] text-[var(--fz-text-3)]">Read on this device. Nothing has been saved yet.</p>
                                    </div>
                                </div>
                                <div className={`grid gap-2 ${stats.length > 3 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
                                    {stats.map((s) => (
                                        <div key={s.label} className="rounded-[10px] border border-[var(--fz-border)] bg-[var(--fz-bg-panel)] px-3 py-2.5">
                                            <p className="text-[20px] font-semibold tabular-nums text-[var(--fz-text-1)]">{s.value.toLocaleString()}</p>
                                            <p className="text-[12px] text-[var(--fz-text-3)]">{s.label}</p>
                                        </div>
                                    ))}
                                </div>
                                {(step.parsed.skipped.length > 0 || step.parsed.totpInNotes > 0) && (
                                    <ul className="space-y-1.5 text-[12.5px] leading-[1.5] text-[var(--fz-text-3)]">
                                        {step.parsed.skipped.map((s) => (
                                            <li key={s.reason} className="flex gap-2">
                                                <span className="mt-[7px] size-1 shrink-0 rounded-full bg-[var(--fz-text-4)]" />
                                                Leaving out {plural(s.count, 'item')}: {s.reason.charAt(0).toLowerCase() + s.reason.slice(1)}.
                                            </li>
                                        ))}
                                        {step.parsed.totpInNotes > 0 && (
                                            <li className="flex gap-2">
                                                <span className="mt-[7px] size-1 shrink-0 rounded-full bg-[var(--fz-text-4)]" />
                                                {plural(step.parsed.totpInNotes, 'one-time code secret')} will be kept in the login&apos;s notes.
                                            </li>
                                        )}
                                    </ul>
                                )}
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <label className="block">
                                        <span className="mb-1.5 block text-[12.5px] font-medium text-[var(--fz-text-2)]">Add to vault</span>
                                        <select
                                            value={vaultId || vaults[0]?.id || ''}
                                            onChange={(event) => setVaultId(event.target.value)}
                                            className="h-9 w-full rounded-[8px] border border-[var(--fz-border)] bg-[var(--fz-bg-panel)] px-2.5 text-[13px] text-[var(--fz-text-1)] outline-none focus:border-[var(--fz-border-strong)]"
                                        >
                                            {vaults.map((vault) => (
                                                <option key={vault.id} value={vault.id}>
                                                    {vault.name}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <label className="flex cursor-pointer items-start gap-2.5 self-end pb-2 text-[13px] text-[var(--fz-text-2)]">
                                        <input type="checkbox" checked={tagImport} onChange={(event) => setTagImport(event.target.checked)} className="mt-0.5 size-4 accent-[var(--fz-text-1)]" />
                                        <span>
                                            Tag them &ldquo;Imported from {step.source.name}&rdquo;
                                            <span className="block text-[12px] text-[var(--fz-text-4)]">Easy to find and review later.</span>
                                        </span>
                                    </label>
                                </div>
                                <p className="text-[12.5px] leading-[1.5] text-[var(--fz-text-4)]">
                                    Anything already in FocuzPass (same site, username and password) is skipped.
                                </p>
                            </div>
                        );
                    })()}

                    {step.kind === 'importing' && (
                        <div className="flex flex-col items-center justify-center gap-3 py-12">
                            <Loader2 size={22} className="animate-spin text-[var(--fz-text-3)]" />
                            <p className="text-[14px] text-[var(--fz-text-2)]">
                                {step.done ? `Saving ${step.done.toLocaleString()} of ${step.count.toLocaleString()}…` : `Encrypting ${plural(step.count, 'item')}…`}
                            </p>
                        </div>
                    )}

                    {step.kind === 'done' && (
                        <div className="flex flex-col items-center gap-3 py-8 text-center">
                            <motion.span
                                className="flex size-12 items-center justify-center rounded-full text-[var(--fz-success)]"
                                style={{ boxShadow: 'inset 0 0 0 1px currentColor' }}
                                initial={{ scale: 0.6, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ duration: 0.32, ease: EASE }}
                            >
                                <Check size={22} strokeWidth={2.5} />
                            </motion.span>
                            <p className="text-[16px] font-medium text-[var(--fz-text-1)]">
                                {step.added ? `Imported ${plural(step.added, 'item')} from ${step.source.name}` : 'Everything was already in FocuzPass'}
                            </p>
                            <p className="max-w-[26rem] text-[13px] leading-[1.55] text-[var(--fz-text-3)]">
                                {[
                                    step.duplicates ? `${plural(step.duplicates, 'item')} ${step.duplicates === 1 ? 'was' : 'were'} already here and skipped.` : '',
                                    step.failed ? `${plural(step.failed, 'item')} couldn't be saved.` : '',
                                    'Now delete the export file you downloaded: it isn\'t encrypted.',
                                ]
                                    .filter(Boolean)
                                    .join(' ')}
                            </p>
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>
        </Dialog>
    );
}
