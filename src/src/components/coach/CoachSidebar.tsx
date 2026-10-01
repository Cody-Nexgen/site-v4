import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Ellipsis, Images, SlidersHorizontal, SquarePen } from 'lucide-react';
import { BeamZMark } from '../BeamZMark';
import { IconButton } from '../fz/IconButton';
import { Dialog } from '../fz/Dialog';
import { Button } from '../fz/Button';
import { IconPanelLeftClose, IconSearch } from '../fz/icons';
import { formatPercent } from '../../lib/coach/usage';

export type CoachChatItem = { id: string; title: string };
export type CoachSidebarView = 'chats' | 'library';

/** Fair-use token-budget consumption, as percentages (0–100). */
export type CoachUsageSummary = {
    dayPct: number;
    weekPct: number;
    thinkPct: number;
    isPro: boolean;
};

export type CoachSidebarProps = {
    chats: CoachChatItem[];
    activeChatId?: string | null;
    view: CoachSidebarView;
    onViewChange: (v: CoachSidebarView) => void;
    onNewChat: () => void;
    onSelectChat: (id: string) => void;
    onRenameChat: (id: string, title: string) => void;
    onDeleteChat: (id: string) => void;
    userName: string;
    userPlan: string;
    onOpenAccount: () => void;
    onCollapse: () => void;
    onRowClick?: () => void;
    modelOptions: string[];
    model: string;
    onModelChange: (label: string) => void;
    usage: CoachUsageSummary;
    onClearChats: () => void;
};

const NAV: { id: CoachSidebarView | 'new'; label: string; icon: React.ReactNode }[] = [
    { id: 'new', label: 'New chat', icon: <SquarePen size={16} strokeWidth={1.5} /> },
    { id: 'library', label: 'Library', icon: <Images size={16} strokeWidth={1.5} /> },
];

function NavRow({
    icon,
    label,
    active = false,
    onClick,
}: {
    icon: React.ReactNode;
    label: string;
    active?: boolean;
    onClick?: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            data-active={active || undefined}
            className="coach-nav-row group flex h-8 w-full items-center gap-2.5 rounded-lg px-2 text-left text-[14px] text-[var(--fz-text-2)] transition-colors hover:bg-[var(--fz-bg-hover)] hover:text-[var(--fz-text-1)] focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--fz-focus-ring)] data-[active]:bg-[var(--fz-bg-active)] data-[active]:text-[var(--fz-text-1)] data-[active]:shadow-[var(--fz-edge)]"
        >
            <span className="flex size-4 shrink-0 items-center justify-center text-[var(--fz-text-3)] transition-colors group-hover:text-[var(--fz-text-2)] group-data-[active]:text-[var(--fz-text-1)]">
                {icon}
            </span>
            <span className="min-w-0 flex-1 truncate">{label}</span>
        </button>
    );
}

function ChatRow({
    chat,
    active,
    renaming,
    onClick,
    onMenu,
    onRenameSubmit,
    onRenameCancel,
}: {
    chat: CoachChatItem;
    active: boolean;
    renaming: boolean;
    onClick: () => void;
    onMenu: (rect: DOMRect) => void;
    onRenameSubmit: (title: string) => void;
    onRenameCancel: () => void;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    useEffect(() => {
        if (renaming) {
            inputRef.current?.focus();
            inputRef.current?.select();
        }
    }, [renaming]);

    if (renaming) {
        return (
            <div className="flex h-8 items-center rounded-lg bg-[var(--fz-bg-active)] px-2 shadow-[var(--fz-edge)]">
                <input
                    ref={inputRef}
                    defaultValue={chat.title}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') onRenameSubmit((e.target as HTMLInputElement).value);
                        if (e.key === 'Escape') onRenameCancel();
                    }}
                    onBlur={(e) => onRenameSubmit(e.target.value)}
                    className="w-full bg-transparent text-[14px] text-[var(--fz-text-1)] outline-none"
                />
            </div>
        );
    }

    return (
        <button
            type="button"
            onClick={onClick}
            data-active={active || undefined}
            className="group relative flex h-8 w-full items-center rounded-lg px-2 text-left text-[14px] text-[var(--fz-text-2)] transition-colors hover:bg-[var(--fz-bg-hover)] hover:text-[var(--fz-text-1)] focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--fz-focus-ring)] data-[active]:bg-[var(--fz-bg-active)] data-[active]:text-[var(--fz-text-1)]"
        >
            <span className="min-w-0 flex-1 truncate">{chat.title || 'New chat'}</span>
            <span
                role="button"
                tabIndex={-1}
                aria-label={`Options for ${chat.title}`}
                onClick={(e) => {
                    e.stopPropagation();
                    onMenu((e.currentTarget as HTMLElement).getBoundingClientRect());
                }}
                className="absolute right-1 flex size-6 items-center justify-center rounded-md bg-[var(--fz-bg-hover)] text-[var(--fz-text-3)] opacity-0 transition-opacity hover:bg-[var(--fz-bg-active)] hover:text-[var(--fz-text-1)] focus-visible:opacity-100 group-hover:opacity-100"
            >
                <Ellipsis size={14} strokeWidth={1.75} />
            </span>
        </button>
    );
}

