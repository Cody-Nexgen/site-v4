import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import { useAuthStore } from '../lib/store';
import { Play, Maximize2, ShieldAlert, Zap, CalendarDays, Command } from 'lucide-react';
import { Brand } from '../components/shell/Brand';
import { ShellButton } from '../components/shell/ui';
import { BookingNotificationModal } from '../components/BookingNotificationModal';
import { useHostBookingNotifications } from '../hooks/useHostBookingNotifications';

const PEEK_FEATURES = [
    { icon: Zap, label: 'Nuclear Lockdown', hint: 'Block everything for a set time' },
    { icon: CalendarDays, label: 'Focus Calendar', hint: 'Schedule deep work blocks' },
    { icon: Command, label: 'Command palette', hint: '⌘K to jump anywhere' },
] as const;

function PopupPeek() {
    const [idx, setIdx] = useState(0);
    const f = PEEK_FEATURES[idx];
    const Icon = f.icon;

    useEffect(() => {
        const t = window.setInterval(() => setIdx((i) => (i + 1) % PEEK_FEATURES.length), 3200);
        return () => window.clearInterval(t);
    }, []);

    const openDashboard = () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('src/options/index.html') });
        window.close();
    };

    return (
        <div className="relative z-10 flex h-full flex-col">
            <Brand size="sm" className="mb-5" glow showRotatingWord />

            <div className="relative mb-4 overflow-hidden rounded-xl border border-white/[0.08] bg-black/40">
                <div className="grid grid-cols-2 gap-2 p-2.5">
                    <div className="focuz-popup-stat p-3 text-center">
                        <p className="text-xl font-semibold tabular-nums text-violet-400">—</p>
                        <p className="mt-1 text-[10px] font-medium text-neutral-500">Streak</p>
                    </div>
                    <div className="focuz-popup-stat p-3 text-center">
                        <p className="text-xl font-semibold tabular-nums text-neutral-300">—</p>
                        <p className="mt-1 text-[10px] font-medium text-neutral-500">Blocks</p>
                    </div>
                </div>
                <div className="border-t border-white/[0.06] bg-white/[0.02] px-3 py-2.5 flex items-center gap-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/15 ring-1 ring-violet-500/25">
                        <Icon size={14} className="text-violet-300" strokeWidth={2} />
                    </span>
                    <div className="min-w-0">
                        <p className="text-xs font-medium text-white truncate">{f.label}</p>
                        <p className="text-[10px] text-neutral-500 truncate">{f.hint}</p>
                    </div>
                </div>
            </div>

            <p className="mb-4 text-xs text-neutral-500 leading-relaxed">
                Sign in to sync your dashboard, or preview the app first.
            </p>

            <ShellButton
                className="mb-2"
                onClick={() => {
                    chrome.tabs.create({ url: 'https://focuznow.com/#signup' });
                    window.close();
                }}
            >
                Create free account
            </ShellButton>
            <ShellButton variant="secondary" onClick={openDashboard}>
                Preview dashboard
            </ShellButton>
        </div>
    );
}

