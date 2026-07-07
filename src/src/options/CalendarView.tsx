import { useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns';
import { useAuthStore } from '../lib/store';
import { 
    ChevronLeft, ChevronRight, Check, 
    Calendar, Clock, Globe, Plus, 
    Filter, Settings as IconSettings 
} from 'lucide-react';

export default function CalendarView() {
    const { engineState, fetchEngineState } = useAuthStore();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [view, setView] = useState<'month' | 'week' | 'day'>('month');
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [domain, setDomain] = useState('');
    const [startHour, setStartHour] = useState('09:00');
    const [endHour, setEndHour] = useState('17:00');
    const [repeatsWeekly, setRepeatsWeekly] = useState(false);

    const nextDate = () => {
        if (view === 'month') setCurrentDate(addMonths(currentDate, 1));
        else if (view === 'week') setCurrentDate(new Date(currentDate.getTime() + 7 * 86400000));
        else setCurrentDate(new Date(currentDate.getTime() + 86400000));
    };
    const prevDate = () => {
        if (view === 'month') setCurrentDate(subMonths(currentDate, 1));
        else if (view === 'week') setCurrentDate(new Date(currentDate.getTime() - 7 * 86400000));
        else setCurrentDate(new Date(currentDate.getTime() - 86400000));
    };

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    const handleAddBlock = async () => {
        if (!domain.trim() || !selectedDate) return;
        const [sh, sm] = startHour.split(':').map(Number);
        const [eh, em] = endHour.split(':').map(Number);

        await new Promise<void>(r => chrome.runtime.sendMessage({
            type: 'SCHEDULE_ADD',
            domain: domain.trim(),
            startHour: sh,
            startMin: sm,
            endHour: eh,
            endMin: em,
            days: [selectedDate.getDay()],
            specificDate: repeatsWeekly ? null : format(selectedDate, 'yyyy-MM-dd')
        }, () => r()));

        setSelectedDate(null);
        setDomain('');
        fetchEngineState();
    };

    return (
        <div className="bg-[#0A0A0A] border border-white/5 rounded-[24px] overflow-hidden flex flex-col h-full shadow-2xl animate-fade-in transition-all">
            {/* Notion-style Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#0f0f0f]/50">
                <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-1">
                        <button onClick={prevDate} className="p-1.5 hover:bg-white/5 rounded-md transition-colors"><ChevronLeft size={16} className="text-neutral-400" /></button>
                        <button onClick={nextDate} className="p-1.5 hover:bg-white/5 rounded-md transition-colors"><ChevronRight size={16} className="text-neutral-400" /></button>
                    </div>
                    <h2 className="text-sm font-bold text-white tracking-tight">
                        {view === 'month' ? format(currentDate, 'MMMM yyyy') :
                            view === 'week' ? `Week of ${format(startOfWeek(currentDate), 'MMM d')}` :
                                format(currentDate, 'MMMM d, yyyy')}
                    </h2>
                    <button onClick={() => setCurrentDate(new Date())} className="px-2 py-1 hover:bg-white/5 rounded text-[11px] font-bold text-neutral-400 border border-white/5 transition-all">Today</button>
                </div>

                <div className="flex items-center space-x-3">
                    <div className="flex p-0.5 bg-white/5 rounded-lg border border-white/5">
                        {(['month', 'week', 'day'] as const).map(v => (
                            <button
                                key={v}
                                onClick={() => setView(v)}
                                className={`px-3 py-1 rounded-md text-[11px] font-bold capitalize transition-all ${view === v ? 'bg-white/10 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-300'}`}
                            >
                                {v}
                            </button>
                        ))}
                    </div>
                    <div className="h-4 w-px bg-white/10" />
                    <button className="p-1.5 hover:bg-white/5 rounded-md text-neutral-500 transition-colors"><Filter size={14} /></button>
                    <button className="p-1.5 hover:bg-white/5 rounded-md text-neutral-500 transition-colors"><IconSettings size={14} /></button>
                    <button className="flex items-center space-x-1.5 px-3 py-1.5 bg-white text-black rounded-md text-[11px] font-bold hover:bg-neutral-200 transition-all shadow-sm">
                        <Plus size={14} strokeWidth={3} />
                        <span>New</span>
                    </button>
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="flex-1 overflow-hidden flex flex-col">
                {view === 'month' ? (
                    <>
                        <div className="grid grid-cols-7 border-b border-white/5 bg-[#0f0f0f]/30">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                                <div key={day} className="py-2.5 text-[10px] font-bold tracking-widest uppercase text-neutral-600 border-r border-white/5 last:border-0">{day}</div>
                            ))}
                        </div>
                        <div className="grid grid-cols-7 flex-1 overflow-y-auto scrollbar-hide">
                            {days.map((day, i) => {
                                const isCurrentMonth = isSameMonth(day, monthStart);
                                const isToday = isSameDay(day, new Date());
                                return (
                                    <div
                                        key={i}
                                        onClick={() => setSelectedDate(day)}
                                        className={`min-h-[100px] border-r border-b border-white/5 p-2 transition-all hover:bg-white/[0.02] cursor-pointer group relative ${!isCurrentMonth ? 'bg-white/[0.01]' : ''}`}
                                    >
                                        <div className="flex justify-between items-start">
                                            <span className={`text-[11px] font-bold transition-colors ${isToday ? 'bg-purple-600 text-white w-5 h-5 flex items-center justify-center rounded-sm' : isCurrentMonth ? 'text-neutral-400' : 'text-neutral-700'}`}>
                                                {format(day, 'd')}
                                            </span>
                                            <Plus size={12} className="text-neutral-800 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                        
                                        <div className="mt-2 space-y-1">
                                            {engineState?.schedules && Object.entries(engineState.schedules).map(([dom, schs]: [string, any]) => {
                                                const dStr = format(day, 'yyyy-MM-dd');
                                                const activeSchs = schs.filter((s: any) => s.specificDate === dStr || (!s.specificDate && s.days.includes(day.getDay())));
                                                return activeSchs.map((s: any) => (
                                                    <div key={s.id} className="flex items-center space-x-1.5 px-1.5 py-0.5 bg-red-400/10 text-red-400 rounded border border-red-400/10 text-[9px] font-black uppercase tracking-tight truncate">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                                                        <span className="truncate">{dom}</span>
                                                    </div>
                                                ));
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                ) : (
                    /* Week/Day View remains functional but with refined styling */
                    <div className="flex-1 overflow-auto scrollbar-hide flex flex-col">
                        <div className="flex bg-[#0f0f0f]/30 border-b border-white/5 sticky top-0 z-20">
                            <div className="w-16 border-r border-white/5" />
                            {(view === 'week' ? Array.from({ length: 7 }) : [0]).map((_, idx) => {
                                const day = view === 'week' ? new Date(startOfWeek(currentDate).getTime() + idx * 86400000) : currentDate;
                                const isToday = isSameDay(day, new Date());
                                return (
                                    <div key={idx} className="flex-1 py-3 text-center border-r border-white/5 last:border-0">
                                        <div className={`text-[10px] font-black uppercase tracking-widest ${isToday ? 'text-purple-400' : 'text-neutral-500'}`}>
                                            {format(day, 'EEE')}
                                        </div>
                                        <div className={`text-lg font-black mt-1 ${isToday ? 'text-white' : 'text-neutral-400'}`}>
                                            {format(day, 'd')}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex flex-1 relative min-h-[1200px]">
                            <div className="w-16 border-r border-white/5 bg-[#0a0a0a]">
                                {Array.from({ length: 24 }).map((_, h) => (
                                    <div key={h} className="h-[50px] text-[9px] font-bold text-neutral-700 flex items-start justify-center pt-2">
                                        {h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h-12} PM`}
                                    </div>
                                ))}
                            </div>
                            <div className="flex-1 flex">
                                {(view === 'week' ? Array.from({ length: 7 }) : [0]).map((_, idx) => {
                                    const day = view === 'week' ? new Date(startOfWeek(currentDate).getTime() + idx * 86400000) : currentDate;
                                    return (
                                        <div key={idx} className="flex-1 border-r border-white/5 last:border-0 relative group transition-colors hover:bg-white/[0.01]" onClick={() => setSelectedDate(day)}>
                                            {Array.from({ length: 24 }).map((_, h) => (
                                                <div key={h} className="h-[50px] border-b border-white/5" />
                                            ))}
                                            {engineState?.schedules && Object.entries(engineState.schedules).flatMap(([dom, schs]: [string, any]) => {
                                                const dStr = format(day, 'yyyy-MM-dd');
                                                const activeSchs = schs.filter((s: any) => s.specificDate === dStr || (!s.specificDate && s.days.includes(day.getDay())));
                                                return activeSchs.map((s: any) => {
                                                    const start = s.startHour + (s.startMin / 60);
                                                    const end = s.endHour + (s.endMin / 60);
                                                    return (
                                                        <div key={s.id} className="absolute left-1 right-1 bg-red-400/20 border border-red-400/20 rounded-md px-2 py-1.5 flex flex-col items-start shadow-sm z-10 group/item hover:bg-red-400/30 transition-all overflow-hidden" style={{ top: `${start * 50}px`, height: `${(end - start) * 50}px` }}>
                                                            <span className="text-[10px] font-black text-white leading-none truncate w-full">{dom}</span>
                                                            <span className="text-[8px] font-bold text-red-300/60 mt-1 uppercase tracking-tighter">
                                                                {s.startHour}:{s.startMin.toString().padStart(2, '0')} - {s.endHour}:{s.endMin.toString().padStart(2, '0')}
                                                            </span>
                                                            <button 
                                                                onClick={async (e) => { e.stopPropagation(); await chrome.runtime.sendMessage({ type: 'SCHEDULE_REMOVE', domain: dom, scheduleId: s.id }); fetchEngineState(); }}
                                                                className="absolute top-1 right-1 opacity-0 group-hover/item:opacity-100 p-0.5 hover:bg-black/20 rounded transition-all"
                                                            ><Check size={10} className="rotate-45" /></button>
                                                        </div>
                                                    );
                                                });
                                            })}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )
                }
            </div>

            {/* Notion-style Add Modal */}
            {selectedDate && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={() => setSelectedDate(null)}>
                    <div className="bg-[#0f0f0f] border border-white/10 rounded-2xl p-8 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center space-x-3 mb-6">
                            <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center">
                                <Calendar size={20} className="text-purple-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white">Add Schedule</h3>
                                <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">{format(selectedDate, 'EEEE, MMM do')}</p>
                            </div>
                        </div>

                        <div className="space-y-5">
                            <div className="group">
                                <label className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.2em] mb-2 block group-focus-within:text-purple-400 transition-colors">Target Website</label>
                                <div className="relative">
                                    <Globe size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-600" />
                                    <input autoFocus type="text" value={domain} onChange={e => setDomain(e.target.value)} className="w-full bg-white/[0.03] border border-white/5 rounded-xl pl-10 pr-4 py-3 text-sm text-white outline-none focus:border-purple-500/50 focus:bg-white/[0.05] transition-all" placeholder="e.g. youtube.com" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.2em] mb-2 block">Starts</label>
                                    <div className="relative">
                                        <Clock size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-700" />
                                        <input type="time" value={startHour} onChange={e => setStartHour(e.target.value)} className="w-full bg-white/[0.03] border border-white/5 rounded-xl pl-9 pr-3 py-3 text-[12px] font-bold text-white outline-none focus:border-purple-500/50" />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.2em] mb-2 block">Ends</label>
                                    <div className="relative">
                                        <Clock size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-700" />
                                        <input type="time" value={endHour} onChange={e => setEndHour(e.target.value)} className="w-full bg-white/[0.03] border border-white/5 rounded-xl pl-9 pr-3 py-3 text-[12px] font-bold text-white outline-none focus:border-purple-500/50" />
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => setRepeatsWeekly(!repeatsWeekly)}
                                className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${repeatsWeekly ? 'bg-purple-500/5 border-purple-500/20 text-purple-300' : 'bg-white/5 border-white/5 text-neutral-400 hover:bg-white/[0.08]'}`}
                            >
                                <div className="flex items-center space-x-3">
                                    <Refresh size={16} className={repeatsWeekly ? 'animate-spin-slow' : ''} />
                                    <span className="text-xs font-bold">Repeat Weekly</span>
                                </div>
                                <div className={`w-10 h-5 rounded-full transition-all relative ${repeatsWeekly ? 'bg-purple-600' : 'bg-neutral-800'}`}>
                                    <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${repeatsWeekly ? 'left-6' : 'left-1'}`} />
                                </div>
                            </button>
                        </div>

                        <div className="flex space-x-3 mt-8">
                            <button onClick={() => setSelectedDate(null)} className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-neutral-400 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all">Discard</button>
                            <button onClick={handleAddBlock} className="flex-1 py-4 bg-white text-black hover:bg-neutral-200 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all shadow-xl">Confirm</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const Refresh = ({ size, className }: { size: number, className?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" />
    </svg>
);
