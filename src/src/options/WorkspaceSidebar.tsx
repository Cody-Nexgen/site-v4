import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
    BarChart3,
    Ban,
    CalendarDays,
    ChevronDown,
    Clock,
    HelpCircle,
    LayoutDashboard,
    ListTodo,
    LogOut,
    Mic2,
    Moon,
    Search,
    Settings,
    ShoppingBag,
    Sparkles,
    Sun,
    Target,
    Trees,
    Trophy,
    User,
    Users,
    Zap,
} from 'lucide-react';
import {
    getDashboardColorMode,
    initializeDashboardColorMode,
    resolveDashboardColorMode,
    setDashboardColorMode,
    subscribeToDashboardColorMode,
    type DashboardColorMode,
} from '../lib/themes';
import { COLLAPSIBLE_NAV, PRIMARY_NAV } from '../lib/workspaceNav';

type Props = {
    activeTab: string;
    avatarUrl?: string;
    username?: string;
    email?: string;
    isPro: boolean;
    onNavigate: (tab: string) => void;
    onOpenPalette: () => void;
    onUpgrade: () => void;
    onSignOut: () => void;
};

const ICONS: Record<string, ReactNode> = {
    overview: <LayoutDashboard size={14} />,
    calendar: <CalendarDays size={14} />,
    lists: <ListTodo size={14} />,
    ai_coach: <Sparkles size={14} />,
    sessions: <Clock size={14} />,
    blocklist: <Ban size={14} />,
    habits: <Target size={14} />,
    statistics: <BarChart3 size={14} />,
    progress: <Trophy size={14} />,
    challenges: <Zap size={14} />,
    forest: <Trees size={14} />,
    friends: <Users size={14} />,
    focus_rooms: <Mic2 size={14} />,
};

const STORAGE_KEY = 'focuznow-sidebar-sections-v1';
function readExpanded(): Record<string, boolean> {
    try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (!stored) return { progress: true, social: true };
        const parsed: unknown = JSON.parse(stored);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? parsed as Record<string, boolean>
            : { progress: true, social: true };
    } catch {
        return { progress: true, social: true };
    }
}

