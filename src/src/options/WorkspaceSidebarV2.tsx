import { PALETTE_SHORTCUT_LABEL } from '../lib/shortcuts';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
    getDashboardColorMode,
    initializeDashboardColorMode,
    setDashboardColorMode,
    subscribeToDashboardColorMode,
    setEngineTheme,
    normalizeThemeForUser,
    type DashboardColorMode,
} from '../lib/themes';
import { COLLAPSIBLE_NAV, PRIMARY_NAV, type NavTab } from '../lib/workspaceNav';
import { getInitials } from '../lib/avatarInitials';
import { ACCENTS, accentHueFor, accentSwatch, applyAccentHue, readCustomHue, writeCustomHue, type AccentId } from '../lib/accents';
import { useAuthStore } from '../lib/store';
import { Menu, type MenuItem } from '../components/fz/Menu';
import { IconPin } from '../components/fz/icons';
import { Tooltip } from '../components/fz/Tooltip';
import { Popover } from '../components/fz/Popover';
import { WhatsNewCard, useHasWhatsNew } from './WhatsNewCard';
import {
    IconAiCoach,
    IconBlocklist,
    IconCalendar,
    IconChallenges,
    IconChevronDown,
    IconDashboard,
    IconFocuzPass,
    IconForest,
    IconFriends,
    IconHabits,
    IconHelp,
    IconLists,
    IconLogout,
    IconMoon,
    IconPanelLeftClose,
    IconPomodoro,
    IconProgress,
    IconSearch,
    IconSettings,
    IconShop,
    IconSparkle,
    IconStats,
    IconSun,
} from './SidebarIcons';

type SidebarMode = 'expanded' | 'rail' | 'peek' | 'hidden';

type Props = {
    activeTab: string;
    avatarUrl?: string;
    avatarFallbackUrl?: string;
    username?: string;
    email?: string;
    isPro: boolean;
    /** 'expanded' | 'rail' | 'peek' | 'hidden' — driven by useSidebarController. */
    mode?: SidebarMode;
    collapsed?: boolean; // legacy alias → hidden
    onToggleCollapse?: () => void;
    onPin?: () => void; // peek → expanded
    onNavigate: (tab: string) => void;
    onOpenPalette: () => void;
    onUpgrade: () => void;
    onSignOut: () => void;
    /** Preview/testing hook — opens the account menu on mount. */
    defaultAccountOpen?: boolean;
    /** Preview/testing hook — renders the What's-new card expanded. */
    defaultWhatsNewExpanded?: boolean;
};

const ICONS: Record<string, ReactNode> = {
    overview: <IconDashboard />,
    focuzpass: <IconFocuzPass />,
    calendar: <IconCalendar />,
    lists: <IconLists />,
    ai_coach: <IconAiCoach />,
    sessions: <IconPomodoro />,
    blocklist: <IconBlocklist />,
    habits: <IconHabits />,
    statistics: <IconStats />,
    progress: <IconProgress />,
    challenges: <IconChallenges />,
    forest: <IconForest />,
    friends: <IconFriends />,
};

const STORAGE_KEY = 'focuznow-sidebar-sections-v1';
function readExpanded(): Record<string, boolean> {
    try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        const parsed: unknown = stored ? JSON.parse(stored) : null;
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? parsed as Record<string, boolean>
            : {};
    } catch {
        return {};
    }
}

const THEME_MODES: { id: DashboardColorMode; label: string }[] = [
    { id: 'light', label: 'Light' },
    { id: 'dark', label: 'Dark' },
    { id: 'system', label: 'System' },
];

