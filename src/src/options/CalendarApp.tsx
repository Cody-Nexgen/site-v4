import { useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useAuthStore } from '../lib/store';
import { initializeDashboardColorMode } from '../lib/themes';
import SchedulingCalendarPage from './SchedulingCalendarPage';

export default function CalendarApp() {
    const { session, loading, init, checkSession } = useAuthStore();

    useEffect(() => {
        void initializeDashboardColorMode();
        init();
        void checkSession();
    }, [init, checkSession]);

    if (loading) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-page">
                <div className="w-10 h-10 border-4 border-[var(--fz-accent)] border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="h-screen w-screen flex flex-col bg-page text-white overflow-hidden">
            <header className="h-12 flex-shrink-0 flex items-center justify-between px-4 border-b border-white/8 bg-surface">
                <button
                    type="button"
                    onClick={() => {
                        window.location.href = chrome.runtime.getURL('src/options/index.html');
                    }}
                    className="glass-edge-btn flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-neutral-400 hover:text-white"
                >
                    <ArrowLeft size={14} />
                    Dashboard
                </button>
                <span className="text-[11px] font-bold text-neutral-600 ">Calendar</span>
                <span className="text-xs text-neutral-500 truncate max-w-[200px]">{session?.user?.email || ''}</span>
            </header>
            <main className="flex-1 min-h-0 p-0">
                <SchedulingCalendarPage fullscreen />
            </main>
        </div>
    );
}
