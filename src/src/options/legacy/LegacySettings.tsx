// LEGACY: the Preferences + Account pages from before Settings was merged.
// Moved out of options/OptionsApp.tsx; kept for Settings → Page versions.
import { useEffect, useState, useRef } from 'react';

import { useAuthStore } from '../../lib/store';
import {
    Palette as IconPalette,
    Youtube as IconBrandYoutube,
    Instagram as IconBrandInstagram,
    Search as IconSearch,
    User as IconUser,
    Play as IconPlayerPlay,
    ExternalLink as IconExternalLink,
    CreditCard as IconCreditCard,
} from 'lucide-react';

import SmartYouTubeModal from '../../components/SmartYouTubeModal';
import { normalizeSmartYouTube } from '../../lib/youtubeSmartMode';

import { BrowsingHistorySettings } from '../../components/BrowsingHistorySettings';

import { sendProgressionMessage } from '../../hooks/useFocusProgression';
import { useFocusProgression } from '../../hooks/useFocusProgression';
import { syncPublicFocusProfile, publicProfileUrl } from '../../lib/progressionApi';
import { computeAchievements, unlockedCount } from '../../lib/achievements';
import { computeFocusScore } from '../../lib/focusScore';

import DeleteAccountModal from '../../components/DeleteAccountModal';

import { deleteAccountPermanently, usesGoogleSignIn, verifyAccountWithGoogle } from '../../lib/accountApi';

import { Dialog } from '../../components/fz/Dialog';

import { supabase } from '../../lib/supabase';
import {
    fetchMyProfile,
    isUsernameAvailable,
    normalizeUsername,
    suggestUsername,
    syncProfileFromSettings,
} from '../../lib/profileApi';
import { signOutOnAuthError } from '../../lib/authErrors';
import { BILLING_RETURN_URL } from '../../lib/billingUrls';
import { invokeAuthedFunction } from '../../lib/supabaseFunctions';
import { useProDashboardVisuals } from '../../lib/proDashboard';
import {
    getDashboardColorMode,
    setDashboardColorMode,
    subscribeToDashboardColorMode,
    setEngineTheme,
    normalizeThemeForUser,
    type DashboardColorMode,
} from '../../lib/themes';
import {
    ACCENTS,
    accentHueFor,
    accentSwatch,
    applyAccentHue,
    readCustomHue,
    writeCustomHue,
    type AccentId,
} from '../../lib/accents';
import {
    readSidebarDefaultMode,
    readSidebarStyle,
    setSidebarDefaultMode,
    setSidebarStyle,
    type SidebarMode,
    type SidebarStyle,
} from '../../lib/sidebar';
import { SegmentedControl } from '../../components/fz/SegmentedControl';
import { Switch } from '../../components/fz/Switch';
import { PROFILE_AVATAR_LARGE_IMG_CLASS, PROFILE_AVATAR_LARGE_WRAP_CLASS } from '../../lib/profileAvatar';

import { GlassCard } from '../OptionsApp';
import { resetPageVersions, setPageVersion } from '../../lib/pageVersions';

function accountAvatarFromMetadata(metadata: Record<string, unknown> | null | undefined): string {
    const candidates = [metadata?.avatar_url, metadata?.picture, metadata?.avatar];
    return candidates.find((value): value is string => typeof value === 'string' && value.trim().length > 0)?.trim() || '';
}

const SIDEBAR_DEFAULT_OPTIONS: { value: SidebarMode; label: string }[] = [
    { value: 'expanded', label: 'Expanded' },
    { value: 'rail', label: 'Rail' },
];

const AppearanceSection = () => {
    const { engineState } = useAuthStore();
    const { enabled, setEnabled } = useProDashboardVisuals();
    const [colorMode, setColorMode] = useState<DashboardColorMode>(() => getDashboardColorMode());
    const [customHue, setCustomHue] = useState(() => readCustomHue());
    const [sidebarDefault, setSidebarDefault] = useState<SidebarMode>(() => readSidebarDefaultMode());
    const [sidebarStyle, setSidebarStyleState] = useState<SidebarStyle>(() => readSidebarStyle());
    const accentId = normalizeThemeForUser(engineState.theme, true);

    useEffect(() => subscribeToDashboardColorMode(setColorMode), []);

    const pickAccent = (id: string, hue?: number) => {
        if (id === 'custom') {
            const h = hue ?? customHue;
            if (hue !== undefined) {
                writeCustomHue(h);
                setCustomHue(h);
            }
            applyAccentHue(h);
        } else {
            applyAccentHue(accentHueFor(id));
        }
        void setEngineTheme(id as AccentId);
    };

    return (
        <section>
            <div className="pt-1 pb-2">
                <p className="text-label text-[var(--fz-text-3)]">Appearance</p>
            </div>
            <GlassCard className="divide-y divide-[var(--dashboard-border)] border-[var(--dashboard-border)] bg-[var(--dashboard-surface-raised)]">
                <div className="flex items-center justify-between gap-6 px-4 py-3.5">
                    <div className="min-w-0">
                        <h3 className="text-sm font-medium text-[var(--dashboard-text)]">Theme</h3>
                        <p className="mt-0.5 text-xs text-[var(--dashboard-text-muted)]">Light, dark, or follow your system.</p>
                    </div>
                    <SegmentedControl
                        size="sm"
                        value={colorMode}
                        onChange={(m) => {
                            setColorMode(m);
                            void setDashboardColorMode(m);
                        }}
                        options={[
                            { value: 'light' as const, label: 'Light' },
                            { value: 'dark' as const, label: 'Dark' },
                            { value: 'system' as const, label: 'System' },
                        ]}
                    />
                </div>
                <div className="px-4 py-3.5">
                    <div className="flex items-start justify-between gap-6">
                        <div className="min-w-0">
                            <h3 className="text-sm font-medium text-[var(--dashboard-text)]">Accent</h3>
                            <p className="mt-0.5 text-xs text-[var(--dashboard-text-muted)]">Used for focus states and highlights.</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                            {ACCENTS.filter((a) => a.id !== 'custom').map((a) => (
                                <button
                                    key={a.id}
                                    type="button"
                                    aria-label={`${a.label} accent`}
                                    aria-pressed={accentId === a.id}
                                    onClick={() => pickAccent(a.id)}
                                    className={`size-6 rounded-full transition-transform hover:scale-110 ${
                                        accentId === a.id ? 'ring-2 ring-[var(--fz-accent)] ring-offset-2 ring-offset-[var(--fz-bg-panel)]' : 'ring-1 ring-[var(--fz-border)]'
                                    }`}
                                    style={{ background: accentSwatch(a.hue) }}
                                />
                            ))}
                            <button
                                type="button"
                                aria-label="Custom accent"
                                aria-pressed={accentId === 'custom'}
                                onClick={() => pickAccent('custom')}
                                className={`size-6 rounded-full transition-transform hover:scale-110 ${
                                    accentId === 'custom' ? 'ring-2 ring-[var(--fz-accent)] ring-offset-2 ring-offset-[var(--fz-bg-panel)]' : 'ring-1 ring-[var(--fz-border)]'
                                }`}
                                style={{ background: `conic-gradient(from 0deg, oklch(0.68 0.15 15), oklch(0.68 0.15 160), oklch(0.68 0.15 255), oklch(0.68 0.15 15))` }}
                            />
                        </div>
                    </div>
                    {accentId === 'custom' && (
                        <input
                            type="range"
                            min={0}
                            max={360}
                            value={customHue}
                            aria-label="Custom accent hue"
                            onChange={(e) => pickAccent('custom', Number(e.target.value))}
                            className="mt-3 w-full accent-[var(--fz-accent)]"
                        />
                    )}
                </div>
                <div className="flex items-center justify-between gap-6 px-4 py-3.5">
                    <div className="min-w-0">
                        <h3 className="text-sm font-medium text-[var(--dashboard-text)]">Reduce motion</h3>
                        <p className="mt-0.5 text-xs text-[var(--dashboard-text-muted)]">Minimize animations and transitions.</p>
                    </div>
                    <Switch
                        checked={!enabled}
                        onCheckedChange={(v) => void setEnabled(!v)}
                        aria-label="Reduce motion"
                    />
                </div>
                <div className="flex items-center justify-between gap-6 px-4 py-3.5">
                    <div className="min-w-0">
                        <h3 className="text-sm font-medium text-[var(--dashboard-text)]">Sidebar style</h3>
                        <p className="mt-0.5 text-xs text-[var(--dashboard-text-muted)]">Use the current sidebar or switch back to the legacy one.</p>
                    </div>
                    <SegmentedControl
                        size="sm"
                        value={sidebarStyle}
                        onChange={(v) => {
                            setSidebarStyleState(v);
                            setSidebarStyle(v);
                        }}
                        options={[
                            { value: 'modern' as const, label: 'Current' },
                            { value: 'legacy' as const, label: 'Legacy' },
                        ]}
                    />
                </div>
                {sidebarStyle === 'modern' && (
                <div className="flex items-center justify-between gap-6 px-4 py-3.5">
                    <div className="min-w-0">
                        <h3 className="text-sm font-medium text-[var(--dashboard-text)]">Sidebar default</h3>
                        <p className="mt-0.5 text-xs text-[var(--dashboard-text-muted)]">How the sidebar opens on the dashboard.</p>
                    </div>
                    <SegmentedControl
                        size="sm"
                        value={sidebarDefault}
                        onChange={(m) => {
                            setSidebarDefault(m);
                            setSidebarDefaultMode(m);
                        }}
                        options={SIDEBAR_DEFAULT_OPTIONS}
                    />
                </div>
                )}
            </GlassCard>
        </section>
    );
};

