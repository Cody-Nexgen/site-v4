import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../lib/store';
import {
    Ban as IconBan,
    Zap as IconBolt,
    LogOut as IconLogout,
    Lock as IconLock,
    Globe as IconWorldCheck,
    Palette as IconPalette,
    Youtube as IconBrandYoutube,
    Instagram as IconBrandInstagram,
    Search as IconSearch,
    X as IconX,
    Target as IconTarget,
    User as IconUser,
    FileText as IconNote,
    Clock as IconClock,
    ListTodo as IconChecklist,
    Quote as IconQuote,
    Plus as IconPlus,
    Trash as IconTrash,
    Play as IconPlayerPlay,
    Pause as IconPlayerPause,
    RefreshCw as IconRefresh,
    Check as IconCheck,
    ExternalLink as IconExternalLink,
    CreditCard as IconCreditCard,
    Maximize2 as IconMaximize2,
} from 'lucide-react';
import AiCoachGate from '../components/AiCoachGate';
import ForestTab from './ForestTab';
import FocusRoomView from '../components/FocusRoomView';
import SmartYouTubeModal from '../components/SmartYouTubeModal';
import { normalizeSmartYouTube } from '../lib/youtubeSmartMode';
import { FeaturePreview } from '../components/FeaturePreview';
import { AuthLogin } from '../components/AuthLogin';
import { BrowsingHistorySettings } from '../components/BrowsingHistorySettings';
import OverviewTab from './OverviewTab';
import { SessionsTab, BlocklistTab, HabitsTab, StatisticsTab, PatternsTab } from './Pages';
import SupportTab from './SupportTab';
import AchievementsTab from './AchievementsTab';
import ChallengesTab from './ChallengesTab';
import FocusShopTab from './FocusShopTab';
import FriendsTab from './FriendsTab';
import { resolveTabId, tabLabel } from '../lib/workspaceNav';
import { AUTO_SCHEDULE_COACH_PROMPT } from '../lib/socialApi';
import { sendProgressionMessage } from '../hooks/useFocusProgression';
import { useFocusProgression } from '../hooks/useFocusProgression';
import { syncPublicFocusProfile, publicProfileUrl } from '../lib/progressionApi';
import { computeAchievements, unlockedCount } from '../lib/achievements';
import { computeFocusScore } from '../lib/focusScore';
import SchedulingCalendarPage from './SchedulingCalendarPage';
import ListsTab from './ListsTab';
import { BookingNotificationModal } from '../components/BookingNotificationModal';
import DeleteAccountModal from '../components/DeleteAccountModal';
import { EmergencyUnlockModal } from '../components/EmergencyUnlockModal';
import HabitNameModal from '../components/HabitNameModal';
import {
    deleteAccountPermanently,
    usesGoogleSignIn,
    verifyAccountWithGoogle,
} from '../lib/accountApi';
import { useHostBookingNotifications } from '../hooks/useHostBookingNotifications';
import { OptionsCommandPalette } from './OptionsCommandPalette';
import { WorkspaceSidebar } from './WorkspaceSidebar';
import SetupPage from './SetupPage';
import {
    isSetupComplete,
    markSetupComplete,
    openWebDashboard,
    readSidebarCollapsed,
    shouldOpenTabOnWeb,
    writeSidebarCollapsed,
} from '../lib/workspaceSync';
import { getPlatform, isWebPlatform } from '../lib/platform';
import { supabase } from '../lib/supabase';
import {
    fetchMyProfile,
    isUsernameAvailable,
    normalizeUsername,
    suggestUsername,
    syncProfileFromSettings,
} from '../lib/profileApi';
import { signOutOnAuthError } from '../lib/authErrors';
import { BILLING_RETURN_URL } from '../lib/billingUrls';
import { invokeAuthedFunction } from '../lib/supabaseFunctions';
import { useProDashboardVisuals, FOCUS_COMPLETE_EVENT } from '../lib/proDashboard';
import {
    applyDocumentTheme,
    applyProWelcomePack,
} from '../lib/themes';
import {
    PROFILE_AVATAR_LARGE_IMG_CLASS,
    PROFILE_AVATAR_LARGE_WRAP_CLASS,
} from '../lib/profileAvatar';
import { ThemeSelector } from '../components/pro-dashboard/ThemeSelector';
import {
    ProConfettiGate,
    ProFocusToast,
} from '../components/pro-dashboard/ProDashboardVisuals';
import { FutureSelfBlockedOverlay } from '../components/FutureSelfBlockedOverlay';
import { DailyFocusMirrorModal } from '../components/DailyFocusMirrorModal';
import type { FutureSelfBlockedSummary, FutureSelfMirror } from '../lib/futureSelfTypes';

// --- GLASSMORPHISM COMPONENTS ---

export const GlassCard = ({ children, className = "", onClick, style }: { children: React.ReactNode, className?: string, onClick?: (e: React.MouseEvent) => void, style?: React.CSSProperties }) => (
    <div
        onClick={onClick}
        style={style}
        className={`surface-card relative overflow-hidden ${onClick ? 'cursor-pointer hover:bg-white/[0.025] transition-colors' : ''} ${className}`}
    >
        <div className="relative z-10">{children}</div>
    </div>
);


export const ActivityGraph = ({ stats: statsProp, onSelectDay }: { stats?: { date: string; total: number; sites: Record<string, number> }[]; onSelectDay: (day: any) => void }) => {
    const { last7DaysStats } = useAuthStore();
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const [chartMode, setChartMode] = useState<'bar' | 'line'>('line');
    const uid = React.useId().replace(/:/g, '');

    const source = statsProp ?? last7DaysStats;
    const sliced = source.slice(-7);
    const stats = sliced.length ? sliced : Array.from({ length: 7 }, () => ({ date: '', total: 0, sites: {} }));
    const maxTotal = Math.max(...stats.map((s) => s.total || 0), 60 * 60 * 1000);
    const width = 800;
    const height = 200;
    const paddingX = 36;
    const paddingTop = 28;
    const paddingBottom = 16;
    const chartWidth = width - paddingX * 2;
    const chartHeight = height - paddingTop - paddingBottom;
    const barGap = 12;
    const barWidth = Math.max(28, (chartWidth - barGap * (stats.length - 1)) / Math.max(1, stats.length));

    const getBarX = (i: number) => paddingX + i * (barWidth + barGap);
    const getBarHeight = (ms: number) => Math.max(ms > 0 ? 4 : 0, ((ms || 0) / maxTotal) * chartHeight);
    const getBarY = (ms: number) => paddingTop + chartHeight - getBarHeight(ms);
    const getY = (pct: number) => paddingTop + chartHeight - (pct * chartHeight / 100);
    const getPointX = (i: number) => paddingX + (i * chartWidth / Math.max(1, stats.length - 1));
    const getPointY = (ms: number) => paddingTop + chartHeight - ((ms || 0) / maxTotal) * chartHeight;
    const linePath = stats.reduce((path, day, i) => {
        const x = getPointX(i);
        const y = getPointY(day.total);
        if (i === 0) return `M ${x} ${y}`;
        const previousX = getPointX(i - 1);
        const previousY = getPointY(stats[i - 1].total);
        const controlX = (previousX + x) / 2;
        return `${path} C ${controlX} ${previousY}, ${controlX} ${y}, ${x} ${y}`;
    }, '');

    const formatTime = (ms: number) => {
        const mins = Math.round((ms || 0) / 60000);
        if (mins < 60) return `${mins}m`;
        return `${(mins / 60).toFixed(1)}h`;
    };

    return (
        <div className="w-full h-full min-h-[12rem] relative overflow-visible">
            <div
                className="activity-chart-controls absolute right-1 top-0 z-20 flex rounded-lg border border-white/[0.08] bg-black/50 p-0.5 shadow-sm backdrop-blur"
                role="group"
                aria-label="Activity chart type"
            >
                {(['bar', 'line'] as const).map((mode) => (
                    <button
                        key={mode}
                        type="button"
                        onClick={() => setChartMode(mode)}
                        aria-pressed={chartMode === mode}
                        className={`rounded-md px-2 py-1 text-[10px] font-semibold capitalize transition-colors ${
                            chartMode === mode ? 'bg-white/[0.12] text-white' : 'text-neutral-500 hover:text-neutral-300'
                        }`}
                    >
                        {mode}
                    </button>
                ))}
            </div>
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible" preserveAspectRatio="none">
                <defs>
                    <linearGradient id={`barGradient-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#c084fc" />
                        <stop offset="100%" stopColor="#7c3aed" />
                    </linearGradient>
                    <linearGradient id={`lineFill-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#d4d4d4" stopOpacity="0.18" />
                        <stop offset="100%" stopColor="#d4d4d4" stopOpacity="0" />
                    </linearGradient>
                </defs>

                {[0, 50, 100].map((v) => (
                    <g key={v}>
                        <line x1={paddingX} y1={getY(v)} x2={width - paddingX} y2={getY(v)} stroke="white" strokeOpacity="0.04" />
                        <text x={4} y={getY(v) + 4} className="text-[9px] fill-neutral-600 font-medium">
                            {v === 0 ? '0' : v === 50 ? formatTime(maxTotal / 2) : formatTime(maxTotal)}
                        </text>
                    </g>
                ))}

                {chartMode === 'line' && (
                    <>
                        <motion.path
                            key={`area-${linePath}`}
                            d={`${linePath} L ${getPointX(stats.length - 1)} ${paddingTop + chartHeight} L ${getPointX(0)} ${paddingTop + chartHeight} Z`}
                            fill={`url(#lineFill-${uid})`}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.45 }}
                        />
                        <motion.path
                            key={linePath}
                            d={linePath}
                            fill="none"
                            stroke="#d4d4d4"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            vectorEffect="non-scaling-stroke"
                            initial={{ pathLength: 0, opacity: 0 }}
                            animate={{ pathLength: 1, opacity: 1 }}
                            transition={{ duration: 0.65, ease: 'easeOut' }}
                        />
                    </>
                )}

                {stats.map((day, i) => {
                    const h = getBarHeight(day.total);
                    const x = getBarX(i);
                    const y = getBarY(day.total);
                    const active = hoveredIndex === i;
                    const pointX = getPointX(i);
                    const pointY = getPointY(day.total);
                    return (
                        <g
                            key={i}
                            className="cursor-pointer"
                            onMouseEnter={() => setHoveredIndex(i)}
                            onMouseLeave={() => setHoveredIndex(null)}
                            onClick={() => onSelectDay(day)}
                            role="button"
                            tabIndex={0}
                            aria-label={`${day.date || `Day ${i + 1}`}: ${formatTime(day.total)}`}
                            onFocus={() => setHoveredIndex(i)}
                            onBlur={() => setHoveredIndex(null)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    onSelectDay(day);
                                }
                            }}
                        >
                            <rect
                                x={chartMode === 'bar' ? x : pointX - Math.max(22, chartWidth / stats.length / 2)}
                                y={paddingTop}
                                width={chartMode === 'bar' ? barWidth : Math.max(44, chartWidth / stats.length)}
                                height={chartHeight}
                                fill="transparent"
                            />
                            {chartMode === 'bar' ? (
                                <motion.rect
                                    x={x}
                                    width={barWidth}
                                    rx={8}
                                    fill={`url(#barGradient-${uid})`}
                                    opacity={active ? 1 : 0.85}
                                    initial={{ y: paddingTop + chartHeight, height: 0 }}
                                    animate={{ y, height: h }}
                                    transition={{ duration: 0.45, delay: i * 0.04, ease: 'easeOut' }}
                                />
                            ) : (
                                <>
                                    <circle
                                        cx={pointX}
                                        cy={pointY}
                                        r={active ? 6 : 4}
                                        fill="#0a0a0a"
                                        stroke={active ? '#fff' : '#a3a3a3'}
                                        strokeWidth="2"
                                        vectorEffect="non-scaling-stroke"
                                        className="transition-all duration-150"
                                    />
                                    {active && (
                                        <line
                                            x1={pointX}
                                            y1={pointY}
                                            x2={pointX}
                                            y2={paddingTop + chartHeight}
                                            stroke="white"
                                            strokeOpacity="0.12"
                                            strokeDasharray="3 4"
                                            vectorEffect="non-scaling-stroke"
                                        />
                                    )}
                                </>
                            )}
                            {day.total > 0 && (
                                <text
                                    x={chartMode === 'bar' ? x + barWidth / 2 : pointX}
                                    y={Math.max(14, (chartMode === 'bar' ? y : pointY) - 8)}
                                    textAnchor="middle"
                                    className="fill-neutral-300 font-semibold"
                                    style={{ fontSize: 11, opacity: chartMode === 'bar' || active ? 1 : 0 }}
                                >
                                    {formatTime(day.total)}
                                </text>
                            )}
                        </g>
                    );
                })}
            </svg>
        </div>
    );
};



