import React, { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '../lib/store';
import {
    IconLayoutDashboard,
    IconBan,
    IconBolt,
    IconLogout,
    IconCalendarStats,
    IconLock,
    IconWorldCheck,
    IconPalette,
    IconBrandYoutube,
    IconBrandInstagram,
    IconBrandTiktok,
    IconUserSearch,
    IconSearch,
    IconX,
    IconTarget,
    IconUser,
    IconNote,
    IconClock,
    IconChecklist,
    IconQuote,
    IconSettings,
    IconPlus,
    IconTrash,
    IconPlayerPlay,
    IconPlayerPause,
    IconRefresh,
    IconCheck,
    IconExternalLink,
    IconCreditCard
} from '@tabler/icons-react';
import CalendarView from './CalendarView';
import { supabase } from '../lib/supabase';

// --- GLASSMORPHISM COMPONENTS ---

const GlassCard = ({ children, className = "", onClick }: { children: React.ReactNode, className?: string, onClick?: (e: React.MouseEvent) => void }) => (
    <div onClick={onClick} className={`bg-neutral-900/40 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl ${className}`}>
        {children}
    </div>
);

const SidebarItem = ({ active, icon: Icon, label, onClick }: any) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center space-x-3 px-4 py-3 rounded-2xl transition-all duration-300 group
            ${active
                ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30 shadow-[0_0_20px_rgba(168,85,247,0.15)]'
                : 'text-neutral-500 hover:bg-white/5 hover:text-neutral-300'}`}
    >
        <Icon size={20} className={active ? 'text-purple-400' : 'text-neutral-500 group-hover:text-neutral-400'} />
        <span className="font-medium text-sm">{label}</span>
        {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)]" />}
    </button>
);

const OnboardingView = () => {
    const { setOnboardingCompleted, setHistoryPermission, importHistory } = useAuthStore();
    const [step, setStep] = useState(1);
    const [historyConsent, setHistoryConsent] = useState(false);
    const [isImporting, setIsImporting] = useState(false);

    const handleComplete = async () => {
        setIsImporting(true);
        try {
            await setHistoryPermission(historyConsent);
            if (historyConsent) {
                await importHistory();
            }
            await setOnboardingCompleted(true);
        } finally {
            setIsImporting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/90 backdrop-blur-3xl animate-in fade-in duration-500">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.15)_0%,transparent_70%)] pointer-events-none" />

            <GlassCard className="w-full max-w-2xl p-12 space-y-10 border-purple-500/30 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-purple-500 to-transparent animate-pulse" />

                {step === 1 && (
                    <div className="space-y-8 animate-in slide-in-from-right duration-500">
                        <div className="w-24 h-24 bg-purple-600/10 rounded-3xl flex items-center justify-center mx-auto shadow-[0_0_50px_rgba(168,85,247,0.3)] ring-1 ring-purple-500/20">
                            <IconLock size={48} className="text-purple-400" />
                        </div>
                        <div className="space-y-4 text-center">
                            <h2 className="text-4xl font-black tracking-tight text-white leading-tight">Welcome to <span className="text-purple-400">FocuzNow</span></h2>
                            <p className="text-neutral-400 text-lg leading-relaxed max-w-md mx-auto">First, please read and accept our Terms of Service to enable Pro features and secure your session.</p>
                        </div>
                        <div className="p-6 bg-white/5 border border-white/10 rounded-3xl text-left h-48 overflow-y-auto scrollbar-hide text-sm text-neutral-400 space-y-4">
                            <p className="font-bold text-white uppercase tracking-widest text-[10px]">Terms of Service</p>
                            <p>By using FocuzNow, you agree to our data processing policies. We prioritize local storage and local-first synchronization.</p>
                            <p>Pro features require valid subscription management and periodic verification with our central engine.</p>
                            <p>You confirm that you will use this tool for personal productivity enhancement and will not attempt to exploit or reverse engineer the blocking mechanisms.</p>
                            <p>We are not responsible for any lost data or productivity loss resulting from the misconfiguration of blocking schedules or Nuclear Lockdowns.</p>
                        </div>
                        <button
                            onClick={() => setStep(2)}
                            className="w-full py-5 bg-white text-black rounded-3xl font-black text-xl hover:bg-neutral-200 transition-all shadow-[0_20px_40px_rgba(255,255,255,0.1)] active:scale-95"
                        >
                            I ACCEPT THE TERMS
                        </button>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-8 animate-in slide-in-from-right duration-500">
                        <div className="w-24 h-24 bg-blue-600/10 rounded-3xl flex items-center justify-center mx-auto shadow-[0_0_50px_rgba(59,130,246,0.3)] ring-1 ring-blue-500/20">
                            <IconWorldCheck size={48} className="text-blue-400" />
                        </div>
                        <div className="space-y-4 text-center">
                            <h2 className="text-4xl font-black tracking-tight text-white leading-tight">Browsing Insights</h2>
                            <p className="text-neutral-400 text-lg leading-relaxed max-w-md mx-auto">Would you like to import your previous browsing history for advanced focus analytics?</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <button
                                onClick={() => setHistoryConsent(false)}
                                className={`p-8 rounded-3xl border transition-all text-center space-y-3 ${!historyConsent ? 'bg-neutral-800 border-neutral-700 text-neutral-400' : 'bg-white/5 border-white/5 text-neutral-600 hover:bg-white/10'}`}
                            >
                                <div className="text-xl font-black">NO, THANKS</div>
                                <p className="text-[10px] uppercase tracking-widest leading-relaxed">Start with a clean slate</p>
                            </button>
                            <button
                                onClick={() => setHistoryConsent(true)}
                                className={`p-8 rounded-3xl border transition-all text-center space-y-3 ${historyConsent ? 'bg-blue-600/20 border-blue-500 text-blue-400 shadow-[0_0_30px_rgba(59,130,246,0.2)]' : 'bg-white/5 border-white/5 text-neutral-600 hover:bg-white/10'}`}
                            >
                                <div className="text-xl font-black uppercase">Import History</div>
                                <p className="text-[10px] uppercase tracking-widest leading-relaxed">Better personalized insights</p>
                            </button>
                        </div>

                        <div className="flex space-x-4">
                            <button onClick={() => setStep(1)} className="flex-1 py-4 bg-white/5 text-neutral-500 rounded-3xl font-bold hover:bg-white/10" disabled={isImporting}>BACK</button>
                            <button
                                onClick={handleComplete}
                                disabled={isImporting}
                                className="flex-[2] py-5 bg-purple-600 text-white rounded-3xl font-black text-xl hover:bg-purple-500 transition-all shadow-[0_20px_40px_rgba(168,85,247,0.2)] active:scale-95 disabled:opacity-50"
                            >
                                {isImporting ? 'IMPORTING...' : 'FINISH ONBOARDING'}
                            </button>
                        </div>
                    </div>
                )}
            </GlassCard>
        </div>
    );
};

const ActivityGraph = () => {
    const { last7DaysStats } = useAuthStore();
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const [selectedDay, setSelectedDay] = useState<typeof last7DaysStats[0] | null>(null);

    // Dynamic Scaling
    const maxTotal = Math.max(...last7DaysStats.map(s => s.total), 60 * 60 * 1000); // minimum 1 hour scale
    const points = last7DaysStats.length ? last7DaysStats.map(s => Math.min(100, (s.total / maxTotal) * 100)) : [0, 0, 0, 0, 0, 0, 0];
    const width = 800;
    const height = 160;
    const padding = 20;

    const getX = (i: number) => padding + (i * (width - 2 * padding) / (Math.max(1, points.length - 1)));
    const getY = (v: number) => height - padding - (v * (height - 2 * padding) / 100);

    const pathData = points.reduce((acc, v, i) => {
        const x = getX(i);
        const y = getY(v);
        if (i === 0) return `M ${x} ${y}`;
        const prevX = getX(i - 1);
        const prevY = getY(points[i - 1]);
        const cpX = (prevX + x) / 2;
        return `${acc} C ${cpX} ${prevY}, ${cpX} ${y}, ${x} ${y}`;
    }, "");

    const formatTime = (ms: number) => {
        const mins = Math.round((ms || 0) / 60000);
        if (mins < 60) return `${mins}m`;
        return `${(mins / 60).toFixed(1)}h`;
    };

    return (
        <div className="w-full h-48 relative pt-4 overflow-visible group">
            {/* Tooltip */}
            {hoveredIndex !== null && last7DaysStats[hoveredIndex] && (
                <div
                    className="absolute z-50 pointer-events-none px-3 py-2 bg-neutral-900 border border-white/10 rounded-xl shadow-2xl animate-in fade-in zoom-in duration-200"
                    style={{
                        left: getX(hoveredIndex),
                        top: getY(points[hoveredIndex]) - 50,
                        transform: 'translateX(-50%)'
                    }}
                >
                    <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">{last7DaysStats[hoveredIndex]?.date?.split(' ').slice(0, 3).join(' ')}</div>
                    <div className="text-lg font-black text-white">{formatTime(last7DaysStats[hoveredIndex]?.total)}</div>
                </div>
            )}

            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
                <defs>
                    <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#9333ea" />
                        <stop offset="50%" stopColor="#ec4899" />
                        <stop offset="100%" stopColor="#9333ea" />
                    </linearGradient>
                    <linearGradient id="fillGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#9333ea" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#9333ea" stopOpacity="0" />
                    </linearGradient>
                </defs>

                {/* Y-Axis Scale */}
                {[0, 50, 100].map(v => (
                    <g key={v}>
                        <line x1={padding} y1={getY(v)} x2={width - padding} y2={getY(v)} stroke="white" strokeOpacity="0.05" />
                        <text x={0} y={getY(v) + 4} className="text-[9px] fill-neutral-600 font-bold">
                            {v === 0 ? '0h' : v === 50 ? formatTime(maxTotal / 2) : formatTime(maxTotal)}
                        </text>
                    </g>
                ))}

                {/* Animated Area Fill */}
                <path
                    d={`${pathData} L ${width - padding} ${height} L ${padding} ${height} Z`}
                    fill="url(#fillGradient)"
                    className="animate-in fade-in duration-1000"
                />

                {/* The Main Path */}
                <path
                    d={pathData}
                    fill="none"
                    stroke="url(#lineGradient)"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="animate-draw"
                    style={{
                        strokeDasharray: 2000,
                        strokeDashoffset: 2000,
                        filter: 'drop-shadow(0 0 10px rgba(168, 85, 247, 0.5))'
                    }}
                />

                {/* Interaction Nodes */}
                {points.map((v, i) => (
                    <g key={i}
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredIndex(i)}
                        onMouseLeave={() => setHoveredIndex(null)}
                        onClick={() => setSelectedDay(last7DaysStats[i])}
                    >
                        <circle
                            cx={getX(i)}
                            cy={getY(v)}
                            r="6"
                            fill="#000"
                            stroke="#9333ea"
                            strokeWidth="2"
                            className="hover:scale-150 transition-all duration-300 opacity-0 group-hover:opacity-100"
                        />
                        <circle
                            cx={getX(i)}
                            cy={getY(v)}
                            r="20"
                            fill="transparent"
                        />
                    </g>
                ))}
            </svg>

            {/* Site Breakdown Modal */}
            {selectedDay && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <GlassCard className="w-full max-w-md p-8 space-y-6 relative border-white/10" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-bold text-white">Daily Breakdown</h3>
                                <p className="text-xs text-neutral-500 font-bold uppercase tracking-widest">{selectedDay?.date}</p>
                            </div>
                            <button onClick={() => setSelectedDay(null)} className="p-2 hover:bg-white/5 rounded-full text-neutral-500">
                                <IconLock size={20} className="hidden" /> {/* Temp hidden to avoid icon conflict if missing */}
                                <span className="text-xl leading-none">&times;</span>
                            </button>
                        </div>

                        <div className="space-y-3 max-h-64 overflow-y-auto pr-2 scrollbar-hide">
                            {selectedDay?.sites && Object.entries(selectedDay.sites).length > 0 ? (
                                Object.entries(selectedDay.sites)
                                    .sort(([, a], [, b]) => b - a)
                                    .slice(0, 10)
                                    .map(([site, time]) => (
                                        <div key={site} className="flex items-center justify-between p-3 bg-white/5 rounded-2xl border border-white/5">
                                            <div className="flex items-center space-x-3">
                                                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-[10px] font-bold text-neutral-400">
                                                    {site[0].toUpperCase()}
                                                </div>
                                                <span className="text-sm font-bold text-white truncate max-w-[150px]">{site}</span>
                                            </div>
                                            <span className="text-xs font-black text-purple-400">{formatTime(time)}</span>
                                        </div>
                                    ))
                            ) : (
                                <div className="text-center text-neutral-500 py-4 font-bold text-sm">No recorded data for today.</div>
                            )}
                        </div>

                        <button
                            onClick={() => setSelectedDay(null)}
                            className="w-full py-4 bg-white text-black rounded-2xl font-black uppercase text-sm hover:bg-neutral-200 transition-colors"
                        >
                            Close
                        </button>
                    </GlassCard>
                </div>
            )}
        </div>
    );
};

const Overview = () => {
    const { streak, engineState, last7DaysStats, importHistory } = useAuthStore();
    const todayTotal = last7DaysStats?.length ? (last7DaysStats[6]?.total || 0) : 0;
    const blockedCount = engineState.blockedToday || 0;
    const formatTime = (ms: number) => {
        const mins = Math.round(ms / 60000);
        if (mins < 60) return `${mins}m`;
        return `${(mins / 60).toFixed(1)}h`;
    };

    // Auto-import history once on mount
    useEffect(() => {
        importHistory();
    }, []);

    return (
        <div className="space-y-6 animate-fade-in-up">
            <h2 className="text-2xl font-bold text-white">Screen Time Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <GlassCard className="p-5 flex flex-col justify-center border-purple-500/20">
                    <span className="text-neutral-500 text-xs font-semibold uppercase tracking-wider">Status</span>
                    <div className="flex items-center mt-2 space-x-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.6)]" />
                        <span className="text-xl font-bold text-white">Active</span>
                    </div>
                </GlassCard>
                <GlassCard className="p-5 flex flex-col justify-center">
                    <span className="text-neutral-500 text-xs font-semibold uppercase tracking-wider">Screen Time Today</span>
                    <span className="text-3xl font-bold text-white mt-1">{formatTime(todayTotal)}</span>
                </GlassCard>
                <GlassCard className="p-5 flex flex-col justify-center">
                    <span className="text-neutral-500 text-xs font-semibold uppercase tracking-wider">Blocked Today</span>
                    <span className="text-3xl font-bold text-white mt-1">{blockedCount}</span>
                </GlassCard>
                <GlassCard className="p-5 flex flex-col justify-center">
                    <span className="text-neutral-500 text-xs font-semibold uppercase tracking-wider">Active Streak</span>
                    <span className="text-3xl font-bold text-purple-400 mt-1">{streak} <span className="text-sm font-normal text-neutral-600">days</span></span>
                </GlassCard>
            </div>

            <GlassCard className="p-8">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h3 className="text-xl font-bold text-white">Screen Time</h3>
                        <p className="text-xs text-neutral-500 mt-1 uppercase tracking-widest font-bold">Past 7 Days</p>
                    </div>
                    <div className="flex items-center space-x-4">
                        <div className="px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center space-x-2">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            <span className="text-[10px] text-green-400 font-bold uppercase tracking-widest">Auto-synced</span>
                        </div>
                        <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 rounded-full bg-purple-500" />
                            <span className="text-[10px] text-neutral-400 font-bold uppercase">Screen Time</span>
                        </div>
                    </div>
                </div>

                <ActivityGraph />

                <div className="flex justify-between mt-6 text-[10px] text-neutral-600 font-black px-4 uppercase tracking-[0.2em]">
                    {last7DaysStats.length ? last7DaysStats.map((s, i) => (
                        <span key={i}>{new Date(s.date).toLocaleDateString('en-US', { weekday: 'short' })}</span>
                    )) : <span>-</span>}
                </div>
            </GlassCard>
        </div>
    );
};

const ChallengeModal = ({ isOpen, onClose, onComplete, phrase }: { isOpen: boolean, onClose: () => void, onComplete: () => void, phrase: string }) => {
    const [input, setInput] = useState('');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
            <GlassCard className="w-full max-w-lg p-8 space-y-6 border-purple-500/30">
                <div className="text-center space-y-2">
                    <h3 className="text-2xl font-black text-white tracking-tight">Focus Challenge</h3>
                    <p className="text-neutral-400 text-sm">Type the phrase below exactly to confirm you truly wish to unblock this site.</p>
                </div>

                <div className="p-6 bg-white/5 border border-white/10 rounded-2xl text-center select-none">
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
                            className={`flex-1 py-4 font-black rounded-2xl transition-all shadow-xl
                                ${input === phrase
                                    ? 'bg-purple-600 text-white shadow-purple-600/20 hover:bg-purple-500'
                                    : 'bg-neutral-800 text-neutral-600 cursor-not-allowed opacity-50'}`}
                        >Confirm Unblock</button>
                    </div>
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

const Blocking = () => {
    const { engineState, fetchEngineState } = useAuthStore();
    const [newBlocked, setNewBlocked] = useState('');
    const [newAllowed, setNewAllowed] = useState('');
    const [challengeState, setChallengeState] = useState<{ isOpen: boolean, domain: string, type: string, phrase: string }>({
        isOpen: false,
        domain: '',
        type: '',
        phrase: ''
    });

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
        <div className="space-y-6 animate-fade-in-up">
            <ChallengeModal
                isOpen={challengeState.isOpen}
                phrase={challengeState.phrase}
                onClose={() => setChallengeState(prev => ({ ...prev, isOpen: false }))}
                onComplete={() => executeAction(challengeState.type, challengeState.domain, 'remove')}
            />

            <h2 className="text-2xl font-bold text-white">Site Management</h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Blocked Sites */}
                <GlassCard className="p-6">
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
                        {Array.from(new Set([
                            ...Object.keys(engineState.blocklist || {}),
                            ...Object.keys(engineState.schedules || {}),
                            ...Object.keys(engineState.timers || {})
                        ])).map(domain => (
                            <div key={domain as string} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5 group hover:border-white/10 transition-all">
                                <span className="text-sm font-medium">{domain}</span>
                                {!engineState.nuclearState?.active && (
                                    <button
                                        onClick={() => triggerAction('block', domain, 'remove')}
                                        className="text-neutral-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                                    >
                                        <IconLogout size={16} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </GlassCard>

                {/* Allowed Sites */}
                <GlassCard className="p-6 border-green-500/10">
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

            <GlassCard className="p-6">
                <h3 className="font-semibold text-white mb-6">Network-wide Categories</h3>
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

const Advanced = () => {
    const { engineState, fetchEngineState } = useAuthStore();
    const [nuclearDuration, setNuclearDuration] = useState(60);

    const startNuclear = async (target: string) => {
        if (!confirm(`Warning: The Nuclear Option cannot be cancelled. Block ${target === 'all' ? 'EVERYTHING' : 'your blocklist'} for ${nuclearDuration} minutes?`)) return;
        await new Promise<void>(r => chrome.runtime.sendMessage({
            type: 'START_NUCLEAR',
            target,
            duration: nuclearDuration
        }, () => r()));
        fetchEngineState();
    };

    return (
        <div className="space-y-6 animate-fade-in-up">
            <h2 className="text-2xl font-bold text-white">Security & Lockdown</h2>

            <GlassCard className="p-10 border-red-500/20 bg-gradient-to-br from-red-600/5 to-transparent">
                <div className="flex items-center space-x-3 mb-6">
                    <div className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center shadow-lg shadow-red-600/40">
                        <IconBolt size={26} className="text-white" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white tracking-tight">The Nuclear Option</h3>
                        <p className="text-sm text-red-500 font-bold uppercase tracking-widest">Maximum Lockdown</p>
                    </div>
                </div>

                {engineState.nuclearState?.active ? (
                    <div className="p-6 bg-red-600/20 border border-red-500/40 rounded-3xl text-center">
                        <span className="text-red-400 font-bold text-lg">NUCLEAR LOCKDOWN ACTIVE</span>
                        <div className="text-3xl font-black text-white mt-2">
                            {Math.max(0, Math.ceil((engineState.nuclearState.endTime - Date.now()) / 60000))} MINUTES REMAINING
                        </div>
                        <p className="text-xs text-red-400/60 mt-4">Un-cancellable by design. Stay focused.</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <p className="text-neutral-400 text-sm leading-relaxed max-w-xl text-center mx-auto">
                            The Nuclear Option is for absolute emergencies. Once activated, it cannot be disabled, even by un-blocking sites or closing the extension, until the timer expires.
                        </p>

                        <div className="flex flex-col items-center space-y-4 w-full max-w-md mx-auto">
                            <div className="flex items-center space-x-2 bg-white/5 border border-white/10 p-2 rounded-2xl w-full">
                                {[15, 30, 60].map(m => (
                                    <button
                                        key={m}
                                        onClick={() => setNuclearDuration(m)}
                                        className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all
                                            ${nuclearDuration === m ? 'bg-white text-black shadow-lg shadow-white/20' : 'text-neutral-500 hover:text-white hover:bg-white/10'}`}
                                    >{m}m</button>
                                ))}
                                <div className="flex items-center bg-black/40 rounded-xl px-2 py-1 border border-white/5 focus-within:border-red-500 transition-all w-24">
                                    <input
                                        type="number"
                                        min="1"
                                        value={nuclearDuration}
                                        onChange={(e) => setNuclearDuration(parseInt(e.target.value) || 1)}
                                        className="w-full bg-transparent text-center text-white font-black text-lg outline-none"
                                        placeholder="Min"
                                    />
                                    <span className="text-neutral-500 font-bold ml-1 text-xs">m</span>
                                </div>
                            </div>

                            <div className="flex space-x-4 w-full">
                                <button
                                    onClick={() => startNuclear('blocked')}
                                    className="flex-1 py-4 bg-white/10 hover:bg-white/20 border border-white/10 rounded-2xl text-xs font-bold transition-all"
                                >BLOCK LIST ONLY</button>
                                <button
                                    onClick={() => startNuclear('all')}
                                    className="flex-1 py-4 bg-white text-black hover:bg-neutral-200 rounded-2xl text-xs font-bold transition-all shadow-xl"
                                >BLOCK EVERYTHING</button>
                            </div>
                        </div>
                    </div>
                )}
            </GlassCard>

            <GlassCard className="p-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-semibold text-white">Unblocking Challenge</h3>
                        <p className="text-xs text-neutral-500 mt-1">Require a typing test before unblocking any site during active hours.</p>
                    </div>
                    <button
                        onClick={async () => {
                            await new Promise<void>(r => chrome.runtime.sendMessage({
                                type: 'UPDATE_ENGINE_SETTINGS',
                                settings: { requireChallenge: !engineState.requireChallenge }
                            }, () => r()));
                            fetchEngineState();
                        }}
                        className={`w-14 h-8 rounded-full transition-all relative ${engineState.requireChallenge ? 'bg-purple-600' : 'bg-neutral-800'}`}
                    >
                        <div className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-all ${engineState.requireChallenge ? 'left-7' : 'left-1'}`} />
                    </button>
                </div>
            </GlassCard>
        </div>
    );
};
const Customization = () => {
    const { engineState, fetchEngineState } = useAuthStore();
    const [showFilterModal, setShowFilterModal] = useState(false);
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
        <div className="space-y-6 animate-fade-in-up">
            <h2 className="text-2xl font-bold text-white">Customization</h2>

            <GlassCard className="p-8">
                <h3 className="font-semibold text-white mb-6 flex items-center space-x-2">
                    <IconPalette size={20} className="text-purple-400" />
                    <span>Blocking Message</span>
                </h3>
                <div className="space-y-4">
                    <p className="text-xs text-neutral-500">This message will appear when you try to visit a blocked site.</p>
                    <textarea
                        value={engineState.redirectMessage}
                        onChange={async (e) => {
                            await new Promise<void>(r => chrome.runtime.sendMessage({
                                type: 'UPDATE_ENGINE_SETTINGS',
                                settings: { redirectMessage: e.target.value }
                            }, () => r()));
                            fetchEngineState();
                        }}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white text-sm focus:border-purple-500 outline-none transition-colors h-32 resize-none"
                    />
                </div>
            </GlassCard>

            <GlassCard className="p-8">
                <h3 className="font-semibold text-white mb-4">Theme</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {['purple', 'emerald', 'amber', 'rose'].map(t => (
                        <button key={t}
                            onClick={async () => {
                                await new Promise<void>(r => chrome.runtime.sendMessage({
                                    type: 'UPDATE_ENGINE_SETTINGS',
                                    settings: { theme: t }
                                }, () => r()));
                                fetchEngineState();
                            }}
                            className={`p-4 border rounded-2xl transition-all ${engineState.theme === t ? `bg-white/20 border-white/50 shadow-lg shadow-white/10` : 'bg-white/5 border-white/10 hover:border-white/30'}`}>
                            <span className="text-sm font-bold text-white capitalize">{t}</span>
                        </button>
                    ))}
                </div>
            </GlassCard>

            <GlassCard className="p-8 space-y-6">
                <h3 className="font-semibold text-white">Focus Engine Features</h3>

                <div className="flex items-center justify-between">
                    <div><span className="font-medium text-white">Draggable Site Timer</span>
                        <p className="text-xs text-neutral-500">Show a visual timer bubble on all sites.</p></div>
                    <button onClick={async () => {
                        await new Promise<void>(r => chrome.runtime.sendMessage({ type: 'UPDATE_ENGINE_SETTINGS', settings: { draggableTimer: !engineState.draggableTimer } }, () => r())); fetchEngineState();
                    }} className={`w-14 h-8 rounded-full transition-all relative ${engineState.draggableTimer ? 'bg-purple-600' : 'bg-neutral-800'}`}>
                        <div className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-all ${engineState.draggableTimer ? 'left-7' : 'left-1'}`} />
                    </button>
                </div>

                <div className="flex items-center justify-between">
                    <div><span className="font-medium text-white">Track Background Audio Playback</span>
                        <p className="text-xs text-neutral-500">Count time for unfocused tabs playing media.</p></div>
                    <button onClick={async () => {
                        await new Promise<void>(r => chrome.runtime.sendMessage({ type: 'UPDATE_ENGINE_SETTINGS', settings: { trackBackgroundAudio: !engineState.trackBackgroundAudio } }, () => r())); fetchEngineState();
                    }} className={`w-14 h-8 rounded-full transition-all relative ${engineState.trackBackgroundAudio ? 'bg-purple-600' : 'bg-neutral-800'}`}>
                        <div className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-all ${engineState.trackBackgroundAudio ? 'left-7' : 'left-1'}`} />
                    </button>
                </div>
            </GlassCard>

            <GlassCard className="p-8 space-y-6">
                <div>
                    <h3 className="font-semibold text-white">In-App Distraction Blocking</h3>
                    <p className="text-xs text-neutral-400 mt-1">Hides addictive elements like Shorts, Reels, and FYPs natively inside the sites.</p>
                </div>

                <div className="space-y-4">
                    {/* YouTube */}
                    <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-4 transition-all">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2"><IconBrandYoutube size={18} className="text-white" /><span className="font-bold text-white">YouTube</span></div>
                            <button
                                onClick={async () => {
                                    await new Promise<void>(r => chrome.runtime.sendMessage({ type: 'UPDATE_ENGINE_SETTINGS', settings: { inAppBlock: { ...engineState.inAppBlock, youtube: !engineState.inAppBlock?.youtube } } }, () => r())); fetchEngineState();
                                }}
                                className={`w-12 h-6 rounded-full transition-all relative ${engineState.inAppBlock?.youtube ? 'bg-purple-600' : 'bg-neutral-800'}`}>
                                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${engineState.inAppBlock?.youtube ? 'left-7' : 'left-1'}`} />
                            </button>
                        </div>
                        {engineState.inAppBlock?.youtube && (
                            <div className="pl-4 border-l-2 border-white/10 flex justify-between items-center animate-fade-in-up">
                                <span className="text-xs text-neutral-400 font-bold uppercase tracking-widest">Block Shorts</span>
                                <button
                                    onClick={async () => {
                                        await new Promise<void>(r => chrome.runtime.sendMessage({ type: 'UPDATE_ENGINE_SETTINGS', settings: { inAppBlock: { ...engineState.inAppBlock, youtubeShorts: !engineState.inAppBlock?.youtubeShorts } } }, () => r())); fetchEngineState();
                                    }}
                                    className={`w-8 h-4 rounded-full transition-all relative ${engineState.inAppBlock?.youtubeShorts ? 'bg-purple-600' : 'bg-neutral-800'}`}>
                                    <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${engineState.inAppBlock?.youtubeShorts ? 'left-4' : 'left-0.5'}`} />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Instagram */}
                    <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-4 transition-all">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2"><IconBrandInstagram size={18} className="text-white" /><span className="font-bold text-white">Instagram</span></div>
                            <button
                                onClick={async () => {
                                    await new Promise<void>(r => chrome.runtime.sendMessage({ type: 'UPDATE_ENGINE_SETTINGS', settings: { inAppBlock: { ...engineState.inAppBlock, instagram: !engineState.inAppBlock?.instagram } } }, () => r())); fetchEngineState();
                                }}
                                className={`w-12 h-6 rounded-full transition-all relative ${engineState.inAppBlock?.instagram ? 'bg-purple-600' : 'bg-neutral-800'}`}>
                                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${engineState.inAppBlock?.instagram ? 'left-7' : 'left-1'}`} />
                            </button>
                        </div>
                        {engineState.inAppBlock?.instagram && (
                            <div className="pl-4 border-l-2 border-white/10 flex justify-between items-center animate-fade-in-up">
                                <span className="text-xs text-neutral-400 font-bold uppercase tracking-widest">Block Reels</span>
                                <button
                                    onClick={async () => {
                                        await new Promise<void>(r => chrome.runtime.sendMessage({ type: 'UPDATE_ENGINE_SETTINGS', settings: { inAppBlock: { ...engineState.inAppBlock, instagramReels: !engineState.inAppBlock?.instagramReels } } }, () => r())); fetchEngineState();
                                    }}
                                    className={`w-8 h-4 rounded-full transition-all relative ${engineState.inAppBlock?.instagramReels ? 'bg-purple-600' : 'bg-neutral-800'}`}>
                                    <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${engineState.inAppBlock?.instagramReels ? 'left-4' : 'left-0.5'}`} />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* TikTok */}
                    <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-4 transition-all">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2"><IconBrandTiktok size={18} className="text-white" /><span className="font-bold text-white">TikTok</span></div>
                            <button
                                onClick={async () => {
                                    await new Promise<void>(r => chrome.runtime.sendMessage({ type: 'UPDATE_ENGINE_SETTINGS', settings: { inAppBlock: { ...engineState.inAppBlock, tiktok: !engineState.inAppBlock?.tiktok } } }, () => r())); fetchEngineState();
                                }}
                                className={`w-12 h-6 rounded-full transition-all relative ${engineState.inAppBlock?.tiktok ? 'bg-purple-600' : 'bg-neutral-800'}`}>
                                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${engineState.inAppBlock?.tiktok ? 'left-7' : 'left-1'}`} />
                            </button>
                        </div>
                    </div>

                    {/* Content Filters */}
                    <div className="p-4 bg-white/5 border border-white/10 rounded-2xl transition-all">
                        <span className="font-bold text-white block mb-2">Content Filtering</span>
                        <p className="text-[10px] text-neutral-500 mb-4 uppercase font-bold tracking-widest">Hide accounts or keywords natively from your feed on these networks.</p>
                        <div className="mt-4">
                            <button
                                onClick={() => setShowFilterModal(true)}
                                className="w-full py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 font-bold text-sm transition-all flex items-center justify-center space-x-2 shadow-lg"
                            >
                                <IconUserSearch size={18} />
                                <span>Add Blocked Account / Keyword</span>
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-4">
                            {(engineState.inAppBlock?.filters || []).map((f: string) => (
                                <div key={f} className="text-xs bg-white/10 border border-white/10 text-white px-3 py-1 rounded-full flex items-center gap-2 font-bold shadow shadow-white/5">
                                    {f}
                                    <button onClick={async () => {
                                        const nv = (engineState.inAppBlock?.filters || []).filter((x: string) => x !== f);
                                        await new Promise<void>(r => chrome.runtime.sendMessage({ type: 'UPDATE_ENGINE_SETTINGS', settings: { inAppBlock: { ...engineState.inAppBlock, filters: nv } } }, () => r()));
                                        fetchEngineState();
                                    }} className="text-neutral-400 hover:text-red-400 transition-colors">×</button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </GlassCard>

            {/* Profile Search Modal */}
            {showFilterModal && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
                    <GlassCard className="w-full max-w-md p-6 animate-fade-in-up">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-white">Block Account / Keyword</h3>
                            <button onClick={() => { setShowFilterModal(false); setMockResults([]); setFilterSearch(''); }} className="text-neutral-500 hover:text-white"><IconX size={20} /></button>
                        </div>

                        {/* Platform Selector */}
                        <div className="flex space-x-2 mb-4">
                            {([
                                { key: 'youtube' as const, icon: IconBrandYoutube, label: 'YouTube', color: 'red' },
                                { key: 'instagram' as const, icon: IconBrandInstagram, label: 'Instagram', color: 'pink' },
                                { key: 'tiktok' as const, icon: IconBrandTiktok, label: 'TikTok', color: 'cyan' },
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
                                    <IconUserSearch size={32} className="mx-auto mb-3" />
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
const Productivity = () => {
    const { engineState, fetchEngineState } = useAuthStore();

    // --- Pomodoro ---
    const defaultPomo = engineState.pomodoroSettings || { focusMin: 25, breakMin: 5, sessionsCompleted: 0, lastDate: '' };
    const [pomoRunning, setPomoRunning] = useState(false);
    const [pomoTimeLeft, setPomoTimeLeft] = useState(defaultPomo.focusMin * 60);
    const [isBreak, setIsBreak] = useState(false);
    const timerRef = useRef<number | null>(null);

    useEffect(() => {
        if (pomoRunning && pomoTimeLeft > 0) {
            timerRef.current = window.setInterval(() => setPomoTimeLeft(t => t - 1), 1000);
            return () => { if (timerRef.current) clearInterval(timerRef.current); };
        }
        if (pomoTimeLeft <= 0 && pomoRunning) {
            setPomoRunning(false);
            if (!isBreak) {
                const updated = { ...defaultPomo, sessionsCompleted: defaultPomo.sessionsCompleted + 1, lastDate: new Date().toDateString() };
                chrome.runtime.sendMessage({ type: 'UPDATE_ENGINE_SETTINGS', settings: { pomodoroSettings: updated } });
                setIsBreak(true);
                setPomoTimeLeft(defaultPomo.breakMin * 60);
            } else {
                setIsBreak(false);
                setPomoTimeLeft(defaultPomo.focusMin * 60);
            }
        }
    }, [pomoRunning, pomoTimeLeft]);

    const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

    // --- Habits ---
    const habits = engineState.habits || [];
    const todayStr = new Date().toDateString();

    const addHabit = async () => {
        const name = prompt("Enter habit name:");
        if (!name) return;
        const updated = [...habits, { id: Date.now(), name, streak: 0, checkins: [] }];
        await new Promise<void>(r => chrome.runtime.sendMessage({ type: 'UPDATE_ENGINE_SETTINGS', settings: { habits: updated } }, () => r()));
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
    };

    const removeHabit = async (id: number) => {
        const updated = habits.filter(h => h.id !== id);
        await new Promise<void>(r => chrome.runtime.sendMessage({ type: 'UPDATE_ENGINE_SETTINGS', settings: { habits: updated } }, () => r()));
        fetchEngineState();
    };

    // --- Scratchpad ---
    const [noteText, setNoteText] = useState(engineState.scratchpad || '');
    const saveNote = async () => {
        await new Promise<void>(r => chrome.runtime.sendMessage({ type: 'UPDATE_ENGINE_SETTINGS', settings: { scratchpad: noteText } }, () => r()));
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
        const updated = planner.map(p => p.id === id ? { ...p, done: !p.done } : p);
        await new Promise<void>(r => chrome.runtime.sendMessage({ type: 'UPDATE_ENGINE_SETTINGS', settings: { dailyPlanner: updated } }, () => r()));
        fetchEngineState();
    };

    const removePlanItem = async (id: number) => {
        const updated = planner.filter(p => p.id !== id);
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
        <div className="space-y-6 animate-fade-in-up">
            <h2 className="text-2xl font-bold text-white">Productivity Tools</h2>

            {/* Pomodoro Timer */}
            <GlassCard className="p-8">
                <div className="flex items-center space-x-3 mb-6">
                    <div className="w-10 h-10 bg-red-500/20 rounded-2xl flex items-center justify-center"><IconClock size={22} className="text-red-400" /></div>
                    <div>
                        <h3 className="font-bold text-white text-lg">Pomodoro Timer</h3>
                        <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">{isBreak ? 'Break Time' : 'Focus Session'} • {defaultPomo.sessionsCompleted} sessions today</p>
                    </div>
                </div>
                <div className="flex flex-col items-center space-y-6">
                    <div className="relative w-48 h-48">
                        <svg className="w-48 h-48 transform -rotate-90" viewBox="0 0 200 200">
                            <circle cx="100" cy="100" r="90" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                            <circle cx="100" cy="100" r="90" fill="none" stroke={isBreak ? '#22c55e' : '#a855f7'} strokeWidth="8" strokeLinecap="round"
                                strokeDasharray={`${2 * Math.PI * 90}`}
                                strokeDashoffset={`${2 * Math.PI * 90 * (1 - pomoTimeLeft / ((isBreak ? defaultPomo.breakMin : defaultPomo.focusMin) * 60))}`}
                                className="transition-all duration-1000" />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-4xl font-black text-white tabular-nums">{formatTime(pomoTimeLeft)}</span>
                        </div>
                    </div>
                    <div className="flex space-x-3">
                        <button onClick={() => setPomoRunning(!pomoRunning)}
                            className={`px-8 py-3 rounded-2xl font-bold text-sm transition-all active:scale-95 ${pomoRunning ? 'bg-white/10 text-white border border-white/10' : 'bg-white text-black shadow-xl'}`}>
                            {pomoRunning ? <><IconPlayerPause size={16} className="inline mr-2" />PAUSE</> : <><IconPlayerPlay size={16} className="inline mr-2" />START</>}
                        </button>
                        <button onClick={() => { setPomoRunning(false); setIsBreak(false); setPomoTimeLeft(defaultPomo.focusMin * 60); }}
                            className="px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm font-bold text-neutral-400 hover:text-white transition-all">
                            <IconRefresh size={16} />
                        </button>
                    </div>
                </div>
            </GlassCard>

            {/* Habit Tracker */}
            <GlassCard className="p-8">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-green-500/20 rounded-2xl flex items-center justify-center"><IconChecklist size={22} className="text-green-400" /></div>
                        <div>
                            <h3 className="font-bold text-white text-lg">Habit Tracker</h3>
                            <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">Build consistency with daily check-ins</p>
                        </div>
                    </div>
                    <button onClick={addHabit} className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-xs font-bold text-white transition-all"><IconPlus size={14} className="inline mr-1" />ADD</button>
                </div>
                {habits.length === 0 ? (
                    <p className="text-neutral-600 text-sm text-center py-6">No habits yet. Click ADD to create your first one.</p>
                ) : (
                    <div className="space-y-3">
                        {habits.map((h: any) => {
                            const checkedToday = h.checkins?.includes(todayStr);
                            return (
                                <div key={h.id} className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl group">
                                    <div className="flex items-center space-x-3">
                                        <button onClick={() => checkInHabit(h.id)}
                                            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${checkedToday ? 'bg-green-500 text-white' : 'bg-white/10 text-neutral-500 hover:bg-green-500/20'}`}>
                                            {checkedToday && <IconCheck size={16} />}
                                        </button>
                                        <div>
                                            <p className={`text-sm font-bold ${checkedToday ? 'text-green-400' : 'text-white'}`}>{h.name}</p>
                                            <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">{h.streak} day streak</p>
                                        </div>
                                    </div>
                                    <button onClick={() => removeHabit(h.id)} className="opacity-0 group-hover:opacity-100 text-neutral-600 hover:text-red-400 transition-all"><IconTrash size={16} /></button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </GlassCard>

            {/* Notes / Scratchpad */}
            <GlassCard className="p-8">
                <div className="flex items-center space-x-3 mb-6">
                    <div className="w-10 h-10 bg-blue-500/20 rounded-2xl flex items-center justify-center"><IconNote size={22} className="text-blue-400" /></div>
                    <div>
                        <h3 className="font-bold text-white text-lg">Focus Notes</h3>
                        <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">Quick scratchpad for ideas during sessions</p>
                    </div>
                </div>
                <textarea
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    onBlur={saveNote}
                    className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white text-sm focus:border-purple-500 outline-none transition-colors h-40 resize-none font-mono"
                    placeholder="Type your notes here... auto-saves on blur."
                />
            </GlassCard>

            {/* Daily Planner */}
            <GlassCard className="p-8">
                <div className="flex items-center space-x-3 mb-6">
                    <div className="w-10 h-10 bg-amber-500/20 rounded-2xl flex items-center justify-center"><IconTarget size={22} className="text-amber-400" /></div>
                    <div>
                        <h3 className="font-bold text-white text-lg">Daily Planner</h3>
                        <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">Time-boxed task list for your day</p>
                    </div>
                </div>
                <div className="flex space-x-3 mb-4">
                    <input type="time" value={newPlanTime} onChange={e => setNewPlanTime(e.target.value)}
                        className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-purple-500 transition-colors w-28" />
                    <input value={newPlanTask} onChange={e => setNewPlanTask(e.target.value)} onKeyDown={e => e.key === 'Enter' && addPlanItem()}
                        placeholder="What needs to get done?"
                        className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white text-sm outline-none focus:border-purple-500 transition-colors" />
                    <button onClick={addPlanItem} className="px-4 py-2 bg-white text-black rounded-xl font-bold text-sm hover:bg-neutral-200 transition-all active:scale-95">ADD</button>
                </div>
                <div className="space-y-2">
                    {planner.map((p: any) => (
                        <div key={p.id} className="flex items-center space-x-3 p-3 bg-white/5 border border-white/10 rounded-xl group">
                            <button onClick={() => togglePlanItem(p.id)} className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${p.done ? 'bg-green-500 text-white' : 'bg-white/10'}`}>
                                {p.done && <IconCheck size={14} />}
                            </button>
                            <span className="text-xs font-bold text-purple-400 w-14">{p.time}</span>
                            <span className={`flex-1 text-sm ${p.done ? 'line-through text-neutral-600' : 'text-white'}`}>{p.task}</span>
                            <button onClick={() => removePlanItem(p.id)} className="opacity-0 group-hover:opacity-100 text-neutral-600 hover:text-red-400 transition-all"><IconTrash size={14} /></button>
                        </div>
                    ))}
                    {planner.length === 0 && <p className="text-neutral-600 text-sm text-center py-4">Plan your day. Add tasks above.</p>}
                </div>
            </GlassCard>

            {/* Focus Quote */}
            <GlassCard className="p-8">
                <div className="flex items-center space-x-3 mb-4">
                    <div className="w-10 h-10 bg-purple-500/20 rounded-2xl flex items-center justify-center"><IconQuote size={22} className="text-purple-400" /></div>
                    <h3 className="font-bold text-white text-lg">Daily Focus Quote</h3>
                </div>
                <blockquote className="text-lg text-neutral-300 italic leading-relaxed border-l-4 border-purple-500/30 pl-6 py-2">
                    "{todayQuote}"
                </blockquote>
                <button onClick={toggleSaveQuote}
                    className={`mt-4 px-4 py-2 rounded-xl text-xs font-bold transition-all ${isQuoteSaved ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30' : 'bg-white/5 border border-white/10 text-neutral-400 hover:text-white hover:bg-white/10'}`}>
                    {isQuoteSaved ? '★ SAVED' : '☆ SAVE QUOTE'}
                </button>
            </GlassCard>
        </div>
    );
};

// =========================================================
// ACCOUNT SETTINGS
// =========================================================
const AccountSettings = () => {
    const { session, engineState, fetchEngineState, subscriptionTier, signOut } = useAuthStore();
    const [displayName, setDisplayName] = useState(engineState.profileName || session?.user?.email || '');
    const [portalLoading, setPortalLoading] = useState(false);
    const isPro = subscriptionTier === 'pro';

    const saveName = async () => {
        await new Promise<void>(r => chrome.runtime.sendMessage({
            type: 'UPDATE_ENGINE_SETTINGS',
            settings: { profileName: displayName }
        }, () => r()));
        fetchEngineState();
    };

    const uploadAvatar = () => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                const reader = new FileReader();
                reader.onloadend = async () => {
                    await new Promise<void>(r => chrome.runtime.sendMessage({
                        type: 'UPDATE_ENGINE_SETTINGS',
                        settings: { profileAvatar: reader.result as string }
                    }, () => r()));
                    fetchEngineState();
                };
                reader.readAsDataURL(file);
            }
        };
        fileInput.click();
    };

    const openStripePortal = async () => {
        setPortalLoading(true);
        try {
            const { data, error } = await supabase.functions.invoke('create-portal-session', {
                body: { return_url: window.location.href }
            });
            if (data?.url) window.open(data.url, '_blank');
            else console.error('Portal error:', error);
        } catch (e) { console.error('Portal failed:', e); }
        setPortalLoading(false);
    };

    return (
        <div className="space-y-6 animate-fade-in-up">
            <h2 className="text-2xl font-bold text-white">Account Settings</h2>

            {/* Avatar + Name */}
            <GlassCard className="p-8">
                <div className="flex items-center space-x-6 mb-8">
                    <div onClick={uploadAvatar} className="w-20 h-20 bg-neutral-800 rounded-full flex items-center justify-center border-2 border-white/10 cursor-pointer hover:border-purple-500 transition-colors overflow-hidden relative group">
                        {engineState.profileAvatar ? (
                            <img src={engineState.profileAvatar} className="w-full h-full object-cover" alt="Avatar" />
                        ) : (
                            <span className="text-3xl font-black">{session?.user?.email?.[0].toUpperCase()}</span>
                        )}
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <IconUser size={24} className="text-white" />
                        </div>
                    </div>
                    <div className="flex-1">
                        <p className="text-[10px] uppercase tracking-widest font-bold text-neutral-600 mb-2">Display Name</p>
                        <div className="flex space-x-3">
                            <input value={displayName} onChange={e => setDisplayName(e.target.value)} onBlur={saveName}
                                className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none focus:border-purple-500 transition-colors" />
                        </div>
                    </div>
                </div>
                <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                    <p className="text-[10px] uppercase tracking-widest font-bold text-neutral-600 mb-1">Email</p>
                    <p className="text-sm text-white font-mono">{session?.user?.email}</p>
                </div>
            </GlassCard>

            {/* Subscription Management */}
            <GlassCard className="p-8">
                <div className="flex items-center space-x-3 mb-6">
                    <div className="w-10 h-10 bg-purple-500/20 rounded-2xl flex items-center justify-center">
                        <IconCreditCard size={22} className="text-purple-400" />
                    </div>
                    <div>
                        <h3 className="font-bold text-white text-lg">Subscription</h3>
                        <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">Current Plan: {isPro ? 'PRO' : 'FREE'}</p>
                    </div>
                </div>
                {isPro ? (
                    <div className="space-y-4">
                        <div className="p-4 bg-purple-600/10 border border-purple-500/20 rounded-2xl">
                            <p className="text-sm text-purple-400 font-bold">You are on the Pro plan ✦</p>
                            <p className="text-xs text-purple-400/60 mt-1">Advanced blocking, scheduling, and all premium features are active.</p>
                        </div>
                        <button onClick={openStripePortal} disabled={portalLoading}
                            className="w-full py-4 bg-white/10 hover:bg-white/20 border border-white/10 rounded-2xl font-bold text-sm text-white transition-all flex items-center justify-center space-x-2 active:scale-[0.98]">
                            {portalLoading ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <><IconExternalLink size={16} /><span>MANAGE SUBSCRIPTION</span></>
                            )}
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <p className="text-sm text-neutral-400">Upgrade to Pro to unlock advanced blocking, scheduling, and all premium features.</p>
                        <button onClick={async () => {
                            const { data } = await supabase.functions.invoke('create-checkout-session', {
                                body: { return_url: 'https://focuznow.com' }
                            });
                            if (data?.url) window.location.href = data.url;
                        }} className="w-full py-4 bg-white text-black rounded-2xl font-bold text-sm hover:bg-neutral-200 transition-all shadow-xl active:scale-[0.98]">
                            UPGRADE TO PRO
                        </button>
                    </div>
                )}
            </GlassCard>

            {/* Danger Zone */}
            <GlassCard className="p-8 border-red-500/10">
                <h3 className="font-bold text-red-400 mb-4">Danger Zone</h3>
                <button onClick={signOut}
                    className="px-6 py-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl font-bold text-sm hover:bg-red-500/20 transition-all">
                    SIGN OUT
                </button>
            </GlassCard>
        </div>
    );
};


const LoginRequired = () => (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-center p-6 space-y-8">
        <div className="w-20 h-20 bg-gradient-to-tr from-purple-600 to-indigo-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-purple-500/40 animate-bounce">
            <IconLock size={40} className="text-white" />
        </div>
        <div className="space-y-3">
            <h1 className="text-4xl font-black text-white tracking-tight">FocuzNow Required</h1>
            <p className="text-neutral-500 max-w-md mx-auto leading-relaxed">
                To sync your focus progress and access premium blocking features, please sign in through our dashboard.
            </p>
        </div>
        <button
            onClick={() => window.open('http://localhost:3000/login', '_blank')}
            className="px-10 py-5 bg-white text-black rounded-3xl font-black text-lg hover:bg-neutral-200 transition-all shadow-[0_20px_40px_rgba(255,255,255,0.1)] active:scale-95"
        >
            SIGN IN TO CONTINUE
        </button>
        <p className="text-xs text-neutral-600 uppercase tracking-widest font-bold">Free & Pro plans available</p>
    </div>
);

const BlockedView = ({ url }: { url: string }) => {
    const { engineState } = useAuthStore();
    const [domain, setDomain] = useState('');

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

    const isNuclear = engineState.nuclearState?.active;

    return (
        <div className="min-h-screen bg-black flex items-center justify-center p-6 text-white font-sans">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.1)_0%,transparent_70%)] pointer-events-none" />

            <GlassCard className="w-full max-w-xl p-10 space-y-8 border-purple-500/20 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 animate-gradient-x" />

                <div className="space-y-4">
                    <div className="w-24 h-24 bg-purple-600/10 rounded-full flex items-center justify-center mx-auto shadow-[0_0_50px_rgba(168,85,247,0.3)] ring-1 ring-purple-500/20">
                        {isNuclear ? <IconBolt size={48} className="text-purple-400" /> : <IconLock size={48} className="text-purple-400" />}
                    </div>
                    <div className="space-y-2">
                        <h1 className="text-4xl font-black tracking-tight bg-gradient-to-br from-white to-neutral-500 bg-clip-text text-transparent">
                            {isNuclear ? 'NUCLEAR LOCKDOWN' : 'Restricted Access'}
                        </h1>
                        <p className="text-neutral-500 font-medium italic">"{engineState.redirectMessage}"</p>
                    </div>
                </div>

                <div className="py-6 px-10 bg-white/5 rounded-3xl border border-white/10 mx-auto max-w-sm">
                    <p className="text-[10px] uppercase tracking-widest font-black text-neutral-600 mb-2">Restricted Area</p>
                    <p className="text-lg font-mono font-bold text-purple-300 truncate">{domain}</p>
                </div>

                <div className="space-y-4 pt-4">
                    <button
                        onClick={() => window.history.back()}
                        className="w-full py-5 bg-white text-black rounded-3xl font-black text-lg hover:bg-neutral-200 transition-all shadow-[0_20px_40px_rgba(255,255,255,0.1)] active:scale-95 flex items-center justify-center"
                    >
                        GO BACK TO WORK
                    </button>

                    {!isNuclear && (
                        <button
                            onClick={() => window.location.href = chrome.runtime.getURL('src/options/index.html')}
                            className="w-full py-4 bg-white/5 text-neutral-500 rounded-3xl font-bold text-sm hover:bg-white/10 transition-all"
                        >
                            Review Extension Settings
                        </button>
                    )}

                    <p className="text-[10px] text-neutral-700 uppercase tracking-[0.2em] font-black">Powered by FocuzNow Precision Engine</p>
                </div>
            </GlassCard>
        </div>
    );
};

const OptionsApp = () => {
    const { session, loading, init, fetchEngineState, onboardingCompleted, engineState, subscriptionTier } = useAuthStore();
    const isPro = subscriptionTier === 'pro';
    const [activeTab, setActiveTab] = useState('overview');
    const [view, setView] = useState<'app' | 'blocked'>('app');
    const [blockedUrl, setBlockedUrl] = useState('');
    const [showEndSession, setShowEndSession] = useState(false);
    const [showProDialog, setShowProDialog] = useState(false);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('view') === 'blocked') {
            setView('blocked');
            setBlockedUrl(params.get('url') || '');
        }

        const prepare = async () => {
            await init();
            await fetchEngineState();
        };
        prepare();
    }, []);

    useEffect(() => {
        if (engineState?.theme) {
            document.documentElement.setAttribute('data-theme', engineState.theme);
        }
    }, [engineState?.theme]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-black">
                <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (view === 'blocked') {
        return <BlockedView url={blockedUrl} />;
    }

    if (!session) {
        return <LoginRequired />;
    }

    if (!onboardingCompleted) {
        return <OnboardingView />;
    }

    const renderContent = () => {
        switch (activeTab) {
            case 'overview': return <Overview />;
            case 'blocking': return <Blocking />;
            case 'schedule': return <CalendarView />;
            case 'productivity': return <Productivity />;
            case 'advanced': return <Advanced />;
            case 'customization': return <Customization />;
            case 'account': return <AccountSettings />;
            default: return <Overview />;
        }
    };

    return (
        <div className="flex min-h-screen bg-black text-white selection:bg-purple-500/30">
            {/* Sidebar */}
            <div className="w-72 border-r border-white/5 p-6 flex flex-col space-y-8 bg-neutral-900/20">
                <div className="flex items-center space-x-3 px-2">
                    <div className="w-10 h-10 bg-gradient-to-tr from-purple-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-600/20">
                        <IconBolt size={24} className="text-white" />
                    </div>
                    <span className="text-xl font-black tracking-tighter">FocuzNow</span>
                </div>

                <div className="space-y-6 pt-4">
                    {/* User Profile */}
                    <div
                        onClick={() => setActiveTab('account')}
                        className="px-2 py-4 bg-white/5 border border-white/10 rounded-3xl text-center space-y-3 cursor-pointer hover:bg-white/10 transition-colors"
                        title="Account Settings"
                    >
                        <div className="w-12 h-12 bg-neutral-800 rounded-full mx-auto flex items-center justify-center border border-white/10 overflow-hidden relative">
                            {engineState.profileAvatar ? (
                                <img src={engineState.profileAvatar} className="w-full h-full object-cover absolute inset-0" alt="Profile" />
                            ) : (
                                <span className="text-lg font-black">{engineState.profileInitial || session.user?.email?.[0].toUpperCase()}</span>
                            )}
                        </div>
                        <div className="space-y-0.5">
                            <p className="text-[10px] uppercase tracking-widest font-black text-neutral-600">Sync Active</p>
                            <p className="text-xs font-bold truncate px-2">{engineState.profileName || session.user?.email}</p>
                        </div>
                    </div>

                    <nav className="space-y-1">
                        <SidebarItem active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={IconLayoutDashboard} label="Overview" />
                        <SidebarItem active={activeTab === 'blocking'} onClick={() => setActiveTab('blocking')} icon={IconBan} label="Site Blocker" />
                        <SidebarItem active={activeTab === 'schedule'} onClick={() => setActiveTab('schedule')} icon={IconCalendarStats} label="Schedules" />
                        <SidebarItem active={activeTab === 'productivity'} onClick={() => setActiveTab('productivity')} icon={IconTarget} label="Productivity" />
                        <SidebarItem active={activeTab === 'advanced'} onClick={() => setActiveTab('advanced')} icon={IconBolt} label="Security Core" />
                        <SidebarItem active={activeTab === 'customization'} onClick={() => setActiveTab('customization')} icon={IconPalette} label="Identity" />
                        <SidebarItem active={activeTab === 'account'} onClick={() => setActiveTab('account')} icon={IconSettings} label="Account" />
                    </nav>
                </div>

                <div className="mt-auto space-y-4">
                    <button
                        onClick={() => setShowEndSession(true)}
                        className="w-full flex items-center space-x-3 px-4 py-3 rounded-2xl text-neutral-500 hover:bg-red-500/10 hover:text-red-400 transition-all group"
                    >
                        <IconLogout size={18} />
                        <span className="text-sm font-medium">End Session</span>
                    </button>
                    {isPro ? (
                        <div onClick={() => setShowProDialog(true)} className="px-4 py-3 bg-purple-600/10 border border-purple-500/20 rounded-2xl cursor-pointer hover:bg-purple-600/20 transition-all group">
                            <p className="text-[10px] font-black uppercase tracking-widest text-purple-500 mb-1 group-hover:text-purple-400 transition-colors">PRO ENABLED</p>
                            <p className="text-[10px] text-purple-400/60 leading-tight">Advanced blocking & persistence active.</p>
                        </div>
                    ) : (
                        <div onClick={async (e) => {
                            const btn = e.currentTarget;
                            btn.style.opacity = '0.5';
                            try {
                                const { data, error } = await supabase.functions.invoke('create-checkout-session', {
                                    body: { return_url: 'https://focuznow.com' }
                                });
                                if (data?.url) {
                                    window.location.href = data.url;
                                } else {
                                    alert('Error connecting to billing servers: ' + (error?.message || 'Missing Configuration'));
                                    btn.style.opacity = '1';
                                }
                            } catch (e) {
                                alert('Network error occurred.');
                                btn.style.opacity = '1';
                            }
                        }} className="px-4 py-3 bg-gradient-to-tr from-purple-600/50 to-indigo-600/50 border border-white/20 rounded-2xl cursor-pointer hover:from-purple-600 hover:to-indigo-600 transition-all group shadow-lg shadow-purple-500/20">
                            <p className="text-[10px] font-black uppercase tracking-widest text-white mb-1">UPGRADE TO PRO</p>
                            <p className="text-[10px] text-white/80 leading-tight">Unlock cloud sync & advanced blocking.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <main className="flex-1 p-12 max-w-5xl overflow-y-auto scrollbar-hide">
                {renderContent()}
            </main>

            {/* Modals */}
            {showEndSession && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <GlassCard className="max-w-md w-full p-8 space-y-6 animate-fade-in-up">
                        <h3 className="text-xl font-bold text-white">End Session?</h3>
                        <p className="text-neutral-400 text-sm">Are you sure you want to end your session? This will lock the dashboard until you authenticate again.</p>
                        <div className="flex space-x-3 pt-4">
                            <button onClick={() => setShowEndSession(false)} className="flex-1 py-3 bg-white/5 border border-white/10 text-white rounded-xl font-bold hover:bg-white/10 transition-all">Cancel</button>
                            <button onClick={() => useAuthStore.getState().signOut()} className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-red-600/30">End Session</button>
                        </div>
                    </GlassCard>
                </div>
            )}

            {showProDialog && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <GlassCard className="max-w-md w-full p-8 text-center space-y-6 animate-fade-in-up">
                        <div className="mx-auto w-16 h-16 bg-purple-600/20 text-purple-500 rounded-2xl flex items-center justify-center border border-purple-500/30 shadow-lg shadow-purple-600/20">
                            <IconBolt size={32} />
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-white tracking-tight leading-loose">Pro Features Active</h3>
                            <p className="text-neutral-400 text-sm mt-3 leading-relaxed">You are currently enjoying advanced blocking heuristics, unlimited schedule generation, and maximum persistence locking.</p>
                        </div>
                        <button onClick={() => setShowProDialog(false)} className="w-full py-4 bg-purple-600 text-white rounded-2xl font-bold hover:bg-purple-500 transition-all shadow-xl shadow-purple-600/20 mt-4">Return</button>
                    </GlassCard>
                </div>
            )}
        </div>
    );
};

export default OptionsApp;
