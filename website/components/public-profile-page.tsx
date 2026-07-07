"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ExternalLink, Flame, Target, Trophy, Clock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { GlassCard } from "@/components/ui/GlassCard";
import { badgeEmoji } from "@/lib/focus-shop";

type PublicStats = {
  level: number;
  rank: string;
  xp: number;
  focusScore: number;
  longestStreak: number;
  hoursFocused: number;
  totalPomodoros: number;
  achievementsUnlocked: number;
  challengesCompleted: number;
  equippedFrame: string | null;
  equippedBadge: string | null;
  updatedAt: string;
};

type PublicProfile = {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  stats: PublicStats;
};

function frameClass(frameId: string | null | undefined): string {
  if (!frameId) return "";
  return `focus-frame-${frameId.replace("frame_", "")}`;
}

export default function PublicProfilePage({ username }: { username: string }) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc("get_public_focus_profile", {
        p_username: username,
      });
      if (cancelled) return;
      if (error || !data?.ok || !data?.profile) {
        setNotFound(true);
        setProfile(null);
      } else {
        setProfile(data.profile as PublicProfile);
        setNotFound(false);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [username]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center text-neutral-500">
        Loading profile…
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center px-6 text-center">
        <p className="text-2xl font-black text-white mb-2">Profile not found</p>
        <p className="text-neutral-500 text-sm max-w-md">
          @{username} hasn&apos;t enabled a public focus profile yet, or this handle doesn&apos;t exist.
        </p>
        <a href="/" className="mt-8 text-purple-400 text-sm font-bold hover:text-purple-300">
          ← Back to FocuzNow
        </a>
      </div>
    );
  }

  const stats = profile.stats;
  const frame = frameClass(stats.equippedFrame);

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(168,85,247,0.12),transparent_55%)] pointer-events-none" />

      <header className="relative z-10 max-w-3xl mx-auto px-6 pt-12 pb-6 flex items-center justify-between">
        <a href="/" className="text-sm font-bold text-neutral-500 hover:text-white transition-colors">
          FocuzNow
        </a>
        <a
          href="https://chrome.google.com/webstore"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-400 hover:text-purple-300"
        >
          Get the extension <ExternalLink size={12} />
        </a>
      </header>

      <main className="relative z-10 max-w-3xl mx-auto px-6 pb-20">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <GlassCard className="p-8 mb-6">
            <div className="flex items-start gap-5">
              <div
                className={`w-20 h-20 rounded-2xl bg-purple-500/20 border-2 border-purple-500/30 flex items-center justify-center overflow-hidden shrink-0 ${frame}`}
              >
                {profile.avatarUrl ? (
                  <img src={profile.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl font-black text-purple-300">
                    {profile.displayName.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Focus Profile</p>
                <h1 className="text-3xl font-black tracking-tight truncate">{profile.displayName}</h1>
                <p className="text-neutral-500 font-mono text-sm">@{profile.username}</p>
                <div className="flex items-center gap-3 mt-3">
                  <span className="px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-black">
                    Lv {stats.level} · {stats.rank}
                  </span>
                  {stats.equippedBadge && (
                    <span className="text-xl" title="Badge">
                      {badgeEmoji(stats.equippedBadge)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </GlassCard>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { icon: Target, label: "Focus Score", value: `${stats.focusScore}/100` },
              { icon: Flame, label: "Longest Streak", value: `${stats.longestStreak}d` },
              { icon: Clock, label: "Hours Focused", value: `${stats.hoursFocused}h` },
              { icon: Trophy, label: "Achievements", value: String(stats.achievementsUnlocked) },
            ].map(({ icon: Icon, label, value }) => (
              <GlassCard key={label} className="p-4">
                <Icon size={16} className="text-purple-400 mb-2" />
                <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">{label}</p>
                <p className="text-xl font-black mt-1">{value}</p>
              </GlassCard>
            ))}
          </div>

          <GlassCard className="p-5">
            <div className="flex flex-wrap gap-4 text-sm text-neutral-400">
              <span><strong className="text-white">{stats.totalPomodoros}</strong> sessions completed</span>
              <span><strong className="text-white">{stats.challengesCompleted}</strong> challenges done</span>
              <span><strong className="text-white">{stats.xp.toLocaleString()}</strong> XP earned</span>
            </div>
            {stats.updatedAt && (
              <p className="text-[10px] text-neutral-600 mt-4">
                Last updated {new Date(stats.updatedAt).toLocaleDateString()}
              </p>
            )}
          </GlassCard>
        </motion.div>
      </main>
    </div>
  );
}
