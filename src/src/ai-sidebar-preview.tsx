import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './styles/focuzDesign.css';
import './mockChrome';
import { CoachSidebar, type CoachChatItem, type CoachSidebarView } from './components/coach/CoachSidebar';
import { setDashboardColorMode, initializeDashboardColorMode, applyDocumentTheme } from './lib/themes';
import { SegmentedControl } from './components/fz/SegmentedControl';
import { ToastProvider } from './components/fz/Toast';

void initializeDashboardColorMode();
applyDocumentTheme(null, false);

const q = new URLSearchParams(window.location.search);
if (q.get('light') === '1') void setDashboardColorMode('light');

const MOCK_COACH_CHATS: CoachChatItem[] = [
    { id: 'c1', title: 'Deep work plan for finals week' },
    { id: 'c2', title: 'Block YouTube during study hours' },
    { id: 'c3', title: 'Why my focus score dropped' },
    { id: 'c4', title: 'Pomodoro vs 52/17 method' },
    { id: 'c5', title: 'Weekly screen time review' },
    { id: 'c6', title: 'Spanish vocab study schedule' },
    { id: 'c7', title: 'Savanna ecosystem essay outline' },
    { id: 'c8', title: 'Morning routine for early classes' },
    { id: 'c9', title: 'Reduce Reddit doomscrolling' },
    { id: 'c10', title: 'Allowlist mode for exam week' },
    { id: 'c11', title: 'Best focus interval for reading' },
    { id: 'c12', title: 'Plan my calculus revision' },
    { id: 'c13', title: 'Twitter blocking schedule idea' },
    { id: 'c14', title: 'Habit streak recovery plan' },
    { id: 'c15', title: 'Bedtime wind-down checklist' },
    { id: 'c16', title: 'Focus score dipped on weekends' },
    { id: 'c17', title: 'Study blocks around lectures' },
    { id: 'c18', title: 'Nuclear lockdown for deadline' },
    { id: 'c19', title: 'Evening deep work experiment' },
    { id: 'c20', title: 'Instagram during lunch only' },
    { id: 'c21', title: 'Group project focus sessions' },
    { id: 'c22', title: 'Review last month analytics' },
];

function App() {
    const [light, setLight] = useState(q.get('light') === '1');
    const [chats, setChats] = useState(MOCK_COACH_CHATS);
    const [active, setActive] = useState('c3');
    const [view, setView] = useState<CoachSidebarView>('chats');
    const [collapsed, setCollapsed] = useState(false);
    const [model, setModel] = useState('FocuzAI');
    return (
        <div className="focuz-dashboard focuz-shell-v2 flex h-screen w-screen overflow-hidden">
            {!collapsed && (
                <CoachSidebar
                    chats={chats}
                    activeChatId={active}
                    view={view}
                    onViewChange={setView}
                    onNewChat={() => {
                        const id = `c${Date.now()}`;
                        setChats((p) => [{ id, title: 'New chat' }, ...p]);
                        setActive(id);
                        setView('chats');
                    }}
                    onSelectChat={setActive}
                    onRenameChat={(id, title) =>
                        setChats((p) => p.map((c) => (c.id === id ? { ...c, title } : c)))
                    }
                    onDeleteChat={(id) => setChats((p) => p.filter((c) => c.id !== id))}
                    userName="Cole Ortiz"
                    userPlan="Pro"
                    onOpenAccount={() => {}}
                    onCollapse={() => setCollapsed(true)}
                    modelOptions={['FocuzAI', 'FocuzAI Think']}
                    model={model}
                    onModelChange={setModel}
                    usage={{ dayPct: 7, weekPct: 9, thinkPct: 8, isPro: true }}
                    onClearChats={() => setChats([])}
                />
            )}
            <main className="relative flex min-w-0 flex-1 flex-col bg-[var(--fz-bg-panel)]">
                <div className="absolute right-3 top-3 z-10">
                    <SegmentedControl
                        size="sm"
                        value={light ? 'light' : 'dark'}
                        onChange={(v) => {
                            const isLight = v === 'light';
                            setLight(isLight);
                            void setDashboardColorMode(isLight ? 'light' : 'dark');
                        }}
                        options={[
                            { value: 'dark', label: 'Dark' },
                            { value: 'light', label: 'Light' },
                        ]}
                    />
                </div>
                <div className="flex h-full items-center justify-center">
                    <p className="text-[14px] text-[var(--fz-text-4)]">
                        {view === 'chats' ? 'Select a chat or start a new one' : 'Library'}
                    </p>
                </div>
            </main>
        </div>
    );
}

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <ToastProvider>
            <App />
        </ToastProvider>
    </StrictMode>,
);
