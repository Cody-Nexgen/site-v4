"use client";

import React, { useEffect, useState } from "react";
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
  X
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { GlassCard } from "@/components/ui/GlassCard";
import { NeonButton } from "@/components/ui/NeonButton";
import { AnimatedInput } from "@/components/ui/AnimatedInput";
import { StatCard, ActivityChart, HistoryList } from "@/components/dashboard/DashboardComponents";

interface DashboardPageProps {
  session: any;
  onLogout: () => void;
}

// Mock Data for initial render (will be replaced by real data fetch)
const MOCK_ACTIVITY_DATA = [
  { name: 'Mon', hours: 2.5 },
  { name: 'Tue', hours: 3.8 },
  { name: 'Wed', hours: 4.2 },
  { name: 'Thu', hours: 1.5 },
  { name: 'Fri', hours: 5.0 },
  { name: 'Sat', hours: 3.2 },
  { name: 'Sun', hours: 2.0 },
];

const MOCK_HISTORY_DATA = [
  { domain: 'github.com', timeSpent: 4500000, visits: 12, lastVisited: '2023-10-27T10:00:00Z' },
  { domain: 'stackoverflow.com', timeSpent: 1200000, visits: 5, lastVisited: '2023-10-27T11:30:00Z' },
  { domain: 'youtube.com', timeSpent: 3600000, visits: 3, lastVisited: '2023-10-27T09:15:00Z' },
  { domain: 'linear.app', timeSpent: 2400000, visits: 8, lastVisited: '2023-10-27T14:20:00Z' },
  { domain: 'figma.com', timeSpent: 1800000, visits: 4, lastVisited: '2023-10-27T13:00:00Z' },
];

export default function DashboardPage({ session, onLogout }: DashboardPageProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'history'>('overview');
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [stats, setStats] = useState({
    timeTracked: '0h',
    sitesVisited: 0,
    focusScore: 0
  });

  // Settings State
  const [dailyLimit, setDailyLimit] = useState(2); // hours
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  useEffect(() => {
    // Redirection Logic: If extension is detected and user is in dashboard, redirect to extension options
    const checkForExtensionAndRedirect = () => {
      if (document.documentElement.getAttribute('data-focuznow-extension')) {
        console.log('[Dashboard] Extension detected. Redirecting to internal settings...');
        // We use a specific ID if known, but chrome-extension://[ID]/src/options/index.html is the target.
        // Since we don't know the production ID yet, we'll try to message the extension or use a generic trigger.
        // For now, let's inform the user or use a window.location if possible.
        // Actually, the most reliable way in MV3 for a webpage to open the options is to ask the extension to open its own page.
        window.postMessage({ type: 'OPEN_EXTENSION_OPTIONS' }, '*');
      }
    };

    // Simulate fetching data
    setTimeout(() => {
      setStats({
        timeTracked: '12.5h',
        sitesVisited: 42,
        focusScore: 85
      });
      setLoading(false);
      checkForExtensionAndRedirect();
    }, 1000);
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-6">
            {/* Hero Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard
                title="Time Tracked"
                value={stats.timeTracked}
                subtitle="This Week"
                icon={Clock}
                color="purple"
                delay={0.1}
              />
              <StatCard
                title="Sites Visited"
                value={stats.sitesVisited}
                subtitle="Unique Domains"
                icon={Globe}
                color="blue"
                delay={0.2}
              />
              <StatCard
                title="Focus Score"
                value={stats.focusScore}
                subtitle="Productivity Rating"
                icon={Zap}
                color="orange"
                delay={0.3}
              />
            </div>

            {/* Charts & Lists */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <ActivityChart data={MOCK_ACTIVITY_DATA} />
              </div>
              <div className="lg:col-span-1">
                <HistoryList history={MOCK_HISTORY_DATA} />
              </div>
            </div>
          </div>
        );

      case 'analytics':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white">Detailed Analytics</h2>
            <ActivityChart data={MOCK_ACTIVITY_DATA} />
            {/* Add more charts here later */}
          </div>
        );

      case 'history':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white">Browsing History</h2>
            <HistoryList history={MOCK_HISTORY_DATA} />
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
              <p className="text-zinc-400">Here's your productivity overview for today.</p>
            </div>
            <div className="flex gap-4">
              <GlassCard className="px-4 py-2 flex items-center gap-2 bg-purple-500/10 border-purple-500/20">
                <Zap className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-bold text-purple-200">5 Day Streak</span>
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
