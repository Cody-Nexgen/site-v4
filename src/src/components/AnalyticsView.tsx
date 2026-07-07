import { useState, useEffect } from 'react';
import { ArrowLeft, BarChart3, Clock, Shield, Zap, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface TopSite {
    domain: string;
    timeSpent: number; // in seconds
}

export function AnalyticsView({ onBack }: { onBack: () => void }) {
    const [topSites, setTopSites] = useState<TopSite[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadTopSites = async () => {
            try {
                // Get today's date in YYYY-MM-DD format
                const today = new Date().toISOString().split('T')[0];
                const storageKey = `screenTime_${today}`;

                console.log('[AnalyticsView] Loading from key:', storageKey);

                // Get screen time data from storage
                const result = await chrome.storage.local.get([storageKey]);
                const screenTimeData = result[storageKey] || {};

                console.log('[AnalyticsView] Screen time data:', screenTimeData);

                // Convert to array and sort by time
                const sitesArray: TopSite[] = Object.entries(screenTimeData)
                    .map(([domain, timeMs]) => ({
                        domain,
                        timeSpent: Math.floor((timeMs as number) / 1000) // Convert ms to seconds
                    }))
                    .filter(site => site.timeSpent > 0) // Only show sites with time
                    .sort((a, b) => b.timeSpent - a.timeSpent)
                    .slice(0, 5); // Top 5

                console.log('[AnalyticsView] Top sites:', sitesArray);
                setTopSites(sitesArray);
            } catch (error) {
                console.error('[AnalyticsView] Error loading top sites:', error);
            } finally {
                setLoading(false);
            }
        };

        loadTopSites();

        // Refresh every 10 seconds
        const interval = setInterval(loadTopSites, 10000);
        return () => clearInterval(interval);
    }, []);

    const formatTime = (seconds: number) => {
        if (seconds < 60) return `${seconds}s`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m`;
        const hours = Math.floor(minutes / 60);
        const remainingMins = minutes % 60;
        return `${hours}h ${remainingMins}m`;
    };

    const getFaviconUrl = (domain: string) => {
        return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    };

    const stats = {
        focusTime: 150,
        blocksCount: 42,
        streak: 5,
        dailyActivity: [20, 45, 30, 60, 90, 45, 150]
    };

    const maxActivity = Math.max(...stats.dailyActivity);
    const maxTimeSpent = topSites.length > 0 ? Math.max(...topSites.map(s => s.timeSpent)) : 1;

    return (
        <div className="absolute inset-0 flex flex-col bg-zinc-950">
            {/* Header - Fixed */}
            <div className="flex items-center gap-2 p-3 border-b border-white/10 bg-zinc-900/50 backdrop-blur-md flex-shrink-0">
                <Button variant="ghost" size="icon" onClick={onBack} className="text-zinc-400 hover:text-white">
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <h2 className="text-lg font-semibold text-white">Analytics</h2>
            </div>

            {/* Content - Scrollable */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {/* Overview Cards */}
                <div className="grid grid-cols-2 gap-3">
                    <Card className="bg-zinc-900/50 border-white/5">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                                <Clock className="h-4 w-4 text-purple-400" />
                                <span className="text-xs text-green-400">Today</span>
                            </div>
                            <div className="text-2xl font-bold text-white">
                                {formatTime(topSites.reduce((sum, site) => sum + site.timeSpent, 0))}
                            </div>
                            <div className="text-xs text-zinc-500">Total Time</div>
                        </CardContent>
                    </Card>
                    <Card className="bg-zinc-900/50 border-white/5">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                                <Shield className="h-4 w-4 text-pink-400" />
                                <span className="text-xs text-zinc-500">Total</span>
                            </div>
                            <div className="text-2xl font-bold text-white">{stats.blocksCount}</div>
                            <div className="text-xs text-zinc-500">Sites Blocked</div>
                        </CardContent>
                    </Card>
                </div>

                {/* Weekly Activity Chart */}
                <Card className="bg-zinc-900/50 border-white/5">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                            <BarChart3 className="h-4 w-4" />
                            Weekly Activity
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-end justify-between h-32 gap-2 pt-4">
                            {stats.dailyActivity.map((val, i) => (
                                <div key={i} className="flex flex-col items-center gap-1 flex-1">
                                    <div
                                        className="w-full bg-purple-600/50 hover:bg-purple-500 rounded-t transition-all"
                                        style={{ height: `${(val / maxActivity) * 100}%` }}
                                    />
                                    <span className="text-[10px] text-zinc-600">
                                        {['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Top Sites - Real Data with Favicons */}
                <Card className="bg-zinc-900/50 border-white/5">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                            <TrendingUp className="h-4 w-4" />
                            Top Sites Today
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {loading ? (
                            <div className="text-center py-4 text-zinc-500 text-xs">Loading...</div>
                        ) : topSites.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 text-center space-y-2">
                                <div className="w-12 h-12 rounded-full bg-zinc-800/50 flex items-center justify-center">
                                    <TrendingUp className="w-6 h-6 text-zinc-600" />
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-zinc-400">No data yet</p>
                                    <p className="text-[10px] text-zinc-600">Browse the web to generate stats!</p>
                                </div>
                            </div>
                        ) : (
                            topSites.map((site) => (
                                <div key={site.domain} className="space-y-1">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            <img
                                                src={getFaviconUrl(site.domain)}
                                                alt=""
                                                className="w-4 h-4 flex-shrink-0"
                                                onError={(e) => {
                                                    e.currentTarget.style.display = 'none';
                                                }}
                                            />
                                            <span className="text-xs text-zinc-300 truncate">{site.domain}</span>
                                        </div>
                                        <span className="text-xs text-zinc-500 flex-shrink-0">{formatTime(site.timeSpent)}</span>
                                    </div>
                                    <Progress
                                        value={(site.timeSpent / maxTimeSpent) * 100}
                                        className="h-1.5 bg-zinc-800"
                                    />
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>

                {/* Streak */}
                <Card className="bg-gradient-to-br from-orange-900/20 to-red-900/20 border-orange-500/20">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center">
                            <Zap className="h-6 w-6 text-orange-500 fill-orange-500" />
                        </div>
                        <div>
                            <div className="text-xl font-bold text-white">{stats.streak} Day Streak</div>
                            <div className="text-xs text-orange-400/80">Keep it up! You're on fire! 🔥</div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
