import React from 'react';
import { motion } from 'framer-motion';
import { GlassCard } from '@/components/ui/GlassCard';
import { LucideIcon } from 'lucide-react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    Cell
} from "recharts";

// -----------------------------------------------------------------------------
// Stat Card
// -----------------------------------------------------------------------------
interface StatCardProps {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: LucideIcon;
    color?: string;
    delay?: number;
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, subtitle, icon: Icon, color = "purple", delay = 0 }) => {
    const colorClasses = {
        purple: "text-purple-400 bg-purple-500/10 border-purple-500/20",
        blue: "text-blue-400 bg-blue-500/10 border-blue-500/20",
        green: "text-green-400 bg-green-500/10 border-green-500/20",
        red: "text-red-400 bg-red-500/10 border-red-500/20",
        orange: "text-orange-400 bg-orange-500/10 border-orange-500/20",
    }[color] || colorClasses.purple;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
        >
            <GlassCard className="p-6 relative overflow-hidden group hover:bg-white/5 transition-colors">
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-zinc-400 text-xs font-medium uppercase tracking-wider mb-1">{title}</p>
                        <h3 className="text-3xl font-bold text-white mb-1">{value}</h3>
                        {subtitle && <p className="text-zinc-500 text-xs">{subtitle}</p>}
                    </div>
                    <div className={`p-3 rounded-xl border ${colorClasses}`}>
                        <Icon className="w-6 h-6" />
                    </div>
                </div>
                {/* Background Glow */}
                <div className={`absolute -bottom-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-10 group-hover:opacity-20 transition-opacity bg-${color}-500`} />
            </GlassCard>
        </motion.div>
    );
};

// -----------------------------------------------------------------------------
// Activity Chart
// -----------------------------------------------------------------------------
interface ActivityChartProps {
    data: any[];
}

export const ActivityChart: React.FC<ActivityChartProps> = ({ data }) => {
    return (
        <GlassCard className="p-6 h-[400px] flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white">Activity Overview</h3>
                <div className="flex gap-2">
                    {['Day', 'Week'].map((t) => (
                        <button key={t} className="px-3 py-1 rounded-full text-xs font-medium bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors">
                            {t}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data}>
                        <defs>
                            <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                        <XAxis
                            dataKey="name"
                            stroke="#52525b"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            dy={10}
                        />
                        <YAxis
                            stroke="#52525b"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            dx={-10}
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px' }}
                            itemStyle={{ color: '#fff' }}
                            cursor={{ stroke: '#ffffff20' }}
                        />
                        <Area
                            type="monotone"
                            dataKey="hours"
                            stroke="#a855f7"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#colorHours)"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </GlassCard>
    );
};

// -----------------------------------------------------------------------------
// History List
// -----------------------------------------------------------------------------
interface HistoryItem {
    domain: string;
    timeSpent: number; // in ms
    visits: number;
    lastVisited: string;
}

interface HistoryListProps {
    history: HistoryItem[];
}

export const HistoryList: React.FC<HistoryListProps> = ({ history }) => {
    const formatTime = (ms: number) => {
        const mins = Math.floor(ms / 60000);
        if (mins < 60) return `${mins}m`;
        const hrs = Math.floor(mins / 60);
        return `${hrs}h ${mins % 60}m`;
    };

    return (
        <GlassCard className="p-0 overflow-hidden flex flex-col h-full">
            <div className="p-6 border-b border-white/5">
                <h3 className="text-lg font-bold text-white">Top Sites</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
                {history.length > 0 ? (
                    <div className="space-y-1">
                        {history.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 hover:bg-white/5 rounded-xl transition-colors group">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-xs font-bold text-zinc-500 group-hover:text-white transition-colors">
                                        {idx + 1}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium text-zinc-200">{item.domain}</span>
                                        <span className="text-xs text-zinc-500">{item.visits} visits</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="text-sm font-bold text-purple-400">{formatTime(item.timeSpent)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-40 text-zinc-500">
                        <p>No history data yet</p>
                    </div>
                )}
            </div>
        </GlassCard>
    );
};
