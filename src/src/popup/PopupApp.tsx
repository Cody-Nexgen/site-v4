import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import { useAuthStore } from '../lib/store';
import {
    ExternalLink,
    KeyRound,
    LayoutDashboard,
    Pause,
    Play,
    ShieldAlert,
    ShieldBan,
    Youtube,
} from 'lucide-react';
import { openWebDashboard } from '../lib/workspaceSync';

const EXTENSION_OPTIONS_URL = chrome.runtime.getURL('src/options/index.html');
const SIGNUP_URL = 'https://focuznow.com/login?extension_oauth=1';
const ICON_URL = chrome.runtime.getURL('public/icons/icon-128.png');

function fmtClock(totalSec: number) {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function useNow(active: boolean) {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        if (!active) return;
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, [active]);
    return now;
}

function PopupBrand({ status }: { status?: string }) {
    return (
        <div className="flex items-center gap-2.5 min-w-0">
            <img src={ICON_URL} alt="" width={28} height={28} className="h-7 w-7 rounded-md" />
            <div className="min-w-0">
                <p className="text-[13px] font-semibold tracking-tight text-[var(--fz-text-1)] leading-none">
                    FocuzNow
                </p>
                {status ? (
                    <p className="mt-0.5 text-[11px] text-[var(--fz-text-3)] truncate tabular-nums">{status}</p>
                ) : null}
            </div>
        </div>
    );
}

function PopupSwitch({
    checked,
    disabled,
    onChange,
    label,
}: {
    checked: boolean;
    disabled?: boolean;
    onChange: (next: boolean) => void;
    label: string;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            disabled={disabled}
            onClick={(e) => {
                e.stopPropagation();
                onChange(!checked);
            }}
            className="relative h-[20px] w-[34px] shrink-0 rounded-full transition-colors duration-150 disabled:opacity-40"
            style={{
                background: checked ? 'var(--fz-accent)' : 'var(--fz-bg-active)',
                boxShadow: 'inset 0 0 0 1px var(--fz-border)',
            }}
        >
            <span
                className="absolute top-[2px] h-[16px] w-[16px] rounded-full bg-white transition-transform duration-150"
                style={{
                    left: 2,
                    transform: checked ? 'translateX(14px)' : 'translateX(0)',
                    transitionTimingFunction: 'var(--fz-ease-out)',
                }}
            />
        </button>
    );
}

function ToggleRow({
    icon,
    label,
    hint,
    checked,
    disabled,
    onChange,
}: {
    icon: React.ReactNode;
    label: string;
    hint?: string;
    checked: boolean;
    disabled?: boolean;
    onChange: (next: boolean) => void;
}) {
    return (
        <div className="flex items-center gap-2.5 px-3 py-2">
            <span className="flex h-6 w-6 items-center justify-center text-[var(--fz-text-3)]">{icon}</span>
            <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-medium text-[var(--fz-text-1)] leading-tight">{label}</p>
                {hint ? <p className="text-[10.5px] text-[var(--fz-text-4)] leading-tight mt-0.5">{hint}</p> : null}
            </div>
            <PopupSwitch checked={checked} disabled={disabled} onChange={onChange} label={label} />
        </div>
    );
}

function PopupSignedOut() {
    return (
        <div className="flex h-full flex-col">
            <PopupBrand status="Focus that sticks" />
            <div className="mt-6 flex-1">
                <h1 className="text-[19px] font-semibold tracking-tight text-[var(--fz-text-1)] leading-snug">
                    Block noise. Keep the streak.
                </h1>
                <p className="mt-2 text-[12px] leading-relaxed text-[var(--fz-text-3)]">
                    Site blocking, Pomodoros, and your dashboard — synced when you sign in.
                </p>
            </div>
            <div className="mt-auto space-y-2">
                <button
                    type="button"
                    className="w-full rounded-[var(--fz-radius-md)] bg-[var(--fz-accent)] px-3 py-2.5 text-[13px] font-semibold text-[var(--fz-accent-fg)] transition-opacity hover:opacity-90"
                    onClick={() => {
                        chrome.tabs.create({ url: SIGNUP_URL });
                        window.close();
                    }}
                >
                    Continue with account
                </button>
                <button
                    type="button"
                    className="w-full rounded-[var(--fz-radius-md)] border border-[var(--fz-border)] bg-[var(--fz-bg-raised)] px-3 py-2 text-[12px] font-medium text-[var(--fz-text-2)] transition-colors hover:bg-[var(--fz-bg-hover)]"
                    onClick={() => {
                        chrome.tabs.create({ url: EXTENSION_OPTIONS_URL });
                        window.close();
                    }}
                >
                    Extension tools
                </button>
            </div>
        </div>
    );
}

