import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useAuthStore } from '../lib/store';
import { AnimatePresence, motion } from 'framer-motion';
import {
    BarChart3,
    Calendar,
    Check,
    FlaskConical,
    KeyRound,
    LayoutGrid,
    ListTodo,
    Search,
    Settings,
    Shield,
    Sparkles,
    Target,
    Timer,
    Trees,
    Trophy,
    User,
    Users,
    ShoppingBag,
} from 'lucide-react';
import { isDevModeEnabled, toggleDevMode } from '../lib/devMode';
import { PALETTE_SHORTCUT_LABEL } from '../lib/shortcuts';
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
    focuzpass: KeyRound,
    calendar: Calendar,
    lists: ListTodo,
    sessions: Timer,
    blocklist: Shield,
    habits: Target,
    progress: Trophy,
    challenges: Target,
    forest: Trees,
    shop: ShoppingBag,
    friends: Users,
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
    /** Short detail shown on the right, like a duration. */
    meta?: string;
    section: 'Actions' | 'Go to';
    icon: typeof LayoutGrid;
    run: () => void;
};

const EASE = [0.16, 1, 0.3, 1] as const;

function Highlight({ label, query }: { label: string; query: string }) {
    const q = query.trim().toLowerCase();
    if (!q) return <>{label}</>;
    const idx = label.toLowerCase().indexOf(q);
    if (idx === -1) return <>{label}</>;
    return (
        <>
            {label.slice(0, idx)}
            <span className="text-[var(--cmdk-text-1)] underline decoration-[var(--cmdk-text-4)] underline-offset-[3px]">
                {label.slice(idx, idx + q.length)}
            </span>
            {label.slice(idx + q.length)}
        </>
    );
}

type Props = {
    open: boolean;
    onClose: () => void;
    onNavigate: (tab: string) => void;
    onOpenAi?: () => void;
    onFeedback?: (message: string) => void;
};

