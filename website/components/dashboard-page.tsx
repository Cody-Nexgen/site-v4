"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  Clock,
  Globe,
  Zap,
  History,
  Settings,
  LogOut,
  Shield,
  BarChart3,
  Calendar as CalendarIcon,
  X
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { GlassCard } from "@/components/ui/GlassCard";
import { NeonButton } from "@/components/ui/NeonButton";
import { AnimatedInput } from "@/components/ui/AnimatedInput";
import { StatCard } from "@/components/dashboard/DashboardComponents";
import InstallExtensionCard from "@/components/InstallExtensionCard";
import { fetchMyWorkspaceState } from "@/lib/workspaceApi";

interface DashboardPageProps {
  session: any;
  onLogout: () => void;
  onOpenCalendar?: () => void;
}

/** Fields synced from the extension via `user_workspace_state.state` (see SYNCABLE_WORKSPACE_KEYS). */
type WorkspaceState = {
  blocklist?: unknown[];
  regexBlocklist?: unknown[];
  habits?: unknown[];
  todos?: unknown[];
  theme?: string;
  weeklyGoalHours?: number;
  dailyFocusTarget?: number;
  profileName?: string;
};

export default function DashboardPage({ session, onLogout, onOpenCalendar }: DashboardPageProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'history'>('overview');
  const [loading, setLoading] = useState(true);
  const [workspaceState, setWorkspaceState] = useState<WorkspaceState | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Settings State
  const [dailyLimit, setDailyLimit] = useState(2); // hours
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [billingNotice, setBillingNotice] = useState(() => {
    if (typeof window === "undefined") return "";
    const params = new URLSearchParams(window.location.search);
    return params.get("subscription") === "success"
      ? "Welcome to Pro — your subscription is active."
      : params.get("billing") === "return"
        ? "Billing updated. You are subscribed to Pro."
        : "";
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const row = await fetchMyWorkspaceState(supabase);
        if (cancelled) return;
        setWorkspaceState((row?.state as WorkspaceState) ?? {});
      } catch (err) {
        console.error("[Dashboard] Failed to load cloud workspace state", err);
        if (!cancelled) setWorkspaceState({});
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Overview stats we can actually derive from cloud-synced state — everything else
  // (live time tracking, focus score, browsing history) only exists in the extension.
  const derived = useMemo(() => {
    const state = workspaceState ?? {};
    const blocklist = Array.isArray(state.blocklist) ? state.blocklist : [];
    const regexBlocklist = Array.isArray(state.regexBlocklist) ? state.regexBlocklist : [];
    const habits = Array.isArray(state.habits) ? state.habits : [];
    const todos = Array.isArray(state.todos) ? state.todos : [];
    const theme = typeof state.theme === "string" && state.theme ? state.theme : "default";
    const weeklyGoalHours = typeof state.weeklyGoalHours === "number" ? state.weeklyGoalHours : null;
    const dailyFocusTarget = typeof state.dailyFocusTarget === "number" ? state.dailyFocusTarget : null;
    return {
      blockedSitesCount: blocklist.length + regexBlocklist.length,
      habitsCount: habits.length,
      todosCount: todos.length,
      theme,
      weeklyGoalHours,
      dailyFocusTarget,
      hasSyncedData: Object.keys(state).length > 0,
    };
  }, [workspaceState]);

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-6">
            {billingNotice && (
              <div className="rounded-2xl border border-purple-500/30 bg-purple-500/10 px-4 py-3 text-sm text-purple-200">
                {billingNotice}
              </div>
            )}
            {/* Cloud-synced summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard
                title="Blocked Sites"
                value={loading ? "…" : derived.blockedSitesCount}
                subtitle="Synced from your blocklist"
                icon={Shield}
                color="purple"
                delay={0.1}
              />
              <StatCard
                title="Weekly Focus Goal"
                value={loading ? "…" : derived.weeklyGoalHours != null ? `${derived.weeklyGoalHours}h` : "Not set"}
                subtitle={derived.dailyFocusTarget != null ? `${derived.dailyFocusTarget}h daily target` : "Set a goal in the extension"}
                icon={Clock}
                color="blue"
                delay={0.2}
              />
              <StatCard
                title="Habits Tracked"
                value={loading ? "…" : derived.habitsCount}
                subtitle={`${derived.todosCount} task${derived.todosCount === 1 ? "" : "s"} on your list`}
                icon={Zap}
                color="orange"
                delay={0.3}
              />
            </div>

            {!loading && !derived.hasSyncedData && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-zinc-400">
                No synced data yet — install the extension and sign in there to start syncing your blocklist, habits and goals to the cloud.
              </div>
            )}

            {/* Browser-only features */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <InstallExtensionCard
                title="Live focus score & time tracking"
                description="Real-time focus scores, tab-switch counts, and time-on-site breakdowns run locally in your browser. Install the extension to see them live."
              />
              <InstallExtensionCard
                title="Site blocking & Pomodoro timer"
                description="Blocking, distraction redirects, and the Pomodoro timer run in your browser via the FocuzNow extension."
              />
            </div>
          </div>
        );

      case 'analytics':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white">Detailed Analytics</h2>
              <p className="text-zinc-400 mt-1">Cloud snapshot of your synced settings — minute-by-minute analytics live in the extension.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <GlassCard className="p-6">
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">Cloud Snapshot</h3>
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-zinc-500">Theme</dt>
                    <dd className="text-white capitalize">{loading ? "…" : derived.theme}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-zinc-500">Blocked sites</dt>
                    <dd className="text-white">{loading ? "…" : derived.blockedSitesCount}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-zinc-500">Habits</dt>
                    <dd className="text-white">{loading ? "…" : derived.habitsCount}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-zinc-500">Daily focus target</dt>
                    <dd className="text-white">{loading ? "…" : derived.dailyFocusTarget != null ? `${derived.dailyFocusTarget}h` : "—"}</dd>
                  </div>
                </dl>
              </GlassCard>
              <InstallExtensionCard
                title="Full analytics dashboard"
                description="Daily and weekly time breakdowns by domain, focus score trends, and tab-switch analytics run entirely in your browser — install the extension to unlock them."
              />
            </div>
          </div>
        );

      case 'history':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white">Browsing History</h2>
            <InstallExtensionCard
              title="Browsing history needs the extension"
              description="FocuzNow tracks page visits locally and never uploads your browsing history to the cloud. Install the extension to see your history and top sites here."
            />
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex overflow-hidden font-sans selection:bg-purple-500/30">
      {/* Sidebar */}
      <motion.aside
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className="w-64 border-r border-white/10 bg-black/50 backdrop-blur-xl flex flex-col z-20 hidden md:flex"
      >
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight">FocuzNow</h1>
              <p className="text-xs text-zinc-500">Pro Dashboard</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {[
            { id: 'overview', icon: LayoutDashboard, label: 'Overview' },
            { id: 'analytics', icon: BarChart3, label: 'Analytics' },
            { id: 'history', icon: History, label: 'History' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative overflow-hidden ${activeTab === item.id
                ? 'bg-purple-600/10 text-purple-400'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
            >
              {activeTab === item.id && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-purple-600/10 rounded-xl"
                  initial={false}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              <item.icon className={`w-5 h-5 relative z-10 ${activeTab === item.id ? 'text-purple-400' : 'group-hover:text-purple-400 transition-colors'}`} />
              <span className="font-medium relative z-10">{item.label}</span>
            </button>
          ))}

          <div className="pt-2 mt-2 border-t border-white/5">
            <button
              onClick={() => {
                if (onOpenCalendar) onOpenCalendar();
                else window.location.href = "/calendar";
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-all group"
            >
              <CalendarIcon className="w-5 h-5 group-hover:text-purple-400 transition-colors" />
              <span className="font-medium">Calendar</span>
            </button>
          </div>
        </nav>

        <div className="p-4 border-t border-white/5 space-y-2">
          <button
            onClick={() => setShowSettings(true)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-all"
          >
            <Settings className="w-5 h-5" />
            <span className="font-medium">Settings</span>
          </button>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-all"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Log Out</span>
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-[url('/grid.svg')] bg-repeat opacity-100">
        <div className="p-8 max-w-7xl mx-auto space-y-8">

          {/* Header */}
          <header className="flex justify-between items-end">
            <div>
              <h2 className="text-3xl font-bold text-white mb-2">Welcome back, {session?.user?.email?.split('@')[0] || 'User'}</h2>
              <p className="text-zinc-400">Here's your cloud-synced productivity overview.</p>
            </div>
            <div className="flex gap-4">
              <GlassCard className="px-4 py-2 flex items-center gap-2 bg-purple-500/10 border-purple-500/20">
                <Globe className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-bold text-purple-200">Synced to cloud</span>
              </GlassCard>
            </div>
          </header>

          {/* Content Area */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md"
            >
              <GlassCard className="p-6 relative">
                <button
                  onClick={() => setShowSettings(false)}
                  className="absolute top-4 right-4 text-zinc-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
                <h2 className="text-xl font-bold text-white mb-6">Settings</h2>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-400">Daily Focus Goal (Hours)</label>
                    <AnimatedInput
                      type="number"
                      value={dailyLimit}
                      onChange={(e) => setDailyLimit(Number(e.target.value))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-zinc-400">Enable Notifications</span>
                    <button
                      onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                      className={`w-12 h-6 rounded-full transition-colors relative ${notificationsEnabled ? 'bg-purple-600' : 'bg-zinc-700'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${notificationsEnabled ? 'left-7' : 'left-1'}`} />
                    </button>
                  </div>

                  <NeonButton className="w-full" onClick={() => setShowSettings(false)}>
                    Save Changes
                  </NeonButton>
                </div>
              </GlassCard>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
