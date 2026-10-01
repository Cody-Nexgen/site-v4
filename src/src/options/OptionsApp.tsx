import { isPaletteShortcut, PALETTE_SHORTCUT_LABEL } from '../lib/shortcuts';
import React, {
    lazy,
    useEffect,
    useLayoutEffect,
    useMemo,
    useState,
    useRef,
} from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../lib/store';
import {
    Ban as IconBan,
    Zap as IconBolt,
    LogOut as IconLogout,
    Lock as IconLock,
    Globe as IconWorldCheck,
    Search as IconSearch,
    Target as IconTarget,
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
    Maximize2 as IconMaximize2,
    ShieldBan as IconShieldBan,
    Timer as IconTimer,
    CalendarClock as IconCalendarClock,
    Layers as IconLayers,
    Sparkles as IconSparkles,
} from 'lucide-react';
import AiCoachGate from '../components/AiCoachGate';
import ForestTab from './ForestTab';

import { pluralize } from '../lib/utils';
import { FeaturePreview } from '../components/FeaturePreview';
import { AuthLogin } from '../components/AuthLogin';

import OverviewTab from './OverviewTab';
import {
    SessionsTab,
    BlocklistTab,
    HabitsTab,
    StatisticsTab,
    PatternsTab,
} from './Pages';
import SupportTab from './SupportTab';
import AchievementsTab from './AchievementsTab';
import ChallengesTab from './ChallengesTab';
import FocusShopTab from './FocusShopTab';
import FriendsTab from './FriendsTab';
import { resolveTabId, tabLabel } from '../lib/workspaceNav';
import { PageShell } from './PageShell';
import { EmptyState } from '../components/dashboard/primitives';
import { AUTO_SCHEDULE_COACH_PROMPT } from '../lib/socialApi';
import { sendProgressionMessage } from '../hooks/useFocusProgression';

import SchedulingCalendarPage from './SchedulingCalendarPage';
import ListsTab from './ListsTab';
import SettingsPage from './settings/SettingsPage';
import { LegacyFrame } from './legacy/LegacyFrame';
import { VERSIONED_PAGES, setPageVersion, usePageVersions } from '../lib/pageVersions';

// Legacy page versions (Settings → Page versions) load on demand, so they
// cost nothing unless someone picks them.
const LegacyCalendarPage = lazy(() => import('./legacy/calendar/SchedulingCalendarPage'));
const LegacyListsTab = lazy(() => import('./legacy/LegacyListsTab'));
const LegacyBlocklistTab = lazy(() => import('./legacy/LegacyPages').then((m) => ({ default: m.BlocklistTab })));
const LegacyHabitsTab = lazy(() => import('./legacy/LegacyPages').then((m) => ({ default: m.HabitsTab })));
const LegacyStatisticsTab = lazy(() => import('./legacy/LegacyPages').then((m) => ({ default: m.StatisticsTab })));
const LegacyAchievementsTab = lazy(() => import('./legacy/LegacyAchievementsTab'));
const LegacyChallengesTab = lazy(() => import('./legacy/LegacyChallengesTab'));
const LegacyForestTab = lazy(() => import('./legacy/LegacyForestTab'));
const LegacyFriendsTab = lazy(() => import('./legacy/LegacyFriendsTab'));
const LegacySettings = lazy(() => import('./legacy/LegacySettings'));
const LegacyBlockedView = lazy(() => import('./legacy/LegacyBlockedView'));
import { BookingNotificationModal } from '../components/BookingNotificationModal';

import { EmergencyUnlockModal } from '../components/EmergencyUnlockModal';
import HabitNameModal from '../components/HabitNameModal';
import { useHostBookingNotifications } from '../hooks/useHostBookingNotifications';
import { OptionsCommandPalette } from './OptionsCommandPalette';
import { WorkspaceSidebarV2 } from './WorkspaceSidebarV2';
import { WorkspaceSidebar } from './WorkspaceSidebar';
import {
    readLegacySidebarCollapsed,
    useSidebarController,
    useSidebarStyle,
    writeLegacySidebarCollapsed,
} from '../lib/sidebar';
import { Toast } from '../components/fz/Toast';
import { Dialog } from '../components/fz/Dialog';
import { Button } from '../components/fz/Button';
import { IconButton } from '../components/fz/IconButton';
import { ChallengeModal } from '../lib/unblockChallenge';
import { Kbd } from '../components/fz/Kbd';
import { IconPanelLeftOpen } from '../components/fz/icons';
import SetupPage from './SetupPage';
import FocuzPassTab from './FocuzPassTab';
import { FocuzPassFrame } from './focuzpass/FocuzPassFrame';
import {
    isSetupComplete,
    markSetupComplete,
    openWebDashboard,
    shouldOpenTabOnWeb,
} from '../lib/workspaceSync';
import { getPlatform, hydrateWebWorkspaceFromCloud, isWebPlatform } from '../lib/platform';

import { BILLING_RETURN_URL } from '../lib/billingUrls';
import { invokeAuthedFunction } from '../lib/supabaseFunctions';
import { FOCUS_COMPLETE_EVENT } from '../lib/proDashboard';
import { applyDocumentTheme, applyProWelcomePack } from '../lib/themes';

import { ProConfettiGate, ProFocusToast } from '../components/pro-dashboard/ProDashboardVisuals';
import { FutureSelfBlockedOverlay } from '../components/FutureSelfBlockedOverlay';
import { DailyFocusMirrorModal } from '../components/DailyFocusMirrorModal';
import type { FutureSelfBlockedSummary, FutureSelfMirror } from '../lib/futureSelfTypes';

// --- GLASSMORPHISM COMPONENTS ---

export const GlassCard = ({ children, className = "", onClick, style }: { children: React.ReactNode, className?: string, onClick?: (e: React.MouseEvent) => void, style?: React.CSSProperties }) => (
    <div
        onClick={onClick}
        style={style}
        className={`surface-card relative overflow-hidden ${onClick ? 'cursor-pointer hover:bg-white/4 transition-colors' : ''} ${className}`}
    >
        <div className="relative z-10">{children}</div>
    </div>
);

function accountAvatarFromMetadata(metadata: Record<string, unknown> | null | undefined): string {
    const candidates = [metadata?.avatar_url, metadata?.picture, metadata?.avatar];
    return candidates.find((value): value is string => typeof value === 'string' && value.trim().length > 0)?.trim() || '';
}

