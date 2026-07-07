import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import SimpleModal from './SimpleModal';

function GoogleIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
            <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
        </svg>
    );
}

type Props = {
    open: boolean;
    email: string;
    googleSignIn: boolean;
    onClose: () => void;
    onVerifyGoogle?: () => Promise<{ ok: boolean; error?: string }>;
    onConfirm: (password: string) => Promise<{ ok: boolean; error?: string }>;
};

export default function DeleteAccountModal({
    open,
    email,
    googleSignIn,
    onClose,
    onVerifyGoogle,
    onConfirm,
}: Props) {
    const [password, setPassword] = useState('');
    const [confirmText, setConfirmText] = useState('');
    const [error, setError] = useState('');
    const [deleting, setDeleting] = useState(false);
    const [googleVerified, setGoogleVerified] = useState(false);

    const confirmOk = confirmText.trim().toLowerCase() === 'delete';
    const canDelete = confirmOk && (googleSignIn ? googleVerified : password.length > 0);

    useEffect(() => {
        if (open) {
            setPassword('');
            setConfirmText('');
            setError('');
            setGoogleVerified(false);
        }
    }, [open]);

    const handleDelete = async () => {
        if (!canDelete || deleting) return;
        setDeleting(true);
        setError('');
        const result = await onConfirm(googleSignIn ? '' : password);
        setDeleting(false);
        if (!result.ok) {
            setError(result.error || 'Could not delete account.');
            return;
        }
        onClose();
    };

    const handleGoogleVerify = async () => {
        if (!onVerifyGoogle) return;
        setError('');
        setDeleting(true);
        const result = await onVerifyGoogle();
        setDeleting(false);
        if (!result.ok) {
            setError(result.error || 'Google verification failed.');
            return;
        }
        setGoogleVerified(true);
    };

    return (
        <SimpleModal
            open={open}
            title="Delete account permanently"
            description="This removes your profile, scheduling links, calendar data, and subscription access. This cannot be undone."
            onClose={onClose}
            maxWidth="max-w-lg"
            danger
        >
            <div className="flex gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/25">
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <ul className="text-xs text-red-200/90 space-y-1 list-disc list-inside">
                    <li>All block lists, habits, and focus history in this extension</li>
                    <li>Scheduling links and bookings on your account</li>
                    <li>Your FocuzNow login — you will need a new account to return</li>
                </ul>
            </div>

            <label className="block space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                    Account email
                </span>
                <p className="text-sm text-white font-mono">{email}</p>
            </label>

            {googleSignIn ? (
                <div className="space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                        Verify identity
                    </span>
                    {googleVerified ? (
                        <p className="text-xs text-emerald-400 font-medium">Verified with Google</p>
                    ) : (
                        <button
                            type="button"
                            onClick={() => void handleGoogleVerify()}
                            disabled={deleting}
                            className="w-full py-3 px-4 rounded-xl bg-white text-[#1f1f1f] hover:bg-neutral-100 text-sm font-semibold flex items-center justify-center gap-2.5 disabled:opacity-50"
                        >
                            <GoogleIcon className="w-5 h-5 shrink-0" />
                            Verify with Google
                        </button>
                    )}
                </div>
            ) : (
                <label className="block space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                        Confirm password
                    </span>
                    <input
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Your current password"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-neutral-600 outline-none focus:border-red-500/50 text-sm"
                    />
                </label>
            )}

            <label className="block space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                    Type <span className="normal-case">delete</span> to confirm
                </span>
                <input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="delete"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-neutral-600 outline-none focus:border-red-500/50 text-sm font-mono normal-case"
                />
            </label>

            {error && <p className="text-xs text-red-400 font-medium">{error}</p>}

            <div className="flex gap-2 pt-1">
                <button
                    type="button"
                    onClick={onClose}
                    disabled={deleting}
                    className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 text-sm font-bold"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={() => void handleDelete()}
                    disabled={!canDelete || deleting}
                    className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    {deleting ? 'Deleting…' : 'Delete my account'}
                </button>
            </div>
        </SimpleModal>
    );
}
