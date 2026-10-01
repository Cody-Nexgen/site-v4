import { useEffect, useMemo, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import {
    CalendarPlus,
    Check,
    ChevronRight,
    FileText,
    Loader2,
    MoreHorizontal,
    Paperclip,
    Plus,
    Sparkles,
    Trash2,
    UploadCloud,
    X,
} from 'lucide-react';
import { streamAiCoachChat } from '../lib/aiCoachApi';
import { deleteAttachment, uploadAttachment, type AttachmentRecord } from '../lib/attachmentApi';
import { expandRecurringEvent } from '../lib/calendarRecurrence';
import {
    createBlankList,
    createListPreset,
    cloneReusableBlocks,
    LIST_PRESETS_KEY,
    newBlock,
    newListId,
    normalizeListPreset,
    SAVED_LISTS_KEY,
    type ListBlock,
    type ListPreset,
    type ListSchedule,
    type SavedList,
} from '../lib/listTypes';
import { CALENDAR_EVENTS_KEY, type CalendarEvent } from '../lib/schedulingTypes';
import { useAuthStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { Dialog } from '../components/fz/Dialog';
import { Button } from '../components/fz/Button';
import { IconButton } from '../components/fz/IconButton';
import { Input, Field } from '../components/fz/Field';
import { Menu, type MenuItem } from '../components/fz/Menu';
import { SegmentedControl } from '../components/fz/SegmentedControl';
import { ListEditor, type EditorTemplate } from './lists/ListEditor';
import { isEmptyList } from './lists/editorUtils';
import { PageIcon } from './lists/EmojiPicker';
import { parseMarkdownBlocks } from './lists/blockCatalog';

const TEMPLATES: EditorTemplate[] = [
    {
        id: 'todo',
        name: 'To-do list',
        description: 'A clean checklist for today.',
        accent: '#5ea2ff',
        make: () => [
            { ...newBlock('heading', 'Today'), level: 2 },
            {
                ...newBlock('checklist'),
                items: ['Most important task', 'Quick win', 'Follow up'].map((text) => ({ id: newListId('item'), text, done: false })),
            },
        ],
    },
    {
        id: 'grocery',
        name: 'Grocery list',
        description: 'Grouped essentials for a quick shop.',
        accent: '#51c878',
        make: () => [
            { ...newBlock('heading', 'Produce'), level: 3 },
            {
                ...newBlock('checklist'),
                items: ['Apples', 'Spinach', 'Avocados'].map((text) => ({ id: newListId('item'), text, done: false })),
            },
            { ...newBlock('heading', 'Pantry'), level: 3 },
            {
                ...newBlock('checklist'),
                items: ['Rice', 'Coffee'].map((text) => ({ id: newListId('item'), text, done: false })),
            },
        ],
    },
    {
        id: 'project',
        name: 'Project plan',
        description: 'Scope, milestones, and next actions.',
        accent: '#a98bff',
        make: () => [
            { ...newBlock('callout', 'What are we building, and why now?'), icon: '🎯' },
            { ...newBlock('heading', 'Milestones'), level: 2 },
            {
                ...newBlock('checklist'),
                items: ['Define scope', 'Build first pass', 'Review and ship'].map((text) => ({ id: newListId('item'), text, done: false })),
            },
            { ...newBlock('heading', 'Notes'), level: 2 },
            newBlock('bullets'),
        ],
    },
    {
        id: 'study',
        name: 'Study guide',
        description: 'Topics, key ideas, and practice questions.',
        accent: '#f0a65a',
        make: () => [
            newBlock('toc'),
            { ...newBlock('heading', 'Key ideas'), level: 2 },
            newBlock('bullets'),
            { ...newBlock('heading', 'Practice questions'), level: 2 },
            { ...newBlock('toggle', 'Question 1'), body: 'Answer…' },
            { ...newBlock('toggle', 'Question 2'), body: 'Answer…' },
        ],
    },
    {
        id: 'code',
        name: 'Code notes',
        description: 'Context, snippets, and implementation notes.',
        accent: '#9aa0a6',
        make: () => [
            { ...newBlock('heading', 'Implementation notes'), level: 2 },
            newBlock('text', 'Goal and constraints'),
            { ...newBlock('code'), language: 'typescript', content: '// Paste or write code here' },
            newBlock('quote', 'Keep the smallest useful surface area.'),
        ],
    },
];

const PRESET_COLORS = ['#5ea2ff', '#51c878', '#a98bff', '#f0a65a', '#f06b8b', '#9aa0a6'];

/** Titles we treat as "not named yet" — a template or AI result may replace them. */
const PLACEHOLDER_TITLES = new Set(['', 'untitled', 'my first list']);

const CARD =
    'rounded-[10px] border border-[var(--fz-border)] bg-[var(--fz-bg-raised)] shadow-[var(--fz-elev-card)]';

function normalizeStoredHeadings(list: SavedList): SavedList {
    return {
        ...list,
        blocks: list.blocks.map((block) =>
            block.type !== 'code' && /^#{1,6}\s*/.test(block.content)
                ? { ...block, type: 'heading', content: block.content.replace(/^#{1,6}\s*/, '') }
                : block,
        ),
    };
}

function listProgress(list: SavedList) {
    const items = list.blocks
        .filter((b) => b.type === 'checklist')
        .flatMap((block) => block.items ?? [])
        .filter((item) => item.text.trim() || item.done);
    return { done: items.filter((item) => item.done).length, total: items.length };
}

/** "…" button + menu. */
function MoreMenu({ label, items }: { label: string; items: MenuItem[] }) {
    const [open, setOpen] = useState(false);
    const anchorRef = useRef<HTMLButtonElement>(null);
    return (
        <>
            <IconButton ref={anchorRef} icon={<MoreHorizontal size={15} />} tooltip={label} onClick={() => setOpen((o) => !o)} />
            <Menu open={open} onClose={() => setOpen(false)} anchor={anchorRef} align="end" items={items} />
        </>
    );
}

export default function ListsTab() {
    const { subscriptionTier, upgradeToPro } = useAuthStore();
    const [lists, setLists] = useState<SavedList[]>([]);
    const [presets, setPresets] = useState<ListPreset[]>([]);
    const [activeId, setActiveId] = useState('');
    const [loaded, setLoaded] = useState(false);
    const [presetsLoaded, setPresetsLoaded] = useState(false);
    const [showPresetModal, setShowPresetModal] = useState(false);
    const [presetName, setPresetName] = useState('');
    const [presetDescription, setPresetDescription] = useState('');
    const [presetAccent, setPresetAccent] = useState(PRESET_COLORS[0]);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [notice, setNotice] = useState('');
    const [uploading, setUploading] = useState(false);
    const [draggingFiles, setDraggingFiles] = useState(false);
    const [scheduleOpen, setScheduleOpen] = useState(false);
    const [newMenuOpen, setNewMenuOpen] = useState(false);
    const [switcherOpen, setSwitcherOpen] = useState(false);
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    const newMenuAnchor = useRef<HTMLButtonElement>(null);
    const switcherAnchor = useRef<HTMLButtonElement>(null);
    const dragDepth = useRef(0);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const active = lists.find((list) => list.id === activeId) ?? lists[0];
    const isPro = subscriptionTier === 'pro';

    useEffect(() => {
        chrome.storage.local.get([SAVED_LISTS_KEY], (result) => {
            const stored = result[SAVED_LISTS_KEY];
            const next = Array.isArray(stored) && stored.length
                ? (stored as SavedList[]).map(normalizeStoredHeadings)
                : [createBlankList('My first list')];
            setLists(next);
            setActiveId(next.find((l) => !l.parentId)?.id ?? next[0].id);
            setLoaded(true);
        });
    }, []);

    useEffect(() => {
        chrome.storage.local.get([LIST_PRESETS_KEY], (result) => {
            const stored = result[LIST_PRESETS_KEY];
            setPresets(Array.isArray(stored)
                ? stored.map(normalizeListPreset).filter((preset): preset is ListPreset => preset !== null)
                : []);
            setPresetsLoaded(true);
        });
    }, []);

    // Every list lives under one key, so writing it on each keystroke re-sends the whole
    // workspace (and chrome.storage broadcasts it to every tab). Batch writes instead.
    const pendingLists = useRef<SavedList[] | null>(null);
    useEffect(() => {
        if (!loaded) return;
        pendingLists.current = lists;
        const t = window.setTimeout(() => {
            pendingLists.current = null;
            void chrome.storage.local.set({ [SAVED_LISTS_KEY]: lists });
        }, 300);
        return () => window.clearTimeout(t);
    }, [lists, loaded]);
    useEffect(() => {
        const flush = () => {
            if (!pendingLists.current) return;
            void chrome.storage.local.set({ [SAVED_LISTS_KEY]: pendingLists.current });
            pendingLists.current = null;
        };
        const onHide = () => document.visibilityState === 'hidden' && flush();
        window.addEventListener('pagehide', flush);
        document.addEventListener('visibilitychange', onHide);
        return () => {
            window.removeEventListener('pagehide', flush);
            document.removeEventListener('visibilitychange', onHide);
            flush(); // leaving the Lists tab
        };
    }, []);

    useEffect(() => {
        if (!presetsLoaded) return;
        chrome.storage.local.set({ [LIST_PRESETS_KEY]: presets });
    }, [presets, presetsLoaded]);

    const updateActive = (updater: (list: SavedList) => SavedList) => {
        if (!active) return;
        const id = active.id;
        setLists((current) =>
            current.map((list) => (list.id === id ? { ...updater(list), updatedAt: new Date().toISOString() } : list)),
        );
    };

    /* ── tree ─────────────────────────────────────────────────────── */

    const byId = useMemo(() => new Map(lists.map((l) => [l.id, l])), [lists]);
    const childrenOf = (id: string | null) =>
        lists.filter((l) => (id === null ? !l.parentId || !byId.has(l.parentId) : l.parentId === id));
    const ancestors = (list?: SavedList): SavedList[] => {
        const chain: SavedList[] = [];
        let cur = list?.parentId ? byId.get(list.parentId) : undefined;
        while (cur && chain.length < 10) {
            chain.unshift(cur);
            cur = cur.parentId ? byId.get(cur.parentId) : undefined;
        }
        return chain;
    };
    const activeAncestors = ancestors(active);
    const isExpanded = (id: string) => expanded[id] ?? activeAncestors.some((a) => a.id === id);
    const descendantsOf = (id: string): string[] => {
        const kids = lists.filter((l) => l.parentId === id).map((l) => l.id);
        return [...kids, ...kids.flatMap(descendantsOf)];
    };

    const selectList = (id: string) => {
        setActiveId(id);
        setScheduleOpen(false);
        setNotice('');
    };

    const createList = (title = 'Untitled', blocks?: ListBlock[], parentId?: string) => {
        const next = createBlankList(title);
        if (blocks) next.blocks = blocks;
        if (parentId) next.parentId = parentId;
        setLists((current) => {
            if (!parentId) return [next, ...current];
            const i = current.findIndex((l) => l.id === parentId);
            return [...current.slice(0, i + 1), next, ...current.slice(i + 1)];
        });
        if (parentId) setExpanded((e) => ({ ...e, [parentId]: true }));
        return next.id;
    };

    /** Fill the open page if it's still empty, otherwise start a new one. */
    const applyTemplate = (name: string, blocks: ListBlock[]) => {
        if (active && isEmptyList(active)) {
            updateActive((list) => ({
                ...list,
                title: PLACEHOLDER_TITLES.has(list.title.trim().toLowerCase()) ? name : list.title,
                blocks,
            }));
        } else {
            selectList(createList(name, blocks));
        }
    };

    const deleteActive = () => {
        if (!active) return;
        const doomed = new Set([active.id, ...descendantsOf(active.id)]);
        lists
            .filter((l) => doomed.has(l.id))
            .forEach((l) => {
                l.blocks.forEach((block) => {
                    if (block.attachment) void deleteAttachment(supabase, block.attachment);
                });
                void syncCalendar({ ...l, schedule: undefined });
            });
        const remaining = lists.filter((l) => !doomed.has(l.id));
        if (!remaining.length) {
            const next = createBlankList();
            setLists([next]);
            selectList(next.id);
            return;
        }
        setLists(remaining);
        selectList(active.parentId && !doomed.has(active.parentId) ? active.parentId : remaining.find((l) => !l.parentId)?.id ?? remaining[0].id);
    };

    const openPresetModal = () => {
        if (!active) return;
        setPresetName(active.title || 'New template');
        setPresetDescription('');
        setPresetAccent(PRESET_COLORS[0]);
        setShowPresetModal(true);
    };

    const savePreset = () => {
        if (!active || !presetName.trim()) return;
        setPresets((current) => [
            ...current,
            createListPreset({
                title: presetName,
                description: presetDescription.trim() || `Reusable blocks from ${active.title || 'Untitled'}.`,
                accent: presetAccent,
                blocks: active.blocks,
            }),
        ]);
        setShowPresetModal(false);
    };

    /* ── files ────────────────────────────────────────────────────── */

    const uploadOne = async (file: File): Promise<AttachmentRecord | null> => {
        if (!active) return null;
        if (!isPro) {
            setNotice('Uploading files is a Pro feature.');
            return null;
        }
        const result = await uploadAttachment(supabase, file, { context: 'list', listId: active.id });
        if (!result.ok) {
            setNotice(result.error);
            return null;
        }
        return result.attachment;
    };

    const addAttachments = async (files: File[]) => {
        if (!active || !files.length || uploading) return;
        if (!isPro) {
            setNotice('Uploading files is a Pro feature.');
            return;
        }
        setUploading(true);
        setNotice('');
        for (const file of files) {
            const record = await uploadOne(file);
            if (!record) continue;
            const type = record.mimeType.startsWith('image/')
                ? 'image'
                : record.mimeType.startsWith('video/')
                  ? 'video'
                  : record.mimeType.startsWith('audio/')
                    ? 'audio'
                    : 'attachment';
            updateActive((list) => ({
                ...list,
                blocks: [...list.blocks, { id: newListId('block'), type, content: record.fileName, attachment: record }],
            }));
        }
        setUploading(false);
    };

    const onDragEnter = (event: React.DragEvent) => {
        if (!event.dataTransfer.types.includes('Files')) return;
        event.preventDefault();
        dragDepth.current += 1;
        setDraggingFiles(true);
    };
    const onDragLeave = (event: React.DragEvent) => {
        if (!event.dataTransfer.types.includes('Files')) return;
        event.preventDefault();
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setDraggingFiles(false);
    };
    const onDrop = (event: React.DragEvent) => {
        if (!event.dataTransfer.types.includes('Files')) return;
        event.preventDefault();
        dragDepth.current = 0;
        setDraggingFiles(false);
        void addAttachments(Array.from(event.dataTransfer.files));
    };

    /* ── calendar ─────────────────────────────────────────────────── */

    const syncCalendar = async (list: SavedList) => {
        const result = await chrome.storage.local.get([CALENDAR_EVENTS_KEY]);
        const existing = Array.isArray(result[CALENDAR_EVENTS_KEY])
            ? (result[CALENDAR_EVENTS_KEY] as CalendarEvent[])
            : [];
        const withoutList = existing.filter((event) => event.sourceListId !== list.id);
        if (!list.schedule?.enabled) {
            await chrome.storage.local.set({ [CALENDAR_EVENTS_KEY]: withoutList });
            return;
        }
        const date = parseISO(`${list.schedule.date}T12:00:00`);
        const seed: CalendarEvent = {
            id: `list_event_${list.id}`,
            title: list.title || 'Untitled list',
            date: date.toDateString(),
            allDay: false,
            startHour: Math.floor(list.schedule.startMin / 60),
            startMin: list.schedule.startMin % 60,
            durationMin: list.schedule.durationMin,
            color: '#5ea2ff',
            sourceListId: list.id,
            repeat: list.schedule.repeat,
            recurrenceWeekdays:
                list.schedule.repeat === 'weekly'
                    ? list.schedule.recurrenceWeekdays?.length
                        ? list.schedule.recurrenceWeekdays
                        : [date.getDay()]
                    : undefined,
            seriesId: list.schedule.repeat === 'none' ? undefined : `list_series_${list.id}`,
            description: 'Open Lists in FocuzNow to view this plan.',
        };
        await chrome.storage.local.set({
            [CALENDAR_EVENTS_KEY]: [...withoutList, ...expandRecurringEvent(seed)],
        });
    };

    // Keep the calendar event's title in step with the page title.
    const scheduledTitleKey = active?.schedule?.enabled ? `${active.id}:${active.title}` : '';
    useEffect(() => {
        if (!scheduledTitleKey || !active) return;
        const t = window.setTimeout(() => void syncCalendar(active), 700);
        return () => window.clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scheduledTitleKey]);

    /* ── AI ───────────────────────────────────────────────────────── */

    const runAi = (prompt: string) =>
        new Promise<ListBlock[] | null>((resolve) => {
            if (!active) return resolve(null);
            let output = '';
            void streamAiCoachChat({
                model: 'gemini-2.5-flash',
                sessionId: null,
                messages: [{
                    role: 'user',
                    content: `Write content for a notes page. Request: ${prompt}.
${active.blocks
    .filter((block) => block.attachment?.extractedText)
    .map((block) => `Attached file "${block.attachment!.fileName}":\n${block.attachment!.extractedText}`)
    .join('\n\n')}
Return only markdown: ## and ### headings, "- [ ]" for tasks, "-" for bullets, "1." for steps, "> " for a quote, --- for a divider, short paragraphs, and fenced code only when relevant. No commentary.`,
                }],
                coachContext: { surface: 'lists', current_title: active.title },
                callbacks: {
                    onToken: (_chunk, visible) => {
                        output = visible;
                    },
                    onDone: (payload) => {
                        output = payload.content || output;
                        if (PLACEHOLDER_TITLES.has(active.title.trim().toLowerCase())) {
                            updateActive((list) => ({ ...list, title: prompt.charAt(0).toUpperCase() + prompt.slice(1, 60) }));
                        }
                        resolve(parseMarkdownBlocks(output));
                    },
                    onError: (message) => {
                        setNotice(message);
                        resolve(null);
                    },
                },
            });
        });

    const addAiBlock = () => {
        if (!active) return;
        const block = newBlock('ai');
        updateActive((list) => ({
            ...list,
            blocks: isEmptyList(list) ? [block] : [...list.blocks, block],
        }));
    };

    const progress = useMemo(() => (active ? listProgress(active) : { done: 0, total: 0 }), [active]);

    if (!active) return null;

    const schedule = active.schedule;
    const scheduleLabel = schedule?.enabled
        ? `${format(parseISO(`${schedule.date}T12:00:00`), 'EEE, MMM d')} · ${format(
              new Date(2000, 0, 1, Math.floor(schedule.startMin / 60), schedule.startMin % 60),
              'h:mm a',
          )}${schedule.repeat === 'daily' ? ' · daily' : schedule.repeat === 'weekly' ? ' · weekly' : ''}`
        : '';

    const newMenuItems: MenuItem[] = [
        { id: 'blank', label: 'Empty page', icon: <FileText size={13} />, onSelect: () => selectList(createList()) },
        {
            id: 'ai',
            label: 'Write with AI',
            icon: <Sparkles size={13} />,
            onSelect: () => selectList(createList('Untitled', [newBlock('ai')])),
        },
        { type: 'separator', id: 'sep' },
        { type: 'label', id: 'tpl', label: 'Templates' },
        ...TEMPLATES.map((t) => ({
            id: t.id,
            label: t.name,
            icon: <span className="size-2 rounded-full" style={{ backgroundColor: t.accent }} />,
            onSelect: () => selectList(createList(t.name, t.make())),
        })),
        ...presets.map((p) => ({
            id: p.id,
            label: p.title,
            icon: <span className="size-2 rounded-full" style={{ backgroundColor: p.accent }} />,
            submenu: [
                { id: `${p.id}-use`, label: 'New page from this', icon: <Plus size={13} />, onSelect: () => selectList(createList(p.title, cloneReusableBlocks(p.blocks))) },
                { id: `${p.id}-del`, label: 'Delete template', icon: <Trash2 size={13} />, danger: true, onSelect: () => setPresets((cur) => cur.filter((x) => x.id !== p.id)) },
            ],
        })),
    ];

    const editorTemplates: EditorTemplate[] = [
        ...TEMPLATES,
        ...presets.map((p) => ({
            id: p.id,
            name: p.title,
            description: p.description,
            accent: p.accent,
            make: () => cloneReusableBlocks(p.blocks),
        })),
    ];

    const renderTree = (parent: string | null, depth: number): React.ReactNode =>
        childrenOf(parent).map((list) => {
            const kids = childrenOf(list.id);
            const open = isExpanded(list.id);
            const selected = list.id === active.id;
            const p = listProgress(list);
            return (
                <div key={list.id}>
                    <div
                        className={`group/row flex h-8 items-center rounded-md pr-1.5 transition-colors ${
                            selected ? 'bg-[var(--fz-bg-selected)]' : 'hover:bg-[var(--fz-bg-hover)]'
                        }`}
                        style={{ paddingLeft: 4 + depth * 14 }}
                    >
                        <button
                            type="button"
                            onClick={() => setExpanded((e) => ({ ...e, [list.id]: !open }))}
                            className={`flex size-5 shrink-0 items-center justify-center rounded text-[var(--fz-text-4)] hover:bg-[var(--fz-bg-active)] hover:text-[var(--fz-text-2)] ${
                                kids.length ? '' : 'invisible'
                            }`}
                            aria-label={open ? 'Collapse' : 'Expand'}
                        >
                            <ChevronRight size={12} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
                        </button>
                        <button
                            type="button"
                            onClick={() => selectList(list.id)}
                            className="flex h-full min-w-0 flex-1 items-center gap-2 pl-0.5 text-left"
                        >
                            <span className="flex size-5 shrink-0 items-center justify-center">
                                {list.icon ? (
                                    <PageIcon icon={list.icon} size={16} />
                                ) : (
                                    <FileText size={14} className="text-[var(--fz-text-3)]" />
                                )}
                            </span>
                            <span
                                className={`truncate text-[13px] ${
                                    selected ? 'font-medium text-[var(--fz-text-1)]' : 'text-[var(--fz-text-2)]'
                                }`}
                            >
                                {list.title || 'Untitled'}
                            </span>
                        </button>
                        {p.total > 0 && (
                            <span className="ml-1 shrink-0 text-[11px] tabular-nums text-[var(--fz-text-4)] group-hover/row:hidden">
                                {p.done}/{p.total}
                            </span>
                        )}
                        <button
                            type="button"
                            onClick={() => selectList(createList('Untitled', undefined, list.id))}
                            className="ml-1 hidden size-5 shrink-0 items-center justify-center rounded text-[var(--fz-text-4)] hover:bg-[var(--fz-bg-active)] hover:text-[var(--fz-text-2)] group-hover/row:flex"
                            aria-label="Add a page inside"
                            title="Add a page inside"
                        >
                            <Plus size={13} />
                        </button>
                    </div>
                    {open && kids.length > 0 && renderTree(list.id, depth + 1)}
                </div>
            );
        });

    const nested = descendantsOf(active.id).length;

    return (
        <div
            className="lists-workspace flex h-full w-full gap-4 px-6 pb-6 pt-5"
            onDragEnter={onDragEnter}
            onDragOver={(event) => {
                if (event.dataTransfer.types.includes('Files')) event.preventDefault();
            }}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
        >
            <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(event) => {
                    void addAttachments(Array.from(event.target.files ?? []));
                    event.target.value = '';
                }}
            />

            {/* Pages */}
            <aside className={`${CARD} hidden w-[260px] shrink-0 flex-col overflow-hidden md:flex`}>
                <div className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--fz-border)] pl-4 pr-2.5">
                    <span className="text-[13px] font-semibold text-[var(--fz-text-1)]">
                        Lists <span className="ml-1 font-normal tabular-nums text-[var(--fz-text-4)]">{lists.length}</span>
                    </span>
                    <IconButton ref={newMenuAnchor} icon={<Plus size={15} />} tooltip="New page" onClick={() => setNewMenuOpen((v) => !v)} />
                    <Menu open={newMenuOpen} onClose={() => setNewMenuOpen(false)} anchor={newMenuAnchor} align="end" items={newMenuItems} />
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-1.5 scrollbar-hide">{renderTree(null, 0)}</div>
            </aside>

            {/* Page */}
            <section className={`${CARD} relative flex min-w-0 flex-1 flex-col overflow-hidden`}>
                <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-[var(--fz-border)] pl-3 pr-2.5">
                    <div className="flex min-w-0 items-center gap-1">
                        <button
                            ref={switcherAnchor}
                            type="button"
                            onClick={() => setSwitcherOpen((v) => !v)}
                            className="flex h-7 items-center gap-1.5 rounded-md px-2 text-[13px] font-medium text-[var(--fz-text-2)] hover:bg-[var(--fz-bg-hover)] md:hidden"
                        >
                            <FileText size={13} />
                            Lists
                        </button>
                        <Menu
                            open={switcherOpen}
                            onClose={() => setSwitcherOpen(false)}
                            anchor={switcherAnchor}
                            items={[
                                ...lists.map((list) => ({
                                    id: list.id,
                                    label: list.title || 'Untitled',
                                    checked: list.id === active.id,
                                    onSelect: () => selectList(list.id),
                                })),
                                { type: 'separator' as const, id: 'sep' },
                                { id: 'new', label: 'New page', icon: <Plus size={13} />, onSelect: () => selectList(createList()) },
                            ]}
                        />
                        {/* Breadcrumbs */}
                        {[...activeAncestors, active].map((crumb, i, arr) => (
                            <div key={crumb.id} className="flex min-w-0 items-center">
                                {i > 0 && <span className="px-0.5 text-[13px] text-[var(--fz-text-4)]">/</span>}
                                <button
                                    type="button"
                                    onClick={() => selectList(crumb.id)}
                                    className={`flex h-7 min-w-0 items-center gap-1.5 rounded-md px-1.5 text-[13px] transition-colors hover:bg-[var(--fz-bg-hover)] ${
                                        i === arr.length - 1 ? 'text-[var(--fz-text-1)]' : 'text-[var(--fz-text-3)]'
                                    }`}
                                >
                                    {crumb.icon && <PageIcon icon={crumb.icon} size={14} />}
                                    <span className="max-w-[180px] truncate">{crumb.title || 'Untitled'}</span>
                                </button>
                            </div>
                        ))}
                        {progress.total > 0 && (
                            <span className="text-meta ml-2 hidden shrink-0 lg:inline">
                                {progress.done} of {progress.total} done
                            </span>
                        )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            iconLeft={<CalendarPlus size={13} />}
                            onClick={() => {
                                if (!schedule?.enabled) {
                                    const next: ListSchedule = {
                                        enabled: true,
                                        date: schedule?.date ?? format(new Date(), 'yyyy-MM-dd'),
                                        startMin: schedule?.startMin ?? 9 * 60,
                                        durationMin: schedule?.durationMin ?? 30,
                                        repeat: schedule?.repeat ?? 'none',
                                        recurrenceWeekdays: schedule?.recurrenceWeekdays,
                                    };
                                    updateActive((list) => ({ ...list, schedule: next }));
                                    void syncCalendar({ ...active, schedule: next });
                                    setScheduleOpen(true);
                                } else {
                                    setScheduleOpen((v) => !v);
                                }
                            }}
                            className={schedule?.enabled ? 'text-[var(--fz-text-1)]' : undefined}
                        >
                            <span className="hidden sm:inline">{schedule?.enabled ? scheduleLabel : 'Add to calendar'}</span>
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            disabled={uploading}
                            iconLeft={uploading ? <Loader2 size={13} className="animate-spin" /> : <Paperclip size={13} />}
                            onClick={() => {
                                if (isPro) fileInputRef.current?.click();
                                else setNotice('Uploading files is a Pro feature.');
                            }}
                        >
                            <span className="hidden sm:inline">{uploading ? 'Uploading…' : 'Attach'}</span>
                            {!isPro && (
                                <span className="rounded border border-[var(--fz-border)] px-1 text-[10px] leading-4 text-[var(--fz-text-3)]">
                                    Pro
                                </span>
                            )}
                        </Button>
                        <MoreMenu
                            label="Page options"
                            items={[
                                { id: 'ai', label: 'Write with AI', icon: <Sparkles size={13} />, onSelect: addAiBlock },
                                { id: 'sub', label: 'Add a page inside', icon: <Plus size={13} />, onSelect: () => selectList(createList('Untitled', undefined, active.id)) },
                                { id: 'preset', label: 'Save as template', icon: <FileText size={13} />, onSelect: openPresetModal },
                                { type: 'separator', id: 'sep' },
                                { id: 'delete', label: 'Delete page', icon: <Trash2 size={13} />, danger: true, onSelect: () => setConfirmDelete(true) },
                            ]}
                        />
                    </div>
                </header>
                {progress.total > 0 && (
                    <div className="h-0.5 shrink-0 bg-[var(--fz-bg-active)]">
                        <div
                            className="h-full bg-[var(--fz-text-1)] transition-[width] duration-500 ease-out"
                            style={{ width: `${(progress.done / progress.total) * 100}%` }}
                        />
                    </div>
                )}

                <div className="cal-scroll min-h-0 flex-1 overflow-y-auto">
                    <ListEditor
                        key={active.id}
                        list={active}
                        lists={lists}
                        onChange={updateActive}
                        onOpenList={selectList}
                        onCreateSubpage={() => createList('Untitled', undefined, active.id)}
                        isPro={isPro}
                        onUpload={uploadOne}
                        onError={setNotice}
                        onAi={runAi}
                        templates={editorTemplates}
                        onApplyTemplate={applyTemplate}
                    >
                        {schedule?.enabled && scheduleOpen && (
                            <SchedulePanel
                                list={active}
                                onChange={updateActive}
                                onSync={syncCalendar}
                                onClose={() => setScheduleOpen(false)}
                            />
                        )}
                    </ListEditor>
                </div>

                {notice && (
                    <div className="absolute bottom-4 left-1/2 z-20 flex max-w-[520px] -translate-x-1/2 items-center gap-3 rounded-lg border border-[var(--fz-border)] bg-[var(--fz-bg-overlay)] py-2 pl-3.5 pr-2 text-[13px] text-[var(--fz-text-2)] shadow-[var(--fz-shadow-overlay)]">
                        <span className="min-w-0 flex-1">{notice}</span>
                        {!isPro && /Pro/.test(notice) && (
                            <Button variant="primary" size="sm" onClick={() => void upgradeToPro()}>
                                Upgrade
                            </Button>
                        )}
                        <IconButton icon={<X size={13} />} tooltip="Dismiss" onClick={() => setNotice('')} />
                    </div>
                )}

                {draggingFiles && (
                    <div className="pointer-events-none absolute inset-3 z-20 flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[var(--fz-border-strong)] bg-[var(--fz-bg-raised)]/90 text-center">
                        <UploadCloud size={22} className="text-[var(--fz-text-2)]" />
                        <p className="text-[14px] font-medium text-[var(--fz-text-1)]">
                            {isPro ? 'Drop to add to this page' : 'Uploading files is a Pro feature'}
                        </p>
                        <p className="text-meta">Images, videos and audio play inline · up to 10MB each</p>
                    </div>
                )}
            </section>

            <Dialog
                open={showPresetModal}
                onClose={() => setShowPresetModal(false)}
                title="Save as template"
                description={`Reuse the blocks from “${active.title || 'Untitled'}” in new pages.`}
                size="sm"
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setShowPresetModal(false)}>Cancel</Button>
                        <Button variant="primary" disabled={!presetName.trim()} onClick={savePreset}>Save template</Button>
                    </>
                }
            >
                <div className="space-y-4">
                    <Field label="Name">
                        <Input
                            value={presetName}
                            onChange={(event) => setPresetName(event.target.value)}
                            placeholder="Weekly review"
                            autoFocus
                            data-autofocus
                        />
                    </Field>
                    <Field label="Description" helper="Optional">
                        <Input
                            value={presetDescription}
                            onChange={(event) => setPresetDescription(event.target.value)}
                            placeholder="A quick structure for every Friday."
                        />
                    </Field>
                    <Field label="Color">
                        <div className="flex items-center gap-2">
                            {PRESET_COLORS.map((color) => (
                                <button
                                    key={color}
                                    type="button"
                                    onClick={() => setPresetAccent(color)}
                                    aria-label={`Color ${color}`}
                                    aria-pressed={presetAccent === color}
                                    className={`size-6 rounded-full transition-transform hover:scale-110 ${
                                        presetAccent === color ? 'ring-2 ring-[var(--fz-text-1)] ring-offset-2 ring-offset-[var(--fz-bg-overlay)]' : ''
                                    }`}
                                    style={{ backgroundColor: color }}
                                />
                            ))}
                        </div>
                    </Field>
                    <p className="text-meta rounded-lg bg-[var(--fz-bg-hover)] px-3 py-2">
                        Uploaded files and links to other pages aren’t copied into templates.
                    </p>
                </div>
            </Dialog>

            <Dialog
                open={confirmDelete}
                onClose={() => setConfirmDelete(false)}
                title={`Delete “${active.title || 'Untitled'}”?`}
                size="sm"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                        <Button
                            variant="danger-solid"
                            onClick={() => {
                                setConfirmDelete(false);
                                deleteActive();
                            }}
                        >
                            Delete page
                        </Button>
                    </>
                }
            >
                <p className="text-body-sm text-[var(--fz-text-3)]">
                    {nested ? `This also deletes ${nested} page${nested === 1 ? '' : 's'} inside it. ` : ''}
                    Its files and calendar event will be removed too. This can’t be undone.
                </p>
            </Dialog>
        </div>
    );
}

