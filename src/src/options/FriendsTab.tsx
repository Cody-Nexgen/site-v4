import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
    AtSign,
    Check,
    Copy,
    ExternalLink,
    Flame,
    MoreHorizontal,
    Search,
    Trophy,
    UserMinus,
    UserPlus,
    Users,
} from 'lucide-react';
import { useAuthStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { publicProfileUrl } from '../lib/progressionApi';
import {
    cancelFriendRequest,
    getFriendsWeeklyLeaderboard,
    leaderboardFromFriends,
    listMyFriends,
    listSentRequests,
    removeFriend,
    respondFriendRequest,
    sendFriendRequest,
    type FriendEntry,
    type LeaderboardEntry,
    type PendingFriendRequest,
    type SentFriendRequest,
} from '../lib/socialApi';
import { GlassCard } from './OptionsApp';
import { Banner } from '../components/fz/Banner';
import { Button } from '../components/fz/Button';
import { Dialog } from '../components/fz/Dialog';
import { EmptyState } from '../components/fz/EmptyState';
import { Input } from '../components/fz/Field';
import { IconButton } from '../components/fz/IconButton';
import { Menu, type MenuItem } from '../components/fz/Menu';
import { Skeleton } from '../components/fz/Skeleton';

const REFRESH_MS = 30_000;
const nowMs = () => Date.now();

// ---------------------------------------------------------
// Formatting
// ---------------------------------------------------------

function fmtMinutes(min: number): string {
    const m = Math.max(0, Math.round(min));
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
}

function sentAgo(iso: string | null, now: number): string {
    if (!iso) return 'Sent';
    const days = Math.floor((now - new Date(iso).getTime()) / 86_400_000);
    if (days <= 0) return 'Sent today';
    if (days === 1) return 'Sent yesterday';
    return `Sent ${days} days ago`;
}

/** Minutes left in a live session, or null when not focusing. */
function focusMinutesLeft(friend: FriendEntry, now: number): number | null {
    if (!friend.isFocusing || !friend.sessionEndsAt) return null;
    const left = (new Date(friend.sessionEndsAt).getTime() - now) / 60_000;
    return left > 0 ? Math.ceil(left) : null;
}

const ERRORS: Record<string, string> = {
    USER_NOT_FOUND: 'Nobody has that username. Check the spelling and try again.',
    SELF_REQUEST: "That's your own username.",
    ALREADY_FRIENDS: "You're already friends.",
    PENDING_EXISTS: 'You already sent them a request. It will show up here once they accept.',
    PROFILE_REQUIRED: 'Pick a username in Account settings first so friends can find you.',
    NOT_AUTHENTICATED: 'Your session expired. Sign in again to manage friends.',
};

function friendlyError(code: string | undefined, fallback: string): string {
    if (!code) return fallback;
    return ERRORS[code] ?? fallback;
}

function openPublicProfile(username: string) {
    const url = publicProfileUrl(username);
    if (window.location.protocol.startsWith('http')) window.location.assign(url);
    else window.open(url, '_blank', 'noopener,noreferrer');
}

// ---------------------------------------------------------
// Pieces
// ---------------------------------------------------------

function Avatar({ url, name, size = 36, live = false }: { url: string | null; name: string; size?: number; live?: boolean }) {
    const initial = name.trim().charAt(0).toUpperCase() || '?';
    return (
        <span className="relative shrink-0" style={{ width: size, height: size }}>
            {url ? (
                <img src={url} alt="" className="size-full rounded-full border border-[var(--fz-border)] object-cover" />
            ) : (
                <span
                    className="flex size-full items-center justify-center rounded-full border border-[var(--fz-border)] bg-[var(--fz-bg-active)] font-medium text-[var(--fz-text-2)]"
                    style={{ fontSize: size * 0.38 }}
                >
                    {initial}
                </span>
            )}
            {live && (
                <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-[var(--fz-success)] ring-2 ring-[var(--dashboard-surface-raised)]">
                    <span className="absolute inset-0 animate-ping rounded-full bg-[var(--fz-success)] opacity-40 motion-reduce:hidden" />
                </span>
            )}
        </span>
    );
}

function CardHeader({ title, meta, children }: { title: string; meta?: ReactNode; children?: ReactNode }) {
    return (
        <div className="flex items-center gap-3 px-4 pb-2 pt-4">
            <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-[var(--fz-text-1)]">{title}</p>
                {meta && <p className="text-meta mt-0.5">{meta}</p>}
            </div>
            {children}
        </div>
    );
}

function RowSkeleton({ count = 3 }: { count?: number }) {
    return (
        <div className="divide-y divide-[var(--fz-border)]">
            {Array.from({ length: count }, (_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <Skeleton className="size-9 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3 w-32" />
                        <Skeleton className="h-2.5 w-20" />
                    </div>
                    <Skeleton className="h-3 w-12" />
                </div>
            ))}
        </div>
    );
}

// ---------------------------------------------------------
// Page
// ---------------------------------------------------------

export default function FriendsTab() {
    const { session } = useAuthStore();
    const [friends, setFriends] = useState<FriendEntry[]>([]);
    const [incoming, setIncoming] = useState<PendingFriendRequest[]>([]);
    const [sent, setSent] = useState<SentFriendRequest[]>([]);
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [now, setNow] = useState(nowMs);

    const [handle, setHandle] = useState('');
    const [sending, setSending] = useState(false);
    const [addResult, setAddResult] = useState<{ ok: boolean; text: string; code?: string } | null>(null);
    const [busyIds, setBusyIds] = useState<Record<string, boolean>>({});
    const [query, setQuery] = useState('');
    const [menuFor, setMenuFor] = useState<string | null>(null);
    const [confirmRemove, setConfirmRemove] = useState<FriendEntry | null>(null);
    const [removing, setRemoving] = useState(false);
    const [copied, setCopied] = useState(false);
    const menuAnchor = useRef<HTMLButtonElement | null>(null);

    const accessToken = session?.access_token;
    const refreshToken = session?.refresh_token;
    const tokens = useMemo(
        () => (accessToken && refreshToken ? { access_token: accessToken, refresh_token: refreshToken } : null),
        [accessToken, refreshToken],
    );

    const refresh = useCallback(async () => {
        if (!session || !tokens) return;
        const [friendsRes, lbRes, sentRes] = await Promise.all([
            listMyFriends(supabase, tokens),
            getFriendsWeeklyLeaderboard(supabase, tokens),
            listSentRequests(tokens.access_token),
        ]);
        const nextFriends = friendsRes.ok ? friendsRes.friends : [];
        if (friendsRes.ok) {
            setFriends(nextFriends);
            setIncoming(friendsRes.pending);
        }
        if (sentRes.ok) setSent(sentRes.sent);
        const names = new Set(nextFriends.map((f) => f.username));
        const board = lbRes.ok ? lbRes.leaderboard.filter((e) => e.isMe || names.has(e.username)) : [];
        setLeaderboard(board.length > 0 ? board : leaderboardFromFriends(nextFriends));
        setLoadError(friendsRes.ok ? '' : friendlyError(friendsRes.error, "Couldn't load your friends. Check your connection and try again."));
        setNow(Date.now());
        setLoading(false);
    }, [session, tokens]);

    useEffect(() => {
        if (!session) return;
        const kick = window.setTimeout(() => void refresh(), 0);
        const id = window.setInterval(() => void refresh(), REFRESH_MS);
        const onVisible = () => {
            if (document.visibilityState === 'visible') void refresh();
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            window.clearTimeout(kick);
            window.clearInterval(id);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [refresh, session]);

    // ---- derived --------------------------------------------

    const me = leaderboard.find((e) => e.isMe) ?? null;
    const myHandle = me && me.username !== 'user' ? me.username : null;
    const ranked = useMemo(
        () => [...leaderboard].sort((a, b) => b.weeklyFocusMinutes - a.weeklyFocusMinutes || Number(b.isMe) - Number(a.isMe)),
        [leaderboard],
    );
    const myRank = ranked.findIndex((e) => e.isMe) + 1;
    const leader = ranked[0];
    const focusingNow = friends.filter((f) => focusMinutesLeft(f, now) != null);

    const sortedFriends = useMemo(() => {
        const q = query.trim().toLowerCase().replace(/^@/, '');
        return friends
            .filter((f) => !q || f.displayName.toLowerCase().includes(q) || f.username.toLowerCase().includes(q))
            .sort((a, b) => {
                const la = focusMinutesLeft(a, now) != null ? 1 : 0;
                const lb = focusMinutesLeft(b, now) != null ? 1 : 0;
                return lb - la || b.weeklyFocusMinutes - a.weeklyFocusMinutes || a.displayName.localeCompare(b.displayName);
            });
    }, [friends, query, now]);

    const rankSub = (() => {
        if (!me || ranked.length < 2) return 'Add friends to compete';
        if (myRank === 1) {
            const second = ranked[1];
            const lead = me.weeklyFocusMinutes - second.weeklyFocusMinutes;
            return lead > 0 ? `${fmtMinutes(lead)} ahead of ${second.displayName}` : `Tied with ${second.displayName}`;
        }
        const above = ranked[myRank - 2];
        return `${fmtMinutes(above.weeklyFocusMinutes - me.weeklyFocusMinutes)} behind ${above.displayName}`;
    })();

    // ---- actions --------------------------------------------

    const setBusy = (id: string, busy: boolean) => setBusyIds((b) => ({ ...b, [id]: busy }));

    const handleSend = async () => {
        const name = handle.trim().replace(/^@/, '');
        if (!name || !tokens) return;
        setSending(true);
        setAddResult(null);
        const res = await sendFriendRequest(supabase, name, tokens);
        setSending(false);
        if (res.ok) {
            setHandle('');
            setAddResult({
                ok: true,
                text: res.autoAccepted ? `You and @${name} are now friends.` : `Request sent to @${name}.`,
            });
            void refresh();
        } else {
            setAddResult({ ok: false, code: res.error, text: friendlyError(res.error, "Couldn't send that request. Try again in a moment.") });
        }
    };

    const respond = async (req: PendingFriendRequest, accept: boolean) => {
        if (!tokens) return;
        setBusy(req.friendshipId, true);
        const res = await respondFriendRequest(supabase, req.friendshipId, accept, tokens);
        setBusy(req.friendshipId, false);
        if (res.ok) {
            setIncoming((list) => list.filter((r) => r.friendshipId !== req.friendshipId));
            if (accept) setAddResult({ ok: true, text: `You and ${req.displayName} are now friends.` });
        } else {
            setAddResult({ ok: false, text: friendlyError(res.error, "Couldn't answer that request. Try again.") });
        }
        void refresh();
    };

    const cancelSent = async (req: SentFriendRequest) => {
        if (!tokens) return;
        setBusy(req.friendshipId, true);
        const res = await cancelFriendRequest(tokens.access_token, req.friendshipId);
        setBusy(req.friendshipId, false);
        if (res.ok) setSent((list) => list.filter((r) => r.friendshipId !== req.friendshipId));
        else setAddResult({ ok: false, text: friendlyError(res.error, "Couldn't cancel that request. Try again.") });
    };

    const confirmRemoval = async () => {
        const friend = confirmRemove;
        if (!friend || !tokens) return;
        setRemoving(true);
        const res = await removeFriend(tokens.access_token, friend.userId);
        setRemoving(false);
        setConfirmRemove(null);
        if (res.ok) {
            setFriends((list) => list.filter((f) => f.userId !== friend.userId));
            setLeaderboard((list) => list.filter((e) => e.isMe || e.username !== friend.username));
            void refresh();
        } else {
            setAddResult({ ok: false, text: friendlyError(res.error, `Couldn't remove ${friend.displayName}. Try again.`) });
        }
    };

    const copyHandle = async () => {
        if (!myHandle) return;
        try {
            await navigator.clipboard.writeText(`@${myHandle}`);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1600);
        } catch {
            /* clipboard blocked — the handle is visible anyway */
        }
    };

    const menuFriend = friends.find((f) => f.userId === menuFor) ?? null;
    const menuItems: MenuItem[] = menuFriend
        ? [
            ...(menuFriend.publicProfileEnabled && menuFriend.username.length >= 3
                ? [{ id: 'profile', label: 'View public profile', icon: <ExternalLink size={14} />, onSelect: () => openPublicProfile(menuFriend.username) }]
                : []),
            {
                id: 'copy',
                label: 'Copy username',
                icon: <Copy size={14} />,
                onSelect: () => void navigator.clipboard?.writeText(`@${menuFriend.username}`).catch(() => undefined),
            },
            { type: 'separator', id: 'sep' },
            { id: 'remove', label: 'Remove friend', icon: <UserMinus size={14} />, danger: true, onSelect: () => setConfirmRemove(menuFriend) },
        ]
        : [];

    // ---- render ---------------------------------------------

    if (!session) {
        return (
            <div className="space-y-6 animate-fade-in-up">
                <GlassCard>
                    <EmptyState
                        icon={<Users size={16} />}
                        title="Sign in to use Friends"
                        description="Add friends by username, see who's focusing right now, and compete on the weekly leaderboard."
                    />
                </GlassCard>
            </div>
        );
    }

    const requestCount = incoming.length + sent.length;

    return (
        <div className="space-y-6 animate-fade-in-up">
            {loadError && (
                <Banner tone="danger" onDismiss={() => setLoadError('')}>
                    {loadError}{' '}
                    <button type="button" className="font-medium underline underline-offset-2" onClick={() => void refresh()}>
                        Retry
                    </button>
                </Banner>
            )}

            {/* Summary */}
            <GlassCard>
                <div className="grid grid-cols-2 sm:grid-cols-4 sm:divide-x sm:divide-[var(--fz-border)]">
                    {[
                        {
                            label: 'Friends',
                            value: loading ? '—' : friends.length,
                            sub: incoming.length
                                ? `${incoming.length} request${incoming.length === 1 ? '' : 's'} waiting`
                                : friends.length ? 'Focus is better together' : 'Add someone below',
                        },
                        {
                            label: 'Focusing now',
                            value: loading ? '—' : focusingNow.length,
                            sub: focusingNow.length
                                ? focusingNow.length === 1
                                    ? focusingNow[0].displayName
                                    : `${focusingNow[0].displayName} and ${focusingNow.length - 1} more`
                                : 'Nobody right now',
                        },
                        {
                            label: 'Your week',
                            value: me ? fmtMinutes(me.weeklyFocusMinutes) : '—',
                            sub: 'Focus time since Monday',
                        },
                        {
                            label: 'Your rank',
                            value: me && ranked.length > 1 ? `#${myRank}` : '—',
                            sub: loading ? 'Loading…' : rankSub,
                        },
                    ].map((s) => (
                        <div key={s.label} className="min-w-0 px-5 py-4">
                            <p className="text-meta">{s.label}</p>
                            <p className="mt-0.5 truncate text-[22px] font-semibold leading-7 tabular-nums text-[var(--fz-text-1)]">{s.value}</p>
                            <p className="text-meta mt-0.5 truncate">{s.sub}</p>
                        </div>
                    ))}
                </div>
            </GlassCard>

            {/* Add a friend */}
            <GlassCard>
                <div className="flex flex-col gap-4 p-4 md:flex-row md:items-end">
                    <form
                        className="min-w-0 flex-1"
                        onSubmit={(e) => {
                            e.preventDefault();
                            void handleSend();
                        }}
                    >
                        <label htmlFor="friend-handle" className="text-[14px] font-semibold text-[var(--fz-text-1)]">
                            Add a friend
                        </label>
                        <p className="text-meta mt-0.5">They'll get a request and show up here once they accept.</p>
                        <div className="mt-3 flex gap-2">
                            <div className="relative min-w-0 flex-1">
                                <AtSign size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--fz-text-4)]" />
                                <Input
                                    id="friend-handle"
                                    value={handle}
                                    onChange={(e) => {
                                        setHandle(e.target.value.replace(/^@+/, ''));
                                        if (addResult && !addResult.ok) setAddResult(null);
                                    }}
                                    placeholder="username"
                                    autoComplete="off"
                                    spellCheck={false}
                                    invalid={addResult?.ok === false}
                                    className="h-9 pl-8"
                                />
                            </div>
                            <Button type="submit" variant="primary" size="lg" loading={sending} disabled={!handle.trim()} iconLeft={<UserPlus size={14} />}>
                                Send request
                            </Button>
                        </div>
                        {addResult && (
                            <p
                                role="status"
                                className={`mt-2 flex items-center gap-1.5 text-[12px] ${addResult.ok ? 'text-[var(--fz-success)]' : 'text-[var(--fz-danger)]'}`}
                            >
                                {addResult.ok && <Check size={13} />}
                                {addResult.text}
                                {addResult.code === 'PROFILE_REQUIRED' && (
                                    <button
                                        type="button"
                                        className="font-medium underline underline-offset-2"
                                        onClick={() => window.dispatchEvent(new CustomEvent('focuznow-navigate-tab', { detail: 'account' }))}
                                    >
                                        Open Account
                                    </button>
                                )}
                            </p>
                        )}
                    </form>

                    {myHandle && (
                        <div className="shrink-0 rounded-lg border border-[var(--fz-border)] px-3.5 py-2.5 md:w-64">
                            <p className="text-meta">Your username</p>
                            <div className="mt-0.5 flex items-center justify-between gap-2">
                                <p className="truncate text-[14px] font-medium text-[var(--fz-text-1)]">@{myHandle}</p>
                                <IconButton
                                    icon={copied ? <Check size={14} /> : <Copy size={14} />}
                                    tooltip={copied ? 'Copied' : 'Copy username'}
                                    onClick={() => void copyHandle()}
                                />
                            </div>
                            <p className="text-meta mt-0.5">Share it so friends can add you.</p>
                        </div>
                    )}
                </div>
            </GlassCard>

            {/* Requests */}
            {requestCount > 0 && (
                <GlassCard>
                    <CardHeader
                        title="Requests"
                        meta={[
                            incoming.length ? `${incoming.length} waiting for you` : null,
                            sent.length ? `${sent.length} sent` : null,
                        ].filter(Boolean).join(' · ')}
                    />
                    <div className="divide-y divide-[var(--fz-border)] border-t border-[var(--fz-border)]">
                        {incoming.map((r) => (
                            <div key={r.friendshipId} className="flex items-center gap-3 px-4 py-3">
                                <Avatar url={r.avatarUrl} name={r.displayName} />
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-[13px] font-medium text-[var(--fz-text-1)]">{r.displayName}</p>
                                    <p className="text-meta truncate">@{r.username} wants to be friends</p>
                                </div>
                                <Button size="sm" variant="ghost" disabled={busyIds[r.friendshipId]} onClick={() => void respond(r, false)}>
                                    Decline
                                </Button>
                                <Button size="sm" variant="primary" loading={busyIds[r.friendshipId]} onClick={() => void respond(r, true)}>
                                    Accept
                                </Button>
                            </div>
                        ))}
                        {sent.map((r) => (
                            <div key={r.friendshipId} className="flex items-center gap-3 px-4 py-3">
                                <Avatar url={r.avatarUrl} name={r.displayName} />
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-[13px] font-medium text-[var(--fz-text-1)]">{r.displayName}</p>
                                    <p className="text-meta truncate">@{r.username} · {sentAgo(r.sentAt, now)}</p>
                                </div>
                                <span className="text-meta hidden sm:inline">Waiting</span>
                                <Button size="sm" variant="ghost" loading={busyIds[r.friendshipId]} onClick={() => void cancelSent(r)}>
                                    Cancel
                                </Button>
                            </div>
                        ))}
                    </div>
                </GlassCard>
            )}

            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
                {/* Friends */}
                <GlassCard>
                    <CardHeader
                        title="Friends"
                        meta={loading ? undefined : friends.length ? `${friends.length} ${friends.length === 1 ? 'friend' : 'friends'} · live status updates every 30 seconds` : undefined}
                    >
                        {friends.length > 5 && (
                            <div className="relative w-44">
                                <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--fz-text-4)]" />
                                <Input
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Search friends"
                                    aria-label="Search friends"
                                    className="pl-7 text-[12px]"
                                />
                            </div>
                        )}
                    </CardHeader>
                    <div className="border-t border-[var(--fz-border)]">
                        {loading ? (
                            <RowSkeleton />
                        ) : friends.length === 0 ? (
                            <EmptyState
                                icon={<Users size={16} />}
                                title="No friends yet"
                                description="Send a request with someone's username above. You'll see when they're focusing and how your weeks compare."
                            />
                        ) : sortedFriends.length === 0 ? (
                            <p className="px-4 py-8 text-center text-body-sm text-[var(--fz-text-3)]">No friends match “{query}”.</p>
                        ) : (
                            <div className="divide-y divide-[var(--fz-border)]">
                                {sortedFriends.map((f) => {
                                    const left = focusMinutesLeft(f, now);
                                    return (
                                        <div key={f.userId || f.username} className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--fz-bg-hover)]">
                                            <Avatar url={f.avatarUrl} name={f.displayName} live={left != null} />
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-[13px] font-medium text-[var(--fz-text-1)]">{f.displayName}</p>
                                                <p className="text-meta flex min-w-0 items-center gap-1.5 overflow-hidden">
                                                    <span className="truncate">@{f.username}</span>
                                                    <span aria-hidden>·</span>
                                                    <span className="shrink-0">Level {f.level}</span>
                                                    {f.streak > 0 && (
                                                        <>
                                                            <span aria-hidden>·</span>
                                                            <span className="inline-flex shrink-0 items-center gap-0.5" title={`${f.streak}-day streak`}>
                                                                <Flame size={11} />
                                                                {f.streak}d
                                                            </span>
                                                        </>
                                                    )}
                                                </p>
                                                {/* Phones: status goes under the name instead of a right column */}
                                                <p className={`text-meta mt-0.5 sm:hidden ${left != null ? 'font-medium text-[var(--fz-success)]' : ''}`}>
                                                    {left != null ? `Focusing · ${left}m left` : `${fmtMinutes(f.weeklyFocusMinutes)} this week`}
                                                </p>
                                            </div>
                                            <div className="hidden shrink-0 text-right sm:block">
                                                {left != null ? (
                                                    <p className="text-[12px] font-medium text-[var(--fz-success)]">Focusing · {left}m left</p>
                                                ) : (
                                                    <p className="text-[12px] text-[var(--fz-text-3)]">Not focusing</p>
                                                )}
                                                <p className="text-meta whitespace-nowrap tabular-nums">{fmtMinutes(f.weeklyFocusMinutes)} this week</p>
                                            </div>
                                            <IconButton
                                                icon={<MoreHorizontal size={15} />}
                                                tooltip={`Options for ${f.displayName}`}
                                                active={menuFor === f.userId}
                                                onClick={(e) => {
                                                    menuAnchor.current = e.currentTarget;
                                                    setMenuFor(f.userId);
                                                }}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </GlassCard>

                {/* Leaderboard */}
                <GlassCard>
                    <CardHeader title="This week" meta="Focus time among you and your friends · resets Monday" />
                    <div className="border-t border-[var(--fz-border)]">
                        {loading ? (
                            <RowSkeleton count={4} />
                        ) : ranked.length < 2 ? (
                            <EmptyState
                                icon={<Trophy size={16} />}
                                title="No one to race yet"
                                description="Once you have friends, your weekly focus time lines up against theirs here."
                            />
                        ) : (
                            <ol className="py-1.5">
                                {ranked.map((e, i) => {
                                    const pct = leader && leader.weeklyFocusMinutes > 0 ? (e.weeklyFocusMinutes / leader.weeklyFocusMinutes) * 100 : 0;
                                    return (
                                        <li
                                            key={`${e.username}-${i}`}
                                            className={`mx-1.5 flex items-center gap-3 rounded-lg px-2.5 py-2 ${e.isMe ? 'bg-[var(--fz-bg-active)]' : ''}`}
                                        >
                                            <span
                                                className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums ${
                                                    i === 0 && e.weeklyFocusMinutes > 0
                                                        ? 'bg-[var(--fz-accent)] text-[var(--fz-accent-fg)]'
                                                        : 'text-[var(--fz-text-3)]'
                                                }`}
                                            >
                                                {i + 1}
                                            </span>
                                            <Avatar url={e.avatarUrl} name={e.displayName} size={28} />
                                            <div className="min-w-0 flex-1">
                                                <p className="flex items-center gap-1.5 truncate text-[13px] font-medium text-[var(--fz-text-1)]">
                                                    <span className="truncate">{e.displayName}</span>
                                                    {e.isMe && <span className="text-meta shrink-0">You</span>}
                                                </p>
                                                <span className="mt-1 block h-1 overflow-hidden rounded-full bg-[var(--fz-bg-active)]">
                                                    <span
                                                        className={`block h-full rounded-full ${e.isMe ? 'bg-[var(--fz-accent)]' : 'bg-[var(--fz-text-4)]'}`}
                                                        style={{ width: `${Math.max(pct, e.weeklyFocusMinutes > 0 ? 3 : 0)}%` }}
                                                    />
                                                </span>
                                            </div>
                                            <span className="shrink-0 whitespace-nowrap pl-1 text-right text-[13px] font-semibold tabular-nums text-[var(--fz-text-1)]">
                                                {fmtMinutes(e.weeklyFocusMinutes)}
                                            </span>
                                        </li>
                                    );
                                })}
                            </ol>
                        )}
                    </div>
                </GlassCard>
            </div>

            <Menu open={!!menuFriend} onClose={() => setMenuFor(null)} anchor={menuAnchor} align="end" items={menuItems} />

            <Dialog
                open={!!confirmRemove}
                onClose={() => !removing && setConfirmRemove(null)}
                title={confirmRemove ? `Remove ${confirmRemove.displayName}?` : 'Remove friend?'}
                description="You'll stop seeing each other's focus status and leave each other's leaderboard. You can send a new request any time."
                size="sm"
                footer={
                    <>
                        <Button variant="ghost" disabled={removing} onClick={() => setConfirmRemove(null)}>
                            Cancel
                        </Button>
                        <Button variant="danger-solid" loading={removing} onClick={() => void confirmRemoval()} data-autofocus>
                            Remove friend
                        </Button>
                    </>
                }
            >
                {null}
            </Dialog>
        </div>
    );
}
