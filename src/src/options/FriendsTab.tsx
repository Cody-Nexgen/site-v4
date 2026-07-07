import { useCallback, useEffect, useState } from 'react';
import { Loader2, UserPlus, Users, Trophy, Zap } from 'lucide-react';
import { GlassCard } from './OptionsApp';
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

function Avatar({ url, name }: { url: string | null; name: string }) {
    const initial = name.charAt(0).toUpperCase() || '?';
    if (url) return <img src={url} alt="" className={PROFILE_AVATAR_IMG_CLASS} />;
    return <div className={PROFILE_AVATAR_FALLBACK_CLASS}>{initial}</div>;
}

function FriendRow({ friend }: { friend: FriendEntry }) {
    const endsAt = friend.sessionEndsAt ? new Date(friend.sessionEndsAt) : null;
    const focusing = friend.isFocusing && endsAt && endsAt.getTime() > Date.now();

    return (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
            <Avatar url={friend.avatarUrl} name={friend.displayName} />
            <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white truncate">{friend.displayName}</p>
                <p className="text-xs text-neutral-500 truncate">@{friend.username} · Lv {friend.level}</p>
            </div>
            <div className="text-right shrink-0">
                {focusing ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 uppercase">
                        <Zap size={10} className="fill-emerald-400" />
                        Focusing
                    </span>
                ) : (
                    <span className="text-[10px] text-neutral-600 font-bold uppercase">Idle</span>
                )}
                <p className="text-[10px] text-neutral-500 mt-0.5">{friend.streak}d streak</p>
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

    const tokens =
        session?.access_token && session?.refresh_token
            ? { access_token: session.access_token, refresh_token: session.refresh_token }
            : null;

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
            window.setTimeout(() => setNotice(''), 3000);
        } else {
            setError(res.error === 'USER_NOT_FOUND' ? 'User not found' : res.error ?? 'Request failed');
        }
    };

    const handleRespond = async (id: string, accept: boolean) => {
        await respondFriendRequest(supabase, id, accept, tokens);
        void refresh();
    };

    if (!session) {
        return (
            <div className="max-w-[720px] mx-auto p-6">
                <GlassCard className="p-8 text-center">
                    <p className="text-neutral-400">Sign in to add friends and see the weekly leaderboard.</p>
                </GlassCard>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in-up max-w-[720px] mx-auto">
            <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Users size={22} className="text-purple-400" />
                    Friends
                </h2>
                <p className="text-sm text-neutral-500 mt-1">
                    See who&apos;s focusing, compare weekly deep work, and stay accountable.
                </p>
            </div>

            <GlassCard className="p-5">
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2 block">
                    Add friend
                </label>
                <div className="flex gap-2">
                    <input
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && void handleSendRequest()}
                        placeholder="@username"
                        className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-purple-500"
                    />
                    <button
                        type="button"
                        disabled={sending || !username.trim()}
                        onClick={() => void handleSendRequest()}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-sm font-bold"
                    >
                        {sending ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                        Add
                    </button>
                </div>
                {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
                {notice && <p className="text-xs text-emerald-400 mt-2">{notice}</p>}
            </GlassCard>

            {pending.length > 0 && (
                <GlassCard className="p-5">
                    <h3 className="text-sm font-bold text-white mb-3">Pending requests</h3>
                    <div className="space-y-2">
                        {pending.map((p) => (
                            <div
                                key={p.friendshipId}
                                className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5"
                            >
                                <Avatar url={p.avatarUrl} name={p.displayName} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-white truncate">{p.displayName}</p>
                                    <p className="text-xs text-neutral-500">@{p.username}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => void handleRespond(p.friendshipId, true)}
                                    className="px-3 py-1.5 rounded-lg bg-emerald-600/80 text-white text-xs font-bold"
                                >
                                    Accept
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void handleRespond(p.friendshipId, false)}
                                    className="px-3 py-1.5 rounded-lg bg-white/5 text-neutral-400 text-xs font-bold hover:text-white"
                                >
                                    Decline
                                </button>
                            </div>
                        ))}
                    </div>
                </GlassCard>
            )}

            <GlassCard className="p-5">
                <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                    <Trophy size={16} className="text-amber-400" />
                    Weekly focus leaderboard
                </h3>
                {leaderboard.length === 0 ? (
                    <p className="text-sm text-neutral-500 italic">Add friends to compete on weekly deep work minutes.</p>
                ) : (
                    <div className="space-y-2">
                        {leaderboard.map((entry, i) => (
                            <div
                                key={`${entry.username}-${i}`}
                                className={`flex items-center gap-3 p-3 rounded-xl border ${
                                    entry.isMe ? 'bg-purple-500/10 border-purple-500/30' : 'bg-white/[0.03] border-white/5'
                                }`}
                            >
                                <span className="text-xs font-black text-neutral-600 w-5">{i + 1}</span>
                                <Avatar url={entry.avatarUrl} name={entry.displayName} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-white truncate">
                                        {entry.displayName}
                                        {entry.isMe && (
                                            <span className="text-[10px] text-purple-400 ml-1">(you)</span>
                                        )}
                                    </p>
                                </div>
                                <span className="text-sm font-bold text-white tabular-nums">
                                    {entry.weeklyFocusMinutes}m
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </GlassCard>

            <GlassCard className="p-5">
                <h3 className="text-sm font-bold text-white mb-3">Your friends</h3>
                {loading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="animate-spin text-purple-400" size={24} />
                    </div>
                ) : friends.length === 0 ? (
                    <p className="text-sm text-neutral-500 italic">No friends yet — add someone by username.</p>
                ) : (
                    <div className="space-y-2">
                        {friends.map((f) => (
                            <FriendRow key={f.userId} friend={f} />
                        ))}
                    </div>
                )}
            </GlassCard>
        </div>
    );
}
