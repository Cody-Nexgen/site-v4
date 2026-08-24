import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import { ArrowRight, Check, LockKeyhole, ShieldCheck, X } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
    focuzPassSetup,
    focuzPassStatus,
    focuzPassUnlock,
    type VaultStatus,
} from '../lib/focuzPass/client';
import './unlock.css';

type AccessMode = 'loading' | 'setup' | 'unlock' | 'success' | 'error';

function announceAccessChange() {
    try {
        void chrome.runtime.sendMessage({ type: 'FOCUZPASS_ACCESS_CHANGED' }).catch(() => undefined);
    } catch {
        /* the opener also polls status */
    }
}

function AccessWindow() {
    const [mode, setMode] = useState<AccessMode>('loading');
    const [status, setStatus] = useState<VaultStatus | null>(null);
    const [password, setPassword] = useState('');
    const [confirmation, setConfirmation] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        let active = true;
        void focuzPassStatus()
            .then((next) => {
                if (!active) return;
                setStatus(next);
                if (next.unlocked) setMode('success');
                else setMode(next.configured ? 'unlock' : 'setup');
            })
            .catch((cause) => {
                if (!active) return;
                setError(cause instanceof Error ? cause.message : 'FocuzPass could not open');
                setMode('error');
            });
        return () => { active = false; };
    }, []);

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        if (busy) return;
        if (password.length < 8) {
            setError('Use at least 8 characters.');
            return;
        }
        if (mode === 'setup' && password !== confirmation) {
            setError('The passwords do not match.');
            return;
        }
        setBusy(true);
        setError('');
        try {
            const next = mode === 'setup'
                ? await focuzPassSetup(password)
                : await focuzPassUnlock(password);
            setStatus(next);
            setPassword('');
            setConfirmation('');
            setMode('success');
            announceAccessChange();
            window.setTimeout(() => window.close(), 650);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'The vault could not be unlocked');
        } finally {
            setBusy(false);
        }
    };

    const isSetup = mode === 'setup';
    return (
        <main className="access-window">
            <header className="access-window__topbar">
                <div className="access-window__brand"><span aria-hidden="true" />FocuzPass</div>
                <button type="button" onClick={() => window.close()} aria-label="Close unlock window"><X size={16} /></button>
            </header>

            <section className={`access-window__content is-${mode}`} aria-live="polite">
                <div className="access-window__lock" aria-hidden="true">
                    {mode === 'success' ? <Check size={30} /> : <LockKeyhole size={30} />}
                </div>

                {mode === 'loading' && <><p className="access-window__eyebrow">Private window</p><h1>Opening your vault</h1><p>Checking the encrypted vault on this device…</p><div className="access-window__progress"><i /></div></>}

                {mode === 'error' && <><p className="access-window__eyebrow">Could not connect</p><h1>FocuzPass is unavailable</h1><p>{error}</p><button className="access-window__secondary" type="button" onClick={() => window.location.reload()}>Try again</button></>}

                {mode === 'success' && <><p className="access-window__eyebrow">Access granted</p><h1>{status?.configured ? 'Vault unlocked' : 'Vault ready'}</h1><p>Returning you to FocuzPass.</p></>}

                {(mode === 'setup' || mode === 'unlock') && (
                    <>
                        <p className="access-window__eyebrow">{isSetup ? 'Private setup' : 'Private window'}</p>
                        <h1>{isSetup ? 'Create your vault' : 'Unlock FocuzPass'}</h1>
                        <p>{isSetup ? 'Choose the master password that protects this device.' : 'Enter your master password to decrypt this device’s vault.'}</p>
                        <form onSubmit={submit}>
                            <label>
                                <span>Master password</span>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(event) => setPassword(event.target.value)}
                                    autoComplete={isSetup ? 'new-password' : 'current-password'}
                                    placeholder={isSetup ? 'At least 8 characters' : 'Enter master password'}
                                    autoFocus
                                />
                            </label>
                            {isSetup && (
                                <label>
                                    <span>Confirm password</span>
                                    <input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" placeholder="Repeat master password" />
                                </label>
                            )}
                            {error && <p className="access-window__error" role="alert">{error}</p>}
                            <button className="access-window__primary" type="submit" disabled={busy}>
                                <span>{busy ? (isSetup ? 'Creating vault…' : 'Unlocking…') : (isSetup ? 'Create encrypted vault' : 'Unlock vault')}</span>
                                {!busy && <ArrowRight size={16} />}
                            </button>
                        </form>
                    </>
                )}
            </section>

            <footer><ShieldCheck size={14} /><span>Your master password never leaves this device</span></footer>
        </main>
    );
}

createRoot(document.getElementById('root')!).render(<AccessWindow />);