/** Row context menu (fixed-position, closes on outside click / Esc). */
function RowMenu({
    point,
    onRename,
    onDelete,
    onClose,
}: {
    point: { x: number; y: number };
    onRename: () => void;
    onDelete: () => void;
    onClose: () => void;
}) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const onDoc = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('mousedown', onDoc);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDoc);
            document.removeEventListener('keydown', onKey);
        };
    }, [onClose]);

    const itemCls =
        'flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-[13px] text-[var(--fz-text-2)] hover:bg-[var(--fz-bg-hover)] hover:text-[var(--fz-text-1)]';
    return createPortal(
        <div
            ref={ref}
            className="fixed z-50 w-36 rounded-xl border border-[var(--fz-border)] bg-[var(--fz-bg-overlay)] p-1 backdrop-blur"
            style={{
                left: Math.min(point.x, window.innerWidth - 152),
                top: Math.min(point.y, window.innerHeight - 90),
                boxShadow: 'var(--fz-elev-card)',
            }}
        >
            <button type="button" className={itemCls} onClick={() => { onClose(); onRename(); }}>
                Rename
            </button>
            <button
                type="button"
                className={`${itemCls} text-[var(--fz-danger)] hover:text-[var(--fz-danger)]`}
                onClick={() => { onClose(); onDelete(); }}
            >
                Delete
            </button>
        </div>,
        document.body,
    );
}

function UsageMeter({ label, pct }: { label: string; pct: number }) {
    return (
        <div>
            <div className="flex items-baseline justify-between text-[12px]">
                <span className="text-[var(--fz-text-3)]">{label}</span>
                <span className="tabular-nums font-medium text-[var(--fz-text-1)]">
                    {formatPercent(pct)}
                    <span className="text-[var(--fz-text-4)]">%</span>
                </span>
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-[var(--fz-bg-hover)]">
                <div
                    className="h-full rounded-full bg-[var(--fz-accent)] transition-[width] duration-500"
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    );
}

