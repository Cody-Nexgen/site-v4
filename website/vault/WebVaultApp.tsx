import { useEffect, useState, type FormEvent } from 'react';
import { Loader2, TriangleAlert } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Mark } from '../components/landing/Mark';
import { WebVault } from '@focuz/options/focuzpass/WebVault';
import type { CloudStore } from '@focuz/lib/focuzPass/cloud/store';

const input =
    'h-10 w-full rounded-[8px] border border-[var(--fz-border-strong)] bg-[var(--fz-bg-panel)] px-3 text-[14px] text-[var(--fz-text-1)] outline-none transition-[border-color,box-shadow] placeholder:text-[var(--fz-text-4)] focus:border-[var(--fz-text-3)] focus:shadow-[0_0_0_3px_var(--fz-bg-active)]';
const primary =
    'inline-flex h-10 w-full items-center justify-center gap-2 rounded-[8px] bg-[var(--fz-text-1)] px-4 text-[13.5px] font-medium text-[var(--fz-bg)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50';
const secondary =
    'inline-flex h-10 w-full items-center justify-center gap-2 rounded-[8px] border border-[var(--fz-border)] px-3 text-[13px] font-medium text-[var(--fz-text-2)] transition-colors hover:bg-[var(--fz-bg-hover)] hover:text-[var(--fz-text-1)]';

/** Signing in to FocuzNow comes first; then it's FocuzPass itself. */
function SignIn() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        setBusy(true);
        setError('');
        const { error: failed } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        setBusy(false);
        if (failed) setError(failed.message || 'That email and password didn\'t work.');
    };

    return (
        <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[var(--fz-bg)] px-4 py-10 text-[var(--fz-text-1)]">
            <div className="flex items-center gap-2.5">
                <Mark size={28} />
                <span className="text-[15px] font-semibold tracking-[-0.01em]">FocuzPass</span>
            </div>
            <div className="w-full max-w-[400px] rounded-[16px] border border-[var(--fz-border)] bg-[var(--fz-bg-panel)] p-6">
                <h1 className="text-[20px] font-semibold tracking-[-0.02em]">Sign in to FocuzNow</h1>
                <p className="mt-1.5 text-[13px] leading-[1.55] text-[var(--fz-text-3)]">Then unlock FocuzPass with your Security Key and master password.</p>
                <form onSubmit={submit} className="mt-5 space-y-3">
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" autoComplete="email" className={input} autoFocus />
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="FocuzNow password" autoComplete="current-password" className={input} />
                    {error && (
                        <p role="alert" className="flex gap-2 rounded-[8px] bg-[var(--fz-danger-soft)] px-3 py-2.5 text-[12.5px] leading-[1.5] text-[var(--fz-danger)]">
                            <TriangleAlert size={14} className="mt-0.5 shrink-0" />
                            {error}
                        </p>
                    )}
                    <button type="submit" className={primary} disabled={busy || !email || !password}>
                        {busy ? <Loader2 size={15} className="animate-spin" /> : null}
                        Sign in
                    </button>
                </form>
                <button
                    type="button"
                    onClick={() => void supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/vault.html` } })}
                    className={`${secondary} mt-3`}
                >
                    Continue with Google
                </button>
            </div>
        </main>
    );
}

/** `demo`: dev only (vault.html?demo), an in-memory cloud instead of Supabase. */
export function WebVaultApp({ demo }: { demo?: { store: CloudStore; email: string; hint: string } }) {
    const [session, setSession] = useState<'loading' | 'signed-out' | { email?: string }>(demo ? { email: demo.email } : 'loading');

    useEffect(() => {
        if (demo) return;
        void supabase.auth.getSession().then(({ data }) => setSession(data.session ? { email: data.session.user.email } : 'signed-out'));
        const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next ? { email: next.user.email } : 'signed-out'));
        return () => data.subscription.unsubscribe();
    }, [demo]);

    if (session === 'loading') {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[var(--fz-bg)]">
                <Loader2 size={20} className="animate-spin text-[var(--fz-text-3)]" />
            </div>
        );
    }
    if (session === 'signed-out') return <SignIn />;
    return (
        <div className="focuz-dashboard h-screen w-full bg-[var(--fz-bg-panel)] text-[var(--fz-text-1)]">
            {demo && (
                <p className="fixed bottom-3 left-1/2 z-50 -translate-x-1/2 rounded-[8px] border border-dashed border-[var(--fz-border-strong)] bg-[var(--fz-bg-panel)] px-3 py-1.5 font-mono text-[11px] text-[var(--fz-text-3)]">
                    Dev demo · {demo.hint}
                </p>
            )}
            <WebVault
                username={session.email?.split('@')[0]}
                accountName={session.email}
                onExit={() => window.location.assign('/app')}
                store={demo?.store}
                realtime={demo ? null : undefined}
            />
        </div>
    );
}