export const ActivityGraph = ({
    stats: statsProp,
    onSelectDay,
}: {
    stats?: { date: string; total: number; sites: Record<string, number>; focusMs?: number }[];
    onSelectDay: (day: {
        date: string;
        total: number;
        sites: Record<string, number>;
        focusMs?: number;
    }) => void;
}) => {
    const { last7DaysStats } = useAuthStore();
    const wrapRef = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState({ width: 640, height: 220 });
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const [chartMode, setChartMode] = useState<'bar' | 'line'>('line');
    const uid = React.useId().replace(/:/g, '');

    useLayoutEffect(() => {
        const el = wrapRef.current;
        if (!el) return;
        const update = () => {
            const rect = el.getBoundingClientRect();
            setSize({
                width: Math.max(Math.floor(rect.width), 240),
                height: Math.max(Math.floor(rect.height), 160),
            });
        };
        update();
        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const source = statsProp ?? last7DaysStats;
    const sliced = source.slice(-7);
    const stats = sliced.length
        ? sliced
        : Array.from({ length: 7 }, () => ({ date: '', total: 0, sites: {} as Record<string, number> }));
    const maxTotal = Math.max(...stats.map((s) => s.total || 0), 60 * 60 * 1000);
    const { width, height } = size;
    const paddingX = 44;
    const paddingTop = 32;
    const paddingBottom = 12;
    const chartWidth = Math.max(width - paddingX * 2, 1);
    const chartHeight = Math.max(height - paddingTop - paddingBottom, 1);
    const barGap = 14;
    const barWidth = Math.max(
        36,
        (chartWidth - barGap * (stats.length - 1)) / Math.max(1, stats.length),
    );
    const slotWidth = chartWidth / Math.max(stats.length, 1);

    const getBarX = (i: number) => paddingX + i * (barWidth + barGap);
    const getBarHeight = (ms: number) => Math.max(ms > 0 ? 6 : 0, ((ms || 0) / maxTotal) * chartHeight);
    const getBarY = (ms: number) => paddingTop + chartHeight - getBarHeight(ms);
    const getY = (pct: number) => paddingTop + chartHeight - (pct * chartHeight) / 100;
    const getPointX = (i: number) => paddingX + (i * chartWidth) / Math.max(1, stats.length - 1);
    const getPointY = (ms: number) => paddingTop + chartHeight - ((ms || 0) / maxTotal) * chartHeight;
    const linePath = useMemo(
        () =>
            stats
                .map((day, i) => `${i === 0 ? 'M' : 'L'} ${getPointX(i)} ${getPointY(day.total)}`)
                .join(' '),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [stats, width, height, maxTotal],
    );

    const formatTime = (ms: number) => {
        const mins = Math.round((ms || 0) / 60000);
        if (mins < 60) return `${mins}m`;
        return `${(mins / 60).toFixed(1)}h`;
    };

    return (
        <div ref={wrapRef} className="relative h-full min-h-[12rem] w-full overflow-visible">
            <div
                className="activity-chart-controls absolute right-1 top-0 z-20 flex rounded-lg border border-white/8 bg-black/50 p-0.5 shadow-sm backdrop-blur"
                role="group"
                aria-label="Activity chart type"
            >
                {(['bar', 'line'] as const).map((mode) => (
                    <button
                        key={mode}
                        type="button"
                        onClick={() => setChartMode(mode)}
                        aria-pressed={chartMode === mode}
                        className={`rounded-lg px-2 py-1 text-[11px] font-semibold capitalize transition-colors ${
                            chartMode === mode
                                ? 'bg-white/10 text-white'
                                : 'text-neutral-500 hover:text-neutral-300'
                        }`}
                    >
                        {mode}
                    </button>
                ))}
            </div>
            <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="absolute inset-0 h-full w-full overflow-visible">
                <defs>
                    <linearGradient id={`barGradient-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="var(--fz-accent)" stopOpacity="0.85" />
                        <stop offset="100%" stopColor="var(--fz-accent)" stopOpacity="0.45" />
                    </linearGradient>
                    <linearGradient id={`lineFill-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="var(--fz-accent)" stopOpacity="0.06" />
                        <stop offset="70%" stopColor="var(--fz-accent)" stopOpacity="0" />
                        <stop offset="100%" stopColor="var(--fz-accent)" stopOpacity="0" />
                    </linearGradient>
                </defs>

                {[0, 50, 100].map((v) => (
                    <g key={v}>
                        <line
                            x1={paddingX}
                            y1={getY(v)}
                            x2={width - paddingX}
                            y2={getY(v)}
                            stroke="white"
                            strokeOpacity="0.04"
                        />
                        <text x={6} y={getY(v) + 4} className="fill-neutral-600 font-medium" style={{ fontSize: 10 }}>
                            {v === 0 ? '0' : v === 50 ? formatTime(maxTotal / 2) : formatTime(maxTotal)}
                        </text>
                    </g>
                ))}

                {chartMode === 'line' && linePath && (
                    <>
                        <path
                            d={`${linePath} L ${getPointX(stats.length - 1)} ${paddingTop + chartHeight} L ${getPointX(0)} ${paddingTop + chartHeight} Z`}
                            fill={`url(#lineFill-${uid})`}
                        />
                        <path
                            d={linePath}
                            fill="none"
                            stroke="#d4d4d4"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
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
                    const hitX = chartMode === 'bar' ? x : pointX - slotWidth / 2;
                    const hitW = chartMode === 'bar' ? barWidth : Math.max(slotWidth, 48);
                    return (
                        <g
                            key={`${day.date || i}`}
                            className="cursor-pointer"
                            onMouseEnter={() => setHoveredIndex(i)}
                            onMouseLeave={() => setHoveredIndex(null)}
                            onClick={() => onSelectDay(day)}
                            role="button"
                            tabIndex={0}
                            aria-label={`${day.date || `Day ${i + 1}`}: ${formatTime(day.total)}. Click for details.`}
                            onFocus={() => setHoveredIndex(i)}
                            onBlur={() => setHoveredIndex(null)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    onSelectDay(day);
                                }
                            }}
                        >
                            <rect x={hitX} y={paddingTop} width={hitW} height={chartHeight} fill="transparent" />
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
                                    {active && (
                                        <line
                                            x1={pointX}
                                            y1={paddingTop}
                                            x2={pointX}
                                            y2={paddingTop + chartHeight}
                                            stroke="white"
                                            strokeOpacity="0.14"
                                            strokeDasharray="3 4"
                                        />
                                    )}
                                    <circle
                                        cx={pointX}
                                        cy={pointY}
                                        r={active ? 4.5 : 2}
                                        fill={active ? 'var(--fz-accent)' : 'var(--fz-text-3)'}
                                    />
                                </>
                            )}
                            {(active || chartMode === 'bar') && day.total > 0 && (
                                <text
                                    x={chartMode === 'bar' ? x + barWidth / 2 : pointX}
                                    y={Math.max(14, (chartMode === 'bar' ? y : pointY) - 12)}
                                    textAnchor="middle"
                                    className="fill-neutral-200 font-semibold"
                                    style={{ fontSize: 11 }}
                                >
                                    {formatTime(day.total)}
                                </text>
                            )}
                        </g>
                    );
                })}
            </svg>
            <p className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 text-[11px] text-neutral-600">
                Click a day for site breakdown
            </p>
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
                            className="flex-1 bg-white/6 border border-white/8 rounded-lg px-4 py-2 text-sm focus:border-[var(--fz-accent)] outline-none transition-colors"
                        />
                        <button
                            onClick={() => { triggerAction('block', newBlocked, 'add'); setNewBlocked(''); }}
                            className="bg-[var(--fz-accent)] hover:brightness-110 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-lg "
                        >Add</button>
                    </div>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-hide pr-1">
                        {Object.keys(engineState.blocklist || {}).length === 0 ? (
                            <EmptyState
                                icon={<IconShieldBan size={16} />}
                                title="No active blocks"
                                description="Blocked sites you add will show up here while a session is running."
                            />
                        ) : (
                            Object.entries(engineState.blocklist || {}).map(([domain, data]: [string, any]) => (
                                <div key={domain} className="flex items-center justify-between p-3 bg-white/6 rounded-lg border border-white/8 group hover:border-white/8 transition-all">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium">{domain}</span>
                                        <span className="text-[11px] text-neutral-600 font-bold ">
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
                            className="flex-1 bg-white/6 border border-white/8 rounded-lg px-4 py-2 text-sm focus:border-green-500 outline-none transition-colors"
                        />
                        <button
                            onClick={() => { triggerAction('allowed_site', newAllowed, 'add'); setNewAllowed(''); }}
                            className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-lg shadow-green-600/20"
                        >Add</button>
                    </div>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-hide pr-1">
                        {(engineState.allowedSites || []).map((domain: string) => (
                            <div key={domain} className="flex items-center justify-between p-3 bg-white/6 rounded-lg border border-white/8 group hover:border-white/8 transition-all">
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
                                className={`p-4 rounded-lg border transition-all text-center group
                                    ${engineState.categoriesActive[cat]
                                        ? 'bg-[var(--fz-accent-soft)] border-[var(--fz-accent)] text-[var(--fz-accent)]'
                                        : 'bg-white/6 border-white/8 text-neutral-500 hover:bg-white/10 hover:text-neutral-300'}`}
                            >
                                <span className="text-xs font-bold ">{cat}</span>
                            </button>
                        ) : null
                    ))}
                </div>
            </GlassCard>
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

    const planSeq = useRef(0);
    /** Show the new planner at once, save it, then re-sync unless a newer edit is already on its way. */
    const savePlanner = async (updated: typeof planner) => {
        const seq = ++planSeq.current;
        useAuthStore.setState((s) => ({ engineState: { ...s.engineState, dailyPlanner: updated } }));
        await new Promise<void>(r => chrome.runtime.sendMessage({ type: 'UPDATE_ENGINE_SETTINGS', settings: { dailyPlanner: updated } }, () => r()));
        if (seq === planSeq.current) await fetchEngineState();
    };

    const addPlanItem = async () => {
        if (!newPlanTask.trim()) return;
        setNewPlanTask('');
        await savePlanner([...planner, { id: Date.now(), time: newPlanTime, task: newPlanTask, done: false }].sort((a, b) => a.time.localeCompare(b.time)));
    };

    const togglePlanItem = (id: number) => savePlanner(planner.map(p => p.id === id ? { ...p, done: !p.done } : p));

    const removePlanItem = (id: number) => savePlanner(planner.filter(p => p.id !== id));

    const organizePlanItems = () =>
        savePlanner([...planner].sort((a, b) => {
            if (a.done !== b.done) return a.done ? 1 : -1;
            return (a.time || '').localeCompare(b.time || '');
        }));

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
                                <span className="text-[11px] text-neutral-500">• {defaultPomo.sessionsCompleted} sessions</span>
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
                                    className="w-12 bg-white/6 border border-white/8 rounded-lg px-1 py-0.5 text-center text-xs text-white outline-none focus:border-[var(--fz-accent)]" />
                                <span className="text-[11px] text-neutral-500">/</span>
                                <input type="number" min="1" max="30" value={defaultPomo.breakMin}
                                    onChange={async (e) => {
                                        const v = parseInt(e.target.value) || 5;
                                        const updated = { ...defaultPomo, breakMin: v };
                                        await new Promise<void>(r => chrome.runtime.sendMessage({ type: 'UPDATE_ENGINE_SETTINGS', settings: { pomodoroSettings: updated } }, () => r()));
                                        if (!pomoRunning && isBreak) setPomoTimeLeft(v * 60);
                                        fetchEngineState();
                                    }}
                                    className="w-10 bg-white/6 border border-white/8 rounded-lg px-1 py-0.5 text-center text-xs text-white outline-none focus:border-[var(--fz-accent)]" />
                                <span className="text-[11px] text-neutral-500">min</span>
                            </div>
                        </div>
                        <div className="flex flex-col items-center space-y-3">
                            <div className="relative w-40 h-40">
                                <svg className="w-40 h-40 transform -rotate-90" viewBox="0 0 200 200">
                                    <circle cx="100" cy="100" r="90" fill="none" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="8" />
                                    <circle cx="100" cy="100" r="90" fill="none" stroke={isBreak ? '#22c55e' : 'var(--fz-accent)'} strokeWidth="8" strokeLinecap="round"
                                        strokeDasharray={`${2 * Math.PI * 90}`}
                                        strokeDashoffset={`${2 * Math.PI * 90 * (1 - pomoTimeLeft / ((isBreak ? defaultPomo.breakMin : defaultPomo.focusMin) * 60))}`}
                                        className="transition-all duration-1000" />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-3xl font-semibold text-white tabular-nums">{formatTime(pomoTimeLeft)}</span>
                                    <span className="text-[11px] text-neutral-500 ">{isBreak ? 'Break' : 'Focus'}</span>
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
                                    className={`px-6 py-2 rounded-lg font-bold text-xs transition-all active:scale-95 ${pomoRunning ? 'bg-white/10 text-white border border-white/8' : 'bg-white text-black'}`}>
                                    {pomoRunning ? <><IconPlayerPause size={14} className="inline mr-1" />PAUSE</> : <><IconPlayerPlay size={14} className="inline mr-1" />START</>}
                                </button>
                                <button onClick={() => { setPomoRunning(false); setPomoEndAt(null); setIsBreak(false); setPomoTimeLeft(defaultPomo.focusMin * 60); }}
                                    className="px-3 py-2 bg-white/6 border border-white/8 rounded-lg text-xs text-neutral-400 hover:text-white transition-all">
                                    <IconRefresh size={14} />
                                </button>
                            </div>
                        </div>
                    </GlassCard>

                    {/* Focus Quote */}
                    <GlassCard className="p-4">
                        <div className="flex items-center space-x-2 mb-2">
                            <IconQuote size={14} className="text-[var(--fz-accent)]" />
                            <h3 className="font-bold text-white text-sm">Daily Quote</h3>
                        </div>
                        <blockquote className="text-sm text-neutral-300 italic leading-relaxed border-l-2 border-[var(--fz-accent)] pl-3 py-1">
                            "{todayQuote}"
                        </blockquote>
                        <button onClick={toggleSaveQuote}
                            className={`mt-2 px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${isQuoteSaved ? 'bg-[var(--fz-accent-soft)] text-[var(--fz-accent)] border border-[var(--fz-accent)]' : 'bg-white/6 border border-white/8 text-neutral-400 hover:text-white'}`}>
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
                                className="px-2 py-1 bg-white/10 hover:bg-white/10 border border-white/8 rounded-lg text-[11px] font-bold text-white transition-all"
                            >
                                <IconPlus size={12} className="inline" /> ADD
                            </button>
                        </div>
                        {habits.length === 0 ? (
                            <EmptyState
                                icon={<IconTarget size={16} />}
                                title="No habits yet"
                                description="Track something you want to do daily and build a streak."
                            />
                        ) : (
                            <div className="space-y-1.5">
                                {habits.map((h: any) => {
                                    const checkedToday = h.checkins?.includes(todayStr);
                                    return (
                                        <div key={h.id} className="flex items-center justify-between p-2 bg-white/6 border border-white/8 rounded-lg group">
                                            <div className="flex items-center space-x-2">
                                                <button onClick={() => checkInHabit(h.id)}
                                                    className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${checkedToday ? 'bg-green-500 text-white' : 'bg-white/10 text-neutral-500 hover:bg-green-500/20'}`}>
                                                    {checkedToday && <IconCheck size={12} />}
                                                </button>
                                                <div>
                                                    <p className={`text-xs font-bold ${checkedToday ? 'text-green-400' : 'text-white'}`}>{h.name}</p>
                                                    <p className="text-[11px] text-neutral-500">{pluralize(h.streak, 'day')} streak</p>
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
                                <IconNote size={14} className="text-[var(--fz-accent)]" />
                                <h3 className="font-bold text-white text-sm">Scratches</h3>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={addScratch}
                                    className="px-2 py-1 bg-white/10 hover:bg-white/10 border border-white/8 rounded-lg text-[11px] font-bold text-white transition-all"
                                >
                                    <IconPlus size={12} className="inline" /> NEW
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setScratchFullscreen((v) => !v)}
                                    className="p-1.5 bg-white/10 hover:bg-white/10 border border-white/8 rounded-lg text-white transition-all"
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
                                        className={`px-2 py-1 rounded-lg text-[11px] whitespace-nowrap border ${
                                            activeScratchId === n.id
                                                ? 'bg-[var(--fz-accent-soft)] border-[var(--fz-accent)] text-[var(--fz-accent)]'
                                                : 'bg-white/6 border-white/8 text-neutral-400 hover:text-white'
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
                            className={`w-full bg-black/40 border border-white/8 rounded-lg p-3 text-white text-xs focus:border-[var(--fz-accent)] outline-none transition-colors ${
                                scratchFullscreen ? 'h-[60vh]' : 'h-28'
                            } resize-none font-mono`}
                            placeholder="Type notes... autosaves."
                        />
                    </GlassCard>

                    {/* Daily Planner */}
                    <GlassCard className="p-4">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2">
                                <IconTarget size={14} className="text-[var(--fz-text-3)]" />
                                <h3 className="font-semibold text-white text-sm">Daily planner</h3>
                            </div>
                            <div className="flex items-center gap-2">
                                {planner.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => void organizePlanItems()}
                                        className="px-2 py-1 rounded-lg bg-white/6 border border-white/8 text-[11px] font-bold text-neutral-400 hover:text-white transition-all"
                                    >
                                        ORGANIZE
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="flex space-x-2 mb-2">
                            <input type="time" value={newPlanTime} onChange={e => setNewPlanTime(e.target.value)}
                                className="bg-black/40 border border-white/8 rounded-lg px-2 py-1.5 text-white text-xs outline-none focus:border-[var(--fz-accent)] transition-colors w-24" />
                            <input value={newPlanTask} onChange={e => setNewPlanTask(e.target.value)} onKeyDown={e => e.key === 'Enter' && addPlanItem()}
                                placeholder="Task..."
                                className="flex-1 bg-black/40 border border-white/8 rounded-lg px-3 py-1.5 text-white text-xs outline-none focus:border-[var(--fz-accent)] transition-colors" />
                            <button onClick={addPlanItem} className="px-3 py-1.5 bg-white text-black rounded-lg font-bold text-xs hover:bg-neutral-200 transition-all">ADD</button>
                        </div>
                        <div className="space-y-1">
                            {planner.map((p: any) => (
                                <div key={p.id} className="flex items-center space-x-2 p-2 bg-white/6 border border-white/8 rounded-lg group">
                                    <button onClick={() => togglePlanItem(p.id)} className={`w-5 h-5 rounded flex items-center justify-center transition-all ${p.done ? 'bg-green-500 text-white' : 'bg-white/10'}`}>
                                        {p.done && <IconCheck size={12} />}
                                    </button>
                                    <span className="text-[11px] font-bold text-[var(--fz-accent)] w-12">{p.time}</span>
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
                            <IconTarget size={16} className="text-[var(--fz-accent)]" />
                            <h3 className="font-bold text-white text-sm">Daily Goals</h3>
                        </div>
                        <p className="text-[11px] text-neutral-500 mb-4">Set time limits for specific domains.</p>
                        <div className="flex space-x-2 mb-4">
                            <input id="dgDomain-p" type="text" placeholder="reddit.com" className="flex-1 bg-black/40 border border-white/8 rounded-lg px-3 py-2 text-white outline-none text-xs" />
                            <input id="dgMinutes-p" type="number" placeholder="Min" className="w-20 bg-black/40 border border-white/8 rounded-lg px-3 py-2 text-white outline-none text-xs" />
                            <button
                                onClick={async () => {
                                    const d = (document.getElementById('dgDomain-p') as HTMLInputElement).value;
                                    const m = parseInt((document.getElementById('dgMinutes-p') as HTMLInputElement).value);
                                    if (!d || isNaN(m)) return;
                                    const updated = { ...(engineState.dailyFocusTarget || {}), [d]: m };
                                    await new Promise<void>(r => chrome.runtime.sendMessage({ type: 'UPDATE_ENGINE_SETTINGS', settings: { dailyFocusTarget: updated } }, () => r()));
                                    fetchEngineState();
                                }}
                                className="bg-[var(--fz-accent)] hover:brightness-110 text-white px-3 py-2 rounded-lg font-bold text-xs transition-colors"
                            >
                                <IconPlus size={16} />
                            </button>
                        </div>
                        <div className="space-y-2 max-h-[200px] overflow-y-auto scrollbar-hide pr-1">
                            {Object.entries(engineState?.dailyFocusTarget || {}).map(([d, m]) => (
                                <div key={d} className="flex items-center justify-between p-2.5 bg-white/6 border border-white/8 rounded-lg group hover:border-white/16 transition-all">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold text-white truncate max-w-[120px]">{d}</span>
                                        <span className="text-[11px] text-neutral-500  font-semibold">Daily Limit</span>
                                    </div>
                                    <div className="flex items-center space-x-3">
                                        <span className="text-xs font-semibold text-[var(--fz-accent)] bg-[var(--fz-accent-soft)] px-2 py-0.5 rounded-full tabular-nums">{m as number}m</span>
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
                                <EmptyState
                                    icon={<IconTimer size={16} />}
                                    title="No time limits"
                                    description="Set a daily cap on a site to get a nudge when you go over."
                                />
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

const BLOCK_REASONS: Record<string, { label: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number }> }> = {
    manual: { label: 'On your blocklist', icon: IconBan },
    ai: { label: 'Added by your AI Coach', icon: IconBan },
    category: { label: 'Part of a blocked category', icon: IconLayers },
    schedule: { label: 'Blocked by your focus schedule', icon: IconCalendarClock },
    timer: { label: 'Blocked by a focus timer', icon: IconTimer },
    in_app: { label: 'Platform blocker', icon: IconShieldBan },
};

/** The page a blocked site redirects to. Calm, one clear way out. */
const BlockedView = ({ url }: { url: string }) => {
    const { engineState, fetchEngineState } = useAuthStore();
    const [engineReady, setEngineReady] = useState(false);
    const [emergencyOpen, setEmergencyOpen] = useState(false);
    const [overrideNotice, setOverrideNotice] = useState('');
    const [overrideError, setOverrideError] = useState('');
    const [futureSelfSummary, setFutureSelfSummary] = useState<FutureSelfBlockedSummary | null>(null);
    const [iconFailed, setIconFailed] = useState(false);
    const [nowMs, setNowMs] = useState(() => Date.now());

    const params = new URLSearchParams(window.location.search);
    const source = params.get('source') || 'manual';
    const ytCategory = params.get('ytCategory');
    const overrideSettings = engineState.emergencyOverrideSettings ?? {
        enabled: true,
        maxPerDay: 3,
        minReasonLength: 20,
        accessMinutes: 15,
        cooldownMinutes: 30,
    };

    const special = url === 'LOCKDOWN' || url === 'REDACTED' || url === 'ALLOWLIST';
    const domain = useMemo(() => {
        if (special) return '';
        try {
            return new URL(url).hostname.replace(/^www\./, '');
        } catch {
            return url;
        }
    }, [url, special]);
    const path = useMemo(() => {
        if (special) return '';
        try {
            const p = new URL(url).pathname;
            return p && p !== '/' ? p : '';
        } catch {
            return '';
        }
    }, [url, special]);

    useEffect(() => {
        void fetchEngineState().then(() => setEngineReady(true));
    }, [fetchEngineState]);

    useEffect(() => {
        if (!url || special) return;
        void chrome.runtime.sendMessage({ type: 'FUTURE_SELF_BLOCKED', url }).then((response) => {
            setFutureSelfSummary(response?.summary ?? null);
        });
    }, [url, special]);

    const isNuclear = !!engineState.nuclearState?.active || url === 'LOCKDOWN';
    useEffect(() => {
        if (!isNuclear) return;
        const t = window.setInterval(() => setNowMs(Date.now()), 15_000);
        return () => window.clearInterval(t);
    }, [isNuclear]);
    const minutesLeft = engineState.nuclearState?.active
        ? Math.max(0, Math.ceil((engineState.nuclearState.endTime - nowMs) / 60000))
        : 0;

    const canEmergency = !isNuclear && overrideSettings.enabled !== false && !special;
    const blockedToday = engineState.blockedToday || 0;
    const customMessage = (engineState.redirectMessage || '').trim();

    const reason = ytCategory
        ? { label: `Smart YouTube · ${ytCategory.replace(/_/g, ' ')}`, icon: IconSparkles }
        : BLOCK_REASONS[source] ?? BLOCK_REASONS.manual;
    const ReasonIcon = reason.icon;

    const heading = isNuclear
        ? 'Nuclear lockdown'
        : url === 'ALLOWLIST'
          ? 'Allowlist mode is on'
          : url === 'REDACTED'
            ? 'Restricted content'
            : domain;
    const body = isNuclear
        ? minutesLeft
            ? `Everything on your blocklist is locked for another ${minutesLeft} min. It can't be turned off early.`
            : 'Everything on your blocklist is locked until the lockdown ends.'
        : url === 'ALLOWLIST'
          ? 'Only the sites you’ve allowed work right now.'
          : customMessage || 'Not right now. Close this and get back to what you were doing.';

    const dashboardUrl = chrome.runtime.getURL('src/options/index.html');
    const backToWork = () => {
        // A blocked link opened in a fresh tab has nowhere to go back to.
        if (window.history.length > 1) {
            window.history.back();
            window.setTimeout(() => {
                window.location.href = dashboardUrl;
            }, 400);
        } else {
            window.location.href = dashboardUrl;
        }
    };

    const requestEmergency = async (reasonText: string) => {
        setOverrideError('');
        setOverrideNotice('');
        const targetUrl = url.startsWith('http') ? url : `https://${domain}`;
        const resp = await new Promise<{ ok?: boolean; error?: string; expiresAt?: number }>((resolve) =>
            chrome.runtime.sendMessage(
                { type: 'EMERGENCY_OVERRIDE', url: targetUrl, reason: reasonText },
                (r) => resolve(r ?? {}),
            ),
        );
        if (!resp.ok) {
            setOverrideError(resp.error ?? 'Override denied');
            throw new Error(resp.error ?? 'Override denied');
        }
        const mins = overrideSettings.accessMinutes ?? 15;
        setOverrideNotice(`Unlocked for ${mins} minutes. Use it for what you said.`);
        setEmergencyOpen(false);
        setTimeout(() => {
            window.location.href = targetUrl;
        }, 800);
    };

    if (futureSelfSummary) {
        return (
            <div className="fixed inset-0 z-[70] flex min-h-[100dvh] w-screen items-center justify-center overflow-y-auto bg-page p-4 sm:p-8">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--fz-accent-soft)_0%,transparent_65%)]" />
                <FutureSelfBlockedOverlay url={url} summary={futureSelfSummary} />
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[70] flex min-h-[100dvh] w-screen flex-col items-center overflow-y-auto bg-[var(--fz-bg-app)] px-6 text-[var(--fz-text-1)]">
            <div
                aria-hidden
                className="pointer-events-none fixed inset-0"
                style={{
                    background:
                        'radial-gradient(56% 46% at 50% 38%, color-mix(in oklab, var(--fz-text-1) 5%, transparent), transparent 70%)',
                }}
            />

            <main className="relative my-auto flex w-full max-w-[420px] flex-col items-center py-16 text-center">
                <div className="relative mb-7">
                    <span className="flex size-16 items-center justify-center rounded-2xl border border-[var(--fz-border)] bg-[var(--fz-bg-raised)] text-[var(--fz-text-2)] shadow-[var(--fz-elev-card)]">
                        {isNuclear ? (
                            <IconBolt size={26} strokeWidth={1.75} />
                        ) : domain && !iconFailed ? (
                            <img
                                src={`https://www.google.com/s2/favicons?domain=${domain}&sz=128`}
                                alt=""
                                className="size-8 rounded-md"
                                onError={() => setIconFailed(true)}
                            />
                        ) : (
                            <IconLock size={24} strokeWidth={1.75} />
                        )}
                    </span>
                    {!isNuclear && (
                        <span className="absolute -bottom-1.5 -right-1.5 flex size-7 items-center justify-center rounded-full border-[3px] border-[var(--fz-bg-app)] bg-[var(--fz-text-1)] text-[var(--fz-bg-app)]">
                            <IconLock size={12} strokeWidth={2.5} />
                        </span>
                    )}
                </div>

                <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--fz-border)] bg-[var(--fz-bg-raised)] px-2.5 py-1 text-[12px] font-medium text-[var(--fz-text-3)]">
                    {isNuclear ? (
                        <>
                            <span className="size-1.5 animate-pulse rounded-full bg-[var(--fz-danger)]" />
                            {minutesLeft ? `${minutesLeft} min left` : 'Active'}
                        </>
                    ) : (
                        <>
                            <ReasonIcon size={12} strokeWidth={2} />
                            {url === 'ALLOWLIST' ? 'Allowlist mode' : reason.label}
                        </>
                    )}
                </span>

                <h1 className="mt-4 max-w-full break-words text-[30px] font-semibold leading-[36px] tracking-[-0.02em]">
                    {heading || 'This site'}
                </h1>
                {path && <p className="text-meta mt-1 max-w-full truncate">{path}</p>}
                <p className="text-body mt-3 max-w-[360px] text-[var(--fz-text-3)]">
                    {engineReady || isNuclear ? body : ' '}
                </p>

                <div className="mt-9 flex w-full max-w-[320px] flex-col gap-2">
                    <Button variant="primary" size="lg" className="h-11 w-full text-[14px]" onClick={backToWork}>
                        Back to work
                    </Button>
                    {canEmergency && (
                        <Button variant="ghost" size="lg" className="w-full" onClick={() => setEmergencyOpen(true)}>
                            Emergency unlock
                        </Button>
                    )}
                </div>

                {overrideNotice && <p className="text-body-sm mt-4 text-[var(--fz-text-2)]">{overrideNotice}</p>}
                {overrideError && !emergencyOpen && (
                    <p className="text-body-sm mt-4 text-[var(--fz-danger)]">{overrideError}</p>
                )}
            </main>

            <footer className="relative flex w-full max-w-[640px] items-center justify-between gap-4 border-t border-[var(--fz-border)] py-4 text-meta">
                <span className="tabular-nums">
                    {engineReady
                        ? `${blockedToday} ${blockedToday === 1 ? 'distraction' : 'distractions'} stopped today`
                        : ' '}
                </span>
                <a
                    href={dashboardUrl}
                    className="font-medium text-[var(--fz-text-2)] transition-colors hover:text-[var(--fz-text-1)]"
                >
                    Open FocuzNow
                </a>
            </footer>

            <EmergencyUnlockModal
                open={emergencyOpen}
                domain={domain}
                minReasonLength={overrideSettings.minReasonLength ?? 20}
                onClose={() => setEmergencyOpen(false)}
                onSubmit={requestEmergency}
            />
        </div>
    );
};

/**
 * Page header copy per tab. PageShell renders this; pages must not render their
 * own title block any more. `title` only needs setting where the page deserves a
 * fuller name than its sidebar label.
 */

const PAGE_HEADERS: Record<string, { title?: string; eyebrow?: string; description?: string }> = {
    statistics: {
        title: 'Statistics & analytics',
        description: 'Where your time went, day by day.',
    },
    patterns: {
        description: 'Activity trends and focus insights — all computed locally.',
    },
    ai_patterns: {
        title: 'Patterns',
        description: 'Activity trends and focus insights — all computed locally.',
    },
    habits: {
        description: 'Build discipline through consistency.',
    },
    blocklist: {
        title: 'Site management',
        description: 'Control what gets blocked and what stays reachable.',
    },
    progress: {
        title: 'Focuz progression',
        description: 'Level up from sessions, streaks, habits, and resisting distractions.',
    },
    achievements: {
        title: 'Focuz progression',
        description: 'Level up from sessions, streaks, habits, and resisting distractions.',
    },
    challenges: {
        description: 'Behavior-based goals — complete focus sessions, hold streaks, and resist blocks to earn XP and coins.',
    },
    friends: {
        description: 'See who’s focusing and compare weekly deep work.',
    },
    sessions: {
        description: 'Choose a rhythm, start the clock, and stay with one thing.',
    },
    forest: {
        description: 'A living map of completed focus sessions — each tree is real work you finished.',
    },
    shop: {
        description: 'Cosmetics only. Coins come from real sessions — nothing here changes focus power.',
    },
    support: {
        description: 'Ask the AI Coach, browse guides, or reach our team directly.',
    },
    settings: {
        title: 'Settings',
        description: 'Your account, how FocuzNow looks, and how it protects your focus.',
    },
    account: {
        title: 'Settings',
        description: 'Your account, how FocuzNow looks, and how it protects your focus.',
    },
};

/** The blocked-site screen, in whichever version the user picked. */
const BlockedRoute = ({ url }: { url: string }) => {
    const fetchEngineState = useAuthStore((s) => s.fetchEngineState);
    const versions = usePageVersions();
    const [ready, setReady] = useState(false);
    useEffect(() => {
        void fetchEngineState().finally(() => setReady(true));
    }, [fetchEngineState]);
    if (!ready) return <div className="fixed inset-0 bg-page" />;
    if (versions.blocked === 'legacy') {
        return (
            <LegacyFrame pageId="blocked" fill>
                <LegacyBlockedView url={url} />
            </LegacyFrame>
        );
    }
    return <BlockedView url={url} />;
};

const OptionsApp = () => {
    const { session, loading, init, featurePreviewSeen, setFeaturePreviewSeen, engineState, subscriptionTier, recordDashboardOpen } = useAuthStore();
    const hostBookings = useHostBookingNotifications(!!session);
    const isPro = subscriptionTier === 'pro';
    const pageVersions = usePageVersions();
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
    const [contentScrolled, setContentScrolled] = useState(false);
    const sidebarStyle = useSidebarStyle();
    const legacySidebar = sidebarStyle === 'legacy';
    const sidebar = useSidebarController(activeTab !== 'focuzpass' && !legacySidebar);
    // Legacy sidebar: its own collapse flag instead of the v2 resize/rail/peek controller.
    const [legacyCollapsed, setLegacyCollapsed] = useState(readLegacySidebarCollapsed);
    const setLegacyCollapsedPersist = (collapsed: boolean) => {
        setLegacyCollapsed(collapsed);
        writeLegacySidebarCollapsed(collapsed);
    };

    useEffect(() => {
        document.body.classList.add('focuz-dashboard');
        return () => document.body.classList.remove('focuz-dashboard');
    }, []);

    useEffect(() => {
        const onFocusComplete = () => {
            setFocusToast('Deep work logged · +1 to your streak');
            useAuthStore.getState().recalculateStreak();
        };
        window.addEventListener(FOCUS_COMPLETE_EVENT, onFocusComplete);
        return () => window.removeEventListener(FOCUS_COMPLETE_EVENT, onFocusComplete);
    }, []);

    const navigateTab = (tab: string) => {
        const resolved = resolveTabId(tab);
        // FocuzPass is local-only — always keep it inside the current surface.
        if (resolved === 'focuzpass') {
            setActiveTab(resolved);
            const url = new URL(window.location.href);
            url.searchParams.set('tab', resolved);
            window.history.replaceState({}, '', url.pathname + url.search);
            return;
        }
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
            // Alt+K like everywhere else; Ctrl/⌘+K also works inside the dashboard.
            if (isPaletteShortcut(e) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) {
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
        if (resolved === 'focuzpass') {
            setActiveTab(resolved);
            return;
        }
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

        if (params.get('view') === 'blocked') {
            setView('blocked');
            setBlockedUrl(params.get('url') || '');
        }

        const tab = params.get('tab');
        if (tab) {
            const resolved = resolveTabId(tab);
            if (resolved === 'focuzpass') {
                setActiveTab(resolved);
            } else if (!isWebPlatform() && shouldOpenTabOnWeb(resolved)) {
                openWebDashboard(resolved);
            } else {
                setActiveTab(resolved);
            }
        }

        // Ensure platform is initialized (no-op in extension; installs shim + cloud hydrate on web).
        void getPlatform();
        if (isWebPlatform()) {
            void hydrateWebWorkspaceFromCloud();
        }

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
        const dismissedKey = 'focuznow-future-self-mirror-dismissed';
        let dismissedIds: string[] = [];
        try {
            dismissedIds = JSON.parse(localStorage.getItem(dismissedKey) || '[]') as string[];
        } catch {
            dismissedIds = [];
        }
        void chrome.runtime.sendMessage({ type: 'FUTURE_SELF_GET', dashboardOpen: true }).then((response) => {
            const pending = response?.pendingMirror ?? null;
            if (pending?.id && dismissedIds.includes(pending.id)) {
                void chrome.runtime.sendMessage({ type: 'FUTURE_SELF_MIRROR_SHOWN', id: pending.id });
                setFutureSelfMirror(null);
                return;
            }
            setFutureSelfMirror(pending);
        });
    }, [session, isPro, view]);

    useEffect(() => {
        applyDocumentTheme(engineState, isPro);
    }, [engineState, isPro]);

    if (view === 'blocked') {
        return <BlockedRoute url={blockedUrl} />;
    }

    if (loading && !session) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-black">
                <div className="w-12 h-12 border-4 border-[var(--fz-accent)] border-t-transparent rounded-full animate-spin" />
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

    const accountAvatarUrl = accountAvatarFromMetadata(session?.user?.user_metadata);
    const resolvedProfileAvatar = engineState.profileAvatar || accountAvatarUrl;
    const focuzPassMode = activeTab === 'focuzpass';
    const fullHeightTab = ['calendar', 'lists', 'ai_coach', 'focuzpass'].includes(activeTab);
    // Canvas-style pages that legitimately want the full width of the shell.
    const fullBleedTab = ['forest'].includes(activeTab);
    const headerConfig = PAGE_HEADERS[activeTab] ?? {};
    const pageTitle = headerConfig.title ?? tabLabel(activeTab);
    const pageEyebrow = activeTab === 'overview'
        ? new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
        : headerConfig.eyebrow;
    // Which Settings → Page versions entry this tab belongs to.
    const versionId = activeTab === 'account' ? 'settings' : activeTab === 'achievements' ? 'progress' : activeTab;
    const isLegacy = (id: string) => pageVersions[id] === 'legacy';
    const legacy = (id: string, node: React.ReactNode) => <LegacyFrame pageId={id}>{node}</LegacyFrame>;
    const pageActions = isLegacy(versionId) && VERSIONED_PAGES.some((p) => p.id === versionId)
        ? (
            <button
                type="button"
                onClick={() => void setPageVersion(versionId, 'new')}
                title="You picked the legacy design for this page in Settings → Page versions"
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--fz-border)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--fz-text-2)] transition-colors hover:bg-[var(--fz-bg-hover)] hover:text-[var(--fz-text-1)]"
            >
                <span className="rounded bg-[var(--fz-bg-active)] px-1.5 py-px text-[11px] text-[var(--fz-text-3)]">Legacy</span>
                Use new version
            </button>
        )
        : undefined;

    const renderContent = () => {
        switch (activeTab) {
            case 'overview': return <OverviewTab />;
            // On the website FocuzPass is the extension's own page in a frame: the site never sees the vault.
            case 'focuzpass': return isWebPlatform() ? (
                <FocuzPassFrame
                    avatarUrl={resolvedProfileAvatar}
                    username={engineState.profileUsername || engineState.profileName || session?.user?.email?.split('@')[0] || 'Username'}
                    accountName={engineState.profileName || session?.user?.email || 'FocuzNow Account'}
                    onExit={() => navigateTab('overview')}
                />
            ) : (
                <FocuzPassTab
                    avatarUrl={resolvedProfileAvatar}
                    avatarFallbackUrl={accountAvatarUrl}
                    username={engineState.profileUsername || engineState.profileName || session?.user?.email?.split('@')[0] || 'Username'}
                    accountName={engineState.profileName || session?.user?.email || 'FocuzNow Account'}
                    onExit={() => navigateTab('overview')}
                />
            );
            case 'calendar': return isLegacy('calendar') ? legacy('calendar', <LegacyCalendarPage fullscreen />) : <SchedulingCalendarPage fullscreen />;
            case 'lists': return isLegacy('lists') ? legacy('lists', <LegacyListsTab />) : <ListsTab />;
            case 'sessions': return <SessionsTab />;
            case 'blocklist': return isLegacy('blocklist') ? legacy('blocklist', <LegacyBlocklistTab />) : <BlocklistTab />;
            case 'habits': return isLegacy('habits') ? legacy('habits', <LegacyHabitsTab />) : <HabitsTab />;
            case 'progress':
            case 'achievements': return isLegacy('progress') ? legacy('progress', <LegacyAchievementsTab />) : <AchievementsTab />;
            case 'challenges': return isLegacy('challenges') ? legacy('challenges', <LegacyChallengesTab />) : <ChallengesTab />;
            case 'forest': return isLegacy('forest') ? legacy('forest', <LegacyForestTab />) : <ForestTab />;
            case 'statistics': return isLegacy('statistics') ? legacy('statistics', <LegacyStatisticsTab />) : <StatisticsTab />;
            case 'ai_patterns': return <PatternsTab />;
            case 'patterns': return <PatternsTab />;
            case 'shop': return <FocusShopTab />;
            case 'friends': return isLegacy('friends') ? legacy('friends', <LegacyFriendsTab />) : <FriendsTab />;
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
            case 'account':
            case 'settings':
                return isLegacy('settings')
                    ? legacy('settings', <LegacySettings key={activeTab} initialTab={activeTab === 'account' ? 'account' : 'settings'} />)
                    : <SettingsPage key={activeTab} initialSection={activeTab === 'account' ? 'account' : undefined} />;
            default: return <OverviewTab />;
        }
    };

    const sidebarNav = (tab: string) => {
        navigateTab(tab);
        sidebar.onPeekNavigate();
    };

    return (
        <div
            className={`focuz-dashboard focuz-dashboard-shell min-h-screen ${
                legacySidebar
                    ? `focuz-sb-tokens ${legacyCollapsed ? 'focuz-dashboard--sidebar-collapsed' : ''}`
                    : sidebar.shellClass
            } ${focuzPassMode ? 'focuz-dashboard--focuzpass' : ''}`}
            style={focuzPassMode || legacySidebar ? undefined : sidebar.shellStyle}
        >
            {!focuzPassMode && <ProConfettiGate />}

            {/* Sidebar */}
            {!focuzPassMode && legacySidebar && (
                <WorkspaceSidebar
                    activeTab={activeTab === 'account' ? 'settings' : activeTab}
                    avatarUrl={resolvedProfileAvatar}
                    avatarFallbackUrl={accountAvatarUrl}
                    username={engineState.profileUsername || engineState.profileName}
                    email={session?.user?.email}
                    isPro={isPro}
                    collapsed={legacyCollapsed}
                    onToggleCollapse={() => setLegacyCollapsedPersist(!legacyCollapsed)}
                    onNavigate={navigateTab}
                    onOpenPalette={() => setPaletteOpen(true)}
                    onUpgrade={() => void openCheckout()}
                    onSignOut={() => void useAuthStore.getState().signOut()}
                />
            )}
            {!focuzPassMode && !legacySidebar && (
                <WorkspaceSidebarV2
                    activeTab={activeTab === 'account' ? 'settings' : activeTab}
                    avatarUrl={resolvedProfileAvatar}
                    avatarFallbackUrl={accountAvatarUrl}
                    username={engineState.profileUsername || engineState.profileName}
                    email={session?.user?.email}
                    isPro={isPro}
                    mode={sidebar.mode}
                    onToggleCollapse={() => sidebar.setMode('rail')}
                    onNavigate={sidebarNav}
                    onOpenPalette={() => setPaletteOpen(true)}
                    onUpgrade={() => void openCheckout()}
                    onSignOut={() => void useAuthStore.getState().signOut()}
                />
            )}

            {/* Resize handle */}
            {!focuzPassMode && !legacySidebar && sidebar.mode !== 'hidden' && (
                <div {...sidebar.handleProps} className="sb-resize" />
            )}

            {/* Peek hot zone + overlay (also serves as the narrow-viewport overlay) */}
            {!focuzPassMode && !legacySidebar && (sidebar.peekEnabled || sidebar.overlayOpen) && (
                <>
                    <div className="sb-peek-hotzone" {...sidebar.hotzoneProps} />
                    {sidebar.overlayOpen && (
                        <div className="sb-scrim" data-open="true" onClick={sidebar.closeOverlay} aria-hidden="true" />
                    )}
                    <div className="sb-peek" data-open={sidebar.peekOpen || sidebar.overlayOpen} {...sidebar.peekProps}>
                        <WorkspaceSidebarV2
                            activeTab={activeTab === 'account' ? 'settings' : activeTab}
                            avatarUrl={resolvedProfileAvatar}
                            avatarFallbackUrl={accountAvatarUrl}
                            username={engineState.profileUsername || engineState.profileName}
                            email={session?.user?.email}
                            isPro={isPro}
                            mode="peek"
                            onPin={sidebar.pinPeek}
                            onNavigate={sidebarNav}
                            onOpenPalette={() => setPaletteOpen(true)}
                            onUpgrade={() => void openCheckout()}
                            onSignOut={() => void useAuthStore.getState().signOut()}
                        />
                    </div>
                </>
            )}

            {/* Main Content */}
            <main className="workspace-main flex flex-col min-w-0 relative overflow-hidden">
                {/* Topbar */}
                {!focuzPassMode && <header className="workspace-topbar h-11 shrink-0 px-4 flex items-center justify-between gap-4 sticky top-0 z-50" data-scrolled={contentScrolled}>
                    <div className="flex min-w-0 items-center gap-2">
                        <IconButton
                            icon={<IconPanelLeftOpen />}
                            tooltip="Show sidebar"
                            tooltipSide="bottom"
                            data-visible={legacySidebar ? legacyCollapsed : sidebar.mode === 'hidden' || sidebar.narrow}
                            className="tb-show-sidebar"
                            onClick={
                                legacySidebar
                                    ? () => setLegacyCollapsedPersist(false)
                                    : sidebar.narrow
                                      ? sidebar.openOverlay
                                      : () => sidebar.setMode('expanded')
                            }
                        />
                        <span className="text-title-3 truncate text-[var(--fz-text-1)]">{tabLabel(activeTab === 'account' ? 'settings' : activeTab)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setPaletteOpen(true)}
                            className="group hidden h-7 items-center gap-2 rounded-md border border-[var(--fz-border)] bg-[var(--fz-bg-raised)] pl-2.5 pr-1.5 text-[12px] text-[var(--fz-text-3)] transition-colors hover:border-[var(--fz-border-strong)] hover:text-[var(--fz-text-2)] sm:flex"
                        >
                            <IconSearch size={12} />
                            <span>Search</span>
                            <Kbd className="ml-4">{PALETTE_SHORTCUT_LABEL}</Kbd>
                        </button>
                        {activeTab === 'overview' && (
                            <span className="flex items-center gap-1.5 text-meta text-[var(--fz-text-3)]">
                                <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                Live sync
                            </span>
                        )}
                        {!isWebPlatform() && (
                            <IconButton
                                icon={<IconExternalLink size={14} />}
                                tooltip="Open web dashboard"
                                tooltipSide="bottom"
                                onClick={() => openWebDashboard()}
                            />
                        )}
                        {!isPro && (
                            <Button variant="ghost" size="sm" onClick={() => void openCheckout()}>
                                Upgrade
                            </Button>
                        )}
                    </div>
                </header>}

                <div className={fullHeightTab
                    ? 'flex-1 min-h-0 w-full overflow-hidden'
                    : 'w-full overflow-y-auto scrollbar-hide'}
                    onScroll={(e) => setContentScrolled((e.target as HTMLElement).scrollTop > 0)}
                >
                    <div
                        key={activeTab}
                        className={`${!focuzPassMode ? 'pro-content-fade pro-page-enter' : ''} ${fullHeightTab ? 'h-full' : ''}`}
                    >
                        {fullHeightTab ? renderContent() : (
                            <PageShell
                                title={pageTitle}
                                eyebrow={pageEyebrow}
                                description={headerConfig.description}
                                actions={pageActions}
                                fullBleed={fullBleedTab}
                            >
                                {renderContent()}
                            </PageShell>
                        )}
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
            <Toast message={toastMessage} onDone={() => setToastMessage('')} />
            <DailyFocusMirrorModal
                mirror={futureSelfMirror}
                onClose={() => {
                    if (futureSelfMirror) {
                        try {
                            const key = 'focuznow-future-self-mirror-dismissed';
                            const prev = JSON.parse(localStorage.getItem(key) || '[]') as string[];
                            const next = [...new Set([...prev, futureSelfMirror.id])].slice(-30);
                            localStorage.setItem(key, JSON.stringify(next));
                        } catch {
                            /* ignore */
                        }
                        void chrome.runtime.sendMessage({
                            type: 'FUTURE_SELF_MIRROR_SHOWN',
                            id: futureSelfMirror.id,
                        });
                    }
                    setFutureSelfMirror(null);
                }}
            />

            {hostBookings.open && (
                <BookingNotificationModal bookings={hostBookings.bookings} onDismiss={hostBookings.dismiss} onView={() => navigateTab('calendar')} />
            )}

            <ProFocusToast message={focusToast} onDone={() => setFocusToast('')} />

            {/* Modals */}
            <Dialog
                open={showEndSession}
                onClose={() => setShowEndSession(false)}
                title="End session?"
                size="sm"
                footer={
                    <>
                        <Button variant="ghost" size="md" onClick={() => setShowEndSession(false)}>Cancel</Button>
                        <Button variant="danger" size="md" onClick={() => useAuthStore.getState().signOut()}>End Session</Button>
                    </>
                }
            >
                <p className="text-body-sm text-[var(--fz-text-2)]">Are you sure you want to end your session? This will lock the dashboard until you authenticate again.</p>
            </Dialog>
        </div>
    );
};

export default OptionsApp;