const SettingsTab = () => {
    const { engineState, fetchEngineState } = useAuthStore();
    const override = engineState.emergencyOverrideSettings ?? {
        enabled: true,
        maxPerDay: 3,
        minReasonLength: 20,
        accessMinutes: 15,
        cooldownMinutes: 30,
    };

    const patchOverride = async (patch: Partial<typeof override>) => {
        await new Promise<void>(r => chrome.runtime.sendMessage({
            type: 'UPDATE_ENGINE_SETTINGS',
            settings: { emergencyOverrideSettings: { ...override, ...patch } },
        }, () => r()));
        fetchEngineState();
    };

    return (
        <div className="space-y-6 animate-fade-in-up">
            <AppearanceSection />
            <BrowsingHistorySettings />
            <Customization />
            <div className="pt-1">
                <p className="text-label text-[var(--fz-text-3)]">Safety controls</p>
            </div>
            <GlassCard className="border-[var(--dashboard-border)] bg-[var(--dashboard-surface-raised)] p-4">
                <div className="flex items-center justify-between gap-6">
                    <div className="min-w-0">
                        <h3 className="text-sm font-medium text-[var(--dashboard-text)]">Emergency override</h3>
                        <p className="mt-1 max-w-lg text-xs leading-relaxed text-[var(--dashboard-text-muted)]">
                            On blocked pages, users can request temporary access by explaining why.
                            All requests are logged. Disabled during Nuclear Lockdown.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => patchOverride({ enabled: !override.enabled })}
                        aria-label={`${override.enabled ? 'Disable' : 'Enable'} emergency override`}
                        aria-pressed={override.enabled}
                        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${override.enabled ? 'bg-[var(--fz-warning)]' : 'bg-[var(--dashboard-interactive-hover)]'}`}
                    >
                        <div className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${override.enabled ? 'left-6' : 'left-1'}`} />
                    </button>
                </div>
                {override.enabled && (
                    <p className="mt-3 border-t border-[var(--dashboard-border)] pt-3 text-[11px] text-[var(--dashboard-text-muted)]">
                        {override.maxPerDay} uses/day · {override.accessMinutes} min access · {override.minReasonLength}+ char reason · {override.cooldownMinutes} min cooldown
                    </p>
                )}
            </GlassCard>
            <GlassCard className="border-[var(--dashboard-border)] bg-[var(--dashboard-surface-raised)] p-4">
                <div className="flex items-center justify-between gap-6">
                    <div className="min-w-0">
                        <h3 className="text-sm font-medium text-[var(--dashboard-text)]">Unblocking challenge</h3>
                        <p className="mt-1 text-xs text-[var(--dashboard-text-muted)]">Require a typing test before unblocking any site during active hours.</p>
                    </div>
                    <button
                        type="button"
                        onClick={async () => {
                            await new Promise<void>(r => chrome.runtime.sendMessage({
                                type: 'UPDATE_ENGINE_SETTINGS',
                                settings: { requireChallenge: !engineState.requireChallenge }
                            }, () => r()));
                            fetchEngineState();
                        }}
                        aria-label={`${engineState.requireChallenge ? 'Disable' : 'Enable'} unblocking challenge`}
                        aria-pressed={Boolean(engineState.requireChallenge)}
                        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${engineState.requireChallenge ? 'bg-[var(--fz-accent)]' : 'bg-[var(--dashboard-interactive-hover)]'}`}
                    >
                        <div className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${engineState.requireChallenge ? 'left-6' : 'left-1'}`} />
                    </button>
                </div>
            </GlassCard>
        </div>
    );
};