/** The dashboard's command palette, styled like focuznow.com's (see .fz-cmdk in focuzDesign.css). */
export function OptionsCommandPalette({ open, onClose, onNavigate, onOpenAi, onFeedback }: Props) {
    const [query, setQuery] = useState('');
    const [selected, setSelected] = useState(0);
    const [todoPrompt, setTodoPrompt] = useState(false);
    const [todoSuccess, setTodoSuccess] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    /** True when the arrow keys moved the highlight (only then do we scroll it into view). */
    const keyboardMove = useRef(false);
    const listId = useId();

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
            label: t.label,
            section: 'Go to' as const,
            icon: NAV_ICONS[t.tab] || LayoutGrid,
            run: () => onNavigate(t.tab),
        }));

        const actions: Command[] = [
            {
                id: 'focus',
                label: 'Start a focus session',
                meta: '25 min',
                section: 'Actions',
                icon: Timer,
                run: () => {
                    chrome.runtime.sendMessage({ type: 'START_SESSION', duration: 25 }, () => {
                        onFeedback?.('Focus session started (25m)');
                    });
                },
            },
            {
                id: 'todo',
                label: 'Add a to-do',
                section: 'Actions',
                icon: ListTodo,
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
                meta: isDevModeEnabled() ? 'Turn off' : 'Turn on',
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

        const matching = actions.filter((a) => !q || a.label.toLowerCase().includes(q) || a.meta?.toLowerCase().includes(q));
        return [...matching, ...nav];
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
            void useAuthStore.getState().fetchEngineState();
            window.setTimeout(() => {
                setTodoSuccess(false);
                setTodoPrompt(false);
                setSelected(0);
            }, 900);
        });
    };

    const runCommand = (cmd: Command) => {
        cmd.run();
        if (cmd.id !== 'todo') onClose();
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
        if (todoPrompt) inputRef.current?.focus();
    }, [todoPrompt]);

    useEffect(() => {
        if (!todoPrompt && !todoSuccess) {
            setSelected((i) => Math.min(i, Math.max(0, commands.length - 1)));
        }
    }, [commands.length, todoPrompt, todoSuccess]);

    // Keep the highlighted row in view while arrowing through a long list. Not for the mouse:
    // scrolling under the pointer would highlight the next row, scroll again, and run away.
    useEffect(() => {
        if (!open || !keyboardMove.current) return;
        keyboardMove.current = false;
        document.getElementById(`${listId}-${selected}`)?.scrollIntoView({ block: 'nearest' });
    }, [open, selected, listId]);

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
                keyboardMove.current = true;
                setSelected((i) => (i + 1) % Math.max(1, commands.length));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                keyboardMove.current = true;
                setSelected((i) => (i - 1 + commands.length) % Math.max(1, commands.length));
            } else if (e.key === 'Enter' && commands[selected]) {
                e.preventDefault();
                runCommand(commands[selected]);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, commands, selected, onClose, todoPrompt, todoSuccess, query]);

    let lastSection = '';

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    className="fz-cmdk fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[16vh]"
                    style={{ background: 'var(--cmdk-scrim)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    onMouseDown={(e) => e.target === e.currentTarget && onClose()}
                >
                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        aria-label="Command palette"
                        className="w-full max-w-[560px] overflow-hidden rounded-[18px]"
                        style={{ background: 'var(--cmdk-panel)', boxShadow: '0 0 0 1px var(--cmdk-ring), var(--cmdk-shadow)' }}
                        initial={{ opacity: 0, y: -10, scale: 0.97, filter: 'blur(6px)' }}
                        animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                        exit={{ opacity: 0, y: -6, scale: 0.98, filter: 'blur(4px)' }}
                        transition={{ duration: 0.32, ease: EASE }}
                    >
                        <div className="flex items-center gap-3 px-5" style={{ boxShadow: 'inset 0 -1px 0 var(--cmdk-line)' }}>
                            {todoPrompt ? (
                                <ListTodo size={17} className="shrink-0 text-[var(--cmdk-text-3)]" />
                            ) : (
                                <Search size={17} className="shrink-0 text-[var(--cmdk-text-3)]" />
                            )}
                            <input
                                ref={inputRef}
                                value={query}
                                onChange={(e) => {
                                    setQuery(e.target.value);
                                    if (!todoPrompt) setSelected(0);
                                }}
                                placeholder={todoPrompt ? 'What do you need to do?' : 'Search or run a command'}
                                className="fz-cmdk-input h-[58px] min-w-0 flex-1 bg-transparent text-[16px] text-[var(--cmdk-text-1)] outline-none placeholder:text-[var(--cmdk-text-4)]"
                                spellCheck={false}
                                autoComplete="off"
                                role="combobox"
                                aria-expanded={!todoPrompt}
                                aria-controls={listId}
                                aria-activedescendant={!todoPrompt && commands[selected] ? `${listId}-${selected}` : undefined}
                            />
                            <span className="fz-cmdk-kbd">esc</span>
                        </div>

                        {todoSuccess ? (
                            <div className="flex flex-col items-center justify-center gap-3 py-10">
                                <motion.span
                                    className="flex size-12 items-center justify-center rounded-full text-[var(--cmdk-success)]"
                                    style={{ boxShadow: 'inset 0 0 0 1px currentColor' }}
                                    initial={{ scale: 0.6, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ duration: 0.32, ease: EASE }}
                                >
                                    <Check size={22} strokeWidth={2.5} />
                                </motion.span>
                                <p className="text-[14.5px] font-medium text-[var(--cmdk-text-1)]">To-do added</p>
                            </div>
                        ) : todoPrompt ? (
                            <p className="px-5 py-4 text-[13px] text-[var(--cmdk-text-3)]">
                                Type it, then press <span className="fz-cmdk-kbd">↵</span> to add it to today.
                            </p>
                        ) : (
                            <div id={listId} role="listbox" className="max-h-[360px] overflow-y-auto p-2">
                                {commands.length === 0 && (
                                    <div className="px-3 py-8 text-center text-[14px] text-[var(--cmdk-text-3)]">
                                        No commands match “{query}”.
                                    </div>
                                )}
                                {commands.map((cmd, i) => {
                                    const Icon = cmd.icon;
                                    const header = cmd.section !== lastSection ? cmd.section : null;
                                    lastSection = cmd.section;
                                    const isSelected = i === selected;
                                    return (
                                        <div key={cmd.id}>
                                            {header && (
                                                <div className="px-3 pb-1.5 pt-2.5 text-[12px] font-[540] text-[var(--cmdk-text-4)]">{header}</div>
                                            )}
                                            <div
                                                id={`${listId}-${i}`}
                                                role="option"
                                                aria-selected={isSelected}
                                                onMouseMove={() => i !== selected && setSelected(i)}
                                                onClick={() => runCommand(cmd)}
                                                className="flex cursor-pointer items-center gap-3 rounded-[10px] px-3 py-2.5 text-[14.5px] transition-colors duration-150"
                                                style={{
                                                    background: isSelected ? 'var(--cmdk-selected)' : 'transparent',
                                                    color: isSelected ? 'var(--cmdk-text-1)' : 'var(--cmdk-text-2)',
                                                }}
                                            >
                                                <Icon size={16} className="shrink-0" />
                                                <span className="min-w-0 flex-1 truncate">
                                                    <Highlight label={cmd.label} query={query} />
                                                </span>
                                                {cmd.meta && <span className="text-[12.5px] text-[var(--cmdk-text-4)]">{cmd.meta}</span>}
                                                <span className="fz-cmdk-kbd" style={{ visibility: isSelected ? 'visible' : 'hidden' }}>
                                                    ↵
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        <div
                            className="flex items-center gap-2 px-5 py-3 text-[12.5px] text-[var(--cmdk-text-4)]"
                            style={{ boxShadow: 'inset 0 1px 0 var(--cmdk-line)' }}
                        >
                            <span className="fz-cmdk-kbd">{PALETTE_SHORTCUT_LABEL}</span> opens this on every site too.
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
