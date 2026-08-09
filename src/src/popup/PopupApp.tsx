import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import { useAuthStore } from '../lib/store';
import {
    ExternalLink,
    Flame,
    LayoutDashboard,
    Play,
    ShieldAlert,
    ShieldBan,
    Timer,
    Wrench,
} from 'lucide-react';
import { openWebDashboard } from '../lib/workspaceSync';

const EXTENSION_OPTIONS_URL = chrome.runtime.getURL('src/options/index.html');
const SIGNUP_URL = 'https://focuznow.com/login?extension_oauth=1';
const ICON_URL = chrome.runtime.getURL('public/icons/icon-128.png');

function PopupBrand({ subtitle }: { subtitle?: string }) {
    return (
        <div className="focuz-popup-brand flex items-center gap-3 min-w-0">
            <div className="focuz-popup-mark relative shrink-0">
                <img src={ICON_URL} alt="" width={36} height={36} className="h-9 w-9 rounded-[10px]" />
            </div>
            <div className="min-w-0">
                <p className="focuz-popup-wordmark text-[17px] font-semibold tracking-tight text-white leading-none">
                    Focuz<span className="text-neutral-400">Now</span>
                </p>
                {subtitle ? (
                    <p className="mt-1 text-[11px] text-neutral-500 truncate">{subtitle}</p>
                ) : null}
            </div>
        </div>
    );
}

function PopupSignedOut() {
    return (
        <div className="relative z-10 flex h-full flex-col">
            <PopupBrand subtitle="Focus that sticks" />

            <div className="mt-7 flex-1">
                <h1 className="focuz-popup-hero text-[26px] font-semibold tracking-tight text-white leading-[1.15]">
                    Block noise.
                    <br />
                    Keep the streak.
                </h1>
                <p className="mt-3 text-[12.5px] leading-relaxed text-neutral-500">
                    Site blocking, Pomodoros, and your dashboard — synced when you sign in.
                </p>
            </div>

            <div className="mt-auto space-y-2">
                <button
                    type="button"
                    className="focuz-popup-cta w-full"
                    onClick={() => {
                        chrome.tabs.create({ url: SIGNUP_URL });
                        window.close();
                    }}
                >
                    Continue with account
                </button>
                <button
                    type="button"
                    className="focuz-popup-ghost w-full"
                    onClick={() => {
                        chrome.tabs.create({ url: EXTENSION_OPTIONS_URL });
                        window.close();
                    }}
                >
                    <Wrench size={14} className="opacity-70" />
                    Extension tools
                </button>
            </div>
        </div>
    );
}