const ChallengeModal = ({ isOpen, onClose, onComplete, phrase, onDisableChallenge }: { isOpen: boolean, onClose: () => void, onComplete: () => void, phrase: string, onDisableChallenge?: () => void }) => {
    const [input, setInput] = useState('');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
            <GlassCard className="w-full max-w-lg p-8 space-y-6 border-purple-500/30">
                <div className="text-center space-y-2">
                    <h3 className="text-2xl font-semibold text-white tracking-tight">Focus Challenge</h3>
                    <p className="text-neutral-400 text-sm">Type the phrase below exactly to confirm you truly wish to unblock this site.</p>
                </div>

                <div className="p-4 bg-white/5 border border-white/10 rounded-2xl text-center select-none">
                    <p className="text-lg font-mono font-bold text-purple-400 tracking-wide">"{phrase}"</p>
                </div>

                <div className="space-y-4">
                    <input
                        autoFocus
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Type the phrase here..."
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white placeholder:text-neutral-600 outline-none focus:border-purple-500 transition-all font-medium"
                    />

                    <div className="flex space-x-3">
                        <button
                            onClick={onClose}
                            className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-neutral-400 font-bold rounded-2xl transition-all"
                        >Cancel</button>
                        <button
                            disabled={input !== phrase}
                            onClick={() => { onComplete(); setInput(''); }}
                            className={`flex-1 py-4 font-semibold rounded-2xl transition-all shadow-xl
                                ${input === phrase
                                    ? 'bg-purple-600 text-white shadow-purple-600/20 hover:bg-purple-500'
                                    : 'bg-neutral-800 text-neutral-600 cursor-not-allowed opacity-50'}`}
                        >Confirm Unblock</button>
                    </div>
                    {onDisableChallenge && (
                        <button
                            type="button"
                            onClick={onDisableChallenge}
                            className="w-full py-3 text-xs font-semibold text-neutral-500 hover:text-neutral-300 transition-colors"
                        >
                            Turn off typing challenge
                        </button>
                    )}
                </div>
            </GlassCard>
        </div>
    );
};

const FOCUS_PHRASES = [
    "I choose focus over distraction",
    "My time is my most valuable asset",
    "I am in control of my attention",
    "Focus is the key to productivity",
    "Progress over perfection",
    "Discipline creates absolute freedom",
    "I will not sacrifice the future for the present",
    "Small steps every day lead to massive results",
    "Success demands singular and unwavering focus"
];

