import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '../components/fz/Button';
import {
    focuzPassOpenAccessWindow,
    focuzPassSnapshot,
    focuzPassStatus,
    type VaultCollection,
} from '../lib/focuzPass/client';
import { ReceiveTransfer } from '../options/focuzpass/ReceiveTransfer';

type Phase = { kind: 'checking' } | { kind: 'not-setup' } | { kind: 'locked'; waiting?: boolean } | { kind: 'ready' } | { kind: 'error'; message: string };

/**
 * focuznow.com/pwcode's card, running inside the extension: the other vault's master password
 * is typed here, where the website can't see it.
 */
export function EmbeddedReceive({ initialCode }: { initialCode?: string }) {
    const [phase, setPhase] = useState<Phase>({ kind: 'checking' });
    const [vaults, setVaults] = useState<VaultCollection[]>([]);

    const check = useCallback(async (): Promise<{ phase: Phase; vaults?: VaultCollection[] }> => {
        try {
            const status = await focuzPassStatus();
            if (!status.configured) return { phase: { kind: 'not-setup' } };
            if (!status.unlocked) return { phase: { kind: 'locked' } };
            return { phase: { kind: 'ready' }, vaults: (await focuzPassSnapshot()).vaults };
        } catch (error) {
            return { phase: { kind: 'error', message: error instanceof Error ? error.message : 'FocuzPass didn\'t answer.' } };
        }
    }, []);

    useEffect(() => {
        let alive = true;
        void check().then((next) => {
            if (!alive) return;
            if (next.vaults) setVaults(next.vaults);
            setPhase(next.phase);
        });
        return () => {
            alive = false;
        };
    }, [check]);

    // Until FocuzPass is set up and unlocked, keep checking so the card moves on by itself.
    useEffect(() => {
        if (phase.kind !== 'locked' && phase.kind !== 'not-setup') return;
        const timer = window.setInterval(() => {
            void check().then((next) => {
                if (next.phase.kind === phase.kind) return;
                if (next.vaults) setVaults(next.vaults);
                setPhase(next.phase);
            });
        }, 1500);
        return () => window.clearInterval(timer);
    }, [phase.kind, check]);

    const openFocuzPass = async () => {
        setPhase((p) => (p.kind === 'locked' ? { ...p, waiting: true } : p));
        await focuzPassOpenAccessWindow().catch(() => undefined);
    };

    if (phase.kind === 'checking') {
        return (
            <div className="flex justify-center py-10">
                <Loader2 size={20} className="animate-spin text-[var(--fz-text-3)]" />
            </div>
        );
    }
    if (phase.kind === 'ready') {
        return (
            <ReceiveTransfer
                initialCode={initialCode}
                vaults={vaults}
                onImported={async () => {
                    setVaults((await focuzPassSnapshot()).vaults);
                }}
            />
        );
    }
    const copy =
        phase.kind === 'not-setup'
            ? { title: 'Set up FocuzPass first', body: 'Create a master password for FocuzPass on this device. This card continues by itself.', action: 'Open FocuzPass' }
            : phase.kind === 'locked'
              ? {
                    title: 'Unlock FocuzPass on this device',
                    body: phase.waiting ? 'Waiting for you to unlock it…' : 'Unlock it with this device\'s master password so the items can be added. This card continues by itself.',
                    action: 'Unlock FocuzPass',
                }
              : { title: 'Something went wrong', body: phase.message, action: '' };
    return (
        <div className="py-1">
            <p className="text-[15px] font-medium text-[var(--fz-text-1)]">{copy.title}</p>
            <p className="mt-1.5 text-[13.5px] leading-[1.55] text-[var(--fz-text-3)]">{copy.body}</p>
            {copy.action && (
                <Button className="mt-4" variant="primary" onClick={() => void openFocuzPass()}>
                    {copy.action}
                </Button>
            )}
        </div>
    );
}