function PopupSignedIn({
    streak,
    blockedToday,
    sessionsToday,
    displayName,
    nuclear,
    isTimerActive,
}: {
    streak: number;
    blockedToday: number;
    sessionsToday: number;
    displayName: string;
    nuclear: boolean;
    isTimerActive: boolean;
}) {
    const greeting = (() => {
        const h = new Date().getHours();
        if (h < 12) return 'Good morning';
        if (h < 18) return 'Good afternoon';
        return 'Good evening';
    })();

    const openSessions = (start: boolean) => {
        if (start && !nuclear && !isTimerActive) {
            chrome.runtime.sendMessage({ type: 'START_SESSION', duration: 25 });
        }
        chrome.tabs.create({ url: `${EXTENSION_OPTIONS_URL}?tab=sessions` });
        window.close();
    };

    return (
        <div className="relative z-10 flex h-full flex-col">
            <div className="flex items-start justify-between gap-3">
                <PopupBrand subtitle={`${greeting}, ${displayName}`} />
                {nuclear ? (
                    <span className="focuz-popup-pill focuz-popup-pill-danger shrink-0">
                        <ShieldAlert size={11} />
                        Lockdown
                    </span>
                ) : isTimerActive ? (
                    <span className="focuz-popup-pill focuz-popup-pill-live shrink-0">
                        <span className="focuz-popup-live-dot" />
                        Live
                    </span>
                ) : null}
            </div>

            <button
                type="button"
                onClick={() => openSessions(!isTimerActive && !nuclear)}
                className="focuz-popup-focus mt-5 flex flex-1 flex-col items-center justify-center text-center"
            >
                {nuclear ? (
                    <>
                        <span className="focuz-popup-focus-icon focuz-popup-focus-icon-danger">
                            <ShieldAlert size={22} strokeWidth={2} />
                        </span>
                        <p className="mt-3 text-[15px] font-semibold text-red-200">Lockdown active</p>
                        <p className="mt-1 text-[11px] text-neutral-500">Distractions are blocked</p>
                    </>
                ) : isTimerActive ? (
                    <>
                        <span className="focuz-popup-focus-icon focuz-popup-focus-icon-live">
                            <Play size={20} strokeWidth={2} className="ml-0.5" />
                        </span>
                        <p className="mt-3 text-[15px] font-semibold text-emerald-200">Session running</p>
                        <p className="mt-1 text-[11px] text-neutral-500">Open sessions to manage</p>
                    </>
                ) : (
                    <>
                        <span className="focuz-popup-focus-icon">
                            <Play size={20} strokeWidth={2} className="ml-0.5" />
                        </span>
                        <p className="mt-3 text-[15px] font-semibold text-white">Start 25m focus</p>
                        <p className="mt-1 text-[11px] text-neutral-500">Quick Pomodoro · one click</p>
                    </>
                )}
            </button>

            <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="focuz-popup-stat">
                    <Flame size={12} className="text-orange-300/90" />
                    <span className="focuz-popup-stat-value">{streak}</span>
                    <span className="focuz-popup-stat-label">Streak</span>
                </div>
                <div className="focuz-popup-stat">
                    <ShieldBan size={12} className="text-neutral-400" />
                    <span className="focuz-popup-stat-value">{blockedToday}</span>
                    <span className="focuz-popup-stat-label">Blocked</span>
                </div>
                <div className="focuz-popup-stat">
                    <Timer size={12} className="text-neutral-400" />
                    <span className="focuz-popup-stat-value">{sessionsToday}</span>
                    <span className="focuz-popup-stat-label">Sessions</span>
                </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                    type="button"
                    className="focuz-popup-secondary"
                    onClick={() => {
                        openWebDashboard();
                        window.close();
                    }}
                >
                    <LayoutDashboard size={14} />
                    Dashboard
                    <ExternalLink size={11} className="ml-auto opacity-40" />
                </button>
                <button
                    type="button"
                    className="focuz-popup-secondary"
                    onClick={() => {
                        chrome.tabs.create({ url: EXTENSION_OPTIONS_URL });
                        window.close();
                    }}
                >
                    <Wrench size={14} />
                    Tools
                </button>
            </div>
        </div>
    );
}

const PopupApp = () => {
    const { session, streak, engineState, fetchEngineState, focusStartTime, init } = useAuthStore();
    const [ready, setReady] = useState(false);

    useEffect(() => {
        let cancelled = false;
        chrome.storage.local.get(['blockEngineState', 'streak'], (res) => {
            if (cancelled) return;
            if (res.blockEngineState) {
                useAuthStore.setState({ engineState: res.blockEngineState as typeof engineState });
            }
            if (res.streak !== undefined && res.streak !== null) {
                useAuthStore.setState({ streak: res.streak as number });
            }
            setReady(true);
        });
        void Promise.resolve(init()).finally(() => {
            if (!cancelled) setReady(true);
        });
        fetchEngineState();
        return () => {
            cancelled = true;
        };
    }, [fetchEngineState, init]);

    const todayStr = new Date().toDateString();
    const sessionsToday =
        engineState?.pomodoroSettings?.lastDate === todayStr
            ? engineState?.pomodoroSettings?.sessionsCompleted ?? 0
            : 0;
    const blockedToday = engineState?.blockedToday ?? 0;
    const displayName =
        engineState?.profileName?.trim()?.split(' ')[0] ||
        session?.user?.user_metadata?.full_name?.split(' ')[0] ||
        session?.user?.email?.split('@')[0] ||
        'there';

    return (
        <div className="focuz-popup w-[340px] h-[440px]">
            <div className="focuz-popup-shell">
                <div className="focuz-popup-atmosphere" aria-hidden />
                {!ready && !session ? (
                    <div className="relative z-10 flex h-full items-center justify-center">
                        <PopupBrand />
                    </div>
                ) : session ? (
                    <PopupSignedIn
                        streak={streak}
                        blockedToday={blockedToday}
                        sessionsToday={sessionsToday}
                        displayName={displayName}
                        nuclear={!!engineState?.nuclearState?.active}
                        isTimerActive={!!focusStartTime}
                    />
                ) : (
                    <PopupSignedOut />
                )}
            </div>
        </div>
    );
};

const mount = document.getElementById('root');
if (mount) {
    createRoot(mount).render(<PopupApp />);
}
