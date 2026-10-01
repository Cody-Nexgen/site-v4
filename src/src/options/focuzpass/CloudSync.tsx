import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Cloud, Copy, Download, KeyRound, Laptop, Loader2, LockKeyhole, RefreshCw, ShieldCheck, Sparkles, TriangleAlert } from 'lucide-react';
import { Dialog } from '../../components/fz/Dialog';
import { Button } from '../../components/fz/Button';
import {
    focuzPassCloudAccount,
    focuzPassCloudAddDevice,
    focuzPassCloudCancel,
    focuzPassCloudEnable,
    focuzPassCloudKit,
    focuzPassCloudPrepare,
    focuzPassCloudStatus,
    focuzPassCloudSync,
    type CloudKit,
} from '../../lib/focuzPass/client';
import type { CloudStatus } from '../../lib/focuzPass/types';
import { parseAccountKey } from '../../lib/focuzPass/cloud/keys';
import { downloadPdf, emergencyKitPdf, recoveryKeyPdf } from '../../lib/focuzPass/cloud/kitPdf';

type Step =
    | { kind: 'loading' }
    | { kind: 'upsell' }
    | { kind: 'intro'; resuming: boolean }
    | { kind: 'kit'; kit: CloudKit; saved: boolean; recoverySaved: boolean }
    | { kind: 'confirm'; kit: CloudKit }
    | { kind: 'uploading' }
    | { kind: 'done'; uploaded: number }
    | { kind: 'add' }
    | { kind: 'added'; added: number; alreadyThere: number }
    | { kind: 'on'; status: CloudStatus; kit?: CloudKit };

const EASE = [0.16, 1, 0.3, 1] as const;
const inputClass =
    'h-10 w-full rounded-[8px] border border-[var(--fz-border)] bg-[var(--fz-bg-panel)] px-3 text-[14px] text-[var(--fz-text-1)] outline-none focus:border-[var(--fz-border-strong)]';

async function readIsPro(): Promise<boolean> {
    try {
        const stored = await chrome.storage.local.get('subscriptionTier');
        return stored.subscriptionTier === 'pro';
    } catch {
        return false;
    }
}

function Bullet({ icon, children }: { icon: ReactNode; children: ReactNode }) {
    return (
        <li className="flex gap-3 text-[13.5px] leading-[1.5] text-[var(--fz-text-2)]">
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-[7px] bg-[var(--fz-bg-active)] text-[var(--fz-text-2)]">{icon}</span>
            <span>{children}</span>
        </li>
    );
}

function KeyCard({ label, value, note, onDownload }: { label: string; value: string; note: ReactNode; onDownload: () => void }) {
    const [copied, setCopied] = useState(false);
    return (
        <div className="rounded-[12px] border border-[var(--fz-border)] bg-[var(--fz-bg-panel)] p-4">
            <p className="text-[12px] font-medium text-[var(--fz-text-4)]">{label}</p>
            <p className="mt-1 break-all font-mono text-[17px] font-semibold tracking-[0.06em] text-[var(--fz-text-1)]" data-key={label}>
                {value}
            </p>
            <p className="mt-1.5 text-[12.5px] leading-[1.5] text-[var(--fz-text-3)]">{note}</p>
            <div className="mt-3 flex gap-2">
                <Button size="sm" variant="primary" onClick={onDownload} iconLeft={<Download size={13} />}>
                    Download
                </Button>
                <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                        void navigator.clipboard.writeText(value).then(() => {
                            setCopied(true);
                            window.setTimeout(() => setCopied(false), 1500);
                        });
                    }}
                    iconLeft={copied ? <Check size={13} /> : <Copy size={13} />}
                >
                    {copied ? 'Copied' : 'Copy'}
                </Button>
            </div>
        </div>
    );
}

