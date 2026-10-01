import { useEffect, useRef, useState } from 'react';
import { Check, Download, SlidersHorizontal, Trash2 } from 'lucide-react';
import { useAuthStore, type EngineState } from '../../lib/store';
import { normalizeSmartYouTube } from '../../lib/youtubeSmartMode';
import { deleteAccountPermanently, usesGoogleSignIn, verifyAccountWithGoogle } from '../../lib/accountApi';
import SmartYouTubeModal from '../../components/SmartYouTubeModal';
import DeleteAccountModal from '../../components/DeleteAccountModal';
import { Button } from '../../components/fz/Button';
import { Select, Textarea } from '../../components/fz/Field';
import { Switch } from '../../components/fz/Switch';
import { SettingRow, SettingsSection } from './SettingsPrimitives';
import { patchEngine } from './settingsCore';

const DEFAULT_OVERRIDE = { enabled: true, maxPerDay: 3, minReasonLength: 20, accessMinutes: 15, cooldownMinutes: 30 };
type Override = typeof DEFAULT_OVERRIDE;

const opts = (values: number[], unit: (n: number) => string) => values.map((v) => ({ value: String(v), label: unit(v) }));
const OVERRIDE_FIELDS: { key: keyof Omit<Override, 'enabled'>; label: string; options: { value: string; label: string }[] }[] = [
    { key: 'maxPerDay', label: 'Unlocks per day', options: opts([1, 2, 3, 5, 10], (n) => `${n} per day`) },
    { key: 'accessMinutes', label: 'Access lasts', options: opts([5, 10, 15, 30, 60], (n) => `${n} min`) },
    { key: 'cooldownMinutes', label: 'Wait between unlocks', options: opts([0, 15, 30, 60, 120], (n) => (n ? `${n} min` : 'No wait')) },
    { key: 'minReasonLength', label: 'Reason length', options: opts([10, 20, 50, 100], (n) => `${n}+ characters`) },
];

// ---------------------------------------------------------
// Blocking
// ---------------------------------------------------------

export function BlockingSection() {
    const engine = useAuthStore((s) => s.engineState);
    const override: Override = { ...DEFAULT_OVERRIDE, ...(engine.emergencyOverrideSettings ?? {}) };
    const [message, setMessage] = useState(engine.redirectMessage ?? '');
    const [savedFlash, setSavedFlash] = useState(false);
    const saveTimer = useRef<number | null>(null);

    const saveMessage = (text: string) => {
        if (saveTimer.current) window.clearTimeout(saveTimer.current);
        saveTimer.current = null;
        if (text === (useAuthStore.getState().engineState.redirectMessage ?? '')) return;
        void patchEngine({ redirectMessage: text }).then(() => {
            setSavedFlash(true);
            window.setTimeout(() => setSavedFlash(false), 1500);
        });
    };

    useEffect(() => () => {
        if (saveTimer.current) window.clearTimeout(saveTimer.current);
    }, []);

    const patchOverride = (patch: Partial<Override>) =>
        void patchEngine({ emergencyOverrideSettings: { ...override, ...patch } as EngineState['emergencyOverrideSettings'] });

    return (
        <SettingsSection id="blocking" title="Blocking" description="How FocuzNow holds the line when you reach for a blocked site.">
            <SettingRow
                title="Blocked-site message"
                description="Shown on the screen you see when a site is blocked."
                keywords="redirect message quote reminder text blocked page"
                htmlFor="settings-redirect-message"
                stacked
                control={savedFlash ? <span className="flex items-center gap-1 text-[12px] text-[var(--fz-success)]"><Check size={13} /> Saved</span> : null}
            >
                <Textarea
                    id="settings-redirect-message"
                    value={message}
                    maxLength={200}
                    placeholder="Shouldn't you be working?"
                    onChange={(e) => {
                        const text = e.target.value;
                        setMessage(text);
                        if (saveTimer.current) window.clearTimeout(saveTimer.current);
                        saveTimer.current = window.setTimeout(() => saveMessage(text), 800);
                    }}
                    onBlur={() => saveMessage(message)}
                    className="min-h-[56px] resize-none"
                />
            </SettingRow>

            <SettingRow
                title="Typing challenge to unblock"
                description="Make yourself type a passage before removing a site during active hours."
                keywords="unblocking challenge typing test friction"
                control={
                    <Switch
                        checked={!!engine.requireChallenge}
                        onCheckedChange={(v) => void patchEngine({ requireChallenge: v })}
                        aria-label="Typing challenge to unblock"
                    />
                }
            />

            <SettingRow
                title="Emergency unlock"
                description="Lets you open a blocked site for a short time after explaining why. Every request is logged, and it's off during Nuclear Lockdown."
                keywords="emergency override temporary access unlock reason cooldown limit"
                control={<Switch checked={override.enabled} onCheckedChange={(v) => patchOverride({ enabled: v })} aria-label="Emergency unlock" />}
            >
                {override.enabled && (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {OVERRIDE_FIELDS.map((f) => (
                            <div key={f.key} className="min-w-0">
                                <p className="text-label mb-1.5">{f.label}</p>
                                <Select
                                    aria-label={f.label}
                                    value={String(override[f.key])}
                                    options={
                                        f.options.some((o) => o.value === String(override[f.key]))
                                            ? f.options
                                            : [...f.options, { value: String(override[f.key]), label: String(override[f.key]) }]
                                    }
                                    onChange={(v) => patchOverride({ [f.key]: Number(v) })}
                                    className="w-full [&>button]:w-full"
                                />
                            </div>
                        ))}
                    </div>
                )}
            </SettingRow>
        </SettingsSection>
    );
}