const Customization = () => {
    const { engineState, toggleEngineBool, fetchEngineState, patchInAppBlock } = useAuthStore();

    const [showFilterModal, setShowFilterModal] = useState(false);
    const [showSmartYtModal, setShowSmartYtModal] = useState(false);
    const [filterSearch, setFilterSearch] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [mockResults, setMockResults] = useState<any[]>([]);
    const [searchPlatform, setSearchPlatform] = useState<'youtube' | 'instagram' | 'tiktok'>('youtube');

    // Popular accounts per platform for client-side fuzzy search (CORS blocks direct fetches to IG/TT)
    const POPULAR_ACCOUNTS: Record<string, { handle: string; name: string; description: string }[]> = {
        instagram: [
            { handle: '@instagram', name: 'Instagram', description: 'Official Instagram account' },
            { handle: '@cristiano', name: 'Cristiano Ronaldo', description: 'Professional footballer • 600M+' },
            { handle: '@kyliejenner', name: 'Kylie Jenner', description: 'Entrepreneur & Media Personality' },
            { handle: '@therock', name: 'Dwayne Johnson', description: 'Actor, Producer, Athlete • 395M+' },
            { handle: '@selenagomez', name: 'Selena Gomez', description: 'Actress, Singer • 430M+' },
            { handle: '@kimkardashian', name: 'Kim Kardashian', description: 'Media Personality • 360M+' },
            { handle: '@leomessi', name: 'Lionel Messi', description: 'Professional footballer • 500M+' },
            { handle: '@beyonce', name: 'Beyoncé', description: 'Artist, Entertainer • 320M+' },
            { handle: '@justinbieber', name: 'Justin Bieber', description: 'Musician • 290M+' },
            { handle: '@arianagrande', name: 'Ariana Grande', description: 'Singer, Actress • 380M+' },
            { handle: '@kendalljenner', name: 'Kendall Jenner', description: 'Model • 290M+' },
            { handle: '@taylorswift', name: 'Taylor Swift', description: 'Singer-Songwriter • 280M+' },
            { handle: '@natgeo', name: 'National Geographic', description: 'Nature & Science • 280M+' },
            { handle: '@nike', name: 'Nike', description: 'Just Do It • 300M+' },
            { handle: '@neymarjr', name: 'Neymar Jr', description: 'Professional footballer • 220M+' },
            { handle: '@khloekardashian', name: 'Khloé Kardashian', description: 'Media Personality • 310M+' },
            { handle: '@jlo', name: 'Jennifer Lopez', description: 'Entertainer • 250M+' },
            { handle: '@mrbeast', name: 'MrBeast', description: 'YouTube Creator • 45M+' },
            { handle: '@zendaya', name: 'Zendaya', description: 'Actress • 180M+' },
            { handle: '@champagnepapi', name: 'Drake', description: 'Artist • 150M+' },
        ],
        tiktok: [
            { handle: '@charlidamelio', name: "Charli D'Amelio", description: 'Dancer, Creator • 155M+' },
            { handle: '@khaby.lame', name: 'Khaby Lame', description: 'Comedy Creator • 162M+' },
            { handle: '@bellapoarch', name: 'Bella Poarch', description: 'Creator, Singer • 93M+' },
            { handle: '@addisonre', name: 'Addison Rae', description: 'Creator, Actress • 89M+' },
            { handle: '@zachking', name: 'Zach King', description: 'Magic & Illusions • 81M+' },
            { handle: '@willsmith', name: 'Will Smith', description: 'Actor, Comedian • 75M+' },
            { handle: '@kimberly.loaiza', name: 'Kimberly Loaiza', description: 'Creator • 80M+' },
            { handle: '@mrbeast', name: 'MrBeast', description: 'YouTube & TikTok Creator • 95M+' },
            { handle: '@bfranktheone', name: 'Baby Frankie', description: 'Comedy Creator • 30M+' },
            { handle: '@spencerx', name: 'Spencer X', description: 'Beatboxer • 55M+' },
            { handle: '@dixiedamelio', name: "Dixie D'Amelio", description: 'Creator, Singer • 57M+' },
            { handle: '@jasonderulo', name: 'Jason Derulo', description: 'Singer • 60M+' },
            { handle: '@thehypehouse', name: 'Hype House', description: 'Creator collective • 20M+' },
            { handle: '@lorengray', name: 'Loren Gray', description: 'Singer, Creator • 55M+' },
            { handle: '@noahbeck', name: 'Noah Beck', description: 'Creator, Athlete • 33M+' },
        ],
    };

    const searchProfile = async (query: string) => {
        if (!query) return;
        setIsSearching(true);
        setMockResults([]);
        const sanitized = query.replace(/^@/, '').toLowerCase().trim();

        if (searchPlatform === 'youtube') {
            try {
                // YouTube search page for fuzzy multi-result queries
                const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(sanitized)}`;
                const html = await fetch(searchUrl).then(r => r.text());

                // Extract channel results from ytInitialData
                const dataMatch = html.match(/var ytInitialData = (.+?);<\/script>/);
                const results: any[] = [];

                if (dataMatch) {
                    try {
                        const data = JSON.parse(dataMatch[1]);
                        const contents = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];
                        for (const item of contents) {
                            const channel = item.channelRenderer;
                            if (channel && results.length < 5) {
                                const handle = channel.channelId ? `@${channel.title?.simpleText?.replace(/\s+/g, '') || channel.channelId}` : `@${sanitized}`;
                                results.push({
                                    handle,
                                    name: channel.title?.simpleText || sanitized,
                                    image: channel.thumbnail?.thumbnails?.slice(-1)?.[0]?.url || '',
                                    description: channel.subscriberCountText?.simpleText || 'YouTube Channel',
                                    platform: 'youtube'
                                });
                            }
                            const video = item.videoRenderer;
                            if (video && results.length < 5) {
                                const channelName = video.ownerText?.runs?.[0]?.text || 'Unknown';
                                const channelHandle = `@${channelName.replace(/\s+/g, '')}`;
                                if (!results.find(r => r.handle === channelHandle)) {
                                    results.push({
                                        handle: channelHandle,
                                        name: channelName,
                                        image: '',
                                        description: 'YouTube Channel (from video result)',
                                        platform: 'youtube'
                                    });
                                }
                            }
                        }
                    } catch { /* parse error, fallback */ }
                }

                // Fallback: try the direct channel page
                if (results.length === 0) {
                    try {
                        const url = `https://www.youtube.com/@${sanitized}`;
                        const chHtml = await fetch(url).then(r => r.text());
                        const imageMatch = chHtml.match(/<meta property="og:image" content="([^"]+)"/);
                        const titleMatch = chHtml.match(/<meta property="og:title" content="([^"]+)"/);
                        const descMatch = chHtml.match(/<meta property="og:description" content="([^"]+)"/);
                        if (titleMatch) {
                            results.push({
                                handle: `@${sanitized}`,
                                name: titleMatch[1],
                                image: imageMatch?.[1] || '',
                                description: descMatch?.[1] || 'YouTube Channel',
                                platform: 'youtube'
                            });
                        }
                    } catch { /* fallback */ }
                }

                setMockResults(results.length > 0 ? results : [{ handle: `@${sanitized}`, name: sanitized, description: 'Custom keyword filter', platform: 'youtube' }]);
            } catch {
                setMockResults([{ handle: `@${sanitized}`, name: sanitized, description: 'Custom keyword filter', platform: 'youtube' }]);
            }
        } else {
            // Instagram / TikTok — fuzzy search through curated popular accounts
            const pool = POPULAR_ACCOUNTS[searchPlatform] || [];
            const matches = pool.filter(a =>
                a.handle.toLowerCase().includes(sanitized) ||
                a.name.toLowerCase().includes(sanitized)
            );
            if (matches.length > 0) {
                setMockResults(matches.map(m => ({ ...m, platform: searchPlatform })));
            } else {
                // Allow manual entry
                setMockResults([{ handle: `@${sanitized}`, name: sanitized, description: `Custom ${searchPlatform} filter`, platform: searchPlatform }]);
            }
        }
        setIsSearching(false);
    };

    return (
        <div className="animate-fade-in-up space-y-4">
            <p className="pt-1 text-label text-[var(--fz-text-3)]">Blocking</p>

            <GlassCard className="border-[var(--dashboard-border)] bg-[var(--dashboard-surface-raised)] p-4">
                <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-[var(--dashboard-text)]">
                    <IconPalette size={15} className="text-[var(--fz-accent)]" />
                    <span>Blocking message</span>
                </h3>
                <div>
                    <p className="mb-3 text-xs text-[var(--dashboard-text-muted)]">Shown when you try to visit a blocked site.</p>
                    <textarea
                        value={engineState.redirectMessage}
                        onChange={async (e) => {
                            await new Promise<void>(r => chrome.runtime.sendMessage({
                                type: 'UPDATE_ENGINE_SETTINGS',
                                settings: { redirectMessage: e.target.value }
                            }, () => r()));
                            fetchEngineState();
                        }}
                        className="h-20 w-full resize-none rounded-lg border border-[var(--dashboard-border)] bg-[var(--dashboard-interactive)] p-3 text-sm text-[var(--dashboard-text)] outline-none transition-colors focus:border-[var(--fz-accent)]/60"
                    />
                </div>
            </GlassCard>

            <GlassCard className="divide-y divide-[var(--dashboard-border)] border-[var(--dashboard-border)] bg-[var(--dashboard-surface-raised)] px-4">
                <h3 className="py-3 text-sm font-medium text-[var(--dashboard-text)]">Focus engine</h3>

                <div className="flex items-center justify-between gap-6 py-3">
                    <div className="min-w-0">
                        <span className="block text-sm font-medium text-[var(--dashboard-text)]">Site clock</span>
                        <p className="mt-0.5 text-xs text-[var(--dashboard-text-muted)]">Show a per-site time bubble on every page.</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => void toggleEngineBool('draggableTimer')}
                        aria-label={`${engineState.draggableTimer ? 'Disable' : 'Enable'} site clock`}
                        aria-pressed={Boolean(engineState.draggableTimer)}
                        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${engineState.draggableTimer ? 'bg-[var(--fz-accent)]' : 'bg-[var(--dashboard-interactive-hover)]'}`}
                    >
                        <div className={`pointer-events-none absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${engineState.draggableTimer ? 'left-6' : 'left-1'}`} />
                    </button>
                </div>

                <div className="flex items-center justify-between gap-6 py-3">
                    <div className="min-w-0">
                        <span className="block text-sm font-medium text-[var(--dashboard-text)]">Pomodoro widget</span>
                        <p className="mt-0.5 text-xs text-[var(--dashboard-text-muted)]">Show the current session timer on all sites.</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => void toggleEngineBool('pomodoroWidget')}
                        aria-label={`${engineState.pomodoroWidget ? 'Disable' : 'Enable'} Pomodoro widget`}
                        aria-pressed={Boolean(engineState.pomodoroWidget)}
                        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${engineState.pomodoroWidget ? 'bg-[var(--fz-accent)]' : 'bg-[var(--dashboard-interactive-hover)]'}`}
                    >
                        <div className={`pointer-events-none absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${engineState.pomodoroWidget ? 'left-6' : 'left-1'}`} />
                    </button>
                </div>

                <div className="flex items-center justify-between gap-6 py-3">
                    <div className="min-w-0">
                        <span className="block text-sm font-medium text-[var(--dashboard-text)]">Background audio</span>
                        <p className="mt-0.5 text-xs text-[var(--dashboard-text-muted)]">Count time for unfocused tabs playing media.</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => void toggleEngineBool('trackBackgroundAudio')}
                        aria-label={`${engineState.trackBackgroundAudio ? 'Disable' : 'Enable'} background audio tracking`}
                        aria-pressed={Boolean(engineState.trackBackgroundAudio)}
                        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${engineState.trackBackgroundAudio ? 'bg-[var(--fz-accent)]' : 'bg-[var(--dashboard-interactive-hover)]'}`}
                    >
                        <div className={`pointer-events-none absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${engineState.trackBackgroundAudio ? 'left-6' : 'left-1'}`} />
                    </button>
                </div>
            </GlassCard>

            <GlassCard className="space-y-4 border-[var(--dashboard-border)] bg-[var(--dashboard-surface-raised)] p-5 sm:p-6">
                <div>
                    <h3 className="text-base font-semibold text-[var(--dashboard-text)]">Smart YouTube Mode</h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-[var(--dashboard-text-muted)]">
                        Uses the YouTube Data API to classify videos by official category. Education and Science are always allowed.
                    </p>
                </div>

                {(() => {
                    const smart = normalizeSmartYouTube(engineState.inAppBlock?.smartYouTube);
                    const patchSmart = async (next: typeof smart) => {
                        await patchInAppBlock({ smartYouTube: next });
                    };

                    return (
                        <>
                            <div className="flex items-center justify-between gap-4 rounded-lg border border-[var(--dashboard-border)] bg-[var(--dashboard-interactive)] p-4">
                                <div>
                                    <span className="block text-sm font-semibold text-[var(--dashboard-text)]">Enable Smart YouTube</span>
                                    <span className="text-[11px] text-[var(--dashboard-text-muted)]">
                                        {smart.blockedCategoryIds.length} categories blocked
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={smart.enabled}
                                    onClick={() => void patchSmart({ ...smart, enabled: !smart.enabled })}
                                    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${smart.enabled ? 'bg-[var(--fz-accent)]' : 'bg-[var(--dashboard-interactive-hover)]'}`}
                                >
                                    <span className={`pointer-events-none absolute top-1 left-1 h-4 w-4 rounded-full shadow-sm transition-transform ${smart.enabled ? 'translate-x-5 bg-[var(--fz-accent-fg)]' : 'translate-x-0 bg-white'}`} />
                                </button>
                            </div>
                            {smart.enabled && (
                                <button
                                    type="button"
                                    onClick={() => setShowSmartYtModal(true)}
                                    className="w-full rounded-lg border border-[var(--fz-border)] bg-[var(--fz-accent-soft)] py-3 text-sm font-medium text-[var(--fz-accent)] hover:bg-[var(--fz-bg-hover)]"
                                >
                                    Configure blocked categories…
                                </button>
                            )}
                            <SmartYouTubeModal
                                open={showSmartYtModal}
                                onClose={() => setShowSmartYtModal(false)}
                                settings={smart}
                                onSave={patchSmart}
                            />
                        </>
                    );
                })()}
            </GlassCard>

            <GlassCard className="space-y-4 border-[var(--dashboard-border)] bg-[var(--dashboard-surface-raised)] p-5 sm:p-6">
                <div>
                    <h3 className="text-base font-semibold text-[var(--dashboard-text)]">In-App Distraction Blocking</h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-[var(--dashboard-text-muted)]">
                        Blocks YouTube Shorts only — or use Smart YouTube above for smarter filtering.
                    </p>
                </div>

                <div className="rounded-lg border border-[var(--dashboard-border)] bg-[var(--dashboard-interactive)] p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-2">
                            <IconBrandYoutube size={18} className="shrink-0 text-[var(--dashboard-text)]" />
                            <div className="min-w-0">
                                <span className="block font-semibold text-[var(--dashboard-text)]">Block YouTube Shorts</span>
                                <span className="mt-0.5 block text-[11px] text-[var(--dashboard-text-muted)]">
                                    Redirects /shorts URLs and hides Shorts in your feed
                                </span>
                            </div>
                        </div>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={!!engineState.inAppBlock?.youtubeShorts}
                            onClick={() => {
                                void patchInAppBlock({
                                    youtubeShorts: !engineState.inAppBlock?.youtubeShorts,
                                });
                            }}
                            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${engineState.inAppBlock?.youtubeShorts ? 'bg-[var(--fz-accent)]' : 'bg-[var(--dashboard-interactive-hover)]'}`}
                        >
                            <span
                                className={`pointer-events-none absolute top-1 left-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                                    engineState.inAppBlock?.youtubeShorts ? 'translate-x-5' : 'translate-x-0'
                                }`}
                            />
                        </button>
                    </div>
                </div>
            </GlassCard>

            {/* Profile Search Modal — legacy; kept for settings tab other flows */}
            <Dialog
                open={showFilterModal}
                onClose={() => { setShowFilterModal(false); setMockResults([]); setFilterSearch(''); }}
                title="Allow YouTube channel"
                size="md"
            >
                <div>
                        {/* Platform Selector */}
                        <div className="flex space-x-2 mb-4">
                            {([
                                { key: 'youtube' as const, icon: IconBrandYoutube, label: 'YouTube', color: 'red' },
                                { key: 'instagram' as const, icon: IconBrandInstagram, label: 'Instagram', color: 'pink' },
                                { key: 'tiktok' as const, icon: IconPlayerPlay, label: 'TikTok', color: 'cyan' },
                            ]).map(p => (
                                <button key={p.key}
                                    onClick={() => { setSearchPlatform(p.key); setMockResults([]); setFilterSearch(''); }}
                                    className={`flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-lg text-xs font-bold transition-all ${searchPlatform === p.key
                                        ? `bg-${p.color}-500/20 text-${p.color}-400 border border-${p.color}-500/30`
                                        : 'bg-white/6 text-neutral-500 border border-white/8 hover:bg-white/10'
                                        }`}>
                                    <p.icon size={16} />
                                    <span>{p.label}</span>
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center space-x-3 mb-6 bg-black/40 border border-white/8 rounded-lg px-4 py-3 focus-within:border-[var(--fz-accent)] transition-all">
                            <IconSearch size={18} className="text-neutral-500" />
                            <input
                                autoFocus
                                value={filterSearch}
                                onChange={e => setFilterSearch(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && searchProfile(filterSearch)}
                                type="text"
                                className="flex-1 bg-transparent text-white outline-none text-sm placeholder:text-neutral-600"
                                placeholder="Search @handle or #hashtag..."
                            />
                            <button
                                onClick={() => searchProfile(filterSearch)}
                                className="px-3 py-1.5 bg-white/10 hover:bg-white/10 text-white rounded-lg text-xs font-bold transition-colors"
                            >Search</button>
                        </div>

                        <div className="min-h-[100px] max-h-[300px] overflow-y-auto space-y-3">
                            {isSearching ? (
                                <div className="text-center py-8">
                                    <div className="w-8 h-8 border-2 border-[var(--fz-accent)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                                    <p className="text-xs text-neutral-400 font-medium">Scanning web protocols…</p>
                                </div>
                            ) : mockResults.map((res: any, idx: number) => (
                                <div key={idx} className="flex items-center space-x-4 p-4 bg-white/6 border border-white/8 rounded-lg group transition-all">
                                    {res.image ? (
                                        <img src={res.image} alt="" className="w-12 h-12 rounded-full ring-2 ring-white/8 object-cover" />
                                    ) : (
                                        <div className="w-12 h-12 rounded-full bg-[var(--fz-accent-soft)] text-[var(--fz-accent)] flex items-center justify-center font-bold text-lg ring-1 ring-[var(--fz-border)]">
                                            {res.handle[0].toUpperCase()}
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-white truncate">{res.name}</p>
                                        <p className="text-[11px] text-neutral-400 truncate mt-0.5">{res.description}</p>
                                        <p className="text-xs text-[var(--fz-accent)] font-bold mt-1 tracking-tight">{res.handle}</p>
                                    </div>
                                    <button
                                        onClick={async () => {
                                            const current = engineState.inAppBlock?.filters || [];
                                            if (!current.includes(res.handle)) {
                                                await new Promise<void>(r => chrome.runtime.sendMessage({
                                                    type: 'UPDATE_ENGINE_SETTINGS',
                                                    settings: { inAppBlock: { ...engineState.inAppBlock, filters: [...current, res.handle] } }
                                                }, () => r()));
                                                fetchEngineState();
                                            }
                                            setShowFilterModal(false);
                                            setFilterSearch('');
                                            setMockResults([]);
                                        }}
                                        className="bg-[var(--fz-danger-soft)] text-[var(--fz-danger)] rounded-lg px-4 py-2 text-xs font-semibold transition-colors hover:brightness-110"
                                    >Block</button>
                                </div>
                            ))}
                            {!isSearching && mockResults.length === 0 && filterSearch && (
                                <div className="text-center py-8 opacity-50">
                                    <IconSearch size={32} className="mx-auto mb-3" />
                                    <p className="text-xs">No accounts found matching this query in the cache.</p>
                                </div>
                            )}
                        </div>
                </div>
            </Dialog>
        </div>
    );
};

// =========================================================
// ACCOUNT SETTINGS
// =========================================================
const AccountSettings = () => {
    const {
        session,
        engineState,
        fetchEngineState,
        subscriptionTier,
        subscriptionDetails,
        signOut,
        syncSubscriptionFromDb,
        dashboardStreak,
        bestStreak,
        last7DaysStats,
    } = useAuthStore();
    const { progression, refresh: refreshProgression } = useFocusProgression();
    const [publicProfileEnabled, setPublicProfileEnabled] = useState(false);
    const [displayName, setDisplayName] = useState(engineState.profileName || session?.user?.email || '');
    const [username, setUsername] = useState(() => suggestUsername(session?.user?.email));
    const [profileLoaded, setProfileLoaded] = useState(false);
    const [profileSaving, setProfileSaving] = useState(false);
    const [profileError, setProfileError] = useState('');
    const [profileNotice, setProfileNotice] = useState('');
    const [handleStatus, setHandleStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'short'>('idle');
    const savedUsernameRef = useRef('');
    const [portalLoading, setPortalLoading] = useState(false);
    const [checkoutLoading, setCheckoutLoading] = useState(false);
    const [showDeleteAccount, setShowDeleteAccount] = useState(false);
    const isPro = subscriptionTier === 'pro';

    const sessionTokens =
        session?.access_token && session?.refresh_token
            ? { access_token: session.access_token, refresh_token: session.refresh_token }
            : null;
    const sessionAccountAvatarUrl = accountAvatarFromMetadata(session?.user?.user_metadata);

    useEffect(() => {
        if (progression) setPublicProfileEnabled(progression.publicProfileEnabled);
    }, [progression?.publicProfileEnabled]);

    const syncPublicProfile = async (enabled: boolean) => {
        if (!session?.access_token || !progression) return;
        const todayData = last7DaysStats?.[last7DaysStats.length - 1];
        const focusScore = computeFocusScore({
            todaySites: todayData?.sites,
            todayTotalMs: todayData?.total,
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
                progression: { ...progression, publicProfileEnabled: enabled },
            },
            sessionTokens,
        );
    };

    const togglePublicProfile = async () => {
        const next = !publicProfileEnabled;
        setPublicProfileEnabled(next);
        await sendProgressionMessage({ type: 'SET_PUBLIC_PROFILE', enabled: next });
        await refreshProgression();
        await syncPublicProfile(next);
    };

    useEffect(() => {
        if (!session?.user?.id) {
            setDisplayName('');
            setUsername('');
            setProfileLoaded(false);
            return;
        }

        setDisplayName('');
        setUsername(suggestUsername(session.user.email));
        savedUsernameRef.current = '';
        setProfileLoaded(false);
        setHandleStatus('idle');

        let cancelled = false;
        void (async () => {
            const profile = await fetchMyProfile(supabase, sessionTokens);
            if (cancelled) return;
            if (profile) {
                const name = profile.displayName.trim();
                setDisplayName(name);
                setUsername(profile.username);
                savedUsernameRef.current = profile.username;
                setHandleStatus('available');
                const settings = {
                    profileName: name,
                    profileInitial: (name.charAt(0) || 'F').toUpperCase(),
                    profileAvatar: profile.avatarUrl || sessionAccountAvatarUrl || '',
                };
                await new Promise<void>((r) =>
                    chrome.runtime.sendMessage(
                        { type: 'UPDATE_ENGINE_SETTINGS', settings },
                        () => r(),
                    ),
                );
                fetchEngineState();
            } else {
                setUsername(suggestUsername(session.user.email));
            }
            setProfileLoaded(true);
        })();
        return () => {
            cancelled = true;
        };
    }, [session?.user?.id, session?.user?.email, session?.access_token, session?.refresh_token, sessionAccountAvatarUrl, fetchEngineState]);

    useEffect(() => {
        if (!profileLoaded || !sessionTokens) return;
        const normalized = normalizeUsername(username);
        if (normalized.length < 3) {
            setHandleStatus(normalized.length === 0 ? 'idle' : 'short');
            return;
        }
        if (normalized === savedUsernameRef.current) {
            setHandleStatus('available');
            return;
        }

        setHandleStatus('checking');
        const timer = window.setTimeout(() => {
            void isUsernameAvailable(supabase, normalized, sessionTokens).then((result) => {
                if (normalizeUsername(username) !== normalized) return;
                if (result.reason === 'USERNAME_TOO_SHORT') {
                    setHandleStatus('short');
                } else {
                    setHandleStatus(result.available ? 'available' : 'taken');
                }
            });
        }, 400);

        return () => window.clearTimeout(timer);
    }, [username, profileLoaded, sessionTokens]);

    const saveProfile = async (avatarOverride?: string | null) => {
        if (!session?.user?.id || !sessionTokens) {
            await signOutOnAuthError('NOT_AUTHENTICATED');
            return;
        }

        const normalizedHandle = normalizeUsername(username);
        if (normalizedHandle.length < 3) {
            setProfileError('Handle must be at least 3 characters (letters, numbers, underscore).');
            return;
        }
        if (normalizedHandle !== savedUsernameRef.current) {
            const availability = await isUsernameAvailable(supabase, normalizedHandle, sessionTokens);
            if (!availability.available) {
                setProfileError('That handle is already taken. Pick another.');
                setHandleStatus('taken');
                return;
            }
        }

        setProfileSaving(true);
        setProfileError('');
        setProfileNotice('');

        const sync = await syncProfileFromSettings(
            supabase,
            session.user.id,
            {
                username,
                displayName: displayName.trim(),
                profileAvatar: avatarOverride ?? engineState.profileAvatar,
            },
            sessionTokens,
        );

        setProfileSaving(false);

        if (!sync.ok) {
            const signedOut = await signOutOnAuthError(sync.error);
            if (!signedOut) setProfileError(sync.error || 'Could not save profile.');
            if (sync.error?.includes('taken')) setHandleStatus('taken');
            return;
        }

        const nextUsername = sync.profile?.username || normalizedHandle;
        const nextAvatar =
            sync.profile?.avatarUrl ||
            avatarOverride ||
            engineState.profileAvatar ||
            '';
        await new Promise<void>((r) =>
            chrome.runtime.sendMessage(
                {
                    type: 'UPDATE_ENGINE_SETTINGS',
                    settings: {
                        profileName: displayName.trim(),
                        profileUsername: nextUsername,
                        profileAvatar: nextAvatar,
                    },
                },
                () => r(),
            ),
        );
        fetchEngineState();

        if (sync.profile?.username) {
            savedUsernameRef.current = sync.profile.username;
            setUsername(sync.profile.username);
            setHandleStatus('available');
        }

        setProfileNotice('Profile saved.');
        window.setTimeout(() => setProfileNotice(''), 2500);
    };

    const saveName = () => void saveProfile();

    const uploadAvatar = () => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                const reader = new FileReader();
                reader.onloadend = async () => {
                    const dataUrl = reader.result as string;
                    await new Promise<void>((r) =>
                        chrome.runtime.sendMessage(
                            {
                                type: 'UPDATE_ENGINE_SETTINGS',
                                settings: { profileAvatar: dataUrl },
                            },
                            () => r(),
                        ),
                    );
                    fetchEngineState();
                    await saveProfile(dataUrl);
                };
                reader.readAsDataURL(file);
            }
        };
        fileInput.click();
    };

    useEffect(() => {
        void syncSubscriptionFromDb();
    }, [session?.user?.id, syncSubscriptionFromDb]);

    const openStripePortal = async () => {
        if (!session?.access_token) {
            await signOutOnAuthError('NOT_AUTHENTICATED');
            return;
        }
        setPortalLoading(true);
        setProfileError('');
        try {
            await syncSubscriptionFromDb();

            const { data, error } = await invokeAuthedFunction('create-portal-session', session.access_token, {
                return_url: BILLING_RETURN_URL,
            });
            if (data?.url) {
                window.open(data.url, '_blank', 'noopener,noreferrer');
                if (data.stripeCustomerId) {
                    await chrome.storage.local.set({
                        subscriptionDetails: {
                            ...(subscriptionDetails ?? {}),
                            stripeCustomerId: data.stripeCustomerId,
                        },
                    });
                }
            } else if (data?.code === 'NO_CUSTOMER') {
                const checkout = await invokeAuthedFunction(
                    'create-checkout-session',
                    session.access_token,
                    { return_url: BILLING_RETURN_URL },
                );
                if (checkout.data?.url) {
                    window.open(checkout.data.url, '_blank', 'noopener,noreferrer');
                    setProfileNotice('Opening Stripe to link your billing profile…');
                    window.setTimeout(() => setProfileNotice(''), 4000);
                } else {
                    setProfileError(
                        data.error ||
                            'Could not find Stripe billing for this account. Try Upgrade to Pro to link billing.',
                    );
                }
            } else {
                const signedOut = await signOutOnAuthError(error?.message || data?.error);
                if (!signedOut) {
                    setProfileError(
                        data?.error ||
                            error?.message ||
                            'Could not open billing portal. Try https://focuznow.com/manage_subscription while signed in.',
                    );
                }
            }
        } catch (e) {
            console.error('Portal failed:', e);
            const signedOut = await signOutOnAuthError(e);
            if (!signedOut) {
                setProfileError(
                    e instanceof Error
                        ? e.message
                        : 'Could not open billing portal. Try https://focuznow.com/manage_subscription while signed in.',
                );
            }
        }
        setPortalLoading(false);
    };

    const openCheckout = async () => {
        if (!session?.access_token) {
            await signOutOnAuthError('NOT_AUTHENTICATED');
            return;
        }
        if (isPro) {
            setProfileNotice('You are already subscribed to Pro. Opening billing portal…');
            window.setTimeout(() => setProfileNotice(''), 3000);
            await openStripePortal();
            return;
        }
        setCheckoutLoading(true);
        setProfileError('');
        try {
            const { data, error } = await invokeAuthedFunction(
                'create-checkout-session',
                session.access_token,
                { return_url: BILLING_RETURN_URL },
            );
            if (data?.already_subscribed || data?.code === 'ALREADY_SUBSCRIBED') {
                await syncSubscriptionFromDb();
                setProfileNotice(data.error || 'You are already subscribed to Pro.');
                if (data.url) window.open(data.url, '_blank');
                else await openStripePortal();
                return;
            }
            if (data?.url) window.open(data.url, '_blank');
            else {
                const signedOut = await signOutOnAuthError(error?.message || data?.error);
                if (!signedOut) setProfileError(error?.message || 'Could not start checkout.');
            }
        } catch (e) {
            console.error('Checkout failed:', e);
            const signedOut = await signOutOnAuthError(e);
            if (!signedOut) setProfileError('Could not start checkout.');
        } finally {
            setCheckoutLoading(false);
        }
    };

    const renewalLabel = subscriptionDetails?.currentPeriodEnd
        ? new Date(subscriptionDetails.currentPeriodEnd).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
          })
        : null;

    return (
        <div className="grid animate-fade-in-up gap-4 md:grid-cols-2">

            {/* Avatar + Name */}
            <GlassCard className="col-span-full p-5">
                <div className="mb-4 flex items-start gap-5">
                    <div onClick={uploadAvatar} className={`${PROFILE_AVATAR_LARGE_WRAP_CLASS} cursor-pointer hover:border-[var(--fz-accent)] transition-colors relative group`}>
                        {engineState.profileAvatar ? (
                            <img src={engineState.profileAvatar} className={PROFILE_AVATAR_LARGE_IMG_CLASS} alt="Avatar" />
                        ) : (
                            <span className="text-xl font-semibold">{session?.user?.email?.[0].toUpperCase()}</span>
                        )}
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <IconUser size={18} className="text-white" />
                        </div>
                    </div>
                    <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
                        <div>
                            <label className="mb-1.5 block text-label text-[var(--fz-text-3)]">Display name</label>
                            <input
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                onBlur={saveName}
                                disabled={profileSaving}
                                className="w-full rounded-lg border border-[var(--dashboard-border)] bg-[var(--dashboard-interactive)] px-3 py-2 text-sm font-medium text-[var(--dashboard-text)] outline-none transition-colors focus:border-[var(--fz-accent)]/60"
                            />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-label text-[var(--fz-text-3)]">Handle</label>
                            <div className="flex items-center overflow-hidden rounded-lg border border-[var(--dashboard-border)] bg-[var(--dashboard-interactive)] focus-within:border-[var(--fz-accent)]/60">
                                <span className="pl-3 text-sm text-[var(--dashboard-text-muted)]">@</span>
                                <input
                                    value={username}
                                    onChange={(e) => setUsername(normalizeUsername(e.target.value))}
                                    onBlur={saveName}
                                    disabled={profileSaving || !profileLoaded}
                                    placeholder="yourname"
                                    className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm text-[var(--dashboard-text)] outline-none"
                                />
                            </div>
                            <p className="mt-1 text-[11px] text-[var(--dashboard-text-muted)]">
                                Your unique public FocuzNow handle.
                            </p>
                            {handleStatus === 'checking' && (
                                <p className="text-[11px] text-neutral-500 mt-0.5">Checking availability…</p>
                            )}
                            {handleStatus === 'available' && username.length >= 3 && (
                                <p className="text-[11px] text-emerald-500/90 mt-0.5">
                                    @{normalizeUsername(username)} is available
                                </p>
                            )}
                            {handleStatus === 'taken' && (
                                <p className="text-[11px] text-red-400 mt-0.5">That handle is already taken</p>
                            )}
                            {handleStatus === 'short' && username.length > 0 && (
                                <p className="text-[11px] text-[var(--fz-warning)] mt-0.5">At least 3 characters</p>
                            )}
                        </div>
                    </div>
                </div>
                {(profileError || profileNotice) && (
                    <p
                        className={`text-xs mb-2 ${profileError ? 'text-red-400' : 'text-emerald-400'}`}
                    >
                        {profileError || profileNotice}
                    </p>
                )}
                <div className="flex items-center justify-between gap-4 border-t border-[var(--dashboard-border)] pt-3">
                    <p className="text-xs text-[var(--dashboard-text-muted)]">Email address</p>
                    <p className="truncate text-xs font-medium text-[var(--dashboard-text)]">{session?.user?.email}</p>
                </div>
            </GlassCard>

            <GlassCard className="p-4">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h3 className="text-sm font-medium text-[var(--dashboard-text)]">Public focus profile</h3>
                        <p className="mt-1 text-xs leading-relaxed text-[var(--dashboard-text-muted)]">
                            Share your level, streak, and focus stats — like a GitHub profile for students.
                        </p>
                        {publicProfileEnabled && username.length >= 3 && (
                            <a
                                href={publicProfileUrl(normalizeUsername(username))}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-[var(--fz-accent)] hover:text-[var(--fz-accent)] mt-2 font-medium"
                            >
                                View public profile <IconExternalLink size={12} />
                            </a>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={togglePublicProfile}
                        aria-label={`${publicProfileEnabled ? 'Disable' : 'Enable'} public focus profile`}
                        aria-pressed={publicProfileEnabled}
                        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${publicProfileEnabled ? 'bg-[var(--fz-accent)]' : 'bg-[var(--dashboard-interactive-hover)]'}`}
                    >
                        <div className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${publicProfileEnabled ? 'left-6' : 'left-1'}`} />
                    </button>
                </div>
            </GlassCard>

            {/* Subscription Management */}
            {(() => {
                const subscriptionBody = (
                    <>
                        <div className="flex items-center space-x-2 mb-2">
                            <IconCreditCard size={14} className="text-[var(--fz-accent)]" />
                            <h3 className="text-sm font-medium text-[var(--dashboard-text)]">Subscription</h3>
                            <span className="text-[11px] text-neutral-500">· {isPro ? 'Pro' : 'Free'}</span>
                        </div>
                        {isPro ? (
                            <div className="space-y-3">
                                <div className="p-3 bg-[var(--fz-accent-soft)] border border-[var(--fz-accent)] rounded-lg space-y-1">
                                    <p className="text-xs text-[var(--fz-accent)] font-bold">Subscribed to Pro ✦</p>
                                    <p className="text-[11px] text-[var(--fz-accent)]/80">
                                        Status: {subscriptionDetails?.status === 'trialing' ? 'Trial' : 'Active'}
                                        {renewalLabel
                                            ? subscriptionDetails?.cancelAtPeriodEnd
                                                ? ` · access until ${renewalLabel}`
                                                : ` · renews ${renewalLabel}`
                                            : ''}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => void openStripePortal()}
                                    disabled={portalLoading}
                                    className="w-full py-2.5 bg-white/10 hover:bg-white/10 border border-white/8 rounded-lg font-bold text-xs text-white transition-all flex items-center justify-center space-x-2 active:scale-[0.98]"
                                >
                                    {portalLoading ? (
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <IconExternalLink size={14} />
                                            <span>Manage subscription</span>
                                        </>
                                    )}
                                </button>
                                <p className="text-[11px] text-neutral-600 text-center">
                                    Opens Stripe Customer Portal in a new tab.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <p className="text-xs text-neutral-400">Upgrade for advanced blocking, scheduling, and all premium features.</p>
                                <button
                                    onClick={() => void openCheckout()}
                                    disabled={checkoutLoading}
                                    className="w-full py-2.5 bg-white text-black rounded-lg font-bold text-xs hover:bg-neutral-200 transition-all active:scale-[0.98] disabled:opacity-60"
                                >
                                    {checkoutLoading ? 'Opening checkout…' : 'Upgrade to Pro'}
                                </button>
                            </div>
                        )}
                    </>
                );
                return (
                    <GlassCard className="p-4 bg-surface">
                        {subscriptionBody}
                    </GlassCard>
                );
            })()}

            {/* Danger Zone */}
            <GlassCard className="col-span-full flex items-center justify-between gap-6 border-red-500/15 p-4">
                <div>
                <h3 className="mb-1 text-sm font-medium text-red-400">Delete account</h3>
                <p className="text-xs text-neutral-500 mb-3">Permanently delete your account and all associated data. This cannot be undone.</p>
                </div>
                <button
                    type="button"
                    onClick={() => setShowDeleteAccount(true)}
                    className="shrink-0 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/20"
                >
                    Delete account
                </button>
            </GlassCard>

            <DeleteAccountModal
                open={showDeleteAccount}
                email={session?.user?.email || ''}
                googleSignIn={session?.user ? usesGoogleSignIn(session.user) : false}
                onClose={() => setShowDeleteAccount(false)}
                onVerifyGoogle={async () =>
                    verifyAccountWithGoogle(session?.user?.email || '')
                }
                onConfirm={async (password) => {
                    if (!session?.access_token || !session.user?.email) {
                        return { ok: false, error: 'You must be signed in.' };
                    }
                    const googleUser = usesGoogleSignIn(session.user);
                    const result = await deleteAccountPermanently(session.access_token, {
                        email: session.user.email,
                        password,
                        googleAlreadyVerified: googleUser,
                    });
                    if (result.ok) {
                        await signOut();
                    }
                    return result;
                }}
            />
        </div>
    );
};

/** Old Preferences / Account pages behind a small switcher, plus a way back. */
export default function LegacySettings({ initialTab = 'settings' }: { initialTab?: 'settings' | 'account' }) {
    const [tab, setTab] = useState<'settings' | 'account'>(initialTab);
    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--fz-border)] bg-[var(--fz-bg-raised)] px-4 py-3">
                <p className="text-[13px] text-[var(--fz-text-2)]">
                    You're using the legacy Settings.{' '}
                    <button type="button" className="font-medium text-[var(--fz-text-1)] underline underline-offset-2" onClick={() => void setPageVersion('settings', 'new')}>
                        Switch to the new one
                    </button>
                    {' '}or{' '}
                    <button type="button" className="font-medium text-[var(--fz-text-1)] underline underline-offset-2" onClick={() => void resetPageVersions()}>
                        use new pages everywhere
                    </button>
                    .
                </p>
                <SegmentedControl
                    size="sm"
                    idPrefix="legacy-settings"
                    value={tab}
                    onChange={setTab}
                    options={[{ value: 'settings' as const, label: 'Preferences' }, { value: 'account' as const, label: 'Account' }]}
                />
            </div>
            {tab === 'settings' ? <SettingsTab /> : <AccountSettings />}
        </div>
    );
}
