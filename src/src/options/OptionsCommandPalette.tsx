import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
    BarChart3,
    Calendar,
    Check,
    Clock,
    FlaskConical,
    LayoutGrid,
    ListTodo,
    Search,
    Settings,
    Shield,
    Sparkles,
    Target,
    Trees,
    Trophy,
    User,
    Users,
    Mic2,
    ShoppingBag,
} from 'lucide-react';
import { isDevModeEnabled, toggleDevMode } from '../lib/devMode';
import { WORKSPACE_NAV } from '../lib/workspaceNav';

export type PaletteNavTarget = {
    tab: string;
    label: string;
    group: string;
};

const NAV_TARGETS: PaletteNavTarget[] = WORKSPACE_NAV.flatMap((section) =>
    section.tabs.map((t) => ({ group: section.label, tab: t.id, label: t.label })),
);

const NAV_ICONS: Record<string, typeof LayoutGrid> = {
    overview: LayoutGrid,
    calendar: Calendar,
    lists: ListTodo,
    sessions: Clock,
    blocklist: Shield,
    habits: Target,
    progress: Trophy,
    challenges: Target,
    forest: Trees,
    shop: ShoppingBag,
    friends: Users,
    focus_rooms: Mic2,
    statistics: BarChart3,
    ai_coach: Sparkles,
    patterns: BarChart3,
    settings: Settings,
    support: Settings,
    account: User,
};

type Command = {
    id: string;
    label: string;
    meta?: string;
    section: 'Actions' | 'Navigation';
    icon: typeof LayoutGrid;
    run: () => void;
};

type Props = {
    open: boolean;
    onClose: () => void;
    onNavigate: (tab: string) => void;
    onOpenAi?: () => void;
    onFeedback?: (message: string) => void;
};