/** "On your calendar" settings, shown under the title like a property row. */
function SchedulePanel({
    list,
    onChange,
    onSync,
    onClose,
}: {
    list: SavedList;
    onChange: (updater: (list: SavedList) => SavedList) => void;
    onSync: (list: SavedList) => Promise<void>;
    onClose: () => void;
}) {
    const schedule = list.schedule ?? {
        enabled: true,
        date: format(new Date(), 'yyyy-MM-dd'),
        startMin: 9 * 60,
        durationMin: 30,
        repeat: 'none' as const,
    };
    const patch = (changes: Partial<ListSchedule>) => {
        const next = { ...schedule, ...changes };
        onChange((current) => ({ ...current, schedule: next }));
        window.setTimeout(() => void onSync({ ...list, schedule: next }), 0);
    };
    const weekdays = schedule.recurrenceWeekdays ?? [parseISO(`${schedule.date}T12:00:00`).getDay()];
    const control =
        'h-8 rounded-lg border border-[var(--fz-border)] bg-[var(--fz-bg-panel)] px-2.5 text-[13px] text-[var(--fz-text-1)] outline-none transition-colors hover:border-[var(--fz-border-strong)] focus:border-[var(--fz-border-strong)]';

    return (
        <div className="mt-4 rounded-lg border border-[var(--fz-border)] p-3">
            <div className="mb-2.5 flex items-center justify-between gap-3">
                <p className="flex items-center gap-2 text-[13px] font-medium text-[var(--fz-text-1)]">
                    <CalendarPlus size={14} className="text-[var(--fz-text-3)]" />
                    On your calendar
                </p>
                <div className="-my-1 -mr-1 flex items-center">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            patch({ enabled: false });
                            onClose();
                        }}
                    >
                        Remove
                    </Button>
                    <IconButton icon={<Check size={14} />} tooltip="Done" onClick={onClose} />
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <input
                    type="date"
                    value={schedule.date}
                    onChange={(event) => event.target.value && patch({ date: event.target.value })}
                    className={control}
                    aria-label="Date"
                />
                <input
                    type="time"
                    value={`${String(Math.floor(schedule.startMin / 60)).padStart(2, '0')}:${String(schedule.startMin % 60).padStart(2, '0')}`}
                    onChange={(event) => {
                        const [hour, minute] = event.target.value.split(':').map(Number);
                        if (Number.isFinite(hour)) patch({ startMin: hour * 60 + (minute || 0) });
                    }}
                    className={control}
                    aria-label="Start time"
                />
                <select
                    value={schedule.durationMin}
                    onChange={(event) => patch({ durationMin: Number(event.target.value) })}
                    className={control}
                    aria-label="Duration"
                >
                    {[15, 30, 45, 60, 90, 120].map((minutes) => (
                        <option key={minutes} value={minutes}>{minutes} min</option>
                    ))}
                </select>
                <SegmentedControl
                    size="sm"
                    idPrefix={`list-repeat-${list.id}`}
                    value={schedule.repeat}
                    onChange={(repeat) => patch({ repeat })}
                    options={[
                        { value: 'none', label: 'Once' },
                        { value: 'daily', label: 'Daily' },
                        { value: 'weekly', label: 'Weekly' },
                    ]}
                />
            </div>
            {schedule.repeat === 'weekly' && (
                <div className="mt-2.5 flex items-center gap-1.5">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, day) => {
                        const selected = weekdays.includes(day);
                        return (
                            <button
                                key={`${label}-${day}`}
                                type="button"
                                aria-pressed={selected}
                                onClick={() => {
                                    const next = selected
                                        ? weekdays.filter((value) => value !== day)
                                        : [...weekdays, day].sort((a, b) => a - b);
                                    if (next.length) patch({ recurrenceWeekdays: next });
                                }}
                                className={`flex size-7 items-center justify-center rounded-lg text-[12px] font-medium transition-colors ${
                                    selected
                                        ? 'bg-[var(--fz-accent)] text-[var(--fz-accent-fg)]'
                                        : 'border border-[var(--fz-border)] text-[var(--fz-text-3)] hover:bg-[var(--fz-bg-hover)]'
                                }`}
                            >
                                {label}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