export const Blocking = () => {
    const { engineState, fetchEngineState } = useAuthStore();
    const [newBlocked, setNewBlocked] = useState('');
    const [newAllowed, setNewAllowed] = useState('');
    const [challengeState, setChallengeState] = useState<{ isOpen: boolean, domain: string, type: string, phrase: string }>({
        isOpen: false,
        domain: '',
        type: '',
        phrase: ''
    });

    const disableChallenge = async () => {
        await new Promise<void>((r) => chrome.runtime.sendMessage({
            type: 'UPDATE_ENGINE_SETTINGS',
            settings: { requireChallenge: false }
        }, () => r()));
        fetchEngineState();
        setChallengeState(prev => ({ ...prev, isOpen: false }));
    };

    const triggerAction = async (type: string, domain: string, action: 'add' | 'remove') => {
        if (!domain.trim()) return;

        if (action === 'remove' && engineState.requireChallenge) {
            const randomPhrase = FOCUS_PHRASES[Math.floor(Math.random() * FOCUS_PHRASES.length)];
            setChallengeState({ isOpen: true, domain, type, phrase: randomPhrase });
            return;
        }

        await executeAction(type, domain, action);
    };

    const executeAction = async (type: string, domain: string, action: 'add' | 'remove') => {
        await new Promise<void>((r) => chrome.runtime.sendMessage({
            type: `${action.toUpperCase()}_${type.toUpperCase()}`,
            domain: domain.trim()
        }, () => r()));
        fetchEngineState();
        setChallengeState(prev => ({ ...prev, isOpen: false }));
    };

    return (
        <div className="space-y-3 animate-fade-in-up">
            <ChallengeModal
                isOpen={challengeState.isOpen}
                phrase={challengeState.phrase}
                onClose={() => setChallengeState(prev => ({ ...prev, isOpen: false }))}
                onComplete={() => executeAction(challengeState.type, challengeState.domain, 'remove')}
                onDisableChallenge={disableChallenge}
            />

            <h2 className="text-lg font-bold text-white">Site Management</h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Blocked Sites */}
                <GlassCard className="p-4">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-white">Blocked List</h3>
                        <IconBan size={18} className="text-red-400" />
                    </div>
                    <div className="flex space-x-2 mb-4">
                        <input
                            value={newBlocked}
                            onChange={e => setNewBlocked(e.target.value)}
                            placeholder="website.com"
                            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:border-purple-500 outline-none transition-colors"
                        />
                        <button
                            onClick={() => { triggerAction('block', newBlocked, 'add'); setNewBlocked(''); }}
                            className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-lg shadow-purple-600/20"
                        >Add</button>
                    </div>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-hide pr-1">
                        {Object.keys(engineState.blocklist || {}).length === 0 ? (
                            <p className="text-neutral-600 text-xs text-center py-6 italic">No active blocks currently.</p>
                        ) : (
                            Object.entries(engineState.blocklist || {}).map(([domain, data]: [string, any]) => (
                                <div key={domain} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5 group hover:border-white/10 transition-all">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium">{domain}</span>
                                        <span className="text-[10px] text-neutral-600 font-bold uppercase tracking-widest">
                                            {data.sources.join(' + ')}
                                        </span>
                                    </div>
                                    {!engineState.nuclearState?.active && (
                                        <button
                                            onClick={() => triggerAction('block', domain, 'remove')}
                                            className="text-neutral-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                                        >
                                            <IconLogout size={16} />
                                        </button>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </GlassCard>

                {/* Allowed Sites */}
                <GlassCard className="p-4 border-green-500/10">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-white">Allowed (Whitelist)</h3>
                        <IconWorldCheck size={18} className="text-green-400" />
                    </div>
                    <div className="flex space-x-2 mb-4">
                        <input
                            value={newAllowed}
                            onChange={e => setNewAllowed(e.target.value)}
                            placeholder="trustedsite.com"
                            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:border-green-500 outline-none transition-colors"
                        />
                        <button
                            onClick={() => { triggerAction('allowed_site', newAllowed, 'add'); setNewAllowed(''); }}
                            className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-lg shadow-green-600/20"
                        >Add</button>
                    </div>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-hide pr-1">
                        {(engineState.allowedSites || []).map((domain: string) => (
                            <div key={domain} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5 group hover:border-white/10 transition-all">
                                <span className="text-sm font-medium">{domain}</span>
                                {!engineState.nuclearState?.active && (
                                    <button
                                        onClick={() => triggerAction('allowed_site', domain, 'remove')}
                                        className="text-neutral-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                                    >
                                        <IconLogout size={16} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </GlassCard>
            </div>

            <GlassCard className="p-4">
                <h3 className="font-semibold text-white mb-3">Network-wide Categories</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.keys(engineState.categoriesActive || {}).map(cat => (
                        !engineState.nuclearState?.active || engineState.categoriesActive[cat] ? (
                            <button
                                key={cat}
                                onClick={async () => {
                                    await new Promise<void>(r => chrome.runtime.sendMessage({
                                        type: 'CATEGORY_TOGGLE',
                                        category: cat,
                                        enabled: !engineState.categoriesActive[cat]
                                    }, () => r()));
                                    fetchEngineState();
                                }}
                                className={`p-4 rounded-3xl border transition-all text-center group
                                    ${engineState.categoriesActive[cat]
                                        ? 'bg-purple-600/20 border-purple-500 text-purple-400'
                                        : 'bg-white/5 border-white/5 text-neutral-500 hover:bg-white/10 hover:text-neutral-300'}`}
                            >
                                <span className="text-xs font-bold uppercase tracking-widest">{cat}</span>
                            </button>
                        ) : null
                    ))}
                </div>
            </GlassCard>
        </div>
    );
};

export const SettingsTab = () => {
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
        <div className="mx-auto w-full max-w-[820px] animate-fade-in-up space-y-4">
            <div className="border-b border-[var(--dashboard-border)] pb-4">
                <p className="focuz-section-label mb-1">Settings</p>
                <h2 className="text-2xl font-semibold tracking-tight text-[var(--dashboard-text)]">Preferences</h2>
                <p className="mt-1 text-sm text-[var(--dashboard-text-muted)]">Tune how FocuzNow looks, tracks activity, and protects focus time.</p>
            </div>
            <BrowsingHistorySettings />
            <Customization />
            <div className="pt-1">
                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--dashboard-text-muted)]">Safety controls</p>
            </div>
            <GlassCard className="p-4">
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
                        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${override.enabled ? 'bg-amber-500' : 'bg-[var(--dashboard-interactive-hover)]'}`}
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
            <GlassCard className="p-4">
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
                        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${engineState.requireChallenge ? 'bg-purple-500' : 'bg-[var(--dashboard-interactive-hover)]'}`}
                    >
                        <div className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${engineState.requireChallenge ? 'left-6' : 'left-1'}`} />
                    </button>
                </div>
            </GlassCard>
        </div>
    );
};

export const Customization = () => {
    const { engineState, toggleEngineBool, fetchEngineState } = useAuthStore();

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
            <p className="pt-1 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--dashboard-text-muted)]">Appearance & behavior</p>

            <GlassCard className="p-4">
                <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-[var(--dashboard-text)]">
                    <IconPalette size={15} className="text-purple-400" />
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
                        className="h-20 w-full resize-none rounded-md border border-[var(--dashboard-border)] bg-[var(--dashboard-interactive)] p-3 text-sm text-[var(--dashboard-text)] outline-none transition-colors focus:border-purple-500/60"
                    />
                </div>
            </GlassCard>

            <ThemeSelector />

            <GlassCard className="divide-y divide-[var(--dashboard-border)] px-4">
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
                        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${engineState.draggableTimer ? 'bg-purple-500' : 'bg-[var(--dashboard-interactive-hover)]'}`}
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
                        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${engineState.pomodoroWidget ? 'bg-purple-500' : 'bg-[var(--dashboard-interactive-hover)]'}`}
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
                        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${engineState.trackBackgroundAudio ? 'bg-purple-500' : 'bg-[var(--dashboard-interactive-hover)]'}`}
                    >
                        <div className={`pointer-events-none absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${engineState.trackBackgroundAudio ? 'left-6' : 'left-1'}`} />
                    </button>
                </div>
            </GlassCard>

            <GlassCard className="p-5 sm:p-6 space-y-4">
                <div>
                    <h3 className="font-semibold text-white text-base">Smart YouTube Mode</h3>
                    <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed">
                        Uses the YouTube Data API to classify videos by official category. Education and Science are always allowed.
                    </p>
                </div>

                {(() => {
                    const smart = normalizeSmartYouTube(engineState.inAppBlock?.smartYouTube);
                    const patchSmart = async (next: typeof smart) => {
                        await new Promise<void>((r) =>
                            chrome.runtime.sendMessage(
                                {
                                    type: 'UPDATE_ENGINE_SETTINGS',
                                    settings: {
                                        inAppBlock: {
                                            ...engineState.inAppBlock,
                                            smartYouTube: next,
                                            youtubeShorts: next.blockShorts !== false,
                                        },
                                    },
                                },
                                () => r(),
                            ),
                        );
                        fetchEngineState();
                    };

                    return (
                        <>
                            <div className="focuz-surface-card p-4 flex items-center justify-between gap-4">
                                <div>
                                    <span className="font-bold text-white text-sm block">Enable Smart YouTube</span>
                                    <span className="text-[11px] text-neutral-500">
                                        {smart.blockedCategoryIds.length} categories blocked
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => patchSmart({ ...smart, enabled: !smart.enabled })}
                                    className={`w-12 h-6 rounded-full transition-all relative shrink-0 ${smart.enabled ? 'bg-sky-500' : 'bg-neutral-800'}`}
                                >
                                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${smart.enabled ? 'left-7' : 'left-1'}`} />
                                </button>
                            </div>
                            {smart.enabled && (
                                <button
                                    type="button"
                                    onClick={() => setShowSmartYtModal(true)}
                                    className="w-full py-3 rounded-xl text-sm font-bold bg-sky-500/15 text-sky-300 hover:bg-sky-500/25 border border-sky-500/25"
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

            <GlassCard className="p-5 sm:p-6 space-y-4">
                <div>
                    <h3 className="font-semibold text-white text-base">In-App Distraction Blocking</h3>
                    <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed">
                        Blocks YouTube Shorts only — or use Smart YouTube above for smarter filtering.
                    </p>
                </div>

                <div className="p-4 sm:p-5 bg-white/5 border border-white/10 rounded-2xl transition-all">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2 min-w-0">
                            <IconBrandYoutube size={18} className="text-white shrink-0" />
                            <div className="min-w-0">
                                <span className="font-bold text-white block">Block YouTube Shorts</span>
                                <span className="text-[10px] text-neutral-500 mt-0.5 block">
                                    Redirects /shorts URLs and hides Shorts in your feed
                                </span>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={async () => {
                                const on = !engineState.inAppBlock?.youtubeShorts;
                                await new Promise<void>((r) =>
                                    chrome.runtime.sendMessage(
                                        {
                                            type: 'UPDATE_ENGINE_SETTINGS',
                                            settings: {
                                                inAppBlock: {
                                                    ...engineState.inAppBlock,
                                                    youtube: on,
                                                    youtubeShorts: on,
                                                },
                                            },
                                        },
                                        () => r(),
                                    ),
                                );
                                fetchEngineState();
                            }}
                            className={`w-12 h-6 rounded-full transition-all relative shrink-0 ${engineState.inAppBlock?.youtubeShorts ? 'bg-purple-600' : 'bg-neutral-800'}`}
                        >
                            <div
                                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${engineState.inAppBlock?.youtubeShorts ? 'left-7' : 'left-1'}`}
                            />
                        </button>
                    </div>
                </div>
            </GlassCard>

            {/* Profile Search Modal — legacy; kept for settings tab other flows */}
            {showFilterModal && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
                    <GlassCard className="w-full max-w-md p-6 animate-fade-in-up">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-white">Allow YouTube Channel</h3>
                            <button onClick={() => { setShowFilterModal(false); setMockResults([]); setFilterSearch(''); }} className="text-neutral-500 hover:text-white"><IconX size={20} /></button>
                        </div>

                        {/* Platform Selector */}
                        <div className="flex space-x-2 mb-4">
                            {([
                                { key: 'youtube' as const, icon: IconBrandYoutube, label: 'YouTube', color: 'red' },
                                { key: 'instagram' as const, icon: IconBrandInstagram, label: 'Instagram', color: 'pink' },
                                { key: 'tiktok' as const, icon: IconPlayerPlay, label: 'TikTok', color: 'cyan' },
                            ]).map(p => (
                                <button key={p.key}
                                    onClick={() => { setSearchPlatform(p.key); setMockResults([]); setFilterSearch(''); }}
                                    className={`flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-xl text-xs font-bold transition-all ${searchPlatform === p.key
                                        ? `bg-${p.color}-500/20 text-${p.color}-400 border border-${p.color}-500/30`
                                        : 'bg-white/5 text-neutral-500 border border-white/5 hover:bg-white/10'
                                        }`}>
                                    <p.icon size={16} />
                                    <span>{p.label}</span>
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center space-x-3 mb-6 bg-black/40 border border-white/10 rounded-2xl px-4 py-3 focus-within:border-purple-500 transition-all">
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
                                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition-colors"
                            >Search</button>
                        </div>

                        <div className="min-h-[100px] max-h-[300px] overflow-y-auto space-y-3">
                            {isSearching ? (
                                <div className="text-center py-8">
                                    <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                                    <p className="text-xs text-neutral-400 uppercase tracking-widest font-bold">Scanning Web Protocols...</p>
                                </div>
                            ) : mockResults.map((res: any, idx: number) => (
                                <div key={idx} className="flex items-center space-x-4 p-4 bg-white/5 border border-white/5 rounded-2xl group transition-all">
                                    {res.image ? (
                                        <img src={res.image} alt="" className="w-12 h-12 rounded-full ring-2 ring-white/10 object-cover" />
                                    ) : (
                                        <div className="w-12 h-12 rounded-full bg-purple-600/20 text-purple-400 flex items-center justify-center font-bold text-lg ring-1 ring-purple-500/30">
                                            {res.handle[0].toUpperCase()}
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-white truncate">{res.name}</p>
                                        <p className="text-[10px] text-neutral-400 truncate mt-0.5">{res.description}</p>
                                        <p className="text-xs text-purple-400 font-bold mt-1 tracking-tight">{res.handle}</p>
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
                                        className="bg-red-600 hover:bg-red-500 text-white rounded-xl px-4 py-2 text-xs font-bold transition-transform active:scale-95 shadow-lg shadow-red-600/20"
                                    >BLOCK</button>
                                </div>
                            ))}
                            {!isSearching && mockResults.length === 0 && filterSearch && (
                                <div className="text-center py-8 opacity-50">
                                    <IconSearch size={32} className="mx-auto mb-3" />
                                    <p className="text-xs">No accounts found matching this query in the cache.</p>
                                </div>
                            )}
                        </div>
                    </GlassCard>
                </div>
            )}
        </div>
    );
};

// =========================================================
// FOCUS QUOTES DATA
// =========================================================
const FOCUS_QUOTES = [
    "The secret of getting ahead is getting started. — Mark Twain",
    "Focus on being productive instead of busy. — Tim Ferriss",
    "It's not that I'm so smart, it's just that I stay with problems longer. — Einstein",
    "Do the hard jobs first. The easy jobs will take care of themselves. — Dale Carnegie",
    "The way to get started is to quit talking and begin doing. — Walt Disney",
    "Your future is created by what you do today, not tomorrow. — Robert Kiyosaki",
    "Discipline is the bridge between goals and accomplishment. — Jim Rohn",
    "Concentrate all your thoughts upon the work at hand. — Alexander Graham Bell",
    "You don't have to be great to start, but you have to start to be great. — Zig Ziglar",
    "Starve your distractions, feed your focus. — Unknown",
    "Small daily improvements over time lead to stunning results. — Robin Sharma",
    "The only way to do great work is to love what you do. — Steve Jobs",
    "Success is the sum of small efforts repeated day in and day out. — Robert Collier",
    "Action is the foundational key to all success. — Pablo Picasso",
    "Don't watch the clock; do what it does. Keep going. — Sam Levenson",
];

// =========================================================
// PRODUCTIVITY TAB
// =========================================================
export const Productivity = () => {
    const { engineState, fetchEngineState } = useAuthStore();
    const [isNotionSyncing, setIsNotionSyncing] = useState(false);

    const syncNotionTasks = async () => {
        if (!engineState.notionConnected) return;
        setIsNotionSyncing(true);
        chrome.runtime.sendMessage({ type: 'SYNC_NOTION_TASKS' }, async (resp) => {
            if (resp?.ok && resp.tasks) {
                const planner = engineState.dailyPlanner || [];
                const existingNotionIds = new Set(planner.map((p: any) => p.notionId).filter(Boolean));

                const newTasks = resp.tasks
                    .filter((nt: any) => !existingNotionIds.has(nt.id))
                    .map((nt: any) => ({
                        id: Date.now() + Math.random(),
                        time: '09:00',
                        task: nt.text,
                        done: nt.done,
                        notionId: nt.id
                    }));

                const updated = [...planner, ...newTasks].sort((a, b) => a.time.localeCompare(b.time));
                await new Promise<void>(r => chrome.runtime.sendMessage({ type: 'UPDATE_ENGINE_SETTINGS', settings: { dailyPlanner: updated } }, () => r()));
                fetchEngineState();
            }
            setIsNotionSyncing(false);
        });
    };

    // --- Pomodoro ---
    const defaultPomo = engineState.pomodoroSettings || { focusMin: 25, breakMin: 5, sessionsCompleted: 0, lastDate: '' };
    const [pomoRunning, setPomoRunning] = useState(false);
    const [pomoTimeLeft, setPomoTimeLeft] = useState(defaultPomo.focusMin * 60);
    const [isBreak, setIsBreak] = useState(false);
    const [pomoEndAt, setPomoEndAt] = useState<number | null>(null);
    const timerRef = useRef<number | null>(null);

    useEffect(() => {
        if (pomoRunning && pomoEndAt) {
            timerRef.current = window.setInterval(() => {
                const left = Math.max(0, Math.ceil((pomoEndAt - Date.now()) / 1000));
                setPomoTimeLeft(left);
                if (left <= 0) {
                    setPomoRunning(false);
                    setPomoEndAt(null);
                    setIsBreak(false);
                    setPomoTimeLeft(defaultPomo.focusMin * 60);
                }
            }, 1000);
            return () => { if (timerRef.current) clearInterval(timerRef.current); };
        }
    }, [pomoRunning, pomoEndAt, defaultPomo.focusMin]);

    useEffect(() => {
        if (!pomoRunning || pomoEndAt) return;
        setPomoEndAt(Date.now() + pomoTimeLeft * 1000);
    }, [pomoRunning, pomoEndAt, pomoTimeLeft]);

    const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

    // --- Habits ---
    const habits = engineState.habits || [];
    const todayStr = new Date().toDateString();

    const [habitModalOpen, setHabitModalOpen] = useState(false);

    const addHabitByName = async (name: string) => {
        const updated = [...habits, { id: Date.now(), name, streak: 0, checkins: [] }];
        await new Promise<void>(r =>
            chrome.runtime.sendMessage(
                { type: 'UPDATE_ENGINE_SETTINGS', settings: { habits: updated } },
                () => r(),
            ),
        );
        fetchEngineState();
    };

    const checkInHabit = async (id: number) => {
        const updated = habits.map(h => {
            if (h.id !== id) return h;
            if (h.checkins.includes(todayStr)) return h;
            return { ...h, checkins: [...h.checkins, todayStr], streak: h.streak + 1 };
        });
        await new Promise<void>(r => chrome.runtime.sendMessage({ type: 'UPDATE_ENGINE_SETTINGS', settings: { habits: updated } }, () => r()));
        fetchEngineState();
        await sendProgressionMessage({ type: 'PROGRESSION_HABIT_CHECKIN', habitId: id });
    };

    const removeHabit = async (id: number) => {
        const updated = habits.filter(h => h.id !== id);
        await new Promise<void>(r => chrome.runtime.sendMessage({ type: 'UPDATE_ENGINE_SETTINGS', settings: { habits: updated } }, () => r()));
        fetchEngineState();
    };

    // --- Scratchpad ---
    const [noteText, setNoteText] = useState(engineState.scratchpad || '');
    const [scratchList, setScratchList] = useState<{ id: number; title: string; body: string }[]>([]);
    const [activeScratchId, setActiveScratchId] = useState<number | null>(null);
    const [scratchFullscreen, setScratchFullscreen] = useState(false);
    const saveNote = async () => {
        await new Promise<void>(r => chrome.runtime.sendMessage({ type: 'UPDATE_ENGINE_SETTINGS', settings: { scratchpad: noteText } }, () => r()));
    };
    useEffect(() => {
        chrome.storage.local.get('scratchNotesV1', (result) => {
            const list = (result.scratchNotesV1 as { id: number; title: string; body: string }[]) || [];
            setScratchList(list);
            if (list.length) {
                setActiveScratchId(list[0].id);
                setNoteText(list[0].body);
            }
        });
    }, []);
    const persistScratchList = (next: { id: number; title: string; body: string }[]) => {
        setScratchList(next);
        chrome.storage.local.set({ scratchNotesV1: next });
    };
    const addScratch = () => {
        const n = { id: Date.now(), title: `Scratch ${scratchList.length + 1}`, body: '' };
        const next = [n, ...scratchList];
        persistScratchList(next);
        setActiveScratchId(n.id);
        setNoteText('');
    };
    const saveScratchBody = (value: string) => {
        if (!activeScratchId) return;
        const next = scratchList.map((n) => (n.id === activeScratchId ? { ...n, body: value } : n));
        persistScratchList(next);
    };

    // --- Daily Planner ---
    const planner = engineState.dailyPlanner || [];
    const [newPlanTime, setNewPlanTime] = useState('09:00');
    const [newPlanTask, setNewPlanTask] = useState('');

    const addPlanItem = async () => {
        if (!newPlanTask.trim()) return;
        const updated = [...planner, { id: Date.now(), time: newPlanTime, task: newPlanTask, done: false }].sort((a, b) => a.time.localeCompare(b.time));
        await new Promise<void>(r => chrome.runtime.sendMessage({ type: 'UPDATE_ENGINE_SETTINGS', settings: { dailyPlanner: updated } }, () => r()));
        setNewPlanTask('');
        fetchEngineState();
    };

    const togglePlanItem = async (id: number) => {
        const item = planner.find(p => p.id === id);
        const updated = planner.map(p => p.id === id ? { ...p, done: !p.done } : p);
        await new Promise<void>(r => chrome.runtime.sendMessage({ type: 'UPDATE_ENGINE_SETTINGS', settings: { dailyPlanner: updated } }, () => r()));

        if (item?.notionId) {
            chrome.runtime.sendMessage({ type: 'UPDATE_NOTION_TASK', taskId: item.notionId, done: !item.done });
        }

        fetchEngineState();
    };

    const removePlanItem = async (id: number) => {
        const updated = planner.filter(p => p.id !== id);
        await new Promise<void>(r => chrome.runtime.sendMessage({ type: 'UPDATE_ENGINE_SETTINGS', settings: { dailyPlanner: updated } }, () => r()));
        fetchEngineState();
    };

    const organizePlanItems = async () => {
        const updated = [...planner].sort((a, b) => {
            if (a.done !== b.done) return a.done ? 1 : -1;
            return (a.time || '').localeCompare(b.time || '');
        });
        await new Promise<void>(r => chrome.runtime.sendMessage({ type: 'UPDATE_ENGINE_SETTINGS', settings: { dailyPlanner: updated } }, () => r()));
        fetchEngineState();
    };

    // --- Focus Quote ---
    const dayIndex = Math.floor(Date.now() / 86400000) % FOCUS_QUOTES.length;
    const todayQuote = FOCUS_QUOTES[dayIndex];
    const savedQuotes = engineState.savedQuotes || [];
    const isQuoteSaved = savedQuotes.includes(todayQuote);

    const toggleSaveQuote = async () => {
        const updated = isQuoteSaved ? savedQuotes.filter(q => q !== todayQuote) : [...savedQuotes, todayQuote];
        await new Promise<void>(r => chrome.runtime.sendMessage({ type: 'UPDATE_ENGINE_SETTINGS', settings: { savedQuotes: updated } }, () => r()));
        fetchEngineState();
    };

    return (
        <div className="space-y-3 animate-fade-in-up">
            <h2 className="text-lg font-bold text-white">Productivity Tools</h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {/* LEFT COLUMN: Pomodoro + Quote */}
                <div className="space-y-3">
                    {/* Pomodoro Timer */}
                    <GlassCard className="p-4">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center space-x-2">
                                <IconClock size={16} className="text-red-400" />
                                <h3 className="font-bold text-white text-sm">Pomodoro</h3>
                                <span className="text-[10px] text-neutral-500">• {defaultPomo.sessionsCompleted} sessions</span>
                            </div>
                            <div className="flex items-center space-x-1">
                                <input type="number" min="1" max="120" value={defaultPomo.focusMin}
                                    onChange={async (e) => {
                                        const v = parseInt(e.target.value) || 25;
                                        const updated = { ...defaultPomo, focusMin: v };
                                        await new Promise<void>(r => chrome.runtime.sendMessage({ type: 'UPDATE_ENGINE_SETTINGS', settings: { pomodoroSettings: updated } }, () => r()));
                                        if (!pomoRunning && !isBreak) setPomoTimeLeft(v * 60);
                                        fetchEngineState();
                                    }}
                                    className="w-12 bg-white/5 border border-white/10 rounded-lg px-1 py-0.5 text-center text-xs text-white outline-none focus:border-purple-500" />
                                <span className="text-[10px] text-neutral-500">/</span>
                                <input type="number" min="1" max="30" value={defaultPomo.breakMin}
                                    onChange={async (e) => {
                                        const v = parseInt(e.target.value) || 5;
                                        const updated = { ...defaultPomo, breakMin: v };
                                        await new Promise<void>(r => chrome.runtime.sendMessage({ type: 'UPDATE_ENGINE_SETTINGS', settings: { pomodoroSettings: updated } }, () => r()));
                                        if (!pomoRunning && isBreak) setPomoTimeLeft(v * 60);
                                        fetchEngineState();
                                    }}
                                    className="w-10 bg-white/5 border border-white/10 rounded-lg px-1 py-0.5 text-center text-xs text-white outline-none focus:border-purple-500" />
                                <span className="text-[10px] text-neutral-500">min</span>
                            </div>
                        </div>
                        <div className="flex flex-col items-center space-y-3">
                            <div className="relative w-40 h-40">
                                <svg className="w-40 h-40 transform -rotate-90" viewBox="0 0 200 200">
                                    <circle cx="100" cy="100" r="90" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                                    <circle cx="100" cy="100" r="90" fill="none" stroke={isBreak ? '#22c55e' : '#a855f7'} strokeWidth="8" strokeLinecap="round"
                                        strokeDasharray={`${2 * Math.PI * 90}`}
                                        strokeDashoffset={`${2 * Math.PI * 90 * (1 - pomoTimeLeft / ((isBreak ? defaultPomo.breakMin : defaultPomo.focusMin) * 60))}`}
                                        className="transition-all duration-1000" />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-3xl font-semibold text-white tabular-nums">{formatTime(pomoTimeLeft)}</span>
                                    <span className="text-[10px] text-neutral-500 uppercase">{isBreak ? 'Break' : 'Focus'}</span>
                                </div>
                            </div>
                            <div className="flex space-x-2">
                                <button onClick={() => {
                                    if (pomoRunning) {
                                        setPomoRunning(false);
                                        setPomoEndAt(null);
                                    } else {
                                        setPomoRunning(true);
                                        setPomoEndAt(Date.now() + pomoTimeLeft * 1000);
                                    }
                                }}
                                    className={`px-6 py-2 rounded-xl font-bold text-xs transition-all active:scale-95 ${pomoRunning ? 'bg-white/10 text-white border border-white/10' : 'bg-white text-black'}`}>
                                    {pomoRunning ? <><IconPlayerPause size={14} className="inline mr-1" />PAUSE</> : <><IconPlayerPlay size={14} className="inline mr-1" />START</>}
                                </button>
                                <button onClick={() => { setPomoRunning(false); setPomoEndAt(null); setIsBreak(false); setPomoTimeLeft(defaultPomo.focusMin * 60); }}
                                    className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-neutral-400 hover:text-white transition-all">
                                    <IconRefresh size={14} />
                                </button>
                            </div>
                        </div>
                    </GlassCard>

                    {/* Focus Quote */}
                    <GlassCard className="p-4">
                        <div className="flex items-center space-x-2 mb-2">
                            <IconQuote size={14} className="text-purple-400" />
                            <h3 className="font-bold text-white text-sm">Daily Quote</h3>
                        </div>
                        <blockquote className="text-sm text-neutral-300 italic leading-relaxed border-l-2 border-purple-500/30 pl-3 py-1">
                            "{todayQuote}"
                        </blockquote>
                        <button onClick={toggleSaveQuote}
                            className={`mt-2 px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${isQuoteSaved ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30' : 'bg-white/5 border border-white/10 text-neutral-400 hover:text-white'}`}>
                            {isQuoteSaved ? '★ SAVED' : '☆ SAVE'}
                        </button>
                    </GlassCard>
                </div>

                {/* RIGHT COLUMN: Habits + Notes + Planner */}
                <div className="space-y-3">
                    {/* Habit Tracker */}
                    <GlassCard className="p-4">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2">
                                <IconChecklist size={14} className="text-green-400" />
                                <h3 className="font-bold text-white text-sm">Habits</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setHabitModalOpen(true)}
                                className="px-2 py-1 bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg text-[10px] font-bold text-white transition-all"
                            >
                                <IconPlus size={12} className="inline" /> ADD
                            </button>
                        </div>
                        {habits.length === 0 ? (
                            <p className="text-neutral-600 text-xs text-center py-3">No habits yet.</p>
                        ) : (
                            <div className="space-y-1.5">
                                {habits.map((h: any) => {
                                    const checkedToday = h.checkins?.includes(todayStr);
                                    return (
                                        <div key={h.id} className="flex items-center justify-between p-2 bg-white/5 border border-white/10 rounded-lg group">
                                            <div className="flex items-center space-x-2">
                                                <button onClick={() => checkInHabit(h.id)}
                                                    className={`w-6 h-6 rounded-md flex items-center justify-center transition-all ${checkedToday ? 'bg-green-500 text-white' : 'bg-white/10 text-neutral-500 hover:bg-green-500/20'}`}>
                                                    {checkedToday && <IconCheck size={12} />}
                                                </button>
                                                <div>
                                                    <p className={`text-xs font-bold ${checkedToday ? 'text-green-400' : 'text-white'}`}>{h.name}</p>
                                                    <p className="text-[9px] text-neutral-500">{h.streak} day streak</p>
                                                </div>
                                            </div>
                                            <button onClick={() => removeHabit(h.id)} className="opacity-0 group-hover:opacity-100 text-neutral-600 hover:text-red-400 transition-all"><IconTrash size={12} /></button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </GlassCard>

                    {/* Notes */}
                    <GlassCard className="p-4">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2">
                                <IconNote size={14} className="text-blue-400" />
                                <h3 className="font-bold text-white text-sm">Scratches</h3>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={addScratch}
                                    className="px-2 py-1 bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg text-[10px] font-bold text-white transition-all"
                                >
                                    <IconPlus size={12} className="inline" /> NEW
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setScratchFullscreen((v) => !v)}
                                    className="p-1.5 bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg text-white transition-all"
                                    title="Toggle fullscreen"
                                >
                                    <IconMaximize2 size={12} />
                                </button>
                            </div>
                        </div>
                        {scratchList.length > 0 && (
                            <div className="flex gap-1.5 mb-2 overflow-x-auto pb-1">
                                {scratchList.map((n) => (
                                    <button
                                        key={n.id}
                                        type="button"
                                        onClick={() => {
                                            setActiveScratchId(n.id);
                                            setNoteText(n.body || '');
                                        }}
                                        className={`px-2 py-1 rounded-md text-[10px] whitespace-nowrap border ${
                                            activeScratchId === n.id
                                                ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                                                : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white'
                                        }`}
                                    >
                                        {n.title}
                                    </button>
                                ))}
                            </div>
                        )}
                        <textarea
                            value={noteText}
                            onChange={e => {
                                const value = e.target.value;
                                setNoteText(value);
                                saveScratchBody(value);
                            }}
                            onBlur={() => {
                                saveNote();
                                saveScratchBody(noteText);
                            }}
                            className={`w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white text-xs focus:border-purple-500 outline-none transition-colors ${
                                scratchFullscreen ? 'h-[60vh]' : 'h-28'
                            } resize-none font-mono`}
                            placeholder="Type notes... autosaves."
                        />
                    </GlassCard>

                    {/* Daily Planner */}
                    <GlassCard className="p-4">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2">
                                <IconTarget size={14} className="text-amber-400" />
                                <h3 className="font-bold text-white text-sm">Daily Planner</h3>
                            </div>
                            <div className="flex items-center gap-2">
                                {planner.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => void organizePlanItems()}
                                        className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-[9px] font-bold text-neutral-400 hover:text-white transition-all"
                                    >
                                        ORGANIZE
                                    </button>
                                )}
                            {engineState.notionConnected && (
                                <button
                                    onClick={syncNotionTasks}
                                    disabled={isNotionSyncing}
                                    className={`flex items-center space-x-1 px-2 py-1 rounded-md bg-white/5 border border-white/10 text-[9px] font-bold text-neutral-400 hover:text-white hover:bg-white/10 transition-all ${isNotionSyncing ? 'animate-pulse' : ''}`}
                                >
                                    <IconRefresh size={10} className={isNotionSyncing ? 'animate-spin' : ''} />
                                    <span>{isNotionSyncing ? 'SYNCING...' : 'NOTION SYNC'}</span>
                                </button>
                            )}
                            </div>
                        </div>
                        <div className="flex space-x-2 mb-2">
                            <input type="time" value={newPlanTime} onChange={e => setNewPlanTime(e.target.value)}
                                className="bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs outline-none focus:border-purple-500 transition-colors w-24" />
                            <input value={newPlanTask} onChange={e => setNewPlanTask(e.target.value)} onKeyDown={e => e.key === 'Enter' && addPlanItem()}
                                placeholder="Task..."
                                className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs outline-none focus:border-purple-500 transition-colors" />
                            <button onClick={addPlanItem} className="px-3 py-1.5 bg-white text-black rounded-lg font-bold text-xs hover:bg-neutral-200 transition-all">ADD</button>
                        </div>
                        <div className="space-y-1">
                            {planner.map((p: any) => (
                                <div key={p.id} className="flex items-center space-x-2 p-2 bg-white/5 border border-white/10 rounded-lg group">
                                    <button onClick={() => togglePlanItem(p.id)} className={`w-5 h-5 rounded flex items-center justify-center transition-all ${p.done ? 'bg-green-500 text-white' : 'bg-white/10'}`}>
                                        {p.done && <IconCheck size={12} />}
                                    </button>
                                    <span className="text-[10px] font-bold text-purple-400 w-12">{p.time}</span>
                                    <span className={`flex-1 text-xs ${p.done ? 'line-through text-neutral-600' : 'text-white'}`}>{p.task}</span>
                                    <button onClick={() => removePlanItem(p.id)} className="opacity-0 group-hover:opacity-100 text-neutral-600 hover:text-red-400 transition-all"><IconTrash size={12} /></button>
                                </div>
                            ))}
                            {planner.length === 0 && <p className="text-neutral-600 text-xs text-center py-2">Add tasks above.</p>}
                        </div>
                    </GlassCard>

                    {/* Daily Goals (Site Limits) */}
                    <GlassCard className="p-4">
                        <div className="flex items-center space-x-2 mb-3">
                            <IconTarget size={16} className="text-purple-400" />
                            <h3 className="font-bold text-white text-sm">Daily Goals</h3>
                        </div>
                        <p className="text-[10px] text-neutral-500 mb-4">Set time limits for specific domains.</p>
                        <div className="flex space-x-2 mb-4">
                            <input id="dgDomain-p" type="text" placeholder="reddit.com" className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white outline-none text-xs" />
                            <input id="dgMinutes-p" type="number" placeholder="Min" className="w-20 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white outline-none text-xs" />
                            <button
                                onClick={async () => {
                                    const d = (document.getElementById('dgDomain-p') as HTMLInputElement).value;
                                    const m = parseInt((document.getElementById('dgMinutes-p') as HTMLInputElement).value);
                                    if (!d || isNaN(m)) return;
                                    const updated = { ...(engineState.dailyFocusTarget || {}), [d]: m };
                                    await new Promise<void>(r => chrome.runtime.sendMessage({ type: 'UPDATE_ENGINE_SETTINGS', settings: { dailyFocusTarget: updated } }, () => r()));
                                    fetchEngineState();
                                }}
                                className="bg-purple-600 hover:bg-purple-500 text-white px-3 py-2 rounded-xl font-bold text-xs transition-colors"
                            >
                                <IconPlus size={16} />
                            </button>
                        </div>
                        <div className="space-y-2 max-h-[200px] overflow-y-auto scrollbar-hide pr-1">
                            {Object.entries(engineState?.dailyFocusTarget || {}).map(([d, m]) => (
                                <div key={d} className="flex items-center justify-between p-2.5 bg-white/5 border border-white/10 rounded-xl group hover:border-white/20 transition-all">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold text-white truncate max-w-[120px]">{d}</span>
                                        <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">Daily Limit</span>
                                    </div>
                                    <div className="flex items-center space-x-3">
                                        <span className="text-xs font-semibold text-purple-400 bg-purple-400/10 px-2 py-0.5 rounded-full tabular-nums">{m as number}m</span>
                                        <button
                                            onClick={async () => {
                                                const updated = { ...(engineState.dailyFocusTarget || {}) };
                                                delete updated[d];
                                                await new Promise<void>(r => chrome.runtime.sendMessage({ type: 'UPDATE_ENGINE_SETTINGS', settings: { dailyFocusTarget: updated } }, () => r()));
                                                fetchEngineState();
                                            }}
                                            className="text-neutral-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                                        >
                                            <IconTrash size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {Object.keys(engineState.dailyFocusTarget || {}).length === 0 && (
                                <p className="text-neutral-600 text-[10px] text-center py-4 italic">No limits set yet.</p>
                            )}
                        </div>
                    </GlassCard>
                </div>
            </div>
            <HabitNameModal
                open={habitModalOpen}
                onClose={() => setHabitModalOpen(false)}
                onSubmit={addHabitByName}
            />
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
    const { enabled: proVisuals } = useProDashboardVisuals();
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
        if (next) await syncPublicProfile(true);
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
                    profileAvatar: profile.avatarUrl || '',
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
    }, [session?.user?.id, session?.access_token, session?.refresh_token, fetchEngineState]);

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
        <div className="mx-auto grid w-full max-w-[900px] animate-fade-in-up gap-4 md:grid-cols-2">
            <div className="col-span-full flex items-end justify-between border-b border-[var(--dashboard-border)] pb-4">
                <div>
                    <p className="focuz-section-label mb-1">Settings</p>
                    <h2 className="text-2xl font-semibold tracking-tight text-[var(--dashboard-text)]">Account</h2>
                    <p className="mt-1 text-sm text-[var(--dashboard-text-muted)]">Manage your profile, visibility, and subscription.</p>
                </div>
                <button onClick={signOut}
                    className="rounded-md border border-[var(--dashboard-border)] bg-[var(--dashboard-interactive)] px-3 py-2 text-xs font-medium text-[var(--dashboard-text-secondary)] transition-colors hover:bg-[var(--dashboard-interactive-hover)] hover:text-[var(--dashboard-text)]">
                    Sign out
                </button>
            </div>

            {/* Avatar + Name */}
            <GlassCard className="col-span-full p-5">
                <div className="mb-4 flex items-start gap-5">
                    <div onClick={uploadAvatar} className={`${PROFILE_AVATAR_LARGE_WRAP_CLASS} cursor-pointer hover:border-purple-500 transition-colors relative group`}>
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
                            <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--dashboard-text-muted)]">Display name</label>
                            <input
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                onBlur={saveName}
                                disabled={profileSaving}
                                className="w-full rounded-md border border-[var(--dashboard-border)] bg-[var(--dashboard-interactive)] px-3 py-2 text-sm font-medium text-[var(--dashboard-text)] outline-none transition-colors focus:border-purple-500/60"
                            />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--dashboard-text-muted)]">Handle</label>
                            <div className="flex items-center overflow-hidden rounded-md border border-[var(--dashboard-border)] bg-[var(--dashboard-interactive)] focus-within:border-purple-500/60">
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
                            <p className="mt-1 text-[10px] text-[var(--dashboard-text-muted)]">
                                Your unique public FocuzNow handle.
                            </p>
                            {handleStatus === 'checking' && (
                                <p className="text-[10px] text-neutral-500 mt-0.5">Checking availability…</p>
                            )}
                            {handleStatus === 'available' && username.length >= 3 && (
                                <p className="text-[10px] text-emerald-500/90 mt-0.5">
                                    @{normalizeUsername(username)} is available
                                </p>
                            )}
                            {handleStatus === 'taken' && (
                                <p className="text-[10px] text-red-400 mt-0.5">That handle is already taken</p>
                            )}
                            {handleStatus === 'short' && username.length > 0 && (
                                <p className="text-[10px] text-amber-400 mt-0.5">At least 3 characters</p>
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
                                className="inline-flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 mt-2 font-bold"
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
                        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${publicProfileEnabled ? 'bg-purple-500' : 'bg-[var(--dashboard-interactive-hover)]'}`}
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
                            <IconCreditCard size={14} className="text-purple-400" />
                            <h3 className="font-bold text-white text-sm">Subscription</h3>
                            <span className="text-[10px] text-neutral-500">• {isPro ? 'PRO' : 'FREE'}</span>
                        </div>
                        {isPro ? (
                            <div className="space-y-3">
                                <div className="p-3 bg-purple-600/10 border border-purple-500/20 rounded-xl space-y-1">
                                    <p className="text-xs text-purple-300 font-bold">Subscribed to Pro ✦</p>
                                    <p className="text-[10px] text-purple-400/80">
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
                                    className="w-full py-2.5 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl font-bold text-xs text-white transition-all flex items-center justify-center space-x-2 active:scale-[0.98]"
                                >
                                    {portalLoading ? (
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <IconExternalLink size={14} />
                                            <span>MANAGE SUBSCRIPTION</span>
                                        </>
                                    )}
                                </button>
                                <p className="text-[10px] text-neutral-600 text-center">
                                    Opens Stripe Customer Portal in a new tab.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <p className="text-xs text-neutral-400">Upgrade for advanced blocking, scheduling, and all premium features.</p>
                                <button
                                    onClick={() => void openCheckout()}
                                    disabled={checkoutLoading}
                                    className="w-full py-2.5 bg-white text-black rounded-xl font-bold text-xs hover:bg-neutral-200 transition-all active:scale-[0.98] disabled:opacity-60"
                                >
                                    {checkoutLoading ? 'Opening checkout…' : 'UPGRADE TO PRO'}
                                </button>
                            </div>
                        )}
                    </>
                );
                return (
                    <GlassCard className={`p-4 ${proVisuals && isPro ? 'bg-[#0f0f0f]' : ''}`}>
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
                    className="shrink-0 rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/20"
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


const BlockedView = ({ url }: { url: string }) => {
    const { engineState, fetchEngineState } = useAuthStore();
    const { proGoldTheme, enabled: proVisuals } = useProDashboardVisuals();
    const [domain, setDomain] = useState('');
    const [engineReady, setEngineReady] = useState(false);
    const [emergencyOpen, setEmergencyOpen] = useState(false);
    const [overrideNotice, setOverrideNotice] = useState('');
    const [overrideError, setOverrideError] = useState('');
    const [futureSelfSummary, setFutureSelfSummary] = useState<FutureSelfBlockedSummary | null>(null);

    const ytCategory = new URLSearchParams(window.location.search).get('ytCategory');
    const overrideSettings = engineState.emergencyOverrideSettings ?? {
        enabled: true,
        maxPerDay: 3,
        minReasonLength: 20,
        accessMinutes: 15,
        cooldownMinutes: 30,
    };

    useEffect(() => {
        void fetchEngineState().then(() => setEngineReady(true));
    }, [fetchEngineState]);

    useEffect(() => {
        if (url === 'LOCKDOWN') {
            setDomain('ALL SITES (NUCLEAR LOCKDOWN)');
        } else if (url === 'REDACTED') {
            setDomain('Restricted Content');
        } else {
            try {
                setDomain(new URL(url).hostname);
            } catch (e) {
                setDomain(url);
            }
        }
    }, [url]);

    useEffect(() => {
        if (!url || url === 'LOCKDOWN' || url === 'REDACTED') return;
        void chrome.runtime.sendMessage({ type: 'FUTURE_SELF_BLOCKED', url }).then((response) => {
            setFutureSelfSummary(response?.summary ?? null);
        });
    }, [url]);

    const isNuclear = engineState.nuclearState?.active;
    const message = engineState.redirectMessage || "Shouldn't you be working?";
    const canEmergency =
        !isNuclear &&
        overrideSettings.enabled !== false &&
        url !== 'LOCKDOWN' &&
        url !== 'REDACTED';

    const requestEmergency = async (reason: string) => {
        setOverrideError('');
        setOverrideNotice('');
        const targetUrl = url.startsWith('http') ? url : `https://${domain}`;
        const resp = await new Promise<{ ok?: boolean; error?: string; expiresAt?: number }>((resolve) =>
            chrome.runtime.sendMessage(
                { type: 'EMERGENCY_OVERRIDE', url: targetUrl, reason },
                (r) => resolve(r ?? {}),
            ),
        );
        if (!resp.ok) {
            setOverrideError(resp.error ?? 'Override denied');
            throw new Error(resp.error ?? 'Override denied');
        }
        const mins = overrideSettings.accessMinutes ?? 15;
        setOverrideNotice(`Temporary access granted for ${mins} minutes. Use it wisely.`);
        setEmergencyOpen(false);
        setTimeout(() => {
            window.location.href = targetUrl;
        }, 800);
    };

    if (futureSelfSummary) {
        return (
            <div className="fixed inset-0 z-[9999] flex min-h-[100dvh] w-screen items-center justify-center overflow-y-auto bg-[#050505] p-4 sm:p-8">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(168,85,247,0.16)_0%,transparent_65%)]" />
                <FutureSelfBlockedOverlay url={url} summary={futureSelfSummary} />
            </div>
        );
    }

    return (
        <div className="fixed inset-0 min-h-[100dvh] w-screen bg-[#050505] flex flex-col items-center justify-center px-4 py-10 sm:px-8 sm:py-14 md:py-16 text-white font-sans z-[9999] overflow-y-auto">
            <div
                className={`absolute inset-0 pointer-events-none ${
                    proGoldTheme
                        ? 'bg-[radial-gradient(ellipse_at_center,rgba(212,175,55,0.18)_0%,transparent_60%)]'
                        : 'bg-[radial-gradient(ellipse_at_center,rgba(168,85,247,0.14)_0%,transparent_60%)]'
                }`}
            />

            <GlassCard
                className={`w-full max-w-md sm:max-w-lg p-8 sm:p-10 space-y-8 text-center relative shadow-2xl my-auto ${
                    proGoldTheme ? 'border-amber-500/35' : 'border-purple-500/30'
                }`}
            >
                <div
                    className={`absolute top-0 left-0 w-full h-1 animate-gradient-x ${
                        proGoldTheme
                            ? 'bg-gradient-to-r from-amber-700 via-yellow-400 to-amber-700'
                            : 'bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600'
                    }`}
                />

                <div className="space-y-6 sm:space-y-8">
                    <div className="w-20 h-20 sm:w-24 sm:h-24 bg-purple-600/10 rounded-full flex items-center justify-center mx-auto shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] ring-1 ring-purple-500/20">
                        {isNuclear ? <IconBolt size={44} className="text-purple-400 sm:w-12 sm:h-12" /> : <IconLock size={44} className="text-purple-400 sm:w-12 sm:h-12" />}
                    </div>
                    <div className="space-y-3 sm:space-y-4">
                        <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight bg-gradient-to-br from-white to-neutral-500 bg-clip-text text-transparent px-2">
                            {isNuclear ? 'NUCLEAR LOCKDOWN' : 'Restricted Access'}
                        </h1>
                        <p className="text-neutral-400 text-sm sm:text-base md:text-lg leading-relaxed max-w-sm mx-auto px-2">
                            {engineReady
                                ? proVisuals
                                    ? `You chose focus. ${engineState.blockedToday || 0} distractions stopped today.`
                                    : `"${message}"`
                                : 'Loading…'}
                        </p>
                    </div>
                </div>

                <div className="py-6 sm:py-8 px-6 sm:px-8 bg-white/[0.04] rounded-2xl border border-white/10 w-full">
                    <p className="text-[10px] sm:text-xs uppercase tracking-wider font-semibold text-neutral-500 mb-3 sm:mb-4">Restricted Area</p>
                    <p className="text-lg sm:text-xl md:text-2xl font-mono font-bold text-purple-300 break-all leading-snug">{domain || '…'}</p>
                </div>

                {new URLSearchParams(window.location.search).get('source') === 'schedule' && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-center animate-pulse">
                        <p className="text-red-400 text-xs font-bold leading-relaxed">
                            This site is blocked by your <span className="text-white uppercase">Focus Schedule</span>.
                            <br />
                            Go to the <span className="underline cursor-pointer" onClick={() => window.location.href = chrome.runtime.getURL('src/options/index.html?tab=schedule')}>Schedules Tab</span> to manage this.
                        </p>
                    </div>
                )}

                {ytCategory && (
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 text-center">
                        <p className="text-amber-300 text-xs font-bold">
                            Smart YouTube blocked this as <span className="uppercase">{ytCategory.replace('_', ' ')}</span> content
                        </p>
                    </div>
                )}

                {overrideNotice && (
                    <p className="text-sm text-green-400 font-medium text-center">{overrideNotice}</p>
                )}
                {overrideError && !emergencyOpen && (
                    <p className="text-sm text-red-400 font-medium text-center">{overrideError}</p>
                )}

                <EmergencyUnlockModal
                    open={emergencyOpen}
                    domain={domain}
                    minReasonLength={overrideSettings.minReasonLength ?? 20}
                    onClose={() => setEmergencyOpen(false)}
                    onSubmit={requestEmergency}
                />

                <div className="space-y-4 sm:space-y-5 pt-2 sm:pt-6 w-full">
                    <button
                        type="button"
                        onClick={() => window.history.back()}
                        className="w-full py-4 sm:py-5 md:py-6 bg-white text-black rounded-3xl font-black text-base sm:text-lg hover:bg-neutral-200 transition-all shadow-[0_20px_40px_rgba(255,255,255,0.1)] active:scale-95 flex items-center justify-center"
                    >
                        GO BACK TO WORK
                    </button>

                    {!isNuclear && (
                        <>
                            {canEmergency && (
                                <button
                                    type="button"
                                    onClick={() => setEmergencyOpen(true)}
                                    className="w-full py-3.5 sm:py-4 bg-amber-500/15 text-amber-300 border border-amber-500/30 rounded-3xl font-bold text-sm hover:bg-amber-500/25 transition-all"
                                >
                                    Emergency Unlock
                                </button>
                            )}
                            {proVisuals && (
                                <a
                                    href="https://focuznow.com/dashboard?billing=return"
                                    className="w-full py-3.5 sm:py-4 bg-purple-600/20 text-purple-200 border border-purple-500/30 rounded-3xl font-bold text-sm hover:bg-purple-600/30 transition-all text-center block"
                                >
                                    Back to dashboard
                                </a>
                            )}
                            <button
                                type="button"
                                onClick={() => { window.location.href = chrome.runtime.getURL('src/options/index.html'); }}
                                className="w-full py-3.5 sm:py-4 bg-white/5 text-neutral-500 rounded-3xl font-bold text-sm hover:bg-white/10 transition-all"
                            >
                                Review Extension Settings
                            </button>
                        </>
                    )}

                    <p className="text-[10px] text-neutral-700 uppercase tracking-wider font-semibold pt-2">Powered by FocuzNow</p>
                </div>
            </GlassCard>
        </div>
    );
};

function ActionToast({ message, onDone }: { message: string; onDone: () => void }) {
    useEffect(() => {
        const t = window.setTimeout(onDone, 3200);
        return () => window.clearTimeout(t);
    }, [onDone]);
    if (!message) return null;
    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] px-4 py-3 rounded-xl bg-[#1a1a1a] border border-white/10 text-sm text-white shadow-2xl max-w-md text-center">
            {message}
        </div>
    );
}

const OptionsApp = () => {
    const { session, loading, init, featurePreviewSeen, setFeaturePreviewSeen, engineState, subscriptionTier, recordDashboardOpen } = useAuthStore();
    const hostBookings = useHostBookingNotifications(!!session);
    const isPro = subscriptionTier === 'pro';
    const { proGoldTheme, enabled: proVisuals } = useProDashboardVisuals();
    const [activeTab, setActiveTab] = useState('overview');
    const [view, setView] = useState<'app' | 'blocked'>('app');
    const [blockedUrl, setBlockedUrl] = useState('');
    const [showEndSession, setShowEndSession] = useState(false);
    const [paletteOpen, setPaletteOpen] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [focusToast, setFocusToast] = useState('');
    const [coachInitialPrompt, setCoachInitialPrompt] = useState<string | null>(null);
    const [futureSelfMirror, setFutureSelfMirror] = useState<FutureSelfMirror | null>(null);
    const [setupDone, setSetupDone] = useState(isSetupComplete);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarCollapsed);

    useEffect(() => {
        document.body.classList.add('focuz-dashboard');
        return () => document.body.classList.remove('focuz-dashboard');
    }, []);

    useEffect(() => {
        const onFocusComplete = () => {
            if (!proVisuals) return;
            setFocusToast('Deep work logged · +1 to your streak');
            useAuthStore.getState().recalculateStreak();
        };
        window.addEventListener(FOCUS_COMPLETE_EVENT, onFocusComplete);
        return () => window.removeEventListener(FOCUS_COMPLETE_EVENT, onFocusComplete);
    }, [proVisuals]);

    const navigateTab = (tab: string) => {
        const resolved = resolveTabId(tab);
        // Extension helper: open full dashboard on the web for management tabs.
        if (!isWebPlatform() && shouldOpenTabOnWeb(resolved)) {
            openWebDashboard(resolved);
            return;
        }
        setActiveTab(resolved);
        const url = new URL(window.location.href);
        url.searchParams.set('tab', resolved);
        window.history.replaceState({}, '', url.pathname + url.search);
    };

    const toggleSidebarCollapsed = () => {
        setSidebarCollapsed((prev) => {
            const next = !prev;
            writeSidebarCollapsed(next);
            return next;
        });
    };

    const openCheckout = async () => {
        if (!session?.access_token) { navigateTab('account'); return; }
        if (isPro) { navigateTab('account'); return; }
        try {
            const { data } = await invokeAuthedFunction('create-checkout-session', session.access_token, { return_url: BILLING_RETURN_URL });
            if (data?.url) window.open(data.url, '_blank');
            else navigateTab('account');
        } catch { navigateTab('account'); }
    };

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                e.stopPropagation();
                setPaletteOpen((o) => !o);
            }
        };
        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
    }, []);

    const applyTabFromUrl = () => {
        const tab = new URLSearchParams(window.location.search).get('tab');
        if (!tab) return;
        const resolved = resolveTabId(tab);
        if (!isWebPlatform() && shouldOpenTabOnWeb(resolved)) {
            openWebDashboard(resolved);
            return;
        }
        setActiveTab(resolved);
    };

    useEffect(() => {
        const listener = (msg: { type?: string; tab?: string }) => {
            if (msg.type === 'NAVIGATE_TAB' && msg.tab) {
                navigateTab(msg.tab);
            }
        };
        const onCustomNav = (e: Event) => {
            const tab = (e as CustomEvent<string>).detail;
            if (!tab) return;
            const resolvedTab = resolveTabId(tab);
            if (resolvedTab === 'ai_coach' && new URLSearchParams(window.location.search).get('coachPrompt') === 'auto_schedule') {
                setCoachInitialPrompt(AUTO_SCHEDULE_COACH_PROMPT);
            }
            navigateTab(resolvedTab);
        };
        chrome.runtime.onMessage.addListener(listener);
        window.addEventListener('focus', applyTabFromUrl);
        window.addEventListener('focuznow-navigate-tab', onCustomNav as EventListener);
        return () => {
            chrome.runtime.onMessage.removeListener(listener);
            window.removeEventListener('focus', applyTabFromUrl);
            window.removeEventListener('focuznow-navigate-tab', onCustomNav as EventListener);
        };
    }, []);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);

        // Handle Notion OAuth Return
        const notionCode = params.get('notion_code');
        if (notionCode) {
            // Set pending state to show inline setup UI instead of prompt()
            window.localStorage.setItem('focuznow_notion_pending_code', notionCode);
            navigateTab('account'); // Take them to the settings to finish
            // Clear from URL
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        if (params.get('view') === 'blocked') {
            setView('blocked');
            setBlockedUrl(params.get('url') || '');
        }

        const tab = params.get('tab');
        if (tab) {
            const resolved = resolveTabId(tab);
            if (!isWebPlatform() && shouldOpenTabOnWeb(resolved)) {
                openWebDashboard(resolved);
            } else {
                setActiveTab(resolved);
            }
        }

        // Ensure platform is initialized (no-op in extension; installs shim on web).
        void getPlatform();

        if (params.get('coachPrompt') === 'auto_schedule') {
            setCoachInitialPrompt(AUTO_SCHEDULE_COACH_PROMPT);
            params.delete('coachPrompt');
        }

        const toast = params.get('toast');
        if (toast) {
            setToastMessage(toast);
            params.delete('toast');
            const clean = `${window.location.pathname}${params.toString() ? `?${params}` : ''}`;
            window.history.replaceState({}, document.title, clean);
        }

        if (params.get('subscription') === 'success') {
            void applyProWelcomePack().then(() => init());
        } else {
            init();
        }
    }, []);

    useEffect(() => {
        if (session) void recordDashboardOpen();
    }, [session, recordDashboardOpen]);

    useEffect(() => {
        if (!session) return;
        void chrome.storage.local.get(['setupCompleted'], (res) => {
            if (res.setupCompleted && !isSetupComplete()) {
                markSetupComplete();
                setSetupDone(true);
            } else if (!res.setupCompleted && isSetupComplete()) {
                setSetupDone(true);
            }
        });
    }, [session]);

    useEffect(() => {
        if (!session || !isPro || view !== 'app') return;
        void chrome.runtime.sendMessage({ type: 'FUTURE_SELF_GET', dashboardOpen: true }).then((response) => {
            setFutureSelfMirror(response?.pendingMirror ?? null);
        });
    }, [session, isPro, view]);

    useEffect(() => {
        applyDocumentTheme(engineState, isPro);
    }, [engineState, isPro]);

    if (view === 'blocked') {
        return <BlockedView url={blockedUrl} />;
    }

    if (loading && !session) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-black">
                <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!featurePreviewSeen) {
        return <FeaturePreview onComplete={() => void setFeaturePreviewSeen(true)} />;
    }

    if (!session) {
        return <AuthLogin />;
    }

    if (!setupDone) {
        const blocklistCount = Object.keys(engineState?.blocklist || {}).length;
        return (
            <SetupPage
                hasSession={!!session}
                hasBlocklist={blocklistCount > 0}
                historyConnected={!!useAuthStore.getState().historyPermission}
                onComplete={() => setSetupDone(true)}
                onOpenBlocklist={() => {
                    markSetupComplete();
                    setSetupDone(true);
                    setActiveTab('blocklist');
                }}
                onImportHistory={() => {
                    void useAuthStore.getState().setHistoryPermission(true).then(() =>
                        useAuthStore.getState().importHistory(),
                    );
                }}
            />
        );
    }

    const renderContent = () => {
        switch (activeTab) {
            case 'overview': return <OverviewTab />;
            case 'calendar': return <SchedulingCalendarPage fullscreen />;
            case 'lists': return <ListsTab />;
            case 'sessions': return <SessionsTab />;
            case 'blocklist': return <BlocklistTab />;
            case 'habits': return <HabitsTab />;
            case 'progress':
            case 'achievements': return <AchievementsTab />;
            case 'challenges': return <ChallengesTab />;
            case 'forest': return <ForestTab />;
            case 'statistics': return <StatisticsTab />;
            case 'ai_patterns': return <PatternsTab />;
            case 'patterns': return <PatternsTab />;
            case 'shop': return <FocusShopTab />;
            case 'friends': return <FriendsTab />;
            case 'focus_rooms': return <FocusRoomView onBack={() => navigateTab('overview')} embedded />;
            case 'ai_coach': return (
                <AiCoachGate
                    onBack={() => navigateTab('overview')}
                    onOpenAccount={() => navigateTab('account')}
                    initialPrompt={coachInitialPrompt}
                    onPromptConsumed={() => setCoachInitialPrompt(null)}
                    embedded
                />
            );
            case 'support': return <SupportTab onOpenAiCoach={() => navigateTab('ai_coach')} isPro={isPro} />;
            case 'account': return <AccountSettings />;
            case 'settings': return <SettingsTab />;
            default: return <OverviewTab />;
        }
    };

    return (
        <div
            className={`focuz-dashboard focuz-dashboard-shell min-h-screen selection:bg-white/10 ${sidebarCollapsed ? 'focuz-dashboard--sidebar-collapsed' : ''} ${proGoldTheme ? 'pro-shell-vignette' : ''}`}
        >
            {proVisuals && <ProConfettiGate />}
            
            {/* Sidebar */}
            <WorkspaceSidebar
                activeTab={activeTab}
                avatarUrl={engineState.profileAvatar}
                username={engineState.profileUsername || engineState.profileName}
                email={session?.user?.email}
                isPro={isPro}
                collapsed={sidebarCollapsed}
                onToggleCollapse={toggleSidebarCollapsed}
                onNavigate={navigateTab}
                onOpenPalette={() => setPaletteOpen(true)}
                onUpgrade={() => void openCheckout()}
                onSignOut={() => void useAuthStore.getState().signOut()}
            />

            {/* Main Content */}
            <main className="workspace-main flex flex-col min-w-0 relative overflow-x-hidden">
                {/* Topbar */}
                <header className="workspace-topbar h-11 shrink-0 px-6 flex items-center justify-between sticky top-0 z-50">
                    <div className="flex items-center gap-2">
                        {sidebarCollapsed && (
                            <button
                                type="button"
                                onClick={toggleSidebarCollapsed}
                                className="workspace-sidebar-toggle mr-1"
                                aria-label="Expand sidebar"
                            >
                                <IconMaximize2 size={14} />
                            </button>
                        )}
                        <h1 className="text-xs font-medium text-neutral-400">{tabLabel(activeTab)}</h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => openWebDashboard()}
                            className="flex h-7 items-center gap-1.5 rounded-md border border-violet-500/25 bg-violet-500/10 px-2.5 text-[11px] font-medium text-violet-200 transition-colors hover:bg-violet-500/15 hover:text-violet-100"
                        >
                            <IconExternalLink size={12} />
                            Open web dashboard
                        </button>
                        {!isPro && (
                            <button
                                type="button"
                                onClick={() => void openCheckout()}
                                className="flex h-7 items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.035] px-2.5 text-[11px] font-medium text-neutral-400 transition-colors hover:bg-white/[0.06] hover:text-neutral-200"
                            >
                                Upgrade
                            </button>
                        )}
                    </div>
                </header>

                <div className={['calendar', 'lists', 'ai_coach', 'focus_rooms'].includes(activeTab)
                    ? 'flex-1 min-h-0 w-full overflow-hidden'
                    : 'px-6 pb-12 w-full overflow-y-auto scrollbar-hide'}
                >
                    <div
                        key={activeTab}
                        className={`${proVisuals ? 'pro-content-fade pro-page-enter' : ''} ${['calendar', 'lists', 'ai_coach', 'focus_rooms'].includes(activeTab) ? 'h-full' : ''}`}
                    >
                        {renderContent()}
                    </div>
                </div>
            </main>

            <OptionsCommandPalette
                open={paletteOpen}
                onClose={() => setPaletteOpen(false)}
                onNavigate={navigateTab}
                onOpenAi={() => navigateTab('ai_coach')}
                onFeedback={setToastMessage}
            />
            <ActionToast message={toastMessage} onDone={() => setToastMessage('')} />
            <DailyFocusMirrorModal
                mirror={futureSelfMirror}
                onClose={() => {
                    if (futureSelfMirror) {
                        void chrome.runtime.sendMessage({ type: 'FUTURE_SELF_MIRROR_SHOWN', id: futureSelfMirror.id });
                    }
                    setFutureSelfMirror(null);
                }}
            />

            {hostBookings.open && (
                <BookingNotificationModal bookings={hostBookings.bookings} onDismiss={hostBookings.dismiss} />
            )}

            {proVisuals && (
                <ProFocusToast message={focusToast} onDone={() => setFocusToast('')} />
            )}

            {/* Modals */}
            {showEndSession && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <GlassCard className="max-w-md w-full p-8 space-y-6 animate-fade-in-up">
                        <h3 className="text-base font-bold text-white">End Session?</h3>
                        <p className="text-neutral-400 text-sm">Are you sure you want to end your session? This will lock the dashboard until you authenticate again.</p>
                        <div className="flex space-x-3 pt-4">
                            <button onClick={() => setShowEndSession(false)} className="flex-1 py-3 bg-white/5 border border-white/10 text-white rounded-xl font-bold hover:bg-white/10 transition-all">Cancel</button>
                            <button onClick={() => useAuthStore.getState().signOut()} className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold transition-all">End Session</button>
                        </div>
                    </GlassCard>
                </div>
            )}
        </div>
    );
};

export default OptionsApp;