/** Coach settings popover — usage meters, model default, preferences. */
function SettingsPanel({
    usage,
    modelOptions,
    model,
    onModelChange,
    onClearChats,
    onClose,
    onUpgrade,
}: {
    usage: CoachUsageSummary;
    modelOptions: string[];
    model: string;
    onModelChange: (label: string) => void;
    onClearChats: () => void;
    onClose: () => void;
    onUpgrade: () => void;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const [armClear, setArmClear] = useState(false);
    useEffect(() => {
        const onDoc = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('mousedown', onDoc);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDoc);
            document.removeEventListener('keydown', onKey);
        };
    }, [onClose]);
    useEffect(() => {
        if (!armClear) return;
        const t = window.setTimeout(() => setArmClear(false), 4000);
        return () => window.clearTimeout(t);
    }, [armClear]);

    const eyebrow = 'px-1 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--fz-text-4)]';
    return (
        <div
            ref={ref}
            className="absolute inset-x-2 bottom-[calc(100%+8px)] z-30 rounded-xl border border-[var(--fz-border)] bg-[var(--fz-bg-overlay)] p-2.5 backdrop-blur"
            style={{ boxShadow: 'var(--fz-elev-card)' }}
        >
            <p className={eyebrow}>Usage</p>
            <div className="mt-2 space-y-2 px-1">
                <UsageMeter label="Today" pct={usage.dayPct} />
                <UsageMeter label="This week" pct={usage.weekPct} />
                {usage.isPro && <UsageMeter label="Think today" pct={usage.thinkPct} />}
            </div>
            <p className="mt-2 px-1 text-[11px] leading-4 text-[var(--fz-text-4)]">
                {usage.isPro
                    ? 'Fair-use limits keep Pro fast — and at $8/mo.'
                    : 'Free plan limits.'}{' '}
                {!usage.isPro && (
                    <button
                        type="button"
                        onClick={onUpgrade}
                        className="font-medium text-[var(--fz-text-2)] underline underline-offset-2 hover:text-[var(--fz-text-1)]"
                    >
                        Upgrade
                    </button>
                )}
            </p>

            <div className="my-2.5 h-px bg-[var(--fz-border)]" />
            <p className={eyebrow}>Coach</p>
            <div className="mt-1.5 flex gap-0.5 rounded-lg border border-[var(--fz-border)] bg-[var(--fz-bg-raised)] p-0.5">
                {modelOptions.map((label) => (
                    <button
                        key={label}
                        type="button"
                        onClick={() => onModelChange(label)}
                        data-active={model === label || undefined}
                        className="flex-1 rounded-md px-2 py-1 text-[12px] font-medium text-[var(--fz-text-3)] transition-colors hover:text-[var(--fz-text-1)] data-[active]:bg-[var(--fz-bg-active)] data-[active]:text-[var(--fz-text-1)] data-[active]:shadow-[var(--fz-edge)]"
                    >
                        {label.replace('FocuzAI ', '')}
                    </button>
                ))}
            </div>
            <div className="my-2.5 h-px bg-[var(--fz-border)]" />
            <button
                type="button"
                onClick={() => {
                    if (armClear) {
                        setArmClear(false);
                        onClearChats();
                        onClose();
                    } else {
                        setArmClear(true);
                    }
                }}
                className={`w-full rounded-lg px-1 py-1.5 text-left text-[13px] transition-colors ${
                    armClear
                        ? 'bg-[var(--fz-bg-hover)] font-medium text-[var(--fz-danger)]'
                        : 'text-[var(--fz-text-3)] hover:bg-[var(--fz-bg-hover)] hover:text-[var(--fz-danger)]'
                }`}
            >
                {armClear ? 'Really delete every chat?' : 'Clear all chats'}
            </button>
        </div>
    );
}