export function WorkspaceSidebarV2({
    activeTab,
    avatarUrl,
    avatarFallbackUrl,
    username,
    email,
    isPro,
    mode = 'expanded',
    collapsed,
    onToggleCollapse,
    onPin,
    onNavigate,
    onOpenPalette,
    onUpgrade,
    onSignOut,
    defaultAccountOpen = false,
    defaultWhatsNewExpanded = false,
}: Props) {
    const effectiveMode: SidebarMode = collapsed ? 'hidden' : mode;
    const rail = effectiveMode === 'rail';
    const peek = effectiveMode === 'peek';
    const hidden = effectiveMode === 'hidden';

    const [accountOpen, setAccountOpen] = useState(defaultAccountOpen);
    const [whatsNewOpen, setWhatsNewOpen] = useState(false);
    const [failedAvatarSources, setFailedAvatarSources] = useState<string[]>([]);
    const [expanded, setExpanded] = useState<Record<string, boolean>>(readExpanded);
    const [colorMode, setColorMode] = useState<DashboardColorMode>(getDashboardColorMode);
    const [customHue, setCustomHue] = useState<number>(readCustomHue);
    const accountTriggerRef = useRef<HTMLButtonElement>(null);
    const whatsNewBtnRef = useRef<HTMLButtonElement>(null);
    const { hasNew } = useHasWhatsNew();
    const engineTheme = useAuthStore((s) => s.engineState?.theme);

    const displayName = username?.trim() || email?.split('@')[0] || 'Account';
    const avatarSources = [avatarUrl, avatarFallbackUrl].filter((source, index, all): source is string => Boolean(source) && all.indexOf(source) === index);
    const avatarSource = avatarSources.find((source) => !failedAvatarSources.includes(source));
    const initials = getInitials(displayName);

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

    const pickAccent = (id: AccentId, hue?: number) => {
        if (id === 'custom' && hue !== undefined) {
            writeCustomHue(hue);
            setCustomHue(hue);
            applyAccentHue(hue);
        } else if (id === 'custom') {
            applyAccentHue(customHue);
        } else {
            applyAccentHue(accentHueFor(id));
        }
        void setEngineTheme(id);
    };

    const avatar = avatarSource ? (
        <img
            src={avatarSource}
            alt=""
            referrerPolicy="no-referrer"
            onError={() => setFailedAvatarSources((current) => current.includes(avatarSource) ? current : [...current, avatarSource])}
            className="sb-avatar"
        />
    ) : (
        <span className="sb-avatar">
            {initials}
        </span>
    );

    const accentItems: MenuItem[] = [
        ...ACCENTS.filter((a) => a.id !== 'custom').map((a) => ({
            id: `accent-${a.id}`,
            label: a.label,
            checked: normalizeThemeForUser(engineTheme, true) === a.id,
            icon: (
                <span
                    className="inline-block size-3 rounded-full"
                    style={{ background: accentSwatch(a.hue) }}
                />
            ),
            onSelect: () => pickAccent(a.id),
        })),
        { type: 'separator', id: 'accent-sep' },
        {
            type: 'custom',
            id: 'accent-custom',
            node: (
                <div className="px-2 pb-1.5 pt-1">
                    <div className="flex items-center gap-2">
                        <span
                            className="inline-block size-3 shrink-0 rounded-full"
                            style={{ background: `oklch(0.68 0.15 ${customHue})` }}
                        />
                        <span className="text-[13px] text-[var(--fz-text-2)]">Custom hue</span>
                    </div>
                    <input
                        type="range"
                        min={0}
                        max={360}
                        value={customHue}
                        aria-label="Custom accent hue"
                        onChange={(e) => pickAccent('custom', Number(e.target.value))}
                        className="mt-1.5 w-full accent-[var(--fz-accent)]"
                    />
                </div>
            ),
        },
    ];

    const accountMenuItems: MenuItem[] = [
        {
            type: 'custom',
            id: 'hdr',
            node: (
                <div className="flex items-center gap-2.5 px-2 pb-2 pt-1.5">
                    <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[var(--fz-bg-overlay)] text-[12px] font-semibold text-[var(--fz-text-1)] shadow-[var(--fz-edge)]">
                        {avatarSource ? (
                            <img src={avatarSource} alt="" referrerPolicy="no-referrer" className="size-8 object-cover" />
                        ) : (
                            initials
                        )}
                    </span>
                    <span className="min-w-0">
                        <span className="block truncate text-title-3">{displayName}</span>
                        <span className="text-meta block truncate">{email || (isPro ? 'Pro plan' : 'Free plan')}</span>
                    </span>
                </div>
            ),
        },
        { type: 'separator', id: 's0' },
        { id: 'settings', label: 'Settings', icon: <IconSettings size={14} />, onSelect: () => onNavigate('settings') },
        { id: 'accent', label: 'Accent color', icon: <IconSparkle size={14} />, submenu: accentItems },
        {
            type: 'custom',
            id: 'theme',
            node: (
                <div className="sb-seg" role="group" aria-label="Theme">
                    {THEME_MODES.map((m) => (
                        <button
                            key={m.id}
                            type="button"
                            data-active={colorMode === m.id}
                            onClick={(e) => {
                                e.stopPropagation();
                                setColorMode(m.id);
                                void setDashboardColorMode(m.id);
                            }}
                        >
                            {m.id === 'light' ? <IconSun size={11} className="mr-1 inline-block align-[-2px]" /> : null}
                            {m.id === 'dark' ? <IconMoon size={11} className="mr-1 inline-block align-[-2px]" /> : null}
                            {m.label}
                        </button>
                    ))}
                </div>
            ),
        },
        { id: 'support', label: 'Help', icon: <IconHelp size={14} />, onSelect: () => onNavigate('support') },
        { id: 'shop', label: 'Focuz Shop', icon: <IconShop size={14} />, onSelect: () => onNavigate('shop') },
        ...(!isPro
            ? [{ id: 'upgrade', label: 'Upgrade to Pro', icon: <IconSparkle size={14} />, onSelect: onUpgrade } as MenuItem]
            : []),
        { type: 'separator', id: 's1' },
        { id: 'signout', label: 'Sign out', icon: <IconLogout size={14} />, onSelect: onSignOut },
    ];

    const renderItem = (item: NavTab) => {
        const btn = (
            <button
                type="button"
                key={item.id}
                onClick={() => onNavigate(item.id)}
                aria-current={isActive(item.id) ? 'page' : undefined}
                aria-label={rail ? item.label : undefined}
                className="sb-item"
            >
                <span className="sb-item-icon">{ICONS[item.id]}</span>
                <span className="sb-item-label sb-fade">{item.label}</span>
            </button>
        );
        return rail ? (
            <Tooltip key={item.id} content={item.label} side="right">
                {btn}
            </Tooltip>
        ) : (
            btn
        );
    };

    const asideContent = (
        <aside
            className={`sb-root ${rail ? 'sb-root--rail' : ''} ${hidden ? 'sb-root--collapsed' : ''}`}
            aria-hidden={hidden}
        >
            <div className="sb-header">
                <button
                    ref={accountTriggerRef}
                    type="button"
                    onClick={() => setAccountOpen((open) => !open)}
                    aria-expanded={accountOpen}
                    aria-haspopup="menu"
                    aria-controls="workspace-account-menu"
                    className="sb-account"
                >
                    {avatar}
                    <span className="sb-account-name sb-fade">{displayName}</span>
                    <IconChevronDown size={12} strokeWidth={1.75} className="sb-account-chevron sb-fade" />
                </button>
                <Menu
                    open={accountOpen}
                    onClose={() => setAccountOpen(false)}
                    anchor={accountTriggerRef}
                    items={accountMenuItems}
                    minWidth={224}
                />
                {rail ? (
                    <Tooltip content="Search" shortcut={PALETTE_SHORTCUT_LABEL} side="right">
                        <button type="button" onClick={onOpenPalette} className="sb-icon-btn" aria-label="Search">
                            <IconSearch />
                        </button>
                    </Tooltip>
                ) : (
                    <button type="button" onClick={onOpenPalette} className="sb-icon-btn" aria-label="Search" title="Search">
                        <IconSearch />
                    </button>
                )}
                {peek && onPin ? (
                    <button type="button" onClick={onPin} className="sb-icon-btn" aria-label="Pin sidebar" title="Pin sidebar">
                        <IconPin />
                    </button>
                ) : onToggleCollapse && !rail ? (
                    <button type="button" onClick={onToggleCollapse} className="sb-icon-btn" aria-label="Collapse sidebar" title="Collapse sidebar">
                        <IconPanelLeftClose />
                    </button>
                ) : null}
            </div>

            <nav className="sb-nav" aria-label="Workspace">
                <div className="sb-list">{PRIMARY_NAV.map(renderItem)}</div>

                <div>
                    {COLLAPSIBLE_NAV.map((section) => {
                        const open = expanded[section.id] !== false;
                        const listId = `sb-section-${section.id}`;
                        return (
                            <div key={section.id} className="sb-group">
                                {!rail && (
                                    <button
                                        type="button"
                                        onClick={() => setExpanded((current) => ({ ...current, [section.id]: !open }))}
                                        aria-expanded={open}
                                        aria-controls={listId}
                                        className="sb-section"
                                    >
                                        <span className="sb-fade">{section.label}</span>
                                        <IconChevronDown size={12} strokeWidth={1.75} className="sb-chevron" />
                                    </button>
                                )}
                                <div id={listId} className="sb-collapse" data-open={rail || open} inert={!rail && !open}>
                                    <div className="sb-list">{section.tabs.map(renderItem)}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </nav>

            {rail ? (
                <div className="sb-footer">
                    <Tooltip content="What's new" side="right">
                        <button
                            ref={whatsNewBtnRef}
                            type="button"
                            onClick={() => setWhatsNewOpen((o) => !o)}
                            className="sb-icon-btn relative"
                            aria-label="What's new"
                        >
                            <IconSparkle />
                            {hasNew && <span className="sb-whatsnew-dot" />}
                        </button>
                    </Tooltip>
                    <Popover open={whatsNewOpen} onClose={() => setWhatsNewOpen(false)} anchor={whatsNewBtnRef} side="right" align="end" offset={8}>
                        <div className="w-[264px] p-2">
                            <WhatsNewCard onNavigate={(t) => { setWhatsNewOpen(false); onNavigate(t); }} />
                        </div>
                    </Popover>
                </div>
            ) : (
                <div className="sb-footer">
                    <WhatsNewCard defaultExpanded={defaultWhatsNewExpanded} onNavigate={onNavigate} />
                </div>
            )}
        </aside>
    );

    return asideContent;
}