/** FocuzPass › profile menu › Cloud sync. */
/** "Synced 3 min ago", for the status line. */
function syncedAgo(iso?: string): string {
    if (!iso) return 'Not synced yet this session';
    const minutes = Math.floor((Date.now() - Date.parse(iso)) / 60000);
    if (minutes < 1) return 'Synced just now';
    if (minutes < 60) return `Synced ${minutes} min ago`;
    return `Synced at ${new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

export function CloudSync({ open, onClose }: { open: boolean; onClose: () => void }) {
    const [step, setStep] = useState<Step>({ kind: 'loading' });
    const [password, setPassword] = useState('');
    const [secretKey, setSecretKey] = useState('');
    const [localPassword, setLocalPassword] = useState('');
    const [samePassword, setSamePassword] = useState(true);
    const [recovery, setRecovery] = useState(true);
    const [lastFour, setLastFour] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!open) return;
        let alive = true;
        void (async () => {
            const [status, pro] = await Promise.all([focuzPassCloudStatus().catch(() => null), readIsPro()]);
            if (!alive) return;
            if (status?.state === 'on') {
                setStep({ kind: 'on', status });
                return;
            }
            if (!pro) {
                setStep({ kind: 'upsell' });
                return;
            }
            // Cloud sync already on for this account (from another device): this one joins it instead.
            const account = status?.state === 'pending' ? null : await focuzPassCloudAccount().catch(() => null);
            if (!alive) return;
            if (account?.signedIn && account.exists) setStep({ kind: 'add' });
            else setStep({ kind: 'intro', resuming: status?.state === 'pending' });
        })();
        return () => {
            alive = false;
        };
    }, [open]);

    const close = () => {
        if (busy || step.kind === 'uploading') return;
        setPassword('');
        setSecretKey('');
        setLocalPassword('');
        setLastFour('');
        setError('');
        onClose();
        window.setTimeout(() => setStep({ kind: 'loading' }), 250);
    };

    const run = async (work: () => Promise<void>) => {
        setBusy(true);
        setError('');
        try {
            await work();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Something went wrong.');
        } finally {
            setBusy(false);
        }
    };

    const prepare = (event: FormEvent) => {
        event.preventDefault();
        void run(async () => {
            const kit = await focuzPassCloudPrepare(password, recovery);
            setPassword('');
            setStep({ kind: 'kit', kit, saved: false, recoverySaved: !kit.recoveryKey });
        });
    };

    const upload = (event: FormEvent) => {
        event.preventDefault();
        if (step.kind !== 'confirm') return;
        const expected = step.kit.secretKey.replace(/-/g, '').slice(-4);
        if (lastFour.trim().toUpperCase() !== expected) {
            setError('That doesn\'t match the end of your Security Key. Check the kit you saved.');
            return;
        }
        setError('');
        setStep({ kind: 'uploading' });
        void focuzPassCloudEnable()
            .then(({ uploaded }) => setStep({ kind: 'done', uploaded }))
            .catch((cause) => {
                const message = cause instanceof Error ? cause.message : 'The upload didn\'t finish. Try again; it carries on where it stopped.';
                if (/Add this device/.test(message)) {
                    void focuzPassCloudCancel().catch(() => undefined);
                    setStep({ kind: 'add' });
                } else {
                    setStep({ kind: 'confirm', kit: step.kit });
                }
                setError(message);
            });
    };

    const addDevice = (event: FormEvent) => {
        event.preventDefault();
        void run(async () => {
            const result = await focuzPassCloudAddDevice({ masterPassword: password, secretKey, localPassword: samePassword ? password : localPassword });
            setPassword('');
            setSecretKey('');
            setLocalPassword('');
            setStep({ kind: 'added', ...result });
        });
    };

    const syncNow = () => {
        if (step.kind !== 'on') return;
        void run(async () => {
            try {
                await focuzPassCloudSync();
            } finally {
                const status = await focuzPassCloudStatus().catch(() => null);
                if (status) setStep((current) => (current.kind === 'on' ? { ...current, status } : current));
            }
        });
    };

    const showKit = (event: FormEvent) => {
        event.preventDefault();
        if (step.kind !== 'on') return;
        void run(async () => {
            const kit = await focuzPassCloudKit(password);
            setPassword('');
            setStep({ ...step, kit });
        });
    };

    const saveKit = (kit: CloudKit) =>
        downloadPdf(
            'FocuzPass Emergency Kit.pdf',
            emergencyKitPdf({
                email: kit.email,
                secretKey: kit.secretKey,
                secretKeyCanonical: parseAccountKey(kit.secretKey, 'secret') ?? kit.secretKey.replace(/-/g, ''),
                secretKeyId: kit.secretKeyId,
                created: new Date(),
            }),
        );

    let title = 'Cloud sync';
    let description: string | undefined;
    let footer: ReactNode = null;
    if (step.kind === 'intro') {
        title = step.resuming ? 'Finish turning on Cloud sync' : 'Turn on Cloud sync';
        description = 'Use FocuzPass on your other devices, with a copy of your vault only you can open.';
        footer = (
            <>
                {step.resuming && (
                    <Button variant="ghost" disabled={busy} onClick={() => void run(async () => { await focuzPassCloudCancel(); close(); })}>
                        Cancel setup
                    </Button>
                )}
                <Button type="submit" form="fz-cloud-intro" variant="primary" loading={busy} disabled={!password}>
                    Continue
                </Button>
            </>
        );
    } else if (step.kind === 'kit') {
        title = 'Save your Emergency Kit';
        description = 'Print it and write your passwords in by hand. You\'ll need it to open FocuzPass on a new device.';
        footer = (
            <Button variant="primary" disabled={!step.saved || !step.recoverySaved} onClick={() => { setError(''); setLastFour(''); setStep({ kind: 'confirm', kit: step.kit }); }}>
                I&apos;ve saved it
            </Button>
        );
    } else if (step.kind === 'confirm') {
        title = 'Check your Emergency Kit';
        footer = (
            <>
                <Button variant="secondary" onClick={() => setStep({ kind: 'kit', kit: step.kit, saved: true, recoverySaved: true })}>
                    Back to the kit
                </Button>
                <Button type="submit" form="fz-cloud-confirm" variant="primary" disabled={lastFour.trim().length !== 4} iconLeft={<Cloud size={14} />}>
                    Turn on Cloud sync
                </Button>
            </>
        );
    } else if (step.kind === 'add') {
        title = 'Add this device to Cloud sync';
        description = 'Cloud sync is already on for your FocuzNow account. Bring this device in with your Security Key.';
        footer = (
            <Button type="submit" form="fz-cloud-add" variant="primary" loading={busy} disabled={!password || !secretKey || (!samePassword && !localPassword)} iconLeft={<Laptop size={14} />}>
                Add this device
            </Button>
        );
    } else if (step.kind === 'done' || step.kind === 'upsell' || step.kind === 'added') {
        footer = (
            <Button variant="primary" onClick={close}>
                Done
            </Button>
        );
    } else if (step.kind === 'on') {
        footer = (
            <Button variant="secondary" onClick={close}>
                Close
            </Button>
        );
    }

    return (
        <Dialog open={open} onClose={close} title={title} description={description} footer={footer} size="md">
            <AnimatePresence mode="wait" initial={false}>
                <motion.div
                    key={step.kind}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2, ease: EASE }}
                    className="space-y-4"
                    data-focuzpass-ignore=""
                >
                    {step.kind === 'loading' && (
                        <div className="flex justify-center py-10">
                            <Loader2 size={20} className="animate-spin text-[var(--fz-text-3)]" />
                        </div>
                    )}

                    {step.kind === 'upsell' && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <span className="flex size-10 items-center justify-center rounded-[10px] bg-[var(--fz-bg-active)] text-[var(--fz-text-2)]">
                                    <Sparkles size={18} />
                                </span>
                                <div>
                                    <p className="text-[15px] font-medium text-[var(--fz-text-1)]">Cloud sync is part of FocuzNow Pro</p>
                                    <p className="text-[13px] text-[var(--fz-text-3)]">Your vault stays on this device until then, with everything else working as it does now.</p>
                                </div>
                            </div>
                            <ul className="space-y-2.5">
                                <Bullet icon={<Cloud size={13} />}>Your passwords on every device where you use FocuzNow.</Bullet>
                                <Bullet icon={<LockKeyhole size={13} />}>Encrypted on your device first. FocuzNow can&apos;t read your vault.</Bullet>
                            </ul>
                        </div>
                    )}

                    {step.kind === 'intro' && (
                        <form id="fz-cloud-intro" className="space-y-4" onSubmit={prepare}>
                            <ul className="space-y-2.5">
                                <Bullet icon={<LockKeyhole size={13} />}>Your vault is encrypted on this device before it goes anywhere. FocuzNow can&apos;t read it, even with full access to its servers.</Bullet>
                                <Bullet icon={<KeyRound size={13} />}>A new device needs your master password and your Security Key, which you&apos;ll save in an Emergency Kit next.</Bullet>
                                <Bullet icon={<ShieldCheck size={13} />}>This device remembers the Security Key, so here you keep unlocking with just your master password.</Bullet>
                            </ul>
                            <label className="block">
                                <span className="mb-1.5 block text-[12.5px] font-medium text-[var(--fz-text-2)]">Master password</span>
                                <input type="password" value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }} autoFocus autoComplete="current-password" className={inputClass} />
                            </label>
                            {!step.resuming && (
                                <label className="flex cursor-pointer items-start gap-2.5 text-[13px] text-[var(--fz-text-2)]">
                                    <input type="checkbox" checked={recovery} onChange={(e) => setRecovery(e.target.checked)} className="mt-0.5 size-4 accent-[var(--fz-text-1)]" />
                                    <span>
                                        Also make a recovery key (recommended)
                                        <span className="block text-[12px] text-[var(--fz-text-4)]">Lets you set a new master password if you ever forget yours.</span>
                                    </span>
                                </label>
                            )}
                        </form>
                    )}

                    {step.kind === 'kit' && (
                        <div className="space-y-3">
                            <KeyCard
                                label="Security Key"
                                value={step.kit.secretKey}
                                note={<>For {step.kit.email || 'your FocuzNow account'} · Key ID {step.kit.secretKeyId}. FocuzNow never has it and can&apos;t send it again.</>}
                                onDownload={() => {
                                    saveKit(step.kit);
                                    setStep((current) => (current.kind === 'kit' ? { ...current, saved: true } : current));
                                }}
                            />
                            {step.kit.recoveryKey && (
                                <KeyCard
                                    label="Recovery key"
                                    value={step.kit.recoveryKey}
                                    note="Keep it apart from the Emergency Kit: with your FocuzNow sign-in it opens your vault without your master password."
                                    onDownload={() => {
                                        downloadPdf('FocuzPass Recovery Key.pdf', recoveryKeyPdf({ email: step.kit.email, recoveryKey: step.kit.recoveryKey!, created: new Date() }));
                                        setStep((current) => (current.kind === 'kit' ? { ...current, recoverySaved: true } : current));
                                    }}
                                />
                            )}
                            {(!step.saved || !step.recoverySaved) && (
                                <label className="flex cursor-pointer items-center gap-2.5 text-[12.5px] text-[var(--fz-text-3)]">
                                    <input
                                        type="checkbox"
                                        checked={step.saved && step.recoverySaved}
                                        onChange={(e) => {
                                            const checked = e.target.checked;
                                            setStep((current) => (current.kind === 'kit' ? { ...current, saved: checked, recoverySaved: checked } : current));
                                        }}
                                        className="size-4 accent-[var(--fz-text-1)]"
                                    />
                                    I wrote them down or saved them another way
                                </label>
                            )}
                        </div>
                    )}

                    {step.kind === 'confirm' && (
                        <form id="fz-cloud-confirm" className="space-y-3" onSubmit={upload}>
                            <p className="text-[13.5px] leading-[1.5] text-[var(--fz-text-2)]">
                                Type the last 4 characters of your Security Key, from the kit you saved.
                            </p>
                            <input
                                value={lastFour}
                                onChange={(e) => { setLastFour(e.target.value.toUpperCase().slice(0, 4)); setError(''); }}
                                autoFocus
                                spellCheck={false}
                                autoComplete="off"
                                aria-label="Last 4 characters of the Security Key"
                                placeholder="XXXX"
                                className={`${inputClass} w-32 text-center font-mono text-[17px] tracking-[0.3em]`}
                            />
                        </form>
                    )}

                    {step.kind === 'uploading' && (
                        <div className="flex flex-col items-center gap-3 py-8 text-center">
                            <Loader2 size={22} className="animate-spin text-[var(--fz-text-3)]" />
                            <p className="text-[14px] text-[var(--fz-text-2)]">Encrypting and uploading your vault…</p>
                            <p className="text-[12.5px] text-[var(--fz-text-4)]">Only ciphertext leaves this device.</p>
                        </div>
                    )}

                    {step.kind === 'done' && (
                        <div className="flex flex-col items-center gap-3 py-6 text-center">
                            <span className="flex size-12 items-center justify-center rounded-full text-[var(--fz-success)]" style={{ boxShadow: 'inset 0 0 0 1px currentColor' }}>
                                <Check size={22} strokeWidth={2.5} />
                            </span>
                            <p className="text-[16px] font-medium text-[var(--fz-text-1)]">Cloud sync is on</p>
                            <p className="max-w-[26rem] text-[13px] leading-[1.55] text-[var(--fz-text-3)]">
                                {uploadedText(step.uploaded)} Keeping every device up to date arrives in the next update.
                            </p>
                        </div>
                    )}

                    {step.kind === 'add' && (
                        <form id="fz-cloud-add" className="space-y-4" onSubmit={addDevice}>
                            <label className="block">
                                <span className="mb-1.5 block text-[12.5px] font-medium text-[var(--fz-text-2)]">Security Key</span>
                                <input
                                    value={secretKey}
                                    onChange={(e) => { setSecretKey(e.target.value); setError(''); }}
                                    autoFocus
                                    spellCheck={false}
                                    autoComplete="off"
                                    placeholder="A1-XXXXXX-XXXXX-XXXXX-XXXXX-XXXXX"
                                    className={`${inputClass} font-mono tracking-[0.04em]`}
                                />
                                <span className="mt-1 block text-[12px] text-[var(--fz-text-4)]">It&apos;s in your Emergency Kit, or under Cloud sync on a device that already syncs.</span>
                            </label>
                            <label className="block">
                                <span className="mb-1.5 block text-[12.5px] font-medium text-[var(--fz-text-2)]">FocuzPass Cloud master password</span>
                                <input type="password" value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }} autoComplete="current-password" className={inputClass} />
                            </label>
                            <label className="flex cursor-pointer items-start gap-2.5 text-[13px] text-[var(--fz-text-2)]">
                                <input type="checkbox" checked={samePassword} onChange={(e) => setSamePassword(e.target.checked)} className="mt-0.5 size-4 accent-[var(--fz-text-1)]" />
                                <span>This device uses the same master password</span>
                            </label>
                            {!samePassword && (
                                <label className="block">
                                    <span className="mb-1.5 block text-[12.5px] font-medium text-[var(--fz-text-2)]">This device&apos;s master password</span>
                                    <input type="password" value={localPassword} onChange={(e) => { setLocalPassword(e.target.value); setError(''); }} autoComplete="current-password" className={inputClass} />
                                    <span className="mt-1 block text-[12px] text-[var(--fz-text-4)]">After this, the device unlocks with your Cloud master password.</span>
                                </label>
                            )}
                            <p className="text-[12.5px] leading-[1.5] text-[var(--fz-text-3)]">Anything on this device that isn&apos;t in the cloud yet is added to it. Nothing is deleted.</p>
                        </form>
                    )}

                    {step.kind === 'added' && (
                        <div className="flex flex-col items-center gap-3 py-6 text-center">
                            <span className="flex size-12 items-center justify-center rounded-full text-[var(--fz-success)]" style={{ boxShadow: 'inset 0 0 0 1px currentColor' }}>
                                <Check size={22} strokeWidth={2.5} />
                            </span>
                            <p className="text-[16px] font-medium text-[var(--fz-text-1)]">This device syncs now</p>
                            <p className="max-w-[26rem] text-[13px] leading-[1.55] text-[var(--fz-text-3)]">
                                {step.added ? `${step.added.toLocaleString()} ${step.added === 1 ? 'item' : 'items'} from this device ${step.added === 1 ? 'was' : 'were'} added to your cloud vault. ` : ''}
                                From now on, unlock FocuzPass here with your FocuzPass Cloud master password.
                            </p>
                        </div>
                    )}

                    {step.kind === 'on' && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 rounded-[12px] border border-[var(--fz-border)] bg-[var(--fz-bg-panel)] px-4 py-3">
                                <span className="flex size-9 shrink-0 items-center justify-center rounded-[9px] text-[var(--fz-success)]" style={{ boxShadow: 'inset 0 0 0 1px currentColor' }}>
                                    <Cloud size={16} />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[14px] font-medium text-[var(--fz-text-1)]">Cloud sync is on</p>
                                    <p className="truncate text-[12.5px] text-[var(--fz-text-3)]">
                                        {step.status.email || 'Your FocuzNow account'} · {step.status.syncing ? 'Syncing…' : syncedAgo(step.status.lastSyncAt)}
                                    </p>
                                </div>
                                <Button size="sm" variant="secondary" onClick={syncNow} loading={busy && !password} iconLeft={<RefreshCw size={13} />}>
                                    Sync now
                                </Button>
                            </div>
                            {step.status.syncError && (
                                <p className="flex gap-2 text-[12.5px] leading-[1.5] text-[var(--fz-text-3)]">
                                    <TriangleAlert size={13} className="mt-0.5 shrink-0 text-[var(--fz-warning,var(--fz-text-3))]" />
                                    <span>Last sync didn&apos;t finish: {step.status.syncError.message} Your changes are safe on this device and go up on the next sync.</span>
                                </p>
                            )}
                            {step.status.accountPending && (
                                <p className="text-[12.5px] leading-[1.5] text-[var(--fz-text-3)]">Your new master password reaches the cloud copy the next time this device is online.</p>
                            )}
                            {step.kit ? (
                                <KeyCard
                                    label="Security Key"
                                    value={step.kit.secretKey}
                                    note={<>Key ID {step.kit.secretKeyId}. Save a new copy of your Emergency Kit if you&apos;ve lost the old one.</>}
                                    onDownload={() => saveKit(step.kit!)}
                                />
                            ) : (
                                <form className="space-y-2" onSubmit={showKit}>
                                    <p className="text-[13px] text-[var(--fz-text-2)]">Need your Emergency Kit again? Enter your master password to see your Security Key.</p>
                                    <div className="flex gap-2">
                                        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} aria-label="Master password" autoComplete="current-password" className={inputClass} />
                                        <Button type="submit" variant="secondary" loading={busy} disabled={!password}>
                                            Show
                                        </Button>
                                    </div>
                                </form>
                            )}
                        </div>
                    )}

                    {error && (
                        <p role="alert" className="flex gap-2 rounded-[8px] bg-[var(--fz-danger-soft)] px-3 py-2.5 text-[13px] leading-[1.5] text-[var(--fz-danger)]">
                            <TriangleAlert size={14} className="mt-0.5 shrink-0" />
                            {error}
                        </p>
                    )}
                </motion.div>
            </AnimatePresence>
        </Dialog>
    );
}

function uploadedText(count: number) {
    return `${count.toLocaleString()} ${count === 1 ? 'thing is' : 'things are'} encrypted in your FocuzNow account.`;
}
