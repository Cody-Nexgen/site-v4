import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
    ArrowRight,
    Check,
    ChevronRight,
    Copy,
    CreditCard,
    Download,
    Eye,
    EyeOff,
    Fingerprint,
    KeyRound,
    Laptop,
    Lock,
    MoreHorizontal,
    Plus,
    RefreshCw,
    Search,
    ShieldCheck,
    ShieldEllipsis,
    Sparkles,
    Trash2,
    Wifi,
    X,
} from 'lucide-react';
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ModalPortal from '../components/ModalPortal';
import {
    focuzPassDelete,
    focuzPassGenerate,
    focuzPassList,
    focuzPassLock,
    focuzPassSetup,
    focuzPassStatus,
    focuzPassTouch,
    focuzPassUnlock,
    focuzPassUpsert,
    type DecryptedVaultItem,
    type VaultStatus,
} from '../lib/focuzPass/client';
import { formatRelativeTime } from '../lib/focuzPass/vaultCore';
import { isWebPlatform } from '../lib/platform';

type VaultItemType = 'login' | 'card' | 'passkey';
type VaultFilter = 'all' | VaultItemType | 'risk';
type PasswordStrength = 'weak' | 'okay' | 'strong';

type VaultItem = {
    id: string;
    type: VaultItemType;
    title: string;
    identity: string;
    domain?: string;
    password?: string;
    cardNumber?: string;
    expiry?: string;
    cvv?: string;
    authMethod: string;
    strength?: PasswordStrength;
    risk?: 'weak' | 'reused';
    lastUsed: string;
    note?: string;
    mark: string;
    markTone: string;
    credentialId?: string;
    experimental?: boolean;
};

type BootState = 'loading' | 'companion' | 'setup' | 'locked' | 'ready' | 'error';

const FILTERS: { id: VaultFilter; label: string }[] = [
    { id: 'all', label: 'All items' },
    { id: 'login', label: 'Logins' },
    { id: 'card', label: 'Cards' },
    { id: 'passkey', label: 'Passkeys' },
    { id: 'risk', label: 'Weak & reused' },
];

const TYPE_META: Record<VaultItemType, { label: string; icon: typeof KeyRound }> = {
    login: { label: 'Login', icon: KeyRound },
    card: { label: 'Card', icon: CreditCard },
    passkey: { label: 'Passkey', icon: Fingerprint },
};

function authMethodLabel(item: DecryptedVaultItem): string {
    if (item.type === 'card') {
        const last4 = item.cardNumber?.slice(-4);
        return last4 ? `Card •••• ${last4}` : 'Card';
    }
    if (item.type === 'passkey') return 'Passkey (experimental)';
    const map: Record<string, string> = {
        PASSWORD: 'Password',
        GOOGLE_SSO: 'Sign in with Google',
        MICROSOFT_SSO: 'Sign in with Microsoft',
        CLASSLINK_SSO: 'ClassLink SSO',
        APPLE_SSO: 'Sign in with Apple',
        OKTA_SSO: 'Okta SSO',
        SAML_GENERIC: 'SSO',
        PASSKEY: 'Passkey',
        MAGIC_LINK: 'Magic link',
        OTP_ONLY: 'OTP only',
        CARD: 'Card',
    };
    return map[item.authMethod] || item.authMethod;
}

function toUiItem(item: DecryptedVaultItem): VaultItem {
    return {
        id: item.id,
        type: item.type,
        title: item.title,
        identity: item.identity,
        domain: item.type === 'card' ? undefined : item.domain,
        password: item.type === 'login' ? item.password : undefined,
        cardNumber: item.type === 'card' ? item.cardNumber : undefined,
        expiry: item.type === 'card' ? item.expiry : undefined,
        cvv: item.type === 'card' ? item.cvv : undefined,
        authMethod: authMethodLabel(item),
        strength: item.type === 'login' ? item.strength : undefined,
        risk: item.type === 'login' ? item.risk : undefined,
        lastUsed: formatRelativeTime(item.lastUsedAt),
        note: item.note,
        mark: item.mark,
        markTone: item.markTone,
        credentialId: item.type === 'passkey' ? item.credentialId : undefined,
        experimental: item.type === 'passkey' ? true : undefined,
    };
}

function randomPassword(length = 20) {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*+-=';
    const values = new Uint32Array(length);
    crypto.getRandomValues(values);
    return Array.from(values, (value) => alphabet[value % alphabet.length]).join('');
}

function maskCard(value = '') {
    return value ? `•••• •••• •••• ${value.slice(-4)}` : '•••• •••• •••• ••••';
}

