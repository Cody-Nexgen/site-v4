import { useEffect, useRef, useState } from 'react';
import { Camera, Check, ExternalLink, LogOut } from 'lucide-react';
import { useAuthStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';
import {
    fetchMyProfile,
    isUsernameAvailable,
    normalizeUsername,
    suggestUsername,
    syncProfileFromSettings,
} from '../../lib/profileApi';
import { signOutOnAuthError } from '../../lib/authErrors';
import { publicProfileUrl, syncPublicFocusProfile } from '../../lib/progressionApi';
import { sendProgressionMessage, useFocusProgression } from '../../hooks/useFocusProgression';
import { computeFocusScore } from '../../lib/focusScore';
import { computeAchievements, unlockedCount } from '../../lib/achievements';
import { Button } from '../../components/fz/Button';
import { Input } from '../../components/fz/Field';
import { Switch } from '../../components/fz/Switch';
import { SettingRow, SettingsSection } from './SettingsPrimitives';
import { patchEngine } from './settingsCore';

type Saved = { name: string; username: string };

function avatarFromMetadata(metadata: Record<string, unknown> | null | undefined): string {
    const candidates = [metadata?.avatar_url, metadata?.picture, metadata?.avatar];
    return candidates.find((v): v is string => typeof v === 'string' && v.trim().length > 0)?.trim() || '';
}

/** Keyed by user id in the parent, so switching accounts starts fresh. */
export function AccountSection() {
    const { session, engineState, dashboardStreak, bestStreak, last7DaysStats, signOut } = useAuthStore();
    const { progression, refresh: refreshProgression } = useFocusProgression();

    const [displayName, setDisplayName] = useState(engineState.profileName || '');
    const [username, setUsername] = useState(() => engineState.profileUsername || suggestUsername(session?.user?.email));
    const [saved, setSaved] = useState<Saved | null>(null);
    const [check, setCheck] = useState<{ name: string; available: boolean } | null>(null);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
    const [publicOverride, setPublicOverride] = useState<boolean | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    const accessToken = session?.access_token;
    const refreshToken = session?.refresh_token;
    const userId = session?.user?.id;
    const email = session?.user?.email ?? '';
    const metadataAvatar = avatarFromMetadata(session?.user?.user_metadata);
    const avatar = engineState.profileAvatar || metadataAvatar;
    const publicEnabled = publicOverride ?? progression?.publicProfileEnabled ?? false;

    // Load the server profile once per account.
    useEffect(() => {
        if (!userId || !accessToken || !refreshToken) return;
        let cancelled = false;
        void fetchMyProfile(supabase, { access_token: accessToken, refresh_token: refreshToken }).then(async (profile) => {
            if (cancelled) return;
            if (!profile) {
                setSaved({ name: '', username: '' });
                return;
            }
            const name = profile.displayName.trim();
            setDisplayName(name);
            setUsername(profile.username);
            setSaved({ name, username: profile.username });
            await patchEngine({
                profileName: name,
                profileInitial: (name.charAt(0) || 'F').toUpperCase(),
                profileAvatar: profile.avatarUrl || metadataAvatar || '',
            });
        });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- once per account; tokens refresh silently
    }, [userId]);

    // Debounced availability check for a changed username.
    const handle = normalizeUsername(username);
    useEffect(() => {
        if (!saved || handle.length < 3 || handle === saved.username || !accessToken || !refreshToken) return;
        const timer = window.setTimeout(() => {
            void isUsernameAvailable(supabase, handle, { access_token: accessToken, refresh_token: refreshToken }).then((r) =>
                setCheck({ name: handle, available: r.available && r.reason !== 'USERNAME_TOO_SHORT' }),
            );
        }, 400);
        return () => window.clearTimeout(timer);
    }, [handle, saved, accessToken, refreshToken]);

    const handleStatus: 'idle' | 'short' | 'current' | 'checking' | 'available' | 'taken' =
        handle.length === 0
            ? 'idle'
            : handle.length < 3
              ? 'short'
              : saved && handle === saved.username
                ? 'current'
                : check?.name === handle
                  ? check.available
                      ? 'available'
                      : 'taken'
                  : 'checking';

    const dirty = !!saved && (displayName.trim() !== saved.name || handle !== saved.username);
    const canSave = dirty && !saving && handleStatus !== 'short' && handleStatus !== 'taken' && handleStatus !== 'checking' && displayName.trim().length > 0;

    const save = async (avatarOverride?: string) => {
        if (!userId || !accessToken || !refreshToken) {
            await signOutOnAuthError('NOT_AUTHENTICATED');
            return;
        }
        setSaving(true);
        setMessage(null);
        const name = displayName.trim();
        const sync = await syncProfileFromSettings(
            supabase,
            userId,
            { username: handle, displayName: name, profileAvatar: avatarOverride ?? engineState.profileAvatar },
            { access_token: accessToken, refresh_token: refreshToken },
        );
        setSaving(false);
        if (!sync.ok) {
            const signedOut = await signOutOnAuthError(sync.error);
            if (!signedOut) setMessage({ ok: false, text: sync.error?.includes('taken') ? 'That username is taken. Try another.' : sync.error || "Couldn't save your profile." });
            return;
        }
        const nextUsername = sync.profile?.username || handle;
        await patchEngine({
            profileName: name,
            profileUsername: nextUsername,
            profileAvatar: sync.profile?.avatarUrl || avatarOverride || engineState.profileAvatar || '',
        });
        setUsername(nextUsername);
        setSaved({ name, username: nextUsername });
        setMessage({ ok: true, text: 'Profile saved.' });
        window.setTimeout(() => setMessage((m) => (m?.ok ? null : m)), 2500);
    };

    const onAvatarFile = (file: File | undefined) => {
        if (!file) return;
        if (file.size > 2_000_000) {
            setMessage({ ok: false, text: 'Pick an image under 2 MB.' });
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
            const dataUrl = reader.result as string;
            void patchEngine({ profileAvatar: dataUrl }).then(() => save(dataUrl));
        };
        reader.readAsDataURL(file);
    };

    const togglePublic = async (next: boolean) => {
        setPublicOverride(next);
        await sendProgressionMessage({ type: 'SET_PUBLIC_PROFILE', enabled: next });
        await refreshProgression();
        if (!accessToken || !refreshToken || !progression) return;
        const today = last7DaysStats?.[last7DaysStats.length - 1];
        const focusScore = computeFocusScore({
            todaySites: today?.sites,
            todayTotalMs: today?.total,
            blockedToday: engineState.blockedToday,
            dailyPlanner: engineState.dailyPlanner,
            habits: engineState.habits,
            streak: dashboardStreak,
        }).score;
        const achievements = computeAchievements({
            streak: dashboardStreak,
            bestStreak: bestStreak || dashboardStreak,
            blockedToday: engineState.blockedToday ?? 0,
            focusScore,
            habitsCount: engineState.habits?.length ?? 0,
            pomodoroTotal: engineState.pomodoroSettings?.sessionsCompleted ?? 0,
        });
        await syncPublicFocusProfile(
            supabase,
            {
                focusScore,
                longestStreak: Math.max(bestStreak, dashboardStreak),
                currentStreak: dashboardStreak,
                hoursFocused: progression.stats.focusMinutesTotal / 60,
                achievementsUnlocked: unlockedCount(achievements),
                progression: { ...progression, publicProfileEnabled: next },
            },
            { access_token: accessToken, refresh_token: refreshToken },
        );
    };

    const initial = (displayName || email || '?').charAt(0).toUpperCase();

    return (
        <SettingsSection id="account" title="Account" description={email ? `Signed in as ${email}` : undefined}>
            <SettingRow
                title="Profile"
                description="How you appear to friends and on your public profile."
                keywords="name display username handle avatar photo picture email"
                stacked
            >
                <form
                    className="flex flex-col gap-4 sm:flex-row sm:items-start"
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (canSave) void save();
                    }}
                >
                    <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        className="group relative size-16 shrink-0 overflow-hidden rounded-full border border-[var(--fz-border)] bg-[var(--fz-bg-active)]"
                        aria-label="Change profile photo"
                        title="Change photo"
                    >
                        {avatar ? (
                            <img src={avatar} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
                        ) : (
                            <span className="flex size-full items-center justify-center text-[22px] font-semibold text-[var(--fz-text-2)]">{initial}</span>
                        )}
                        <span className="absolute inset-0 flex items-center justify-center bg-black/55 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                            <Camera size={18} className="text-white" />
                        </span>
                    </button>
                    <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                            onAvatarFile(e.target.files?.[0]);
                            e.target.value = '';
                        }}
                    />
                    <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
                        <div>
                            <label htmlFor="settings-display-name" className="text-label mb-1.5 block">Display name</label>
                            <Input
                                id="settings-display-name"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                disabled={!saved}
                                maxLength={60}
                            />
                        </div>
                        <div>
                            <label htmlFor="settings-username" className="text-label mb-1.5 block">Username</label>
                            <div className="relative">
                                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] text-[var(--fz-text-4)]">@</span>
                                <Input
                                    id="settings-username"
                                    value={username}
                                    onChange={(e) => setUsername(normalizeUsername(e.target.value))}
                                    disabled={!saved}
                                    placeholder="yourname"
                                    invalid={handleStatus === 'taken'}
                                    className="pl-6"
                                    autoComplete="off"
                                    spellCheck={false}
                                />
                            </div>
                            <p
                                className={`text-meta mt-1 ${
                                    handleStatus === 'taken' ? 'text-[var(--fz-danger)]' : handleStatus === 'available' ? 'text-[var(--fz-success)]' : ''
                                }`}
                            >
                                {handleStatus === 'short'
                                    ? 'At least 3 letters, numbers or underscores.'
                                    : handleStatus === 'checking'
                                      ? 'Checking…'
                                      : handleStatus === 'available'
                                        ? `@${handle} is available`
                                        : handleStatus === 'taken'
                                          ? `@${handle} is taken`
                                          : 'Friends add you with this.'}
                            </p>
                        </div>
                        <div className="flex items-center gap-3 sm:col-span-2">
                            <Button type="submit" variant="primary" size="sm" disabled={!canSave} loading={saving}>
                                Save profile
                            </Button>
                            {dirty && !saving && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        if (!saved) return;
                                        setDisplayName(saved.name);
                                        setUsername(saved.username);
                                    }}
                                >
                                    Discard
                                </Button>
                            )}
                            {message && (
                                <span role="status" className={`flex items-center gap-1 text-[12px] ${message.ok ? 'text-[var(--fz-success)]' : 'text-[var(--fz-danger)]'}`}>
                                    {message.ok && <Check size={13} />}
                                    {message.text}
                                </span>
                            )}
                        </div>
                    </div>
                </form>
            </SettingRow>

            <SettingRow
                title="Public focus profile"
                description={
                    <>
                        Share your level, streak and focus stats on a public page.
                        {publicEnabled && handle.length >= 3 && (
                            <a
                                href={publicProfileUrl(handle)}
                                target="_blank"
                                rel="noreferrer"
                                className="ml-1.5 inline-flex items-center gap-1 font-medium text-[var(--fz-text-1)] underline-offset-2 hover:underline"
                            >
                                View it <ExternalLink size={11} />
                            </a>
                        )}
                    </>
                }
                keywords="public profile share visibility stats page"
                control={<Switch checked={publicEnabled} onCheckedChange={(v) => void togglePublic(v)} aria-label="Public focus profile" />}
            />

            <SettingRow
                title="Sign out"
                description="Sign out of FocuzNow on this device."
                keywords="log out logout"
                control={
                    <Button size="sm" iconLeft={<LogOut size={13} />} onClick={() => void signOut()}>
                        Sign out
                    </Button>
                }
            />
        </SettingsSection>
    );
}