/** AI Coach inner sidebar — ChatGPT-desktop grammar on fz tokens. */
export function CoachSidebar({
    chats,
    activeChatId,
    view,
    onViewChange,
    onNewChat,
    onSelectChat,
    onRenameChat,
    onDeleteChat,
    userName,
    userPlan,
    onOpenAccount,
    onCollapse,
    onRowClick,
    modelOptions,
    model,
    onModelChange,
    usage,
    onClearChats,
}: CoachSidebarProps) {
    const [searchOpen, setSearchOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [menu, setMenu] = useState<{ id: string; point: { x: number; y: number } } | null>(null);
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const searchRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (searchOpen) searchRef.current?.focus();
    }, [searchOpen]);

    const filtered = query.trim()
        ? chats.filter((c) => c.title.toLowerCase().includes(query.trim().toLowerCase()))
        : chats;

    const initials =
        userName
            .split(/\s+/)
            .map((w) => w[0])
            .slice(0, 2)
            .join('')
            .toUpperCase() || 'F';

    return (
        <aside className="flex h-full w-[260px] shrink-0 flex-col border-r border-[var(--fz-border)] bg-[var(--fz-bg-app)]">
            {/* Header */}
            <div className="flex h-12 shrink-0 items-center justify-between px-3">
                <div className="flex items-center gap-2">
                    <BeamZMark size={20} title="" />
                    <span className="text-[15px] font-semibold text-[var(--fz-text-1)]">Coach</span>
                </div>
                <div className="flex items-center gap-1">
                    <IconButton
                        icon={<IconSearch size={16} />}
                        tooltip="Search chats"
                        tooltipSide="bottom"
                        aria-label="Search chats"
                        active={searchOpen}
                        onClick={() => {
                            setSearchOpen((v) => !v);
                            if (searchOpen) setQuery('');
                        }}
                    />
                    <button type="button" onClick={onCollapse} className="sb-icon-btn" aria-label="Collapse sidebar" title="Collapse sidebar">
                        <IconPanelLeftClose />
                    </button>
                </div>
            </div>

            {/* Inline search field */}
            {searchOpen && (
                <div className="shrink-0 px-2 pb-1">
                    <input
                        ref={searchRef}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                                setSearchOpen(false);
                                setQuery('');
                            }
                        }}
                        placeholder="Search chats"
                        className="h-8 w-full rounded-lg border border-[var(--fz-border)] bg-[var(--fz-bg-raised)] px-2.5 text-[13px] text-[var(--fz-text-1)] outline-none placeholder:text-[var(--fz-text-4)] focus:border-[var(--fz-border-strong)]"
                    />
                </div>
            )}

            {/* Nav rows */}
            <nav className="mt-1 shrink-0 space-y-0.5 px-2">
                {NAV.map((n) =>
                    n.id === 'new' ? (
                        <NavRow key={n.id} icon={n.icon} label={n.label} onClick={onNewChat} />
                    ) : (
                        <NavRow
                            key={n.id}
                            icon={n.icon}
                            label={n.label}
                            active={view === n.id}
                            onClick={() => onViewChange(n.id as CoachSidebarView)}
                        />
                    ),
                )}
            </nav>

            {/* Chats */}
            <div className="mt-4 shrink-0 px-3 text-[13px] font-medium text-[var(--fz-text-4)]">
                Chats
            </div>
            <div className="coach-chat-scroll relative mt-1 min-h-0 flex-1 overflow-y-auto px-2 pb-2">
                <div className="space-y-0.5">
                    {filtered.length === 0 ? (
                        <p className="px-2 py-4 text-[13px] text-[var(--fz-text-4)]">
                            {query ? 'No matches' : 'No chats yet'}
                        </p>
                    ) : (
                        filtered.map((chat) => (
                            <ChatRow
                                key={chat.id}
                                chat={chat}
                                active={view === 'chats' && activeChatId === chat.id}
                                renaming={renamingId === chat.id}
                                onClick={() => {
                                    onViewChange('chats');
                                    onSelectChat(chat.id);
                                    onRowClick?.();
                                }}
                                onMenu={(rect) =>
                                    setMenu({ id: chat.id, point: { x: rect.right - 140, y: rect.bottom + 4 } })
                                }
                                onRenameSubmit={(title) => {
                                    setRenamingId(null);
                                    const next = title.trim();
                                    if (next && next !== chat.title) onRenameChat(chat.id, next);
                                }}
                                onRenameCancel={() => setRenamingId(null)}
                            />
                        ))
                    )}
                </div>
            </div>
            <div
                aria-hidden
                className="pointer-events-none -mt-8 h-8 shrink-0"
                style={{ background: 'linear-gradient(180deg, transparent, var(--fz-bg-app))' }}
            />

            {/* Footer */}
            <div className="relative flex h-14 shrink-0 items-center gap-1 border-t border-[var(--fz-border)] px-3">
                <button
                    type="button"
                    onClick={onOpenAccount}
                    className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-1 py-1.5 text-left transition-colors hover:bg-[var(--fz-bg-hover)] focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--fz-focus-ring)]"
                >
                    <span className="sb-avatar shrink-0" style={{ width: 28, height: 28, borderRadius: '50%', fontSize: 12 }}>
                        {initials}
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium leading-4 text-[var(--fz-text-1)]">{userName}</span>
                        <span className="block text-[12px] leading-4 text-[var(--fz-text-3)]">{userPlan}</span>
                    </span>
                </button>
                <IconButton
                    icon={<SlidersHorizontal size={15} strokeWidth={1.5} />}
                    tooltip="Coach settings"
                    tooltipSide="top"
                    aria-label="Coach settings"
                    active={settingsOpen}
                    onClick={() => setSettingsOpen((v) => !v)}
                />
                {settingsOpen && (
                    <SettingsPanel
                        usage={usage}
                        modelOptions={modelOptions}
                        model={model}
                        onModelChange={onModelChange}
                        onClearChats={onClearChats}
                        onClose={() => setSettingsOpen(false)}
                        onUpgrade={() => {
                            setSettingsOpen(false);
                            onOpenAccount();
                        }}
                    />
                )}
            </div>

            {menu && (
                <RowMenu
                    point={menu.point}
                    onRename={() => setRenamingId(menu.id)}
                    onDelete={() => setConfirmDeleteId(menu.id)}
                    onClose={() => setMenu(null)}
                />
            )}

            <Dialog
                open={confirmDeleteId !== null}
                onClose={() => setConfirmDeleteId(null)}
                title="Delete chat"
                size="sm"
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setConfirmDeleteId(null)}>
                            Cancel
                        </Button>
                        <Button
                            variant="danger-solid"
                            onClick={() => {
                                if (confirmDeleteId) onDeleteChat(confirmDeleteId);
                                setConfirmDeleteId(null);
                            }}
                        >
                            Delete
                        </Button>
                    </>
                }
            >
                <p className="text-[14px] text-[var(--fz-text-2)]">
                    This chat will be permanently deleted.
                </p>
            </Dialog>
        </aside>
    );
}