function PopupSignedIn({
    nuclear,
    isTimerActive,
    focusElapsedSec,
}: {
    nuclear: boolean;
    isTimerActive: boolean;
    focusElapsedSec: number;
}) {
    const { engineState, fetchEngineState, patchInAppBlock } = useAuthStore();
    const [nuclearConfirm, setNuclearConfirm] = useState(false);
    const [busy, setBusy] = useState(false);

    const blocking = !!engineState.focusMode;
    const smartYt = !!engineState.inAppBlock?.smartYouTube?.enabled;

    const toggleBlocking = (next: boolean) => {
        chrome.runtime.sendMessage(
            { type: 'UPDATE_ENGINE_SETTINGS', settings: { focusMode: next } },
            () => fetchEngineState(),
        );
    };

    const toggleSmartYt = (next: boolean) => {
        void patchInAppBlock({
            smartYouTube: {
                blockShorts: true,
                ...(engineState.inAppBlock?.smartYouTube || {}),
                enabled: next,
            },
        });
    };

    const startFocus = () => {
        if (nuclear || isTimerActive || busy) return;
        setBusy(true);
        chrome.runtime.sendMessage({ type: 'START_SESSION', duration: 25 }, () => {
            setBusy(false);
            chrome.tabs.create({ url: `${EXTENSION_OPTIONS_URL}?tab=sessions` });
            window.close();
        });
    };

    const startNuclear = () => {
        if (busy) return;
        setBusy(true);
        chrome.runtime.sendMessage(
            { type: 'START_NUCLEAR', target: 'popup', duration: 60 },
            () => {
                setBusy(false);
                setNuclearConfirm(false);
                void fetchEngineState();
            },
        );
    };

    return (
        <div className="flex h-full flex-col">
            <div className="flex items-center justify-between gap-3">
                <PopupBrand
                    status={
                        nuclear
                            ? 'Lockdown active'
                            : isTimerActive
                                ? `Focusing · ${fmtClock(focusElapsedSec)}`
                                : 'Not focusing'
                    }
                />
                {isTimerActive && !nuclear ? (
                    <span className="flex items-center gap-1.5 rounded-full border border-[var(--fz-border)] px-2 py-0.5 text-[10.5px] font-medium text-[var(--fz-text-3)]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[var(--fz-success)]" />
                        Live
                    </span>
                ) : null}
            </div>

            <button
                type="button"
                onClick={startFocus}
                disabled={nuclear || isTimerActive || busy}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-[var(--fz-radius-lg)] border border-[var(--fz-border)] px-3 py-3.5 text-[14px] font-semibold transition-all duration-150 disabled:cursor-default"
                style={{
                    background: isTimerActive ? 'var(--fz-accent-soft)' : 'var(--fz-accent)',
                    color: isTimerActive ? 'var(--fz-accent)' : 'var(--fz-accent-fg)',
                    borderColor: isTimerActive ? 'var(--fz-accent)' : 'transparent',
                }}
            >
                {nuclear ? (
                    <>
                        <ShieldAlert size={15} />
                        Lockdown active
                    </>
                ) : isTimerActive ? (
                    <>
                        <Pause size={15} />
                        <span className="tabular-nums">{fmtClock(focusElapsedSec)}</span>
                        <span className="font-medium opacity-70">— session running</span>
                    </>
                ) : (
                    <>
                        <Play size={15} />
                        Start 25m focus
                    </>
                )}
            </button>

            <div className="mt-3 rounded-[var(--fz-radius-lg)] border border-[var(--fz-border)] bg-[var(--fz-bg-panel)]">
                <ToggleRow
                    icon={<ShieldBan size={14} />}
                    label="Blocking"
                    hint="Blocklist and schedules"
                    checked={blocking}
                    onChange={toggleBlocking}
                />
                <div className="mx-3 border-t border-[var(--fz-border)]" />
                <ToggleRow
                    icon={<Youtube size={14} />}
                    label="Smart YouTube"
                    hint="Classify and block distractions"
                    checked={smartYt}
                    onChange={toggleSmartYt}
                />
                <div className="mx-3 border-t border-[var(--fz-border)]" />
                <ToggleRow
                    icon={<ShieldAlert size={14} />}
                    label="Nuclear lockdown"
                    hint={nuclear ? 'Active until it expires' : 'Blocks everything for 60m'}
                    checked={nuclear}
                    disabled={nuclear}
                    onChange={(next) => {
                        if (next) setNuclearConfirm(true);
                    }}
                />
            </div>

            {nuclearConfirm ? (
                <div className="mt-2 rounded-[var(--fz-radius-md)] border border-[var(--fz-danger)] bg-[var(--fz-danger-soft)] px-3 py-2.5">
                    <p className="text-[12px] font-medium text-[var(--fz-text-1)]">
                        Start a 60-minute lockdown?
                    </p>
                    <p className="mt-0.5 text-[11px] text-[var(--fz-text-3)]">
                        All distracting sites stay blocked until it ends.
                    </p>
                    <div className="mt-2 flex gap-2">
                        <button
                            type="button"
                            onClick={startNuclear}
                            className="rounded-[var(--fz-radius-sm)] bg-[var(--fz-danger)] px-2.5 py-1 text-[11.5px] font-semibold text-[var(--fz-danger-fg)]"
                        >
                            Start lockdown
                        </button>
                        <button
                            type="button"
                            onClick={() => setNuclearConfirm(false)}
                            className="rounded-[var(--fz-radius-sm)] px-2.5 py-1 text-[11.5px] font-medium text-[var(--fz-text-3)] hover:text-[var(--fz-text-1)]"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            ) : null}

            <div className="mt-auto flex items-center gap-2 pt-3">
                <button
                    type="button"
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-[var(--fz-radius-md)] border border-[var(--fz-border)] bg-[var(--fz-bg-raised)] px-3 py-2 text-[12px] font-medium text-[var(--fz-text-2)] transition-colors hover:bg-[var(--fz-bg-hover)] hover:text-[var(--fz-text-1)]"
                    onClick={() => {
                        openWebDashboard();
                        window.close();
                    }}
                >
                    <LayoutDashboard size={13} />
                    Open dashboard
                    <ExternalLink size={10} className="opacity-50" />
                </button>
                <button
                    type="button"
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-[var(--fz-radius-md)] border border-[var(--fz-border)] bg-[var(--fz-bg-raised)] px-3 py-2 text-[12px] font-medium text-[var(--fz-text-2)] transition-colors hover:bg-[var(--fz-bg-hover)] hover:text-[var(--fz-text-1)]"
                    onClick={() => {
                        chrome.tabs.create({ url: `${EXTENSION_OPTIONS_URL}?tab=focuzpass` });
                        window.close();
                    }}
                >
                    <KeyRound size={13} />
                    FocuzPass
                </button>
            </div>
        </div>
    );
}

const PopupApp = () => {
    const { session, engineState, fetchEngineState, focusStartTime, init } = useAuthStore();
    const [ready, setReady] = useState(false);
    const now = useNow(!!focusStartTime);

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

    const focusElapsedSec = focusStartTime ? Math.max(0, Math.floor((now - focusStartTime) / 1000)) : 0;

    return (
        <div
            className="w-[360px] max-h-[560px] overflow-y-auto p-4"
            style={{
                background: 'var(--fz-bg-app)',
                color: 'var(--fz-text-1)',
                fontFamily: 'var(--fz-font-display)',
            }}
        >
            {!ready && !session ? (
                <div className="flex h-[120px] items-center justify-center">
                    <PopupBrand />
                </div>
            ) : session ? (
                <PopupSignedIn
                    nuclear={!!engineState?.nuclearState?.active}
                    isTimerActive={!!focusStartTime}
                    focusElapsedSec={focusElapsedSec}
                />
            ) : (
                <PopupSignedOut />
            )}
        </div>
    );
};

const mount = document.getElementById('root');
if (mount) {
    createRoot(mount).render(<PopupApp />);
}
