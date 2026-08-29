import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Trophy, UserPlus, Users, X } from 'lucide-react';
import { useAuthStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { publicProfileUrl } from '../lib/progressionApi';
import {
    getFriendsWeeklyLeaderboard,
    leaderboardFromFriends,
    listMyFriends,
    respondFriendRequest,
    sendFriendRequest,
    type FriendEntry,
    type LeaderboardEntry,
    type PendingFriendRequest,
} from '../lib/socialApi';
import {
    PROFILE_AVATAR_FALLBACK_CLASS,
    PROFILE_AVATAR_IMG_CLASS,
} from '../lib/profileAvatar';

const CARD_CLASS =
    'surface-card rounded-2xl bg-[var(--dashboard-surface-raised)]';
const PRIMARY_BTN_CLASS =
    'px-4 py-2 rounded-xl bg-[var(--dashboard-text)] text-[var(--dashboard-bg)] text-xs font-semibold hover:opacity-90';

function Avatar({ url, name }: { url: string | null; name: string }) {
    const initial = name.charAt(0).toUpperCase() || '?';
    if (url) return <img src={url} alt="" className={PROFILE_AVATAR_IMG_CLASS} />;
    return <div className={PROFILE_AVATAR_FALLBACK_CLASS}>{initial}</div>;
}

function openPublicProfile(username: string) {
    const url = publicProfileUrl(username);
    if (typeof window === 'undefined') return;
    if (window.location.protocol.startsWith('http')) {
        window.location.assign(url);
        return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
}

function FriendRow({ friend }: { friend: FriendEntry }) {
    const endsAt = friend.sessionEndsAt ? new Date(friend.sessionEndsAt) : null;
    const focusing = friend.isFocusing && endsAt && endsAt.getTime() > Date.now();
    const canOpen = friend.publicProfileEnabled && friend.username.length >= 3;

    return (
        <div
            className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                canOpen
                    ? 'cursor-pointer hover:bg-[var(--dashboard-interactive)]'
                    : 'hover:bg-[var(--dashboard-interactive)]'
            }`}
            role={canOpen ? 'link' : undefined}
            tabIndex={canOpen ? 0 : undefined}
            onClick={() => {
                if (canOpen) openPublicProfile(friend.username);
            }}
            onKeyDown={(event) => {
                if (!canOpen) return;
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openPublicProfile(friend.username);
                }
            }}
            title={canOpen ? `Open @${friend.username}'s public focus profile` : undefined}
        >
            <div className="relative shrink-0">
                <Avatar url={friend.avatarUrl} name={friend.displayName} />
                {focusing && (
                    <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-[var(--dashboard-surface-raised)]" />
                )}
            </div>
            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[var(--dashboard-text)]">{friend.displayName}</p>
                <p className="truncate text-xs text-[var(--dashboard-text-muted)]">
                    @{friend.username} · Lv <span className="tabular-nums">{friend.level}</span>
                    {canOpen ? ' · Public profile' : ''}
                </p>
            </div>
            <div className="shrink-0 text-right">
                {focusing ? (
                    <p className="text-xs font-medium text-emerald-500">Focusing</p>
                ) : (
                    <p className="text-xs text-[var(--dashboard-text-muted)]">Idle</p>
                )}
                <p className="mt-0.5 text-xs tabular-nums text-[var(--dashboard-text-muted)]">{friend.streak}d streak</p>
            </div>
        </div>
    );
}

export default function FriendsTab() {
    const { session } = useAuthStore();
    const [friends, setFriends] = useState<FriendEntry[]>([]);
    const [pending, setPending] = useState<PendingFriendRequest[]>([]);
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [username, setUsername] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    const tokens = useMemo(
        () =>
            session?.access_token && session?.refresh_token
                ? { access_token: session.access_token, refresh_token: session.refresh_token }
                : null,
        [session?.access_token, session?.refresh_token],
    );

    const refresh = useCallback(async () => {
        if (!session) {
            setLoading(false);
            return;
        }
        setError('');
        const [friendsRes, lbRes] = await Promise.all([
            listMyFriends(supabase, tokens),
            getFriendsWeeklyLeaderboard(supabase, tokens),
        ]);
        const nextFriends = friendsRes.ok ? friendsRes.friends : [];
        const friendNames = new Set(nextFriends.map((friend) => friend.username));
        if (friendsRes.ok) {
            setFriends(nextFriends);
            setPending(friendsRes.pending);
        } else {
            setError(friendsRes.error ?? 'Could not load friends');
        }
        const rpcBoard = lbRes.ok ? lbRes.leaderboard.filter((entry) => entry.isMe || friendNames.has(entry.username)) : [];
        setLeaderboard(rpcBoard.length > 0 ? rpcBoard : leaderboardFromFriends(nextFriends));
        if (!lbRes.ok && !friendsRes.ok) {
            setError(lbRes.error ?? friendsRes.error ?? 'Could not load social data');
        }
        setLoading(false);
    }, [session, tokens]);

    useEffect(() => {
        void refresh();
        const id = window.setInterval(() => void refresh(), 30000);
        return () => window.clearInterval(id);
    }, [refresh]);

    const handleSendRequest = async () => {
        const handle = username.trim().replace(/^@/, '');
        if (!handle) return;
        setSending(true);
        setError('');
        const res = await sendFriendRequest(supabase, handle, tokens);
        setSending(false);
        if (res.ok) {
            setNotice(`Request sent to @${handle}`);
            setUsername('');
            void refresh();
            window.setTimeout(() => setNotice(''), 3000);
        } else {
            setError(res.error ?? 'Could not send request');
        }
    };

    const handleRespond = async (friendshipId: string, accept: boolean) => {
        const res = await respondFriendRequest(supabase, friendshipId, accept, tokens);
        if (!res.ok) setError(res.error ?? 'Could not respond');
        void refresh();
    };

    if (!session) {
        return (
            <div className="mx-auto max-w-[960px] animate-fade-in-up space-y-6 pb-20 pt-6">
                <div>
                    <p className="focuz-section-label mb-1">Social</p>
                    <h1 className="text-3xl font-semibold tracking-tight text-[var(--dashboard-text)]">Friends</h1>
                </div>
                <div className={`${CARD_CLASS} flex flex-col items-center px-6 py-16 text-center`}>
                    <Users size={24} className="text-[var(--dashboard-text-muted)]" />
                    <p className="mt-3 text-sm text-[var(--dashboard-text-muted)]">
                        Sign in to add friends and see the weekly leaderboard.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-[960px] animate-fade-in-up space-y-6 pb-20 pt-6">
            <div>
                <p className="focuz-section-label mb-1">Social</p>
                <h1 className="text-3xl font-semibold tracking-tight text-[var(--dashboard-text)]">Friends</h1>
                <p className="mt-1 text-sm text-[var(--dashboard-text-muted)]">
                    See who&apos;s focusing and compare weekly deep work.
                </p>
            </div>

            <div className={`${CARD_CLASS} p-4`}>
                <div className="flex gap-2">
                    <input
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && void handleSendRequest()}
                        placeholder="Add a friend by @username"
                        className="flex-1 rounded-xl border border-[var(--dashboard-border)] bg-[var(--dashboard-interactive)] px-3 py-2.5 text-sm text-[var(--dashboard-text)] outline-none placeholder:text-[var(--dashboard-text-muted)] focus:border-purple-500/40"
                    />
                    <button
                        type="button"
                        disabled={sending || !username.trim()}
                        onClick={() => void handleSendRequest()}
                        className={`${PRIMARY_BTN_CLASS} inline-flex shrink-0 items-center gap-1.5 disabled:pointer-events-none disabled:opacity-40`}
                    >
                        {sending ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />}
                        Add friend
                    </button>
                </div>
                {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
                {notice && <p className="mt-2 text-xs text-emerald-500">{notice}</p>}
            </div>

            {pending.length > 0 && (
                <div className={CARD_CLASS}>
                    <div className="flex items-center gap-2 px-4 pb-2 pt-4">
                        <h3 className="text-sm font-semibold text-[var(--dashboard-text)]">Incoming requests</h3>
                        <span className="min-w-[1.25rem] rounded-full bg-[var(--dashboard-text)] px-1.5 py-0.5 text-center text-[10px] font-bold tabular-nums text-[var(--dashboard-bg)]">
                            {pending.length}
                        </span>
                    </div>
                    <div className="divide-y divide-[var(--dashboard-border)]">
                        {pending.map((p) => (
                            <div
                                key={p.friendshipId}
                                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--dashboard-interactive)]"
                            >
                                <Avatar url={p.avatarUrl} name={p.displayName} />
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-[var(--dashboard-text)]">{p.displayName}</p>
                                    <p className="truncate text-xs text-[var(--dashboard-text-muted)]">@{p.username}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => void handleRespond(p.friendshipId, true)}
                                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
                                    aria-label={`Accept request from ${p.displayName}`}
                                >
                                    <Check size={16} strokeWidth={2.5} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void handleRespond(p.friendshipId, false)}
                                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-400 hover:bg-red-500/25"
                                    aria-label={`Decline request from ${p.displayName}`}
                                >
                                    <X size={16} strokeWidth={2.5} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
                <div className={CARD_CLASS}>
                    <div className="flex items-center gap-2 px-4 pb-2 pt-4">
                        <h3 className="text-sm font-semibold text-[var(--dashboard-text)]">Your friends</h3>
                        {friends.length > 0 && (
                            <span className="text-xs tabular-nums text-[var(--dashboard-text-muted)]">{friends.length}</span>
                        )}
                    </div>
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="animate-spin text-[var(--dashboard-text-muted)]" size={20} />
                        </div>
                    ) : friends.length === 0 ? (
                        <div className="flex flex-col items-center px-6 py-12 text-center">
                            <Users size={24} className="text-[var(--dashboard-text-muted)]" />
                            <p className="mt-3 text-sm text-[var(--dashboard-text-muted)]">
                                No friends yet — add someone by username above.
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-[var(--dashboard-border)]">
                            {friends.map((f) => (
                                <FriendRow key={f.userId} friend={f} />
                            ))}
                        </div>
                    )}
                </div>

                <div className={CARD_CLASS}>
                    <div className="px-4 pb-2 pt-4">
                        <h3 className="text-sm font-semibold text-[var(--dashboard-text)]">Weekly leaderboard</h3>
                        <p className="mt-0.5 text-xs text-[var(--dashboard-text-muted)]">Focus minutes this week · friends only</p>
                    </div>
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="animate-spin text-[var(--dashboard-text-muted)]" size={20} />
                        </div>
                    ) : leaderboard.length === 0 ? (
                        <div className="flex flex-col items-center px-6 py-12 text-center">
                            <Trophy size={24} className="text-[var(--dashboard-text-muted)]" />
                            <p className="mt-3 text-sm text-[var(--dashboard-text-muted)]">
                                Add friends to compete on weekly deep work minutes.
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-[var(--dashboard-border)]">
                            {leaderboard.map((entry, i) => (
                                <div
                                    key={`${entry.username}-${i}`}
                                    className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                                        entry.isMe
                                            ? 'border-l-2 border-purple-500 bg-purple-500/[0.08]'
                                            : 'border-l-2 border-transparent hover:bg-[var(--dashboard-interactive)]'
                                    }`}
                                >
                                    <span className="w-5 text-xs font-semibold tabular-nums text-[var(--dashboard-text-muted)]">
                                        {i + 1}
                                    </span>
                                    <Avatar url={entry.avatarUrl} name={entry.displayName} />
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium text-[var(--dashboard-text)]">
                                            {entry.displayName}
                                            {entry.isMe && (
                                                <span className="ml-1.5 text-xs text-purple-400">you</span>
                                            )}
                                        </p>
                                    </div>
                                    <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--dashboard-text)]">
                                        {entry.weeklyFocusMinutes}m
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