// ---------------------------------------------------------
// While you browse
// ---------------------------------------------------------

const BROWSE_TOGGLES: { key: 'draggableTimer' | 'pomodoroWidget' | 'trackBackgroundAudio'; title: string; description: string; keywords: string }[] = [
    { key: 'draggableTimer', title: 'Site clock', description: 'A small bubble on every page showing time spent on that site.', keywords: 'timer bubble overlay time spent' },
    { key: 'pomodoroWidget', title: 'Pomodoro widget', description: 'Keep the current session timer visible on every site.', keywords: 'pomodoro timer overlay floating session' },
    { key: 'trackBackgroundAudio', title: 'Count background audio', description: 'Count time on tabs playing music or video while you look elsewhere.', keywords: 'audio music video background tracking stats' },
];

export function BrowsingSection() {
    const engine = useAuthStore((s) => s.engineState);
    return (
        <SettingsSection id="browsing" title="While you browse">
            {BROWSE_TOGGLES.map((t) => (
                <SettingRow
                    key={t.key}
                    title={t.title}
                    description={t.description}
                    keywords={t.keywords}
                    control={<Switch checked={!!engine[t.key]} onCheckedChange={(v) => void patchEngine({ [t.key]: v })} aria-label={t.title} />}
                />
            ))}
        </SettingsSection>
    );
}

// ---------------------------------------------------------
// YouTube
// ---------------------------------------------------------

export function YouTubeSection() {
    const { engineState, patchInAppBlock } = useAuthStore();
    const [modalOpen, setModalOpen] = useState(false);
    const smart = normalizeSmartYouTube(engineState.inAppBlock?.smartYouTube);
    const saveSmart = async (next: typeof smart) => {
        await patchInAppBlock({ smartYouTube: next });
    };

    return (
        <SettingsSection id="youtube" title="YouTube">
            <SettingRow
                title="Smart YouTube"
                description={
                    smart.enabled
                        ? `Blocking ${smart.blockedCategoryIds.length} ${smart.blockedCategoryIds.length === 1 ? 'category' : 'categories'}. Education and Science always stay open.`
                        : 'Block videos by their official category. Education and Science always stay open.'
                }
                keywords="smart youtube categories videos filter education science entertainment gaming music"
                control={
                    <>
                        {smart.enabled && (
                            <Button size="sm" variant="ghost" iconLeft={<SlidersHorizontal size={13} />} onClick={() => setModalOpen(true)}>
                                Categories
                            </Button>
                        )}
                        <Switch checked={smart.enabled} onCheckedChange={(v) => void saveSmart({ ...smart, enabled: v })} aria-label="Smart YouTube" />
                    </>
                }
            />
            <SettingRow
                title="Block YouTube Shorts"
                description="Redirects /shorts links and hides Shorts in your feed."
                keywords="shorts youtube reels short videos feed"
                control={
                    <Switch
                        checked={!!engineState.inAppBlock?.youtubeShorts}
                        onCheckedChange={(v) => void patchInAppBlock({ youtubeShorts: v })}
                        aria-label="Block YouTube Shorts"
                    />
                }
            />
            <SmartYouTubeModal open={modalOpen} onClose={() => setModalOpen(false)} settings={smart} onSave={saveSmart} />
        </SettingsSection>
    );
}

// ---------------------------------------------------------
// Data & privacy
// ---------------------------------------------------------

export function DataSection() {
    const { session, historyPermission, setHistoryPermission, importHistory, signOut } = useAuthStore();
    const [importing, setImporting] = useState(false);
    const [imported, setImported] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);

    const runImport = async () => {
        setImporting(true);
        try {
            await setHistoryPermission(true);
            await importHistory();
            setImported(true);
        } finally {
            setImporting(false);
        }
    };

    return (
        <SettingsSection id="data" title="Data & privacy">
            <SettingRow
                title="Import browsing history"
                description="Pull the last 7 days from Chrome for fuller stats. It stays on this device."
                keywords="history chrome import stats privacy permission revoke"
                control={
                    <>
                        {historyPermission && (
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                    void setHistoryPermission(false);
                                    setImported(false);
                                }}
                            >
                                Revoke access
                            </Button>
                        )}
                        <Button
                            size="sm"
                            loading={importing}
                            disabled={imported}
                            iconLeft={imported ? <Check size={13} /> : <Download size={13} />}
                            onClick={() => void runImport()}
                        >
                            {imported ? 'Imported' : historyPermission ? 'Import again' : 'Import'}
                        </Button>
                    </>
                }
            />
            {session?.user && (
                <SettingRow
                    title="Delete account"
                    description="Permanently deletes your account and everything synced to it. This can't be undone."
                    keywords="delete remove account close erase data danger"
                    tone="danger"
                    control={
                        <Button size="sm" variant="danger" iconLeft={<Trash2 size={13} />} onClick={() => setDeleteOpen(true)}>
                            Delete account
                        </Button>
                    }
                />
            )}
            <DeleteAccountModal
                open={deleteOpen}
                email={session?.user?.email || ''}
                googleSignIn={session?.user ? usesGoogleSignIn(session.user) : false}
                onClose={() => setDeleteOpen(false)}
                onVerifyGoogle={async () => verifyAccountWithGoogle(session?.user?.email || '')}
                onConfirm={async (password) => {
                    if (!session?.access_token || !session.user?.email) return { ok: false, error: 'You must be signed in.' };
                    const result = await deleteAccountPermanently(session.access_token, {
                        email: session.user.email,
                        password,
                        googleAlreadyVerified: usesGoogleSignIn(session.user),
                    });
                    if (result.ok) await signOut();
                    return result;
                }}
            />
        </SettingsSection>
    );
}
