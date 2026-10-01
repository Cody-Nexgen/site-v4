import { useState, type FormEvent } from 'react';
import { KeyRound, ShieldCheck, TriangleAlert } from 'lucide-react';
import { Dialog } from '../../components/fz/Dialog';
import { Button } from '../../components/fz/Button';
import { focuzPassChangeMasterPassword } from '../../lib/focuzPass/client';

function strength(password: string): { label: string; tone: string; width: string } {
    if (!password) return { label: '', tone: 'var(--fz-border-strong)', width: '0%' };
    let score = 0;
    if (password.length >= 12) score++;
    if (password.length >= 16) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password) || /\s/.test(password)) score++;
    if (password.length < 8) return { label: 'Too short', tone: 'var(--fz-danger)', width: '15%' };
    if (score <= 2) return { label: 'Okay', tone: 'oklch(0.78 0.14 75)', width: '45%' };
    if (score === 3) return { label: 'Good', tone: 'var(--fz-success)', width: '70%' };
    return { label: 'Strong', tone: 'var(--fz-success)', width: '100%' };
}

const inputClass =
    'h-10 w-full rounded-[8px] border border-[var(--fz-border)] bg-[var(--fz-bg-panel)] px-3 text-[14px] text-[var(--fz-text-1)] outline-none focus:border-[var(--fz-border-strong)]';

/** FocuzPass › profile menu › Change master password. */
export function ChangeMasterPassword({ open, onClose, onChanged }: { open: boolean; onClose: () => void; onChanged: () => void }) {
    const [current, setCurrent] = useState('');
    const [next, setNext] = useState('');
    const [confirm, setConfirm] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const meter = strength(next);

    const close = () => {
        if (busy) return;
        setCurrent('');
        setNext('');
        setConfirm('');
        setError('');
        onClose();
    };

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        if (busy) return;
        if (next.length < 8) return setError('Use at least 8 characters.');
        if (next !== confirm) return setError('The new passwords don\'t match.');
        setBusy(true);
        setError('');
        try {
            await focuzPassChangeMasterPassword(current, next);
            setCurrent('');
            setNext('');
            setConfirm('');
            onChanged();
            onClose();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Couldn\'t change the master password.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={close}
            title="Change master password"
            description="You'll use the new one to unlock FocuzPass. Your items stay as they are."
            footer={
                <>
                    <Button variant="secondary" onClick={close} disabled={busy}>
                        Cancel
                    </Button>
                    <Button type="submit" form="fz-change-master" variant="primary" loading={busy} disabled={!current || !next || !confirm} iconLeft={<KeyRound size={14} />}>
                        Change password
                    </Button>
                </>
            }
        >
            <form id="fz-change-master" className="space-y-4" onSubmit={(event) => void submit(event)} data-focuzpass-ignore="">
                <label className="block">
                    <span className="mb-1.5 block text-[12.5px] font-medium text-[var(--fz-text-2)]">Current master password</span>
                    <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoFocus autoComplete="current-password" className={inputClass} />
                </label>
                <label className="block">
                    <span className="mb-1.5 block text-[12.5px] font-medium text-[var(--fz-text-2)]">New master password</span>
                    <input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" className={inputClass} />
                    <span className="mt-2 flex items-center gap-2.5">
                        <span className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--fz-bg-active)]">
                            <span className="block h-full rounded-full transition-[width,background-color] duration-200" style={{ width: meter.width, background: meter.tone }} />
                        </span>
                        <span className="w-16 text-right text-[12px] text-[var(--fz-text-3)]">{meter.label}</span>
                    </span>
                </label>
                <label className="block">
                    <span className="mb-1.5 block text-[12.5px] font-medium text-[var(--fz-text-2)]">Confirm new password</span>
                    <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" className={inputClass} />
                </label>
                {error && (
                    <p role="alert" className="flex gap-2 rounded-[8px] bg-[var(--fz-danger-soft)] px-3 py-2.5 text-[13px] leading-[1.5] text-[var(--fz-danger)]">
                        <TriangleAlert size={14} className="mt-0.5 shrink-0" />
                        {error}
                    </p>
                )}
                <p className="flex gap-2 text-[12.5px] leading-[1.5] text-[var(--fz-text-4)]">
                    <ShieldCheck size={14} className="mt-0.5 shrink-0" />
                    FocuzNow can&apos;t recover it, so pick one you&apos;ll remember. Backup files you already saved still open with the old password.
                </p>
            </form>
        </Dialog>
    );
}
