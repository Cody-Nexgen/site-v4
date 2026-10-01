import { useEffect, useState } from 'react';
import { Cloud, KeyRound, Laptop, MonitorSmartphone } from 'lucide-react';
import { Dialog } from '../../components/fz/Dialog';
import { Button } from '../../components/fz/Button';
import { focuzPassPasskeySettings } from '../../lib/focuzPass/client';

function Point({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <li className="flex gap-3 text-[13px] leading-[1.5] text-[var(--fz-text-2)]">
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-[7px] bg-[var(--fz-bg-active)] text-[var(--fz-text-2)]">{icon}</span>
            <span>{children}</span>
        </li>
    );
}

/** FocuzPass › profile menu › Passkeys. */
export function PasskeySettings({ open, onClose }: { open: boolean; onClose: () => void }) {
    const [enabled, setEnabled] = useState<boolean | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!open) return;
        let alive = true;
        void focuzPassPasskeySettings()
            .then((settings) => alive && setEnabled(settings.enabled))
            .catch(() => alive && setEnabled(false));
        return () => {
            alive = false;
        };
    }, [open]);

    const toggle = async () => {
        if (enabled === null || busy) return;
        setBusy(true);
        setError('');
        try {
            setEnabled((await focuzPassPasskeySettings(!enabled)).enabled);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'That setting didn\'t change.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            title="Passkeys"
            description="Save passkeys in FocuzPass and sign in with them in this browser."
            size="md"
            footer={<Button variant="secondary" onClick={onClose}>Done</Button>}
        >
            <div className="space-y-5" data-focuzpass-ignore="">
                <div className="flex items-start gap-3 rounded-[12px] border border-[var(--fz-border)] bg-[var(--fz-bg-panel)] px-4 py-3.5">
                    <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-[9px] bg-[var(--fz-bg-active)] text-[var(--fz-text-2)]">
                        <KeyRound size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2 text-[14px] font-medium text-[var(--fz-text-1)]">
                            Use FocuzPass for passkeys
                            <span className="rounded-full border border-[var(--fz-border)] px-1.5 py-px text-[10.5px] font-medium text-[var(--fz-text-3)]">Experimental</span>
                        </p>
                        <p className="mt-1 text-[12.5px] leading-[1.5] text-[var(--fz-text-3)]">
                            On by default. When a site asks for a passkey, FocuzPass offers to save it or sign you in; &ldquo;Use another device&rdquo; always switches to your browser&apos;s own passkeys (like Windows Hello).
                        </p>
                    </div>
                    <button
                        type="button"
                        role="switch"
                        aria-checked={Boolean(enabled)}
                        aria-label="Use FocuzPass for passkeys"
                        disabled={enabled === null || busy}
                        onClick={() => void toggle()}
                        className={`relative mt-1 h-[22px] w-[38px] shrink-0 rounded-full transition-colors disabled:opacity-50 ${enabled ? 'bg-[var(--fz-text-1)]' : 'bg-[var(--fz-bg-active)] shadow-[inset_0_0_0_1px_var(--fz-border-strong)]'}`}
                    >
                        <span className={`absolute top-[3px] size-4 rounded-full transition-[left] ${enabled ? 'left-[19px] bg-[var(--fz-bg)]' : 'left-[3px] bg-[var(--fz-text-3)]'}`} />
                    </button>
                </div>
                <ul className="space-y-2.5">
                    <Point icon={<Cloud size={13} />}>With Cloud sync on, your passkeys sync to your other devices like everything else in your vault. Without it, they stay on this device.</Point>
                    <Point icon={<Laptop size={13} />}>Passkeys work while FocuzPass is unlocked. If it&apos;s locked, the prompt asks you to unlock first.</Point>
                    <Point icon={<MonitorSmartphone size={13} />}>Showing up in Windows&apos; own passkey dialog, and on phones, needs the FocuzPass apps. They&apos;re planned.</Point>
                </ul>
                {error && <p role="alert" className="text-[12.5px] text-[var(--fz-danger)]">{error}</p>}
            </div>
        </Dialog>
    );
}