export function WorkspaceSidebar({
    activeTab,
    avatarUrl,
    username,
    email,
    isPro,
    onNavigate,
    onOpenPalette,
    onUpgrade,
    onSignOut,
}: Props) {
    const [accountOpen, setAccountOpen] = useState(false);
    const [expanded, setExpanded] = useState<Record<string, boolean>>(readExpanded);
    const [colorMode, setColorMode] = useState<DashboardColorMode>(getDashboardColorMode);
    const accountRef = useRef<HTMLDivElement>(null);
    const accountTriggerRef = useRef<HTMLButtonElement>(null);
    const displayName = username?.trim() || email?.split('@')[0] || 'Account';
    const initial = displayName.charAt(0).toUpperCase();
    const resolvedColorMode = resolveDashboardColorMode(colorMode);
    const nextColorMode = resolvedColorMode === 'dark' ? 'light' : 'dark';
    const colorModeLabel = `Switch to ${nextColorMode} mode`;

    useEffect(() => {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(expanded));
    }, [expanded]);

    useEffect(() => {
        const unsubscribe = subscribeToDashboardColorMode(setColorMode);
        void initializeDashboardColorMode().then(setColorMode);
        return unsubscribe;
    }, []);

    useEffect(() => {
        if (!accountOpen) return;
        const close = (event: MouseEvent) => {
            if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false);
        };
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setAccountOpen(false);
                window.requestAnimationFrame(() => accountTriggerRef.current?.focus());
            }
        };
        document.addEventListener('mousedown', close);
        document.addEventListener('keydown', closeOnEscape);
        return () => {
            document.removeEventListener('mousedown', close);
            document.removeEventListener('keydown', closeOnEscape);
        };
    }, [accountOpen]);

    const isActive = (tab: string) =>
        activeTab === tab || (tab === 'progress' && activeTab === 'achievements');
    const navClass = (tab: string) =>
        `w-full h-7 px-2 flex items-center gap-2 rounded-[4px] text-[12.5px] text-left transition-colors ${
            isActive(tab)
                ? 'bg-white/[0.055] text-neutral-200'
                : 'text-neutral-500 hover:bg-white/[0.035] hover:text-neutral-300'
        }`;
    const navigateFromMenu = (tab: string) => {
        setAccountOpen(false);
        onNavigate(tab);
    };

    return (
        <aside className="workspace-sidebar relative flex h-screen w-[240px] min-w-[240px] flex-col overflow-x-hidden border-r border-white/[0.07] bg-[#0d0d0e]">
            <div ref={accountRef} className="relative flex h-11 items-center gap-1 px-2">
                <button
                    ref={accountTriggerRef}
                    type="button"
                    onClick={() => setAccountOpen((open) => !open)}
                    aria-expanded={accountOpen}
                    aria-haspopup="menu"
                    aria-controls="workspace-account-menu"
                    className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-[4px] px-1.5 text-left transition-colors hover:bg-white/[0.035]"
                >
                    {avatarUrl ? (
                        <img src={avatarUrl} alt="" className="h-5 w-5 shrink-0 rounded-[5px] object-cover" />
                    ) : (
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] bg-neutral-700 text-[9px] font-medium text-neutral-100">
                            {initial}
                        </span>
                    )}
                    <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-neutral-200">
                        {displayName}
                    </span>
                    <ChevronDown
                        size={11}
                        className={`shrink-0 text-neutral-600 transition-transform ${accountOpen ? 'rotate-180' : ''}`}
                    />
                </button>
                <button
                    type="button"
                    onClick={onOpenPalette}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] text-neutral-600 transition-colors hover:bg-white/[0.035] hover:text-neutral-300"
                    aria-label="Search"
                    title="Search"
                >
                    <Search size={13} />
                </button>

                {accountOpen && (
                    <div
                        id="workspace-account-menu"
                        role="menu"
                        className="workspace-account-menu absolute left-2 right-2 top-10 z-[90] rounded-lg border border-white/[0.09] bg-[#171719] p-1 shadow-[0_16px_40px_rgba(0,0,0,0.55)]"
                    >
                        <div className="px-2 py-2">
                            <p className="truncate text-xs font-medium text-neutral-200">{displayName}</p>
                            <p className="truncate text-[11px] text-neutral-600">{email || (isPro ? 'Pro plan' : 'Free plan')}</p>
                        </div>
                        <div className="my-1 h-px bg-white/[0.07]" />
                        {[
                            { id: 'account', label: 'Account', icon: <User size={13} /> },
                            { id: 'settings', label: 'Preferences', icon: <Settings size={13} /> },
                            { id: 'support', label: 'Help', icon: <HelpCircle size={13} /> },
                            { id: 'shop', label: 'Focuz Shop', icon: <ShoppingBag size={13} /> },
                        ].map((item) => (
                            <button
                                type="button"
                                role="menuitem"
                                key={item.id}
                                onClick={() => navigateFromMenu(item.id)}
                                className="flex h-7 w-full items-center gap-2 rounded px-2 text-left text-xs text-neutral-400 hover:bg-white/[0.05] hover:text-neutral-200"
                            >
                                {item.icon}
                                <span>{item.label}</span>
                            </button>
                        ))}
                        {!isPro && (
                            <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                    setAccountOpen(false);
                                    onUpgrade();
                                }}
                                className="flex h-7 w-full items-center gap-2 rounded px-2 text-left text-xs text-neutral-400 hover:bg-white/[0.05] hover:text-neutral-200"
                            >
                                <Sparkles size={13} />
                                <span>Upgrade to Pro</span>
                            </button>
                        )}
                        <div className="my-1 h-px bg-white/[0.07]" />
                        <button
                            type="button"
                            role="menuitem"
                            onClick={onSignOut}
                            className="flex h-7 w-full items-center gap-2 rounded px-2 text-left text-xs text-neutral-500 hover:bg-white/[0.05] hover:text-neutral-200"
                        >
                            <LogOut size={13} />
                            <span>Sign out</span>
                        </button>
                    </div>
                )}
            </div>

            <nav className="flex-1 overflow-y-auto px-2 pb-3 pt-1 scrollbar-hide">
                <div className="space-y-0.5">
                    {PRIMARY_NAV.map((item) => (
                        <button
                            type="button"
                            key={item.id}
                            onClick={() => onNavigate(item.id)}
                            aria-current={isActive(item.id) ? 'page' : undefined}
                            className={navClass(item.id)}
                        >
                            <span className="shrink-0">{ICONS[item.id]}</span>
                            <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        </button>
                    ))}
                </div>

                <div className="mt-5 space-y-4">
                    {COLLAPSIBLE_NAV.map((section) => {
                        const open = expanded[section.id] !== false;
                        return (
                            <div key={section.id}>
                                <button
                                    type="button"
                                    onClick={() =>
                                        setExpanded((current) => ({ ...current, [section.id]: !open }))
                                    }
                                    aria-expanded={open}
                                    className="flex h-7 w-full items-center gap-1 rounded-[4px] px-2 text-[11px] font-medium text-neutral-600 transition-colors hover:bg-white/[0.025] hover:text-neutral-400"
                                >
                                    <ChevronDown
                                        size={10}
                                        className={`transition-transform ${open ? '' : '-rotate-90'}`}
                                    />
                                    <span>{section.label}</span>
                                </button>
                                {open && (
                                    <div className="ml-3 space-y-0.5 border-l border-white/[0.06] pl-2">
                                        {section.tabs.map((item) => (
                                            <button
                                                type="button"
                                                key={item.id}
                                                onClick={() => onNavigate(item.id)}
                                                aria-current={isActive(item.id) ? 'page' : undefined}
                                                className={navClass(item.id)}
                                            >
                                                <span className="shrink-0">{ICONS[item.id]}</span>
                                                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </nav>
            <div className="workspace-theme-switcher flex justify-end border-t border-white/[0.07] px-2 py-2">
                <button
                    type="button"
                    aria-label={colorModeLabel}
                    title={colorModeLabel}
                    onClick={() => {
                        setColorMode(nextColorMode);
                        void setDashboardColorMode(nextColorMode);
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-[4px] text-neutral-600 transition-colors hover:bg-white/[0.04] hover:text-neutral-300"
                >
                    {resolvedColorMode === 'dark' ? (
                        <Sun size={14} aria-hidden="true" />
                    ) : (
                        <Moon size={14} aria-hidden="true" />
                    )}
                </button>
            </div>
        </aside>
    );
}
