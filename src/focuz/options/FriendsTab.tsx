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

const CARD_CLASS = 'rounded-2xl border border-white/[0.06] bg-[#0c0c0e]';
const PRIMARY_BTN_CLASS =
    'px-4 py-2 rounded-xl bg-white text-black text-xs font-semibold hover:bg-neutral-200';
const GHOST_BTN_CLASS =
    'px-4 py-2 rounded-xl bg-white/[0.06] text-neutral-300 text-xs font-semibold hover:bg-white/10';

function Avatar({ url, name }: { url: string | null; name: string }) {
    const initial = name.charAt(0).toUpperCase() || '?';
    if (url) return <img src={url} alt="" className={PROFILE_AVATAR_IMG_CLASS} />;
    return <div className={PROFILE_AVATAR_FALLBACK_CLASS}>{initial}</div>;
}

function FriendRow({ friend }: { friend: FriendEntry }) {
    const endsAt = friend.sessionEndsAt ? new Date(friend.sessionEndsAt) : null;
    const focusing = friend.isFocusing && endsAt && endsAt.getTime() > Date.now();

    return (
        <div className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors">
            <div className="relative shrink-0">
                <Avatar url={friend.avatarUrl} name={friend.displayName} />
                {focusing && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#0c0c0e]" />
                )}
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white truncate">{friend.displayName}</p>
                <p className="text-xs text-neutral-500 truncate">
                    @{friend.username} · Lv <span className="tabular-nums">{friend.level}</span>
                </p>
            </div>
            <div className="text-right shrink-0">
                {focusing ? (
                    <p className="text-xs font-medium text-emerald-400">Focusing</p>
                ) : (
                    <p className="text-xs text-neutral-600">Idle</p>
                )}
                <p className="text-xs text-neutral-500 mt-0.5 tabular-nums">{friend.streak}d streak</p>
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
            const code = res.error || '';
            const friendly =
                code === 'USER_NOT_FOUND'
                    ? 'User not found — check the exact username'
                    : code === 'SELF_REQUEST'
                      ? "You can't add yourself"
                      : code === 'ALREADY_FRIENDS'
                        ? 'You are already friends'
                        : code === 'NOT_AUTHENTICATED'
                          ? 'Sign in again to add friends'
                          : code === 'PROFILE_REQUIRED'
                            ? 'Set your username in Account before adding friends'
                          : code === 'PENDING_EXISTS' || code.includes('duplicate') || code.includes('unique')
                            ? 'A request is already pending'
                            : code || 'Request failed';
            setError(friendly);
        }
    };

    const handleRespond = async (id: string, accept: boolean) => {
        setError('');
        const res = await respondFriendRequest(supabase, id, accept, tokens);
        if (!res.ok) {
            setError(
                res.error === 'NOT_AUTHENTICATED'
                    ? 'Sign in again to respond'
                    : res.error === 'NOT_FOUND'
                      ? 'That request is no longer available'
                      : res.error || (accept ? 'Could not accept request' : 'Could not decline request'),
            );
            return;
        }
        setNotice(accept ? 'Friend added' : 'Request declined');
        window.setTimeout(() => setNotice(''), 2500);
        void refresh();
    };

    if (!session) {
        return (
            <div className="max-w-[720px] mx-auto pt-6 pb-20">
                <div className={`${CARD_CLASS} px-6 py-16 flex flex-col items-center text-center`}>
                    <Users size={24} className="text-neutral-600" />
                    <p className="text-sm text-neutral-500 mt-3">
                        Sign in to add friends and see the weekly leaderboard.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in-up max-w-[960px] mx-auto pt-6 pb-20">
            <div>
                <p className="focuz-section-label mb-1">Social</p>
                <h1 className="text-3xl font-semibold text-white tracking-tight">Friends</h1>
                <p className="text-sm text-neutral-500 mt-1">
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
                        className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-white/20 placeholder:text-neutral-600"
                    />
                    <button
                        type="button"
                        disabled={sending || !username.trim()}
                        onClick={() => void handleSendRequest()}
                        className={`${PRIMARY_BTN_CLASS} inline-flex items-center gap-1.5 shrink-0 disabled:opacity-40 disabled:pointer-events-none`}
                    >
                        {sending ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />}
                        Add friend
                    </button>
                </div>
                {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
                {notice && <p className="text-xs text-emerald-400 mt-2">{notice}</p>}
            </div>

            <div className={CARD_CLASS}>
                <div className="flex items-center gap-2 px-4 pt-4 pb-2">
                    <h3 className="text-sm font-semibold text-white">Incoming requests</h3>
                    {pending.length > 0 && (
                        <span className="rounded-full bg-white text-black text-[10px] font-bold px-1.5 py-0.5 tabular-nums min-w-[1.25rem] text-center">
                            {pending.length}
                        </span>
                    )}
                </div>
                {loading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="animate-spin text-neutral-600" size={18} />
                    </div>
                ) : pending.length === 0 ? (
                    <p className="px-4 pb-4 text-xs text-neutral-600">
                        When someone adds you, Accept / Decline show up here.
                    </p>
                ) : (
                    <div className="divide-y divide-white/[0.04]">
                        {pending.map((p) => (
                            <div
                                key={p.friendshipId}
                                className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors"
                            >
                                <Avatar url={p.avatarUrl} name={p.displayName} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-white truncate">{p.displayName}</p>
                                    <p className="text-xs text-neutral-500 truncate">@{p.username}</p>
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                <div className={CARD_CLASS}>
                    <div className="flex items-center gap-2 px-4 pt-4 pb-2">
                        <h3 className="text-sm font-semibold text-white">Your friends</h3>
                        {friends.length > 0 && (
                            <span className="text-xs text-neutral-500 tabular-nums">{friends.length}</span>
                        )}
                    </div>
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="animate-spin text-neutral-600" size={20} />
                        </div>
                    ) : friends.length === 0 ? (
                        <div className="px-6 py-12 flex flex-col items-center text-center">
                            <Users size={24} className="text-neutral-600" />
                            <p className="text-sm text-neutral-500 mt-3">
                                No friends yet — add someone by username above.
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-white/[0.04]">
                            {friends.map((f) => (
                                <FriendRow key={f.userId} friend={f} />
                            ))}
                        </div>
                    )}
                </div>

                <div className={CARD_CLASS}>
                    <div className="px-4 pt-4 pb-2">
                        <h3 className="text-sm font-semibold text-white">Weekly leaderboard</h3>
                        <p className="text-xs text-neutral-500 mt-0.5">Focus minutes this week</p>
                    </div>
                    {leaderboard.length === 0 ? (
                        <div className="px-6 py-12 flex flex-col items-center text-center">
                            <Trophy size={24} className="text-neutral-600" />
                            <p className="text-sm text-neutral-500 mt-3">
                                Add friends to compete on weekly deep work minutes.
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-white/[0.04]">
                            {leaderboard.map((entry, i) => (
                                <div
                                    key={`${entry.username}-${i}`}
                                    className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                                        entry.isMe
                                            ? 'bg-purple-500/[0.08] border-l-2 border-purple-500'
                                            : 'border-l-2 border-transparent hover:bg-white/[0.03]'
                                    }`}
                                >
                                    <span className="text-xs font-semibold text-neutral-600 w-5 tabular-nums">
                                        {i + 1}
                                    </span>
                                    <Avatar url={entry.avatarUrl} name={entry.displayName} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-white truncate">
                                            {entry.displayName}
                                            {entry.isMe && (
                                                <span className="text-xs text-purple-400 ml-1.5">you</span>
                                            )}
                                        </p>
                                    </div>
                                    <span className="text-sm font-semibold text-white tabular-nums shrink-0">
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