function formatRemaining(ms: number | null | undefined) {
    if (ms == null) return '—';
    const totalMinutes = Math.max(0, Math.floor(ms / 60000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours <= 0) return `${minutes}m`;
    return `${hours}h ${minutes}m`;
}

function copyText(value: string, setCopied: (label: string) => void, label: string) {
    void navigator.clipboard?.writeText(value).then(() => {
        setCopied(label);
        window.setTimeout(() => setCopied(''), 1600);
    });
}

function clearSensitiveUi(
    setItems: (items: VaultItem[]) => void,
    setRevealed: (v: boolean) => void,
    setCopied: (v: string) => void,
    setUnlockValue: (v: string) => void,
    setSetupPassword: (v: string) => void,
    setSetupConfirm: (v: string) => void,
) {
    setItems([]);
    setRevealed(false);
    setCopied('');
    setUnlockValue('');
    setSetupPassword('');
    setSetupConfirm('');
}

function ItemMark({ item, large = false }: { item: VaultItem; large?: boolean }) {
    return (
        <span
            className={`vault-item-mark ${large ? 'h-12 w-12 rounded-[13px] text-[12px]' : 'h-9 w-9 rounded-[10px] text-[10px]'} flex shrink-0 items-center justify-center border border-white/[0.09] bg-white/[0.045] font-bold tracking-[-0.03em]`}
            style={{ color: item.markTone }}
            aria-hidden="true"
        >
            {item.mark}
        </span>
    );
}

function DetailField({
    label,
    value,
    secret,
    reveal,
    onToggleReveal,
    onCopy,
    copied,
}: {
    label: string;
    value: string;
    secret?: boolean;
    reveal?: boolean;
    onToggleReveal?: () => void;
    onCopy?: () => void;
    copied?: boolean;
}) {
    return (
        <div className="group border-b border-white/[0.055] py-3 last:border-b-0">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-600">{label}</p>
            <div className="flex min-h-6 items-center gap-2">
                <p className={`min-w-0 flex-1 truncate text-[13px] text-neutral-300 ${secret && !reveal ? 'tracking-[0.12em]' : ''}`}>
                    {secret && !reveal ? '••••••••••••••••' : value}
                </p>
                {secret && onToggleReveal && (
                    <button
                        type="button"
                        onClick={onToggleReveal}
                        className="vault-icon-button"
                        aria-label={reveal ? `Hide ${label}` : `Reveal ${label}`}
                    >
                        {reveal ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                )}
                {onCopy && (
                    <button type="button" onClick={onCopy} className="vault-icon-button" aria-label={`Copy ${label}`}>
                        {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    </button>
                )}
            </div>
        </div>
    );
}

function VaultModal({
    mode,
    item,
    onClose,
    onSave,
    busy,
}: {
    mode: 'add' | 'edit';
    item?: VaultItem;
    onClose: () => void;
    onSave: (item: {
        id?: string;
        type: VaultItemType;
        title: string;
        identity: string;
        domain?: string;
        password?: string;
        cardNumber?: string;
        expiry?: string;
        cvv?: string;
        note?: string;
    }) => void;
    busy?: boolean;
}) {
    const [type, setType] = useState<VaultItemType>(item?.type ?? 'login');
    const [title, setTitle] = useState(item?.title ?? '');
    const [identity, setIdentity] = useState(item?.identity ?? '');
    const [domain, setDomain] = useState(item?.domain ?? '');
    const [password, setPassword] = useState(item?.password ?? '');
    const [cardNumber, setCardNumber] = useState(item?.cardNumber ?? '');
    const [expiry, setExpiry] = useState(item?.expiry ?? '');
    const [cvv, setCvv] = useState(item?.cvv ?? '');
    const [note, setNote] = useState(item?.note ?? '');
    const titleRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        titleRef.current?.focus();
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', closeOnEscape);
        return () => window.removeEventListener('keydown', closeOnEscape);
    }, [onClose]);

    const submit = (event: FormEvent) => {
        event.preventDefault();
        if (!title.trim() || !identity.trim() || busy) return;
        onSave({
            id: item?.id,
            type,
            title: title.trim(),
            identity: identity.trim(),
            domain: type !== 'card' ? domain.trim() : undefined,
            password: type === 'login' ? password : undefined,
            cardNumber: type === 'card' ? cardNumber.replace(/\s/g, '') : undefined,
            expiry: type === 'card' ? expiry : undefined,
            cvv: type === 'card' ? cvv : undefined,
            note: note.trim() || undefined,
        });
    };

    return (
        <ModalPortal>
            <motion.div
                className="fixed inset-0 z-[500] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onMouseDown={(event) => event.target === event.currentTarget && onClose()}
            >
                <motion.div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="vault-modal-title"
                    className="vault-modal w-full max-w-[520px] overflow-hidden rounded-2xl border border-white/[0.09] bg-[#151516] shadow-[0_28px_90px_rgba(0,0,0,0.62)]"
                    initial={{ opacity: 0, y: 18, scale: 0.985 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.99 }}
                    transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                >
                    <form onSubmit={submit}>
                        <div className="flex items-start justify-between border-b border-white/[0.065] px-6 py-5">
                            <div>
                                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-amber-400/80">FocuzPass</p>
                                <h2 id="vault-modal-title" className="text-[19px] font-semibold tracking-[-0.025em] text-white">
                                    {mode === 'add' ? 'Add to your vault' : `Edit ${item?.title}`}
                                </h2>
                            </div>
                            <button type="button" onClick={onClose} className="vault-icon-button h-8 w-8" aria-label="Close">
                                <X size={15} />
                            </button>
                        </div>

                        <div className="max-h-[65vh] space-y-5 overflow-y-auto px-6 py-5 scrollbar-hide">
                            <div className="grid grid-cols-3 gap-1 rounded-lg bg-white/[0.035] p-1" role="radiogroup" aria-label="Item type">
                                {(Object.keys(TYPE_META) as VaultItemType[]).map((value) => {
                                    const Icon = TYPE_META[value].icon;
                                    return (
                                        <button
                                            key={value}
                                            type="button"
                                            role="radio"
                                            aria-checked={type === value}
                                            onClick={() => setType(value)}
                                            className={`flex h-9 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-colors ${type === value ? 'bg-white/[0.09] text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-300'}`}
                                        >
                                            <Icon size={13} />
                                            {TYPE_META[value].label}
                                        </button>
                                    );
                                })}
                            </div>

                            {type === 'passkey' && (
                                <p className="rounded-lg border border-amber-300/15 bg-amber-300/[0.04] px-3 py-2 text-[11px] leading-5 text-amber-100/80">
                                    Passkey provider interception is experimental. FocuzPass stores metadata only — the browser still owns WebAuthn private keys.
                                </p>
                            )}

                            <div className="grid gap-4 sm:grid-cols-2">
                                <label className="vault-field sm:col-span-2">
                                    <span>Name</span>
                                    <input ref={titleRef} value={title} onChange={(event) => setTitle(event.target.value)} placeholder={type === 'card' ? 'Chase Sapphire' : 'GitHub'} required />
                                </label>
                                <label className="vault-field sm:col-span-2">
                                    <span>{type === 'card' ? 'Cardholder' : 'Username or email'}</span>
                                    <input value={identity} onChange={(event) => setIdentity(event.target.value)} placeholder={type === 'card' ? 'Jane Doe' : 'you@example.com'} required />
                                </label>
                                {type !== 'card' && (
                                    <label className="vault-field sm:col-span-2">
                                        <span>Website</span>
                                        <input value={domain} onChange={(event) => setDomain(event.target.value)} placeholder="example.com" />
                                    </label>
                                )}
                                {type === 'login' && (
                                    <label className="vault-field sm:col-span-2">
                                        <span>Password</span>
                                        <div className="relative">
                                            <input className="pr-10" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter or generate a password" autoComplete="off" />
                                            <button type="button" onClick={() => setPassword(randomPassword())} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1.5 text-neutral-500 hover:bg-white/[0.05] hover:text-amber-300" aria-label="Generate password">
                                                <Sparkles size={14} />
                                            </button>
                                        </div>
                                    </label>
                                )}
                                {type === 'card' && (
                                    <>
                                        <label className="vault-field sm:col-span-2">
                                            <span>Card number</span>
                                            <input inputMode="numeric" value={cardNumber} onChange={(event) => setCardNumber(event.target.value)} placeholder="0000 0000 0000 0000" autoComplete="off" />
                                        </label>
                                        <label className="vault-field">
                                            <span>Expiry</span>
                                            <input value={expiry} onChange={(event) => setExpiry(event.target.value)} placeholder="MM/YY" autoComplete="off" />
                                        </label>
                                        <label className="vault-field">
                                            <span>CVV</span>
                                            <input value={cvv} onChange={(event) => setCvv(event.target.value)} placeholder="•••" autoComplete="off" />
                                        </label>
                                    </>
                                )}
                                <label className="vault-field sm:col-span-2">
                                    <span>Private note</span>
                                    <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional note" rows={3} />
                                </label>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 border-t border-white/[0.065] px-6 py-4">
                            <button type="button" onClick={onClose} className="vault-button vault-button-secondary">Cancel</button>
                            <button type="submit" disabled={busy} className="vault-button vault-button-primary">
                                <ShieldCheck size={14} />
                                {mode === 'add' ? 'Save item' : 'Save changes'}
                            </button>
                        </div>
                    </form>
                </motion.div>
            </motion.div>
        </ModalPortal>
    );
}

function GeneratorPanel({ onClose }: { onClose: () => void }) {
    const [length, setLength] = useState(20);
    const [password, setPassword] = useState(() => randomPassword(20));
    const [copied, setCopied] = useState(false);

    return (
        <motion.div
            className="vault-generator mb-4 overflow-hidden rounded-xl border border-amber-400/20 bg-amber-400/[0.035]"
            initial={{ opacity: 0, height: 0, y: -8 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -8 }}
            transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
        >
            <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-400/10 text-amber-300">
                        <Sparkles size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-300/70">Generated password</p>
                        <p className="truncate font-mono text-[13px] text-neutral-200">{password}</p>
                    </div>
                </div>
                <label className="flex items-center gap-3 text-[11px] text-neutral-500">
                    <span>Length</span>
                    <input
                        type="range"
                        min="12"
                        max="36"
                        value={length}
                        onChange={(event) => {
                            const nextLength = Number(event.target.value);
                            setLength(nextLength);
                            setPassword(randomPassword(nextLength));
                        }}
                        className="vault-range w-28"
                    />
                    <span className="w-5 font-mono text-neutral-300">{length}</span>
                </label>
                <div className="flex items-center gap-1.5">
                    <button
                        type="button"
                        className="vault-button vault-button-secondary h-8 px-2.5"
                        onClick={() => {
                            void focuzPassGenerate(length)
                                .then(setPassword)
                                .catch(() => setPassword(randomPassword(length)));
                        }}
                        aria-label="Regenerate password"
                    >
                        <RefreshCw size={13} />
                    </button>
                    <button
                        type="button"
                        className="vault-button vault-button-secondary h-8"
                        onClick={() => {
                            void navigator.clipboard?.writeText(password);
                            setCopied(true);
                            window.setTimeout(() => setCopied(false), 1500);
                        }}
                    >
                        {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                        {copied ? 'Copied' : 'Copy'}
                    </button>
                    <button type="button" onClick={onClose} className="vault-icon-button h-8 w-8" aria-label="Close generator"><X size={14} /></button>
                </div>
            </div>
        </motion.div>
    );
}

function CompanionScreen() {
    const reduceMotion = useReducedMotion();
    const extensionInstalled =
        typeof document !== 'undefined' &&
        !!document.documentElement.getAttribute('data-focuznow-extension');

    const openExtension = () => {
        try {
            window.postMessage({ type: 'OPEN_EXTENSION_OPTIONS' }, '*');
        } catch {
            /* ignore */
        }
        try {
            chrome.runtime?.openOptionsPage?.();
        } catch {
            /* ignore */
        }
    };

    return (
        <section className="focuz-pass mx-auto flex min-h-[calc(100vh-7.5rem)] w-full max-w-[1480px] items-center justify-center py-10">
            <motion.div
                className="relative w-full max-w-[520px] overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.025] p-8 text-center"
                initial={reduceMotion ? false : { opacity: 0, scale: 0.985 }}
                animate={{ opacity: 1, scale: 1 }}
            >
                <div className="vault-lock-orbit mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] text-amber-300">
                    <Laptop size={24} />
                </div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300/75">Local-first companion</p>
                <h2 className="text-2xl font-semibold tracking-[-0.035em] text-white">FocuzPass lives in the extension</h2>
                <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-neutral-500">
                    Your encrypted vault never syncs to FocuzNow cloud or this website. Open the browser extension dashboard to set up, unlock, and manage credentials on this device.
                </p>
                <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:justify-center">
                    {extensionInstalled ? (
                        <button
                            type="button"
                            className="vault-button vault-button-primary h-10 justify-center"
                            onClick={openExtension}
                        >
                            Open extension dashboard
                            <ArrowRight size={14} />
                        </button>
                    ) : (
                        <a
                            href="https://chrome.google.com/webstore/detail/your-extension-id"
                            target="_blank"
                            rel="noreferrer"
                            className="vault-button vault-button-primary h-10 justify-center"
                        >
                            <Download size={14} />
                            Get the FocuzNow extension
                        </a>
                    )}
                </div>
                <p className="mt-5 flex items-center justify-center gap-1.5 text-[10px] text-neutral-600">
                    <ShieldCheck size={11} /> AES-256-GCM · master password never leaves your device
                </p>
            </motion.div>
        </section>
    );
}

export default function FocuzPassTab() {
    const reduceMotion = useReducedMotion();
    const [boot, setBoot] = useState<BootState>('loading');
    const [status, setStatus] = useState<VaultStatus | null>(null);
    const [items, setItems] = useState<VaultItem[]>([]);
    const [filter, setFilter] = useState<VaultFilter>('all');
    const [query, setQuery] = useState('');
    const [selectedId, setSelectedId] = useState('');
    const [revealed, setRevealed] = useState(false);
    const [copied, setCopied] = useState('');
    const [modal, setModal] = useState<'add' | 'edit' | null>(null);
    const [generatorOpen, setGeneratorOpen] = useState(false);
    const [unlockValue, setUnlockValue] = useState('');
    const [setupPassword, setSetupPassword] = useState('');
    const [setupConfirm, setSetupConfirm] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [toast, setToast] = useState('');
    const searchRef = useRef<HTMLInputElement>(null);

    const clearSecrets = useCallback(() => {
        clearSensitiveUi(setItems, setRevealed, setCopied, setUnlockValue, setSetupPassword, setSetupConfirm);
    }, []);

    const loadUnlocked = useCallback(async () => {
        const list = await focuzPassList();
        const ui = list.map(toUiItem);
        setItems(ui);
        setSelectedId((current) => (ui.some((item) => item.id === current) ? current : ui[0]?.id || ''));
        setBoot('ready');
    }, []);

    const refreshStatus = useCallback(async () => {
        if (isWebPlatform()) {
            setBoot('companion');
            return;
        }
        const next = await focuzPassStatus();
        setStatus(next);
        if (!next.configured) {
            clearSecrets();
            setBoot('setup');
            return;
        }
        if (!next.unlocked) {
            clearSecrets();
            setBoot('locked');
            return;
        }
        await loadUnlocked();
    }, [clearSecrets, loadUnlocked]);

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            try {
                await refreshStatus();
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : 'Failed to load FocuzPass');
                    setBoot('error');
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [refreshStatus]);

    useEffect(() => {
        const onMessage = (message: { type?: string }) => {
            if (message?.type === 'FOCUZPASS_LOCKED') {
                clearSecrets();
                setBoot('locked');
                setStatus((current) => (current ? { ...current, unlocked: false, itemCount: 0, remainingMs: null } : current));
            }
        };
        try {
            chrome.runtime?.onMessage?.addListener(onMessage);
            return () => chrome.runtime?.onMessage?.removeListener(onMessage);
        } catch {
            return undefined;
        }
    }, [clearSecrets]);

    useEffect(() => {
        if (boot !== 'ready') return;
        const onActivity = () => {
            void focuzPassTouch().catch(() => undefined);
        };
        window.addEventListener('pointerdown', onActivity);
        window.addEventListener('keydown', onActivity);
        const timer = window.setInterval(() => {
            void focuzPassStatus()
                .then((next) => {
                    setStatus(next);
                    if (!next.unlocked) {
                        clearSecrets();
                        setBoot('locked');
                    }
                })
                .catch(() => undefined);
        }, 30000);
        return () => {
            window.removeEventListener('pointerdown', onActivity);
            window.removeEventListener('keydown', onActivity);
            window.clearInterval(timer);
        };
    }, [boot, clearSecrets]);

    useEffect(() => {
        const handleShortcut = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement;
            if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
                event.preventDefault();
                searchRef.current?.focus();
            }
        };
        window.addEventListener('keydown', handleShortcut);
        return () => window.removeEventListener('keydown', handleShortcut);
    }, []);

    const counts = useMemo(() => ({
        all: items.length,
        login: items.filter((item) => item.type === 'login').length,
        card: items.filter((item) => item.type === 'card').length,
        passkey: items.filter((item) => item.type === 'passkey').length,
        risk: items.filter((item) => item.risk).length,
    }), [items]);

    const filteredItems = useMemo(() => {
        const normalized = query.trim().toLowerCase();
        return items.filter((item) => {
            const matchesType = filter === 'all' || (filter === 'risk' ? Boolean(item.risk) : item.type === filter);
            const matchesQuery = !normalized || [item.title, item.identity, item.domain, item.authMethod].some((value) => value?.toLowerCase().includes(normalized));
            return matchesType && matchesQuery;
        });
    }, [filter, items, query]);

    const selected = items.find((item) => item.id === selectedId) ?? filteredItems[0];

    const showToast = (message: string) => {
        setToast(message);
        window.setTimeout(() => setToast(''), 2200);
    };

    const saveItem = async (draft: {
        id?: string;
        type: VaultItemType;
        title: string;
        identity: string;
        domain?: string;
        password?: string;
        cardNumber?: string;
        expiry?: string;
        cvv?: string;
        note?: string;
    }) => {
        setBusy(true);
        setError('');
        try {
            const saved = await focuzPassUpsert({
                id: draft.id,
                type: draft.type,
                title: draft.title,
                identity: draft.identity,
                domain: draft.domain,
                password: draft.password,
                cardNumber: draft.cardNumber,
                expiry: draft.expiry,
                cvv: draft.cvv,
                note: draft.note,
                authMethod: draft.type === 'login' ? 'PASSWORD' : draft.type === 'card' ? 'CARD' : 'PASSKEY',
            });
            const ui = toUiItem(saved);
            setItems((current) => {
                const exists = current.some((candidate) => candidate.id === ui.id);
                return exists ? current.map((candidate) => (candidate.id === ui.id ? ui : candidate)) : [ui, ...current];
            });
            setSelectedId(ui.id);
            setModal(null);
            showToast(`${ui.title} saved to your vault`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not save item');
        } finally {
            setBusy(false);
        }
    };

    const deleteSelected = async () => {
        if (!selected) return;
        setBusy(true);
        try {
            await focuzPassDelete(selected.id);
            setItems((current) => {
                const next = current.filter((item) => item.id !== selected.id);
                setSelectedId(next[0]?.id || '');
                return next;
            });
            showToast(`${selected.title} removed`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not delete item');
        } finally {
            setBusy(false);
        }
    };

    const handleSetup = async (event: FormEvent) => {
        event.preventDefault();
        if (setupPassword.length < 8) {
            setError('Master password must be at least 8 characters');
            return;
        }
        if (setupPassword !== setupConfirm) {
            setError('Passwords do not match');
            return;
        }
        setBusy(true);
        setError('');
        try {
            const next = await focuzPassSetup(setupPassword);
            setStatus(next);
            setSetupPassword('');
            setSetupConfirm('');
            setItems([]);
            setBoot('ready');
            showToast('Vault created on this device');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Setup failed');
        } finally {
            setBusy(false);
        }
    };

    const handleUnlock = async (event: FormEvent) => {
        event.preventDefault();
        if (!unlockValue.trim()) return;
        setBusy(true);
        setError('');
        try {
            const next = await focuzPassUnlock(unlockValue);
            setUnlockValue('');
            setStatus(next);
            await loadUnlocked();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unlock failed');
        } finally {
            setBusy(false);
        }
    };

    const handleLock = async () => {
        setBusy(true);
        try {
            const next = await focuzPassLock();
            clearSecrets();
            setStatus(next);
            setBoot('locked');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Lock failed');
        } finally {
            setBusy(false);
        }
    };

    if (boot === 'loading') {
        return (
            <section className="focuz-pass mx-auto flex min-h-[calc(100vh-7.5rem)] w-full max-w-[1480px] items-center justify-center py-10">
                <p className="text-sm text-neutral-500">Opening FocuzPass…</p>
            </section>
        );
    }

    if (boot === 'companion') {
        return <CompanionScreen />;
    }

    if (boot === 'error') {
        return (
            <section className="focuz-pass mx-auto flex min-h-[calc(100vh-7.5rem)] w-full max-w-[1480px] items-center justify-center py-10">
                <div className="max-w-md text-center">
                    <p className="text-sm text-neutral-300">Could not open FocuzPass</p>
                    <p className="mt-2 text-[12px] text-neutral-600">{error}</p>
                    <button type="button" className="vault-button vault-button-primary mt-4" onClick={() => void refreshStatus()}>Retry</button>
                </div>
            </section>
        );
    }

    if (boot === 'setup') {
        return (
            <section className="focuz-pass mx-auto flex min-h-[calc(100vh-7.5rem)] w-full max-w-[1480px] items-center justify-center py-10">
                <motion.div
                    className="relative w-full max-w-[460px] overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.025] p-8 text-center"
                    initial={reduceMotion ? false : { opacity: 0, scale: 0.985 }}
                    animate={{ opacity: 1, scale: 1 }}
                >
                    <div className="vault-lock-orbit mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] text-amber-300">
                        <KeyRound size={24} />
                    </div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300/75">First-run setup</p>
                    <h2 className="text-2xl font-semibold tracking-[-0.035em] text-white">Create your local vault</h2>
                    <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-neutral-500">
                        Choose a master password. It is never stored — only a device-local encrypted vault blob is saved.
                    </p>
                    <form className="mt-7 space-y-3" onSubmit={handleSetup}>
                        <label className="vault-field text-left">
                            <span>Master password</span>
                            <input type="password" value={setupPassword} onChange={(event) => setSetupPassword(event.target.value)} autoFocus placeholder="At least 8 characters" autoComplete="new-password" />
                        </label>
                        <label className="vault-field text-left">
                            <span>Confirm master password</span>
                            <input type="password" value={setupConfirm} onChange={(event) => setSetupConfirm(event.target.value)} placeholder="Repeat master password" autoComplete="new-password" />
                        </label>
                        {error && <p className="text-left text-[11px] text-amber-300">{error}</p>}
                        <button type="submit" disabled={busy} className="vault-button vault-button-primary h-10 w-full justify-center">
                            Create encrypted vault
                            <ArrowRight size={14} />
                        </button>
                    </form>
                    <p className="mt-5 flex items-center justify-center gap-1.5 text-[10px] text-neutral-600"><Laptop size={11} /> Local to this device · no cloud sync</p>
                </motion.div>
            </section>
        );
    }

    if (boot === 'locked') {
        return (
            <section className="focuz-pass mx-auto flex min-h-[calc(100vh-7.5rem)] w-full max-w-[1480px] items-center justify-center py-10">
                <motion.div
                    className="relative w-full max-w-[460px] overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.025] p-8 text-center"
                    initial={reduceMotion ? false : { opacity: 0, scale: 0.985 }}
                    animate={{ opacity: 1, scale: 1 }}
                >
                    <div className="vault-lock-orbit mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] text-amber-300">
                        <Lock size={24} />
                    </div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300/75">FocuzPass is sealed</p>
                    <h2 className="text-2xl font-semibold tracking-[-0.035em] text-white">Your vault is locked</h2>
                    <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-neutral-500">Unlock to access logins, cards, and passkey metadata stored on this device.</p>
                    <form className="mt-7 space-y-3" onSubmit={handleUnlock}>
                        <label className="vault-field text-left">
                            <span>Master password</span>
                            <input type="password" value={unlockValue} onChange={(event) => setUnlockValue(event.target.value)} autoFocus placeholder="Enter your master password" autoComplete="current-password" />
                        </label>
                        {error && <p className="text-left text-[11px] text-amber-300">{error}</p>}
                        <button type="submit" disabled={busy} className="vault-button vault-button-primary h-10 w-full justify-center">
                            Unlock vault
                            <ArrowRight size={14} />
                        </button>
                    </form>
                    <p className="mt-5 flex items-center justify-center gap-1.5 text-[10px] text-neutral-600"><Laptop size={11} /> Local to this device</p>
                </motion.div>
            </section>
        );
    }

    return (
        <section className="focuz-pass mx-auto w-full max-w-[1480px] pb-10 pt-7">
            <header className="mb-6 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                <div className="max-w-2xl">
                    <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-300/80">
                        <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-300 opacity-30 motion-reduce:animate-none" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-300" />
                        </span>
                        Encrypted local vault
                    </div>
                    <h2 className="text-[30px] font-semibold leading-tight tracking-[-0.045em] text-white sm:text-[34px]">Your keys, close at hand.</h2>
                    <p className="mt-2 max-w-xl text-[13px] leading-6 text-neutral-500">Manage the accounts, cards, and passkey metadata FocuzNow can recognize while you browse. Nothing in this vault leaves this device.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => setGeneratorOpen((open) => !open)} className="vault-button vault-button-secondary">
                        <Sparkles size={14} className="text-amber-300" />
                        Generate
                    </button>
                    <button type="button" onClick={() => setModal('add')} className="vault-button vault-button-primary">
                        <Plus size={14} />
                        Add item
                    </button>
                </div>
            </header>

            <AnimatePresence initial={false}>{generatorOpen && <GeneratorPanel onClose={() => setGeneratorOpen(false)} />}</AnimatePresence>

            <div className="vault-shell overflow-hidden rounded-2xl border border-white/[0.075] bg-white/[0.018]">
                <div className="flex flex-col gap-3 border-b border-white/[0.065] p-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="vault-filter-scroll -mx-1 flex min-w-0 items-center gap-1 overflow-x-auto px-1 scrollbar-hide" role="tablist" aria-label="Vault filters">
                        {FILTERS.map((option) => (
                            <button
                                key={option.id}
                                type="button"
                                role="tab"
                                aria-selected={filter === option.id}
                                onClick={() => setFilter(option.id)}
                                className={`relative flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-medium transition-colors ${filter === option.id ? 'text-neutral-100' : 'text-neutral-500 hover:bg-white/[0.03] hover:text-neutral-300'}`}
                            >
                                {filter === option.id && (
                                    <motion.span layoutId="vault-filter" className="absolute inset-0 rounded-md border border-white/[0.075] bg-white/[0.055]" transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.16, 1, 0.3, 1] }} />
                                )}
                                <span className="relative">{option.label}</span>
                                <span className={`relative rounded px-1 py-0.5 text-[9px] ${option.id === 'risk' && counts.risk ? 'bg-amber-400/10 text-amber-300' : 'bg-white/[0.035] text-neutral-600'}`}>{counts[option.id]}</span>
                            </button>
                        ))}
                    </div>
                    <label className="vault-search relative block shrink-0 lg:w-[260px]">
                        <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-600" />
                        <input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your vault" className="h-8 w-full rounded-md border border-white/[0.07] bg-black/20 pl-8 pr-9 text-[11px] text-neutral-200 outline-none transition focus:border-amber-300/25 focus:bg-white/[0.025]" />
                        {!query && <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-white/[0.07] bg-white/[0.03] px-1.5 py-0.5 text-[9px] text-neutral-600">/</kbd>}
                        {query && <button type="button" onClick={() => setQuery('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-neutral-600 hover:text-neutral-300" aria-label="Clear search"><X size={12} /></button>}
                    </label>
                </div>

                <div className="vault-content-grid">
                    <div className="min-w-0 border-white/[0.065] lg:border-r">
                        <div className="flex items-center justify-between border-b border-white/[0.055] px-4 py-2.5">
                            <p className="text-[10px] font-medium uppercase tracking-[0.11em] text-neutral-600">{filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'}</p>
                            <div className="flex items-center gap-1.5 text-[10px] text-neutral-600"><ShieldCheck size={12} className="text-emerald-400/80" /> Encrypted at rest</div>
                        </div>

                        <div className="min-h-[440px]">
                            <AnimatePresence mode="popLayout">
                                {filteredItems.length > 0 ? filteredItems.map((item, index) => {
                                    const TypeIcon = TYPE_META[item.type].icon;
                                    const isSelected = selected?.id === item.id;
                                    return (
                                        <motion.button
                                            layout
                                            key={item.id}
                                            type="button"
                                            onClick={() => {
                                                setSelectedId(item.id);
                                                setRevealed(false);
                                            }}
                                            className={`vault-row group relative flex w-full items-center gap-3 border-b border-white/[0.05] px-4 py-3.5 text-left transition-colors ${isSelected ? 'bg-white/[0.045]' : 'hover:bg-white/[0.025]'}`}
                                            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, x: -8 }}
                                            transition={{ duration: reduceMotion ? 0 : 0.24, delay: reduceMotion ? 0 : index * 0.025, ease: [0.16, 1, 0.3, 1] }}
                                        >
                                            {isSelected && <motion.span layoutId="vault-row-seal" className="absolute bottom-2 left-0 top-2 w-[2px] rounded-full bg-amber-300" transition={{ duration: reduceMotion ? 0 : 0.24, ease: [0.16, 1, 0.3, 1] }} />}
                                            <ItemMark item={item} />
                                            <span className="min-w-0 flex-1">
                                                <span className="flex items-center gap-2">
                                                    <span className="truncate text-[13px] font-medium text-neutral-200">{item.title}</span>
                                                    {item.risk && <span className="rounded bg-amber-400/10 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.08em] text-amber-300">{item.risk}</span>}
                                                </span>
                                                <span className="mt-0.5 block truncate text-[11px] text-neutral-600">{item.identity}</span>
                                            </span>
                                            <span className="hidden min-w-[118px] text-right sm:block">
                                                <span className="flex items-center justify-end gap-1.5 text-[10px] text-neutral-400"><TypeIcon size={11} /> {item.authMethod}</span>
                                                <span className="mt-1 block text-[9px] text-neutral-600">Used {item.lastUsed.toLowerCase()}</span>
                                            </span>
                                            <ChevronRight size={13} className={`shrink-0 transition-transform ${isSelected ? 'translate-x-0 text-amber-300/80' : '-translate-x-1 text-neutral-700 group-hover:translate-x-0 group-hover:text-neutral-500'}`} />
                                        </motion.button>
                                    );
                                }) : items.length === 0 ? (
                                    <motion.div className="flex min-h-[360px] flex-col items-center justify-center px-6 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.025] text-neutral-600"><KeyRound size={16} /></div>
                                        <p className="text-sm font-medium text-neutral-300">Your vault is empty</p>
                                        <p className="mt-1 max-w-xs text-[11px] text-neutral-600">Add a login, card, or passkey metadata record. Secrets stay encrypted on this device.</p>
                                        <button type="button" onClick={() => setModal('add')} className="vault-button vault-button-primary mt-4">
                                            <Plus size={13} />
                                            Add your first item
                                        </button>
                                    </motion.div>
                                ) : (
                                    <motion.div className="flex min-h-[360px] flex-col items-center justify-center px-6 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.025] text-neutral-600"><Search size={16} /></div>
                                        <p className="text-sm font-medium text-neutral-300">No matching vault items</p>
                                        <p className="mt-1 text-[11px] text-neutral-600">Try a different filter or search term.</p>
                                        <button type="button" onClick={() => { setFilter('all'); setQuery(''); }} className="mt-4 text-[11px] font-medium text-amber-300 hover:text-amber-200">Clear filters</button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>

                    <aside className="vault-detail min-w-0 bg-black/[0.08]">
                        <AnimatePresence mode="wait">
                            {selected ? (
                                <motion.div
                                    key={selected.id}
                                    className="flex h-full min-h-[490px] flex-col"
                                    initial={reduceMotion ? false : { opacity: 0, x: 12 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -8 }}
                                    transition={{ duration: reduceMotion ? 0 : 0.24, ease: [0.16, 1, 0.3, 1] }}
                                >
                                    <div className="flex items-start gap-3 border-b border-white/[0.055] p-5">
                                        <ItemMark item={selected} large />
                                        <div className="min-w-0 flex-1 pt-0.5">
                                            <p className="truncate text-[15px] font-semibold tracking-[-0.015em] text-neutral-100">{selected.title}</p>
                                            <p className="mt-1 truncate text-[10px] text-neutral-600">{selected.domain || TYPE_META[selected.type].label}</p>
                                        </div>
                                        <button type="button" className="vault-icon-button h-8 w-8" aria-label="More actions"><MoreHorizontal size={15} /></button>
                                    </div>

                                    <div className="flex-1 px-5 py-2">
                                        <DetailField label={selected.type === 'card' ? 'Cardholder' : 'Identity'} value={selected.identity} onCopy={() => copyText(selected.identity, setCopied, 'identity')} copied={copied === 'identity'} />
                                        {selected.type === 'login' && selected.password && (
                                            <DetailField label="Password" value={selected.password} secret reveal={revealed} onToggleReveal={() => setRevealed((value) => !value)} onCopy={() => copyText(selected.password || '', setCopied, 'password')} copied={copied === 'password'} />
                                        )}
                                        {selected.type === 'card' && (
                                            <>
                                                <DetailField label="Card number" value={revealed ? (selected.cardNumber || '') : maskCard(selected.cardNumber)} secret={!revealed} reveal={revealed} onToggleReveal={() => setRevealed((value) => !value)} onCopy={() => copyText(selected.cardNumber || '', setCopied, 'card')} copied={copied === 'card'} />
                                                <DetailField label="Expiry" value={selected.expiry || '—'} />
                                                {selected.cvv && (
                                                    <DetailField label="CVV" value={selected.cvv} secret reveal={revealed} onToggleReveal={() => setRevealed((value) => !value)} onCopy={() => copyText(selected.cvv || '', setCopied, 'cvv')} copied={copied === 'cvv'} />
                                                )}
                                            </>
                                        )}
                                        {selected.type === 'passkey' && (
                                            <>
                                                <DetailField label="Credential id" value={selected.credentialId || 'Metadata only'} />
                                                <DetailField label="Provider support" value="Experimental — browser owns WebAuthn keys" />
                                            </>
                                        )}
                                        <DetailField label="Sign-in method" value={selected.authMethod} />
                                        {selected.note && <DetailField label="Private note" value={selected.note} />}
                                    </div>

                                    <div className="border-t border-white/[0.055] p-4">
                                        <div className="mb-3 flex items-center justify-between rounded-lg border border-white/[0.055] bg-white/[0.018] px-3 py-2.5">
                                            <span className="flex items-center gap-2 text-[10px] text-neutral-500"><ShieldCheck size={13} className={selected.risk ? 'text-amber-300' : 'text-emerald-400'} /> {selected.risk ? 'Security review recommended' : 'No security issues found'}</span>
                                            {selected.strength && <span className={`text-[9px] font-semibold uppercase tracking-[0.08em] ${selected.strength === 'strong' ? 'text-emerald-400' : selected.strength === 'okay' ? 'text-neutral-400' : 'text-amber-300'}`}>{selected.strength}</span>}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button type="button" onClick={() => setModal('edit')} className="vault-button vault-button-secondary flex-1 justify-center">Edit item</button>
                                            <button type="button" onClick={() => void deleteSelected()} className="vault-icon-button h-9 w-9 hover:border-red-400/20 hover:bg-red-400/[0.06] hover:text-red-300" aria-label={`Delete ${selected.title}`}><Trash2 size={14} /></button>
                                        </div>
                                    </div>
                                </motion.div>
                            ) : (
                                <div className="flex min-h-[490px] flex-col items-center justify-center px-8 text-center text-neutral-600"><KeyRound size={20} /><p className="mt-3 text-xs">Select an item to inspect it.</p></div>
                            )}
                        </AnimatePresence>
                    </aside>
                </div>

                <footer className="flex flex-col gap-3 border-t border-white/[0.065] bg-white/[0.018] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-400/15 bg-emerald-400/[0.05] text-emerald-400"><ShieldEllipsis size={14} /></div>
                        <div>
                            <p className="text-[11px] font-medium text-neutral-300">Vault unlocked</p>
                            <p className="mt-0.5 text-[9px] text-neutral-600">Auto-locks in {formatRemaining(status?.remainingMs)} · Local device only</p>
                        </div>
                        <button type="button" onClick={() => void handleLock()} className="ml-1 text-[10px] font-medium text-neutral-500 underline decoration-white/10 underline-offset-4 hover:text-neutral-300">Lock now</button>
                    </div>
                    <button type="button" onClick={() => showToast('Peer-to-peer transfer is coming in a later release')} className="vault-transfer group flex items-center gap-2 text-left">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.065] bg-white/[0.025] text-neutral-500 transition group-hover:border-amber-300/20 group-hover:text-amber-300"><Wifi size={14} /></span>
                        <span><span className="block text-[10px] font-medium text-neutral-300">Transfer to another device</span><span className="mt-0.5 block text-[9px] text-neutral-600">Peer-to-peer on the same Wi-Fi</span></span>
                        <ArrowRight size={12} className="ml-1 text-neutral-600 transition-transform group-hover:translate-x-1 group-hover:text-amber-300" />
                    </button>
                </footer>
            </div>

            <AnimatePresence>
                {modal && <VaultModal mode={modal} item={modal === 'edit' ? selected : undefined} onClose={() => setModal(null)} onSave={(draft) => void saveItem(draft)} busy={busy} />}
            </AnimatePresence>

            <AnimatePresence>
                {toast && (
                    <motion.div
                        role="status"
                        className="fixed bottom-6 left-1/2 z-[600] flex -translate-x-1/2 items-center gap-2 rounded-lg border border-white/[0.09] bg-[#1b1b1d] px-3 py-2 text-[11px] text-neutral-200 shadow-2xl"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                    >
                        <Check size={13} className="text-emerald-400" />
                        {toast}
                    </motion.div>
                )}
            </AnimatePresence>
        </section>
    );
}
