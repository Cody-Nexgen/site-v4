import { useEffect, useId, useMemo, useRef, useState, type ComponentType, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, BarChart3, CalendarDays, CircleHelp, CreditCard, KeyRound, Search, ShieldBan, Timer } from 'lucide-react';
import { isPaletteShortcut, PALETTE_SHORTCUT_LABEL } from '@focuz/lib/shortcuts';
import { EASE } from './motion';
import { jumpToScene, scrollToId } from './scroll';

const OPEN_EVENT = 'fzl:palette';

export function openPaletteDemo() {
    window.dispatchEvent(new Event(OPEN_EVENT));
}

type Command = { id: string; label: string; group: string; icon: ComponentType<{ size?: number }>; run: () => void };

/**
 * A working copy of the extension's command palette. Alt K opens it here too, and every
 * command jumps somewhere on this page.
 */
export function PaletteDemo({ signedIn, onPrimary }: { signedIn: boolean; onPrimary: () => void }) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [cursor, setCursor] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const returnFocus = useRef<HTMLElement | null>(null);
    const listId = useId();

    const commands = useMemo<Command[]>(
        () => [
            { id: 'block', label: 'Watch FocuzNow block a site', group: 'Jump to', icon: ShieldBan, run: () => jumpToScene(0) },
            { id: 'focus', label: 'Start a focus session', group: 'Jump to', icon: Timer, run: () => jumpToScene(1) },
            { id: 'plan', label: 'Plan your week', group: 'Jump to', icon: CalendarDays, run: () => jumpToScene(2) },
            { id: 'pass', label: 'Open FocuzPass', group: 'Jump to', icon: KeyRound, run: () => jumpToScene(3) },
            { id: 'insights', label: 'See your insights', group: 'Jump to', icon: BarChart3, run: () => jumpToScene(4) },
            { id: 'pricing', label: 'Compare plans', group: 'Jump to', icon: CreditCard, run: () => scrollToId('pricing') },
            { id: 'faq', label: 'Read the FAQ', group: 'Jump to', icon: CircleHelp, run: () => scrollToId('faq') },
            {
                id: 'account',
                label: signedIn ? 'Open your dashboard' : 'Create your free account',
                group: 'Account',
                icon: ArrowRight,
                run: onPrimary,
            },
        ],
        [signedIn, onPrimary],
    );

    const results = useMemo(() => {
        const q = query.trim().toLowerCase();
        return q ? commands.filter((c) => c.label.toLowerCase().includes(q)) : commands;
    }, [commands, query]);

    useEffect(() => {
        const show = () => {
            returnFocus.current = document.activeElement as HTMLElement | null;
            setQuery('');
            setCursor(0);
            setOpen(true);
        };
        const onKey = (event: KeyboardEvent) => {
            if (!isPaletteShortcut(event) || event.defaultPrevented) return;
            event.preventDefault();
            if (open) setOpen(false);
            else show();
        };
        window.addEventListener('keydown', onKey);
        window.addEventListener(OPEN_EVENT, show);
        return () => {
            window.removeEventListener('keydown', onKey);
            window.removeEventListener(OPEN_EVENT, show);
        };
    }, [open]);

    useEffect(() => {
        if (open) inputRef.current?.focus();
        else returnFocus.current?.focus?.();
    }, [open]);

    const run = (command: Command | undefined) => {
        if (!command) return;
        setOpen(false);
        // Let the palette close before the page starts moving.
        window.setTimeout(command.run, 180);
    };

    const onKeyDown = (event: ReactKeyboardEvent) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            setOpen(false);
        } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            setCursor((c) => (results.length ? (c + 1) % results.length : 0));
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setCursor((c) => (results.length ? (c - 1 + results.length) % results.length : 0));
        } else if (event.key === 'Enter') {
            event.preventDefault();
            run(results[cursor]);
        }
    };

    let lastGroup = '';

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[16vh]"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ background: 'oklch(0.08 0.003 275 / 0.6)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
                    onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}
                    data-lenis-prevent
                >
                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        aria-label="Command palette"
                        className="w-full max-w-[560px] overflow-hidden rounded-[18px]"
                        style={{
                            background: 'oklch(0.185 0.004 275)',
                            boxShadow: '0 0 0 1px var(--l-border-strong), 0 40px 120px -20px rgb(0 0 0 / 0.85)',
                        }}
                        initial={{ opacity: 0, y: -10, scale: 0.97, filter: 'blur(6px)' }}
                        animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                        exit={{ opacity: 0, y: -6, scale: 0.98, filter: 'blur(4px)' }}
                        transition={{ duration: 0.32, ease: EASE }}
                    >
                        <div className="flex items-center gap-3 px-5" style={{ boxShadow: 'inset 0 -1px 0 var(--l-border)' }}>
                            <Search size={17} className="shrink-0 text-[var(--l-text-3)]" />
                            <input
                                ref={inputRef}
                                value={query}
                                onChange={(e) => {
                                    setQuery(e.target.value);
                                    setCursor(0);
                                }}
                                onKeyDown={onKeyDown}
                                placeholder="Search or run a command"
                                className="h-[58px] flex-1 bg-transparent text-[16px] text-[var(--l-text-1)] outline-none placeholder:text-[var(--l-text-4)]"
                                role="combobox"
                                aria-expanded="true"
                                aria-controls={listId}
                                aria-activedescendant={results[cursor] ? `${listId}-${results[cursor].id}` : undefined}
                            />
                            <span className="fzl-kbd">esc</span>
                        </div>

                        <div id={listId} role="listbox" className="max-h-[360px] overflow-y-auto p-2">
                            {results.length === 0 && (
                                <div className="px-3 py-8 text-center text-[14px] text-[var(--l-text-3)]">No commands match “{query}”.</div>
                            )}
                            {results.map((command, i) => {
                                const Icon = command.icon;
                                const header = command.group !== lastGroup ? command.group : null;
                                lastGroup = command.group;
                                const selected = i === cursor;
                                return (
                                    <div key={command.id}>
                                        {header && <div className="px-3 pb-1.5 pt-2.5 text-[12px] font-[540] text-[var(--l-text-4)]">{header}</div>}
                                        <div
                                            id={`${listId}-${command.id}`}
                                            role="option"
                                            aria-selected={selected}
                                            onMouseMove={() => setCursor(i)}
                                            onClick={() => run(command)}
                                            className="flex cursor-pointer items-center gap-3 rounded-[10px] px-3 py-2.5 text-[14.5px] transition-colors duration-150"
                                            style={{
                                                background: selected ? 'oklch(1 0 0 / 0.07)' : 'transparent',
                                                color: selected ? 'var(--l-text-1)' : 'var(--l-text-2)',
                                            }}
                                        >
                                            <Icon size={16} />
                                            {command.label}
                                            {selected && <span className="fzl-kbd ml-auto">↵</span>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div
                            className="flex items-center gap-2 px-5 py-3 text-[12.5px] text-[var(--l-text-4)]"
                            style={{ boxShadow: 'inset 0 1px 0 var(--l-border)' }}
                        >
                            In the extension, <span className="fzl-kbd">{PALETTE_SHORTCUT_LABEL}</span> works on every site.
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