function PopupDashboard({
    streak,
    blocksCount,
    engineState,
    focusStartTime,
    onOpen,
}: {
    streak: number;
    blocksCount: number;
    engineState: ReturnType<typeof useAuthStore.getState>['engineState'];
    focusStartTime: number | null;
    onOpen: () => void;
}) {
    const isTimerActive = !!focusStartTime;
    const nuclear = engineState?.nuclearState?.active;

    return (
        <div className="relative z-10 flex h-full flex-col">
            <div className="mb-5 flex items-center justify-between">
                <Brand size="sm" glow />
                <button
                    type="button"
                    onClick={onOpen}
                    className="glass-edge-btn flex h-9 w-9 items-center justify-center p-0"
                    aria-label="Open full dashboard"
                >
                    <Maximize2 size={15} className="text-neutral-300" />
                </button>
            </div>

            <div className="mb-3 grid grid-cols-2 gap-2">
                <div className="focuz-popup-stat flex flex-col items-center justify-center py-3.5">
                    <span className="text-2xl font-semibold tabular-nums text-violet-400">{streak}</span>
                    <span className="mt-1 text-[10px] font-medium text-neutral-500">Day streak</span>
                </div>
                <div className="focuz-popup-stat flex flex-col items-center justify-center py-3.5">
                    <span className="text-2xl font-semibold tabular-nums text-neutral-200">{blocksCount}</span>
                    <span className="mt-1 text-[10px] font-medium text-neutral-500">Active blocks</span>
                </div>
            </div>

            <button
                type="button"
                onClick={() => {
                    if (!nuclear && !isTimerActive) {
                        chrome.runtime.sendMessage({ type: 'START_SESSION', duration: 25 });
                    }
                    chrome.tabs.create({ url: chrome.runtime.getURL('src/options/index.html?tab=sessions') });
                    window.close();
                }}
                className="glass-edge-card flex flex-1 flex-col items-center justify-center rounded-xl border border-white/[0.08] p-4 text-center transition-colors hover:bg-white/[0.03]"
            >
                {nuclear ? (
                    <>
                        <ShieldAlert size={28} className="mb-2 text-red-400" strokeWidth={2} />
                        <p className="text-sm font-semibold text-red-300">Lockdown active</p>
                        <p className="mt-1 text-xs text-neutral-500">Distractions blocked</p>
                    </>
                ) : isTimerActive ? (
                    <>
                        <Play size={28} className="mb-2 text-emerald-400" strokeWidth={2} />
                        <p className="text-sm font-semibold text-emerald-300">Session running</p>
                        <p className="mt-1 text-xs text-neutral-500">Open dashboard</p>
                    </>
                ) : (
                    <>
                        <span className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-violet-500/15 ring-1 ring-violet-500/25">
                            <Play size={18} className="ml-0.5 text-violet-300" strokeWidth={2} />
                        </span>
                        <p className="text-sm font-semibold text-white">Start focus session</p>
                        <p className="mt-1 text-xs text-neutral-500">25 minute Pomodoro</p>
                    </>
                )}
            </button>

            <ShellButton className="mt-3" onClick={onOpen}>
                Open dashboard
            </ShellButton>
        </div>
    );
}

const PopupApp = () => {
    const { session, streak, engineState, fetchEngineState, focusStartTime, init } = useAuthStore();
    const hostBookings = useHostBookingNotifications(!!session);

    useEffect(() => {
        chrome.storage.local.get(['blockEngineState', 'streak'], (res) => {
            if (res.blockEngineState) {
                useAuthStore.setState({ engineState: res.blockEngineState as typeof engineState });
            }
            if (res.streak !== undefined && res.streak !== null) {
                useAuthStore.setState({ streak: res.streak as number });
            }
        });
        void init();
        fetchEngineState();
    }, [fetchEngineState, init]);

    const openDashboard = () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('src/options/index.html') });
        window.close();
    };

    const blocksCount = Object.keys(engineState?.blocklist || {}).length;

    return (
        <>
            {hostBookings.open && (
                <BookingNotificationModal bookings={hostBookings.bookings} onDismiss={hostBookings.dismiss} />
            )}
            <div className="focuz-popup w-[320px] h-[380px] bg-[#0a0a0a] p-2">
                <div className="flex h-full flex-col rounded-2xl border border-white/[0.08] bg-[#0c0c0c] p-4 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.8)]">
                    {session ? (
                        <PopupDashboard
                            streak={streak}
                            blocksCount={blocksCount}
                            engineState={engineState}
                            focusStartTime={focusStartTime}
                            onOpen={openDashboard}
                        />
                    ) : (
                        <PopupPeek />
                    )}
                </div>
            </div>
        </>
    );
};

const root = createRoot(document.getElementById('root')!);
root.render(<PopupApp />);