export function OptionsCommandPalette({ open, onClose, onNavigate, onOpenAi, onFeedback }: Props) {
    const [query, setQuery] = useState('');
    const [selected, setSelected] = useState(0);
    const [todoPrompt, setTodoPrompt] = useState(false);
    const [todoSuccess, setTodoSuccess] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const commands = useMemo<Command[]>(() => {
        const q = query.trim().toLowerCase();
        const nav: Command[] = NAV_TARGETS.filter(
            (t) =>
                !q ||
                t.label.toLowerCase().includes(q) ||
                t.group.toLowerCase().includes(q) ||
                t.tab.includes(q),
        ).map((t) => ({
            id: `nav-${t.tab}`,
            label: `Go to ${t.label}`,
            meta: t.group,
            section: 'Navigation' as const,
            icon: NAV_ICONS[t.tab] || LayoutGrid,
            run: () => onNavigate(t.tab),
        }));

        const actions: Command[] = [
            {
                id: 'focus',
                label: 'Start focus session',
                meta: '25m',
                section: 'Actions',
                icon: Target,
                run: () => {
                    chrome.runtime.sendMessage({ type: 'START_SESSION', duration: 25 }, () => {
                        onFeedback?.('Focus session started (25m)');
                    });
                },
            },
            {
                id: 'todo',
                label: 'Add to-do',
                meta: 'Task',
                section: 'Actions',
                icon: Target,
                run: () => {
                    setTodoPrompt(true);
                    setQuery('');
                },
            },
        ];
        if (onOpenAi) {
            actions.push({
                id: 'ai',
                label: 'Open AI coach',
                meta: 'Coach',
                section: 'Actions',
                icon: Sparkles,
                run: onOpenAi,
            });
        }
        // Hidden dev command — only surfaces when the query starts with '/'
        if (q.startsWith('/')) {
            actions.push({
                id: 'devmodetest',
                label: '/devmodetest',
                meta: isDevModeEnabled() ? 'Disable dev testing mode' : 'Enable dev testing mode',
                section: 'Actions',
                icon: FlaskConical,
                run: () => {
                    const on = toggleDevMode();
                    onFeedback?.(
                        on
                            ? 'Dev mode ON — testing toolkit unlocked (open Forest)'
                            : 'Dev mode OFF',
                    );
                },
            });
        }

        const all = [...actions, ...nav];
        return all.filter((a) => !q || a.label.toLowerCase().includes(q) || a.meta?.toLowerCase().includes(q));
    }, [query, onNavigate, onOpenAi, onFeedback]);

    const submitTodo = () => {
        const title = query.trim();
        if (!title) {
            onFeedback?.('Type a to-do name');
            return;
        }
        chrome.runtime.sendMessage({ type: 'ADD_TODO', title, openDashboard: false }, (resp) => {
            if (chrome.runtime.lastError || (resp && (resp as { ok?: boolean }).ok === false)) {
                onFeedback?.('Could not add to-do');
                return;
            }
            setTodoSuccess(true);
            setQuery('');
            window.setTimeout(() => {
                setTodoSuccess(false);
                setTodoPrompt(false);
                setSelected(0);
            }, 900);
        });
    };

    useEffect(() => {
        if (!open) {
            setTodoPrompt(false);
            setTodoSuccess(false);
            return;
        }
        setQuery('');
        setSelected(0);
        const t = window.setTimeout(() => inputRef.current?.focus(), 30);
        return () => window.clearTimeout(t);
    }, [open]);

    useEffect(() => {
        if (!todoPrompt && !todoSuccess) {
            setSelected((i) => Math.min(i, Math.max(0, commands.length - 1)));
        }
    }, [commands.length, todoPrompt, todoSuccess]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                if (todoPrompt) {
                    setTodoPrompt(false);
                    setTodoSuccess(false);
                } else {
                    onClose();
                }
                return;
            }
            if (todoPrompt || todoSuccess) {
                if (e.key === 'Enter' && todoPrompt && !todoSuccess) {
                    e.preventDefault();
                    submitTodo();
                }
                return;
            }
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelected((i) => (i + 1) % Math.max(1, commands.length));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelected((i) => (i - 1 + commands.length) % Math.max(1, commands.length));
            } else if (e.key === 'Enter' && commands[selected]) {
                e.preventDefault();
                const cmd = commands[selected];
                if (cmd.id === 'todo') {
                    cmd.run();
                } else {
                    cmd.run();
                    onClose();
                }
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, commands, selected, onClose, todoPrompt, todoSuccess, query]);

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    className="fixed inset-0 z-[300] flex items-start justify-center pt-[12vh] px-4 bg-black/70"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                >
                    <motion.div
                        className="w-full max-w-[560px] bg-[#141416] border border-white/[0.09] rounded-lg overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.55)]"
                        initial={{ opacity: 0, scale: 0.97, y: -6 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.97, y: -6 }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div
                            className={`m-2 px-3 py-2.5 bg-white/[0.025] border rounded-md flex items-center gap-2.5 ${
                                todoPrompt ? 'border-white/[0.14]' : 'border-white/[0.07]'
                            }`}
                        >
                            <Search size={18} className="text-neutral-600 flex-shrink-0" />
                            <input
                                ref={inputRef}
                                value={query}
                                onChange={(e) => {
                                    setQuery(e.target.value);
                                    if (!todoPrompt) setSelected(0);
                                }}
                                placeholder={
                                    todoPrompt ? 'What do you need to do?' : 'Type a command or search…'
                                }
                                className="flex-1 bg-transparent border-none outline-none text-neutral-200 text-sm font-normal placeholder:text-neutral-600"
                                spellCheck={false}
                                autoComplete="off"
                            />
                        </div>

                        {todoPrompt && !todoSuccess && (
                            <p className="px-4 pb-2 text-xs font-medium text-neutral-500">
                                Add to-do — press Enter to save
                            </p>
                        )}

                        <div className="max-h-[360px] overflow-y-auto pb-3">
                            {todoSuccess ? (
                                <div className="flex flex-col items-center justify-center py-10 gap-3 animate-fade-in-up">
                                    <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/35 flex items-center justify-center text-emerald-400">
                                        <Check size={28} strokeWidth={2.5} />
                                    </div>
                                    <p className="text-sm font-bold text-white">To-do added</p>
                                </div>
                            ) : todoPrompt ? null : commands.length === 0 ? (
                                <p className="text-center text-neutral-600 text-sm py-10">No matches</p>
                            ) : (
                                (['Actions', 'Navigation'] as const).map((section) => {
                                    const sectionCmds = commands.filter((c) => c.section === section);
                                    if (!sectionCmds.length) return null;
                                    return (
                                        <div key={section}>
                                            <p className="text-[10px] font-medium text-neutral-600 px-4 py-2">
                                                {section}
                                            </p>
                                            {sectionCmds.map((cmd) => {
                                                const i = commands.indexOf(cmd);
                                                const Icon = cmd.icon;
                                                return (
                                                    <button
                                                        key={cmd.id}
                                                        type="button"
                                                        onMouseEnter={() => setSelected(i)}
                                                        onClick={() => {
                                                            if (cmd.id === 'todo') {
                                                                cmd.run();
                                                            } else {
                                                                cmd.run();
                                                                onClose();
                                                            }
                                                        }}
                                                        className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                                                            i === selected
                                                                ? 'bg-white/[0.08] text-white'
                                                                : 'text-neutral-400 hover:bg-white/[0.03]'
                                                        }`}
                                                    >
                                                        <Icon
                                                            size={18}
                                                            className={
                                                                i === selected
                                                                    ? 'text-neutral-200'
                                                                    : 'text-neutral-600'
                                                            }
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <span className="text-sm font-medium block">
                                                                {cmd.label}
                                                            </span>
                                                            <span className="text-[11px] text-neutral-600">
                                                                {cmd.meta || section}
                                                            </span>
                                                        </div>
                                                        <kbd className="kbd">↵</kbd>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
