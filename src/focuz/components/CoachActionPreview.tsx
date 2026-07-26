import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Ban, Check, Clock, Sparkles, Palette, Zap, Calendar, Link2, BarChart3 } from 'lucide-react';
import type { CoachAction } from '../lib/aiCoachTypes';

export function CoachActionPreview({ action }: { action: CoachAction }) {
    const card = (icon: ReactNode, title: string, body: ReactNode, tone: string) => (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mt-2 p-3 rounded-lg border text-xs ${tone}`}
        >
            <div className="flex items-center gap-2 mb-1">
                {icon}
                <p className="font-medium">{title}</p>
            </div>
            {body}
        </motion.div>
    );

    const d = action.data;
    switch (action.action_type) {
        case 'timer':
            return card(
                <Clock size={16} className="text-purple-400" />,
                'Timer started',
                <p className="text-neutral-400">
                    {d.domain} · {d.minutes} min
                </p>,
                'bg-purple-900/30 border-purple-500/30',
            );
        case 'block':
            return card(
                <Ban size={16} className="text-red-400" />,
                'Sites blocked',
                <div className="flex flex-wrap gap-1 mt-1">
                    {(d.domains || []).map((domain) => (
                        <span key={domain} className="px-2 py-0.5 bg-red-500/20 text-red-300 rounded">
                            {domain}
                        </span>
                    ))}
                </div>,
                'bg-red-900/30 border-red-500/30',
            );
        case 'unblock':
            return card(
                <Check size={16} className="text-green-400" />,
                'Sites unblocked',
                <div className="flex flex-wrap gap-1 mt-1">
                    {(d.domains || []).map((domain) => (
                        <span key={domain} className="px-2 py-0.5 bg-green-500/20 text-green-300 rounded">
                            {domain}
                        </span>
                    ))}
                </div>,
                'bg-green-900/30 border-green-500/30',
            );
        case 'blocks_list':
            return card(
                <Ban size={16} className="text-neutral-400" />,
                'Active blocks',
                d.blocks?.length ? (
                    <div className="flex flex-wrap gap-1 mt-1">
                        {d.blocks.map((domain) => (
                            <span key={domain} className="px-2 py-0.5 bg-neutral-700 text-neutral-300 rounded">
                                {domain}
                            </span>
                        ))}
                    </div>
                ) : (
                    <p className="text-neutral-500">None</p>
                ),
                'bg-neutral-800/50 border-neutral-600/30',
            );
        case 'nuclear_start':
            return card(
                <Zap size={16} className="text-red-400" />,
                'Nuclear lockdown',
                <p className="text-neutral-400">
                    {d.target === 'all' ? 'All sites' : 'Blocklist only'} · {d.minutes} min
                </p>,
                'bg-red-950/40 border-red-500/40',
            );
        case 'theme':
            return card(
                <Palette size={16} className="text-violet-400" />,
                'Theme',
                <p className="text-neutral-400">{d.theme}</p>,
                'bg-violet-900/30 border-violet-500/30',
            );
        case 'calendar_open':
            return card(
                <Calendar size={16} className="text-blue-400" />,
                'Calendar',
                <p className="text-neutral-400">Opened scheduling calendar</p>,
                'bg-blue-900/30 border-blue-500/30',
            );
        case 'scheduling_links_list':
            return card(
                <Link2 size={16} className="text-blue-400" />,
                'Booking links',
                <p className="text-neutral-400">{d.message}</p>,
                'bg-blue-900/30 border-blue-500/30',
            );
        case 'read_analytics':
            return card(
                <BarChart3 size={16} className="text-emerald-400" />,
                'Screen time',
                <p className="text-neutral-400">{d.success ? 'Approved' : d.message || 'Declined'}</p>,
                'bg-emerald-900/20 border-emerald-500/30',
            );
        case 'calendar_add_events':
        case 'planner_set':
        case 'daily_goal_set':
        case 'habit_add':
        case 'habit_checkin':
        case 'pomodoro_configure':
        case 'pomodoro_start':
        case 'in_app_block':
        case 'in_app_filter_add':
        case 'in_app_filter_remove':
        case 'change_setting':
        case 'engine_settings':
            return card(
                <Sparkles size={16} className="text-blue-400" />,
                action.action_type.replace(/_/g, ' '),
                <p className="text-neutral-400">{d.message || 'Applied'}</p>,
                'bg-blue-900/30 border-blue-500/30',
            );
        default:
            return null;
    }
}
