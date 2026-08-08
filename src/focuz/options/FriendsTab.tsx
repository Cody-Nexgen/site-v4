import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, UserPlus, Users, Trophy } from 'lucide-react';
import { useAuthStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import {
    getFriendsWeeklyLeaderboard,
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
    'surface-card rounded-2xl border border-[var(--dashboard-border)] bg-[var(--dashboard-surface-raised)]';
const PRIMARY_BTN_CLASS =
    'px-4 py-2 rounded-xl bg-[var(--dashboard-text)] text-[var(--dashboard-bg)] text-xs font-semibold hover:opacity-90';
const GHOST_BTN_CLASS =
    'px-4 py-2 rounded-xl bg-[var(--dashboard-interactive)] text-[var(--dashboard-text-secondary)] text-xs font-semibold hover:bg-[var(--dashboard-interactive-hover)]';

function Avatar({ url, name }: { url: string | null; name: string }) {
    const initial = name.charAt(0).toUpperCase() || '?';
    if (url) return <img src={url} alt="" className={PROFILE_AVATAR_IMG_CLASS} />;
    return <div className={PROFILE_AVATAR_FALLBACK_CLASS}>{initial}</div>;
}

function FriendRow({ friend }: { friend: FriendEntry }) {
    const endsAt = friend.sessionEndsAt ? new Date(friend.sessionEndsAt) : null;
    const focusing = friend.isFocusing && endsAt && endsAt.getTime() > Date.now();

    return (
        <div className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--dashboard-interactive)]">
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
        if (friendsRes.ok) {
            setFriends(friendsRes.friends);
            setPending(friendsRes.pending);
        } else {
            setError(friendsRes.error ?? 'Could not load friends');
        }
        if (lbRes.ok) setLeaderboard(lbRes.leaderboard);
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

            <div className={CARD_CLASS}>
                <div className="flex items-center gap-2 px-4 pb-2 pt-4">
                    <h3 className="text-sm font-semibold text-[var(--dashboard-text)]">Incoming requests</h3>
                    {pending.length > 0 && (
                        <span className="min-w-[1.25rem] rounded-full bg-[var(--dashboard-text)] px-1.5 py-0.5 text-center text-[10px] font-bold tabular-nums text-[var(--dashboard-bg)]">
                            {pending.length}
                        </span>
                    )}
                </div>
                {loading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="animate-spin text-[var(--dashboard-text-muted)]" size={18} />
                    </div>
                ) : pending.length === 0 ? (
                    <p className="px-4 pb-4 text-xs text-[var(--dashboard-text-muted)]">
                        When someone adds you, Accept / Decline show up here.
                    </p>
                ) : (
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
                                    className={`${PRIMARY_BTN_CLASS} shrink-0`}
                                >
                                    Accept
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void handleRespond(p.friendshipId, false)}
                                    className={`${GHOST_BTN_CLASS} shrink-0 text-red-400 hover:text-red-300`}
                                >
                                    Decline
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

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
                        <p className="mt-0.5 text-xs text-[var(--dashboard-text-muted)]">Focus minutes this week</p>
                    </div>
                    {leaderboard.length === 0 ? (
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
