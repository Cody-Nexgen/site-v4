import { useEffect, useState, type Key, type ReactNode } from 'react';
import {
    Avatar,
    Button,
    Chip,
    Drawer,
    Dropdown,
    Label,
    Separator,
    Tooltip,
    useOverlayState,
} from '@heroui/react';
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
    Menu,
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
    mobileOpen?: boolean;
    onMobileOpenChange?: (open: boolean) => void;
};

const ICONS: Record<string, ReactNode> = {
    overview: <LayoutDashboard size={15} />,
    calendar: <CalendarDays size={15} />,
    lists: <ListTodo size={15} />,
    ai_coach: <Sparkles size={15} />,
    sessions: <Clock size={15} />,
    blocklist: <Ban size={15} />,
    habits: <Target size={15} />,
    statistics: <BarChart3 size={15} />,
    progress: <Trophy size={15} />,
    challenges: <Zap size={15} />,
    forest: <Trees size={15} />,
    friends: <Users size={15} />,
    focus_rooms: <Mic2 size={15} />,
};

const STORAGE_KEY = 'focuznow-sidebar-sections-v1';

function readExpanded(): Record<string, boolean> {
    try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (!stored) return { planning: true, focus: true, insights: true, progress: true, social: true };
        const parsed: unknown = JSON.parse(stored);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? (parsed as Record<string, boolean>)
            : { planning: true, focus: true, insights: true, progress: true, social: true };
    } catch {
        return { planning: true, focus: true, insights: true, progress: true, social: true };
    }
}

function SidebarBody({
    activeTab,
    avatarUrl,
    username,
    email,
    isPro,
    onNavigate,
    onOpenPalette,
    onUpgrade,
    onSignOut,
    onNavigateComplete,
}: Props & { onNavigateComplete?: () => void }) {
    const [expanded, setExpanded] = useState<Record<string, boolean>>(readExpanded);
    const [colorMode, setColorMode] = useState<DashboardColorMode>(getDashboardColorMode);
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

    const isActive = (tab: string) =>
        activeTab === tab || (tab === 'progress' && activeTab === 'achievements');

    const navigate = (tab: string) => {
        onNavigate(tab);
        onNavigateComplete?.();
    };

    const navClass = (tab: string) =>
        `w-full h-9 px-2.5 flex items-center gap-2.5 rounded-lg text-[13px] text-left transition-colors ${
            isActive(tab)
                ? 'bg-[var(--fz-accent-muted)] text-[var(--fz-text)] font-medium'
                : 'text-[var(--fz-text-secondary)] hover:bg-[var(--fz-interactive)] hover:text-[var(--fz-text)]'
        }`;

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="flex h-14 items-center gap-2 border-b border-[var(--fz-border)] px-3">
                <Dropdown>
                    <Dropdown.Trigger>
                        <Button
                            variant="ghost"
                            className="h-10 min-w-0 flex-1 justify-start gap-2 px-2"
                            aria-label="Account menu"
                        >
                            <Avatar className="h-7 w-7">
                                {avatarUrl ? <Avatar.Image src={avatarUrl} alt="" /> : null}
                                <Avatar.Fallback className="text-[11px]">{initial}</Avatar.Fallback>
                            </Avatar>
                            <span className="min-w-0 flex-1 truncate text-left text-[13px] font-medium text-[var(--fz-text)]">
                                {displayName}
                            </span>
                            <ChevronDown size={12} className="shrink-0 text-[var(--fz-text-tertiary)]" />
                        </Button>
                    </Dropdown.Trigger>
                    <Dropdown.Popover>
                        <Dropdown.Menu
                            aria-label="Account"
                            onAction={(key: Key) => {
                                if (key === 'signout') {
                                    onSignOut();
                                    return;
                                }
                                if (key === 'upgrade') {
                                    onUpgrade();
                                    onNavigateComplete?.();
                                    return;
                                }
                                navigate(String(key));
                            }}
                        >
                            <Dropdown.Item id="account" textValue="Account">
                                <User size={14} />
                                <Label>Account</Label>
                            </Dropdown.Item>
                            <Dropdown.Item id="settings" textValue="Preferences">
                                <Settings size={14} />
                                <Label>Preferences</Label>
                            </Dropdown.Item>
                            <Dropdown.Item id="support" textValue="Help">
                                <HelpCircle size={14} />
                                <Label>Help</Label>
                            </Dropdown.Item>
                            <Dropdown.Item id="shop" textValue="Focuz Shop">
                                <ShoppingBag size={14} />
                                <Label>Focuz Shop</Label>
                            </Dropdown.Item>
                            {!isPro ? (
                                <Dropdown.Item id="upgrade" textValue="Upgrade to Pro">
                                    <Sparkles size={14} />
                                    <Label>Upgrade to Pro</Label>
                                </Dropdown.Item>
                            ) : null}
                            <Dropdown.Item id="signout" textValue="Sign out">
                                <LogOut size={14} />
                                <Label>Sign out</Label>
                            </Dropdown.Item>
                        </Dropdown.Menu>
                    </Dropdown.Popover>
                </Dropdown>

                <Tooltip>
                    <Tooltip.Trigger>
                        <Button
                            isIconOnly
                            size="sm"
                            variant="ghost"
                            aria-label="Open command palette"
                            onPress={onOpenPalette}
                        >
                            <Search size={14} />
                        </Button>
                    </Tooltip.Trigger>
                    <Tooltip.Content arrowBoundaryOffset={0}>Search</Tooltip.Content>
                </Tooltip>
            </div>

            <div className="px-3 pt-4">
                <div className="flex items-center gap-2 px-1">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--fz-accent)] text-[var(--fz-primary-foreground)]">
                        <Zap size={15} aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--fz-text)]">FocuzNow</p>
                        <p className="truncate text-[11px] text-[var(--fz-text-tertiary)]">
                            {isPro ? 'Pro workspace' : 'Free workspace'}
                        </p>
                    </div>
                    {isPro ? <Chip className="ml-auto border-0 bg-amber-500/15 text-amber-300">Pro</Chip> : null}
                </div>
            </div>

            <nav className="flex-1 overflow-y-auto px-2 py-4 scrollbar-hide" aria-label="Workspace">
                <div className="space-y-0.5">
                    {PRIMARY_NAV.map((item) => (
                        <button
                            type="button"
                            key={item.id}
                            onClick={() => navigate(item.id)}
                            aria-current={isActive(item.id) ? 'page' : undefined}
                            className={navClass(item.id)}
                        >
                            <span className="shrink-0">{ICONS[item.id]}</span>
                            <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        </button>
                    ))}
                </div>

                <div className="mt-5 space-y-3">
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
                                    className="flex h-8 w-full items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--fz-text-tertiary)] transition-colors hover:bg-[var(--fz-interactive)] hover:text-[var(--fz-text-secondary)]"
                                >
                                    <ChevronDown
                                        size={11}
                                        className={`transition-transform ${open ? '' : '-rotate-90'}`}
                                    />
                                    <span>{section.label}</span>
                                </button>
                                {open ? (
                                    <div className="mt-0.5 space-y-0.5 border-l border-[var(--fz-border)] pl-2 ml-3">
                                        {section.tabs.map((item) => (
                                            <button
                                                type="button"
                                                key={item.id}
                                                onClick={() => navigate(item.id)}
                                                aria-current={isActive(item.id) ? 'page' : undefined}
                                                className={navClass(item.id)}
                                            >
                                                <span className="shrink-0">{ICONS[item.id]}</span>
                                                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                ) : null}
                            </div>
                        );
                    })}
                </div>
            </nav>

            <div className="border-t border-[var(--fz-border)] px-3 py-3">
                <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] text-[var(--fz-text-tertiary)]">Appearance</p>
                    <Tooltip>
                        <Tooltip.Trigger>
                            <Button
                                isIconOnly
                                size="sm"
                                variant="ghost"
                                aria-label={colorModeLabel}
                                onPress={() => {
                                    setColorMode(nextColorMode);
                                    void setDashboardColorMode(nextColorMode);
                                }}
                            >
                                {resolvedColorMode === 'dark' ? (
                                    <Sun size={14} aria-hidden="true" />
                                ) : (
                                    <Moon size={14} aria-hidden="true" />
                                )}
                            </Button>
                        </Tooltip.Trigger>
                        <Tooltip.Content arrowBoundaryOffset={0}>{colorModeLabel}</Tooltip.Content>
                    </Tooltip>
                </div>
            </div>
        </div>
    );
}

