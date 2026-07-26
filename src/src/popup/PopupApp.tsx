import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import { useAuthStore } from '../lib/store';
import { ExternalLink, Play, ShieldAlert, Wrench } from 'lucide-react';
import { Brand } from '../components/shell/Brand';
import { ShellButton } from '../components/shell/ui';
import { BookingNotificationModal } from '../components/BookingNotificationModal';
import { useHostBookingNotifications } from '../hooks/useHostBookingNotifications';
import { openWebDashboard } from '../lib/workspaceSync';

const EXTENSION_OPTIONS_URL = chrome.runtime.getURL('src/options/index.html');
const SIGNUP_URL = 'https://focuznow.com/login?extension_oauth=1';

function PopupSignedOut() {
    return (
        <div className="relative z-10 flex h-full flex-col">
            <Brand size="sm" className="mb-5" glow showRotatingWord />

            <p className="mb-5 text-xs text-neutral-500 leading-relaxed">
                Block distractions, run Pomodoros, and sync your streak on the web.
            </p>

            <ShellButton
                className="mb-2"
                onClick={() => {
                    chrome.tabs.create({ url: SIGNUP_URL });
                    window.close();
                }}
            >
                Create account
            </ShellButton>
            <ShellButton
                variant="secondary"
                onClick={() => {
                    chrome.tabs.create({ url: EXTENSION_OPTIONS_URL });
                    window.close();
                }}
            >
                Extension tools
            </ShellButton>
        </div>
    );
}

function PopupSignedIn({
    streak,
    blockedToday,
    sessionsToday,
    engineState,
    focusStartTime,
}: {
    streak: number;
    blockedToday: number;
    sessionsToday: number;
    engineState: ReturnType<typeof useAuthStore.getState>['engineState'];
    focusStartTime: number | null;
}) {
    const isTimerActive = !!focusStartTime;
    const nuclear = engineState?.nuclearState?.active;

    const startFocus = () => {
        if (!nuclear && !isTimerActive) {
            chrome.runtime.sendMessage({ type: 'START_SESSION', duration: 25 });
        }
    };

    return (
        <div className="relative z-10 flex h-full flex-col">
            <Brand size="sm" className="mb-4" glow />

            <div className="mb-4 grid grid-cols-3 gap-2">
                <div className="focuz-popup-stat flex flex-col items-center justify-center py-3">
                    <span className="text-xl font-semibold tabular-nums text-violet-400">{streak}</span>
                    <span className="mt-1 text-[10px] font-medium text-neutral-500">Streak</span>
                </div>
                <div className="focuz-popup-stat flex flex-col items-center justify-center py-3">
                    <span className="text-xl font-semibold tabular-nums text-neutral-200">{blockedToday}</span>
                    <span className="mt-1 text-[10px] font-medium text-neutral-500">Blocked</span>
                </div>
                <div className="focuz-popup-stat flex flex-col items-center justify-center py-3">
                    <span className="text-xl font-semibold tabular-nums text-indigo-300">{sessionsToday}</span>
                    <span className="mt-1 text-[10px] font-medium text-neutral-500">Sessions</span>
                </div>
            </div>

            <ShellButton
                className="mb-2"
                icon={<ExternalLink size={14} className="opacity-80" />}
                onClick={() => {
                    openWebDashboard();
                    window.close();
                }}
            >
                Open web dashboard
            </ShellButton>

            <ShellButton
                variant="secondary"
                className="mb-3"
                icon={<Wrench size={14} className="opacity-70" />}
                onClick={() => {
                    chrome.tabs.create({ url: EXTENSION_OPTIONS_URL });
                    window.close();
                }}
            >
                Extension tools
            </ShellButton>

            <button
                type="button"
                onClick={() => {
                    startFocus();
                    chrome.tabs.create({ url: `${EXTENSION_OPTIONS_URL}?tab=sessions` });
                    window.close();
                }}
                className="glass-edge-card flex flex-1 flex-col items-center justify-center rounded-xl border border-white/[0.08] p-3 text-center transition-colors hover:bg-white/[0.03]"
            >
                {nuclear ? (
                    <>
                        <ShieldAlert size={24} className="mb-2 text-red-400" strokeWidth={2} />
                        <p className="text-sm font-semibold text-red-300">Lockdown active</p>
                        <p className="mt-1 text-[11px] text-neutral-500">Distractions blocked</p>
                    </>
                ) : isTimerActive ? (
                    <>
                        <Play size={24} className="mb-2 text-emerald-400" strokeWidth={2} />
                        <p className="text-sm font-semibold text-emerald-300">Session running</p>
                        <p className="mt-1 text-[11px] text-neutral-500">View in extension</p>
                    </>
                ) : (
                    <>
                        <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-violet-500/15 ring-1 ring-violet-500/25">
                            <Play size={16} className="ml-0.5 text-violet-300" strokeWidth={2} />
                        </span>
                        <p className="text-sm font-semibold text-white">Start 25m focus</p>
                        <p className="mt-1 text-[11px] text-neutral-500">Quick Pomodoro</p>
                    </>
                )}
            </button>
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

    const todayStr = new Date().toDateString();
    const sessionsToday =
        engineState.pomodoroSettings?.lastDate === todayStr
            ? engineState.pomodoroSettings?.sessionsCompleted ?? 0
            : 0;
    const blockedToday = engineState.blockedToday ?? 0;

    return (
        <>
            {hostBookings.open && (
                <BookingNotificationModal bookings={hostBookings.bookings} onDismiss={hostBookings.dismiss} />
            )}
            <div className="focuz-popup w-[320px] h-[400px] bg-[#0a0a0a] p-2">
                <div className="flex h-full flex-col rounded-2xl border border-white/[0.08] bg-[#0c0c0c] p-4 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.8)]">
                    {session ? (
                        <PopupSignedIn
                            streak={streak}
                            blockedToday={blockedToday}
                            sessionsToday={sessionsToday}
                            engineState={engineState}
                            focusStartTime={focusStartTime}
                        />
                    ) : (
                        <PopupSignedOut />
                    )}
                </div>
            </div>
        </>
    );
};

const root = createRoot(document.getElementById('root')!);
root.render(<PopupApp />);