export function WorkspaceSidebar(props: Props) {
    const mobileState = useOverlayState({
        isOpen: props.mobileOpen,
        onOpenChange: props.onMobileOpenChange,
    });

    return (
        <>
            <aside className="workspace-sidebar workspace-sidebar-desktop relative flex h-screen w-[260px] min-w-[260px] flex-col overflow-hidden">
                <SidebarBody {...props} />
            </aside>

            <Drawer state={mobileState}>
                <Drawer.Backdrop>
                    <Drawer.Content placement="left" className="w-[min(86vw,280px)]">
                        <Drawer.Dialog className="border-r border-[var(--fz-border)] bg-[var(--fz-surface)]">
                            <Drawer.CloseTrigger />
                            <Drawer.Header className="sr-only">
                                <Drawer.Heading>Navigation</Drawer.Heading>
                            </Drawer.Header>
                            <Drawer.Body className="p-0">
                                <SidebarBody
                                    {...props}
                                    onNavigateComplete={() => props.onMobileOpenChange?.(false)}
                                />
                            </Drawer.Body>
                        </Drawer.Dialog>
                    </Drawer.Content>
                </Drawer.Backdrop>
            </Drawer>
        </>
    );
}

export function MobileNavTrigger({ onPress }: { onPress: () => void }) {
    return (
        <Button
            isIconOnly
            size="sm"
            variant="ghost"
            className="workspace-mobile-trigger"
            aria-label="Open navigation"
            onPress={onPress}
        >
            <Menu size={16} />
        </Button>
    );
}

export { Separator };
