import { useEffect, useMemo, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import { Highlight, themes, type Language } from 'prism-react-renderer';
import {
    CalendarPlus,
    Check,
    CheckSquare,
    Code2,
    Download,
    FileText,
    Film,
    GripVertical,
    Heading2,
    Image,
    Link as LinkIcon,
    Loader2,
    Music,
    Paperclip,
    Plus,
    Quote,
    Sparkles,
    Trash2,
    Type,
    UploadCloud,
    X,
} from 'lucide-react';
import { streamAiCoachChat } from '../lib/aiCoachApi';
import {
    deleteAttachment,
    downloadAttachment,
    uploadAttachment,
    type AttachmentRecord,
} from '../lib/attachmentApi';
import { expandRecurringEvent } from '../lib/calendarRecurrence';
import { fetchLinkPreview, type LinkPreview } from '../lib/linkPreviewApi';
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
    type ListBlockType,
    type ListPreset,
    type SavedList,
} from '../lib/listTypes';
import { CALENDAR_EVENTS_KEY, type CalendarEvent } from '../lib/schedulingTypes';
import { useAuthStore } from '../lib/store';
import { supabase } from '../lib/supabase';

type Template = {
    id: string;
    name: string;
    description: string;
    accent: string;
    blocks: () => ListBlock[];
};

const TEMPLATES: Template[] = [
    {
        id: 'todo',
        name: 'To-do list',
        description: 'A clean checklist for today.',
        accent: '#5ea2ff',
        blocks: () => [
            newBlock('heading', 'Today'),
            {
                ...newBlock('checklist'),
                items: ['Most important task', 'Quick win', 'Follow up'].map((text) => ({
                    id: newListId('item'),
                    text,
                    done: false,
                })),
            },
        ],
    },
    {
        id: 'grocery',
        name: 'Grocery list',
        description: 'Grouped essentials for a quick shop.',
        accent: '#51c878',
        blocks: () => [
            newBlock('heading', 'Groceries'),
            newBlock('text', 'Produce'),
            {
                ...newBlock('checklist'),
                items: ['Apples', 'Spinach', 'Avocados'].map((text) => ({
                    id: newListId('item'),
                    text,
                    done: false,
                })),
            },
            newBlock('text', 'Pantry'),
            {
                ...newBlock('checklist'),
                items: ['Rice', 'Coffee'].map((text) => ({
                    id: newListId('item'),
                    text,
                    done: false,
                })),
            },
        ],
    },
    {
        id: 'project',
        name: 'Project plan',
        description: 'Scope, milestones, and next actions.',
        accent: '#a98bff',
        blocks: () => [
            newBlock('heading', 'Project brief'),
            newBlock('text', 'What are we building, and why now?'),
            newBlock('heading', 'Milestones'),
            {
                ...newBlock('checklist'),
                items: ['Define scope', 'Build first pass', 'Review and ship'].map((text) => ({
                    id: newListId('item'),
                    text,
                    done: false,
                })),
            },
        ],
    },
    {
        id: 'code',
        name: 'Code notes',
        description: 'Context, snippets, and implementation notes.',
        accent: '#f0a65a',
        blocks: () => [
            newBlock('heading', 'Implementation notes'),
            newBlock('text', 'Goal and constraints'),
            { ...newBlock('code'), language: 'typescript', content: '// Paste or write code here' },
            newBlock('quote', 'Keep the smallest useful surface area.'),
        ],
    },
];

const BLOCK_OPTIONS: { type: ListBlockType; label: string; icon: typeof Type }[] = [
    { type: 'text', label: 'Text', icon: Type },
    { type: 'heading', label: 'Heading', icon: Heading2 },
    { type: 'checklist', label: 'Checklist', icon: CheckSquare },
    { type: 'code', label: 'Code', icon: Code2 },
    { type: 'quote', label: 'Quote', icon: Quote },
    { type: 'link', label: 'Link', icon: LinkIcon },
];

function parseGeneratedContent(content: string): ListBlock[] {
    const blocks: ListBlock[] = [];
    const lines = content.replace(/```(\w+)?\n([\s\S]*?)```/g, (_match, language, code) => {
        blocks.push({ ...newBlock('code'), language: language || 'text', content: code.trim() });
        return '';
    }).split('\n');
    let checklist: ListBlock | null = null;
    for (const raw of lines) {
        const line = raw.trim();
        if (!line) {
            checklist = null;
            continue;
        }
        if (/^#{1,6}\s*/.test(line)) {
            blocks.push(newBlock('heading', line.replace(/^#{1,6}\s*/, '')));
            checklist = null;
        } else if (/^[-*]\s+(?:\[[ x]\]\s*)?/i.test(line) || /^\d+\.\s/.test(line)) {
            if (!checklist) {
                checklist = { ...newBlock('checklist'), items: [] };
                blocks.push(checklist);
            }
            checklist.items?.push({
                id: newListId('item'),
                text: line.replace(/^[-*]\s+(?:\[[ x]\]\s*)?/i, '').replace(/^\d+\.\s*/, ''),
                done: /\[[x]\]/i.test(line),
            });
        } else {
            blocks.push(newBlock('text', line));
            checklist = null;
        }
    }
    return blocks.length ? blocks : [newBlock('text', content.trim())];
}

function normalizeStoredHeadings(list: SavedList): SavedList {
    return {
        ...list,
        blocks: list.blocks.map((block) =>
            block.type !== 'code' && /^#{1,6}\s*/.test(block.content)
                ? {
                      ...block,
                      type: 'heading',
                      content: block.content.replace(/^#{1,6}\s*/, ''),
                  }
                : block,
        ),
    };
}

function useIsLightDashboard() {
    const read = () => document.documentElement.dataset.dashboardTheme === 'light';
    const [isLight, setIsLight] = useState(read);
    useEffect(() => {
        const observer = new MutationObserver(() => setIsLight(read()));
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-dashboard-theme'],
        });
        return () => observer.disconnect();
    }, []);
    return isLight;
}

export default function ListsTab() {
    const { subscriptionTier, upgradeToPro } = useAuthStore();
    const [lists, setLists] = useState<SavedList[]>([]);
    const [presets, setPresets] = useState<ListPreset[]>([]);
    const [activeId, setActiveId] = useState('');
    const [loaded, setLoaded] = useState(false);
    const [presetsLoaded, setPresetsLoaded] = useState(false);
    const [showPresetModal, setShowPresetModal] = useState(false);
    const [managingPresets, setManagingPresets] = useState(false);
    const [presetSourceId, setPresetSourceId] = useState('');
    const [presetName, setPresetName] = useState('');
    const [presetDescription, setPresetDescription] = useState('');
    const [presetAccent, setPresetAccent] = useState('#5ea2ff');
    const [aiPrompt, setAiPrompt] = useState('');
    const [generating, setGenerating] = useState(false);
    const [aiError, setAiError] = useState('');
    const [attachmentError, setAttachmentError] = useState('');
    const [uploading, setUploading] = useState(false);
    const [draggingFiles, setDraggingFiles] = useState(false);
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
            setActiveId(next[0].id);
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

    useEffect(() => {
        if (!loaded) return;
        chrome.storage.local.set({ [SAVED_LISTS_KEY]: lists });
    }, [lists, loaded]);

    useEffect(() => {
        if (!presetsLoaded) return;
        chrome.storage.local.set({ [LIST_PRESETS_KEY]: presets });
    }, [presets, presetsLoaded]);

    const updateActive = (updater: (list: SavedList) => SavedList) => {
        if (!active) return;
        setLists((current) =>
            current.map((list) =>
                list.id === active.id
                    ? { ...updater(list), updatedAt: new Date().toISOString() }
                    : list,
            ),
        );
    };

    const createList = (title = 'Untitled') => {
        const next = createBlankList(title);
        setLists((current) => [next, ...current]);
        setActiveId(next.id);
    };

    const applyTemplate = (template: Template) => {
        const next = createBlankList(template.name);
        next.blocks = template.blocks();
        setLists((current) => [next, ...current]);
        setActiveId(next.id);
    };

    const applyPreset = (preset: ListPreset) => {
        const next = createBlankList(preset.title);
        next.blocks = cloneReusableBlocks(preset.blocks);
        setLists((current) => [next, ...current]);
        setActiveId(next.id);
    };

    const openPresetModal = () => {
        setPresetSourceId(active.id);
        setPresetName(active.title ? `${active.title} preset` : 'New preset');
        setPresetDescription('');
        setPresetAccent('#5ea2ff');
        setShowPresetModal(true);
    };

    const savePreset = () => {
        const source = lists.find((list) => list.id === presetSourceId);
        if (!source || !presetName.trim()) return;
        setPresets((current) => [
            ...current,
            createListPreset({
                title: presetName,
                description: presetDescription.trim() || `Reusable blocks from ${source.title || 'Untitled'}.`,
                accent: presetAccent,
                blocks: source.blocks,
            }),
        ]);
        setShowPresetModal(false);
    };

    const addAttachments = async (files: File[]) => {
        if (!active || !files.length || uploading) return;
        if (!isPro) {
            setAttachmentError('Attachments are available on Pro.');
            return;
        }
        setUploading(true);
        setAttachmentError('');
        for (const file of files) {
            const result = await uploadAttachment(supabase, file, {
                context: 'list',
                listId: active.id,
            });
            if (!result.ok) {
                setAttachmentError(result.error);
                continue;
            }
            const attachment = result.attachment;
            updateActive((list) => ({
                ...list,
                blocks: [
                    ...list.blocks,
                    {
                        id: newListId('block'),
                        type: 'attachment',
                        content: attachment.fileName,
                        attachment,
                    },
                ],
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
        event.preventDefault();
        dragDepth.current = 0;
        setDraggingFiles(false);
        void addAttachments(Array.from(event.dataTransfer.files));
    };

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

    const generateWithAi = async () => {
        if (!active || !aiPrompt.trim() || generating) return;
        setGenerating(true);
        setAiError('');
        let output = '';
        await streamAiCoachChat({
            model: 'gemini-2.5-flash',
            sessionId: null,
            messages: [{
                role: 'user',
                content: `Create a concise, useful structured list for: ${aiPrompt.trim()}.
${active.blocks
    .filter((block) => block.type === 'attachment' && block.attachment?.extractedText)
    .map((block) => `Attached file "${block.attachment!.fileName}":\n${block.attachment!.extractedText}`)
    .join('\n\n')}
Return only markdown using level-two headings (##), checklist items, short text, and fenced code only when relevant. Never use level-four or deeper headings. Do not include commentary.`,
            }],
            coachContext: { surface: 'lists', current_title: active.title },
            callbacks: {
                onToken: (_chunk, visible) => {
                    output = visible;
                },
                onDone: (payload) => {
                    output = payload.content || output;
                    updateActive((list) => ({ ...list, blocks: parseGeneratedContent(output) }));
                    setAiPrompt('');
                    setGenerating(false);
                },
                onError: (message) => {
                    setAiError(message);
                    setGenerating(false);
                },
            },
        });
    };

    const progress = useMemo(() => {
        if (!active) return { done: 0, total: 0 };
        const items = active.blocks.flatMap((block) => block.items ?? []);
        return { done: items.filter((item) => item.done).length, total: items.length };
    }, [active]);

    if (!active) return null;

    return (
        <div
            className="lists-workspace relative flex h-[calc(100vh-48px)] min-h-0 overflow-hidden rounded-lg border border-white/[0.07] bg-[#111112]"
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
            <AnimatePresence>
                {draggingFiles && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[200] flex items-center justify-center bg-[#09090b]/75 backdrop-blur-md"
                    >
                        <div className="mx-6 w-full max-w-lg rounded-2xl border border-blue-400/30 bg-[#11131a]/95 p-8 text-center shadow-2xl shadow-blue-950/40">
                            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-300">
                                <UploadCloud size={32} />
                            </div>
                            <h2 className="mt-5 text-xl font-semibold text-white">
                                {isPro ? 'Drop files into this list' : 'Attachments are a Pro feature'}
                            </h2>
                            <p className="mt-2 text-sm text-neutral-400">Private storage · Any file type · Up to 10MB each</p>
                            <div className="mt-6 flex items-center justify-center gap-3 text-xs text-neutral-500">
                                <span className="rounded-lg bg-white/[0.05] px-3 py-2">Drop</span>
                                <span>→</span>
                                <span className="rounded-lg bg-white/[0.05] px-3 py-2">Secure upload</span>
                                <span>→</span>
                                <span className="rounded-lg bg-white/[0.05] px-3 py-2">AI-ready notes</span>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
            <aside className="flex w-[210px] shrink-0 flex-col border-r border-white/[0.07] bg-[#0d0d0e]">
                <div className="flex h-11 items-center justify-between px-3">
                    <span className="text-xs font-medium text-neutral-300">Lists</span>
                    <button
                        type="button"
                        onClick={() => createList()}
                        className="rounded p-1 text-neutral-500 hover:bg-white/[0.06] hover:text-white"
                        aria-label="New list"
                    >
                        <Plus size={14} />
                    </button>
                </div>
                <div className="flex-1 space-y-0.5 overflow-y-auto px-2">
                    {lists.map((list) => (
                        <button
                            key={list.id}
                            type="button"
                            onClick={() => setActiveId(list.id)}
                            className={`flex h-8 w-full items-center gap-2 rounded px-2 text-left text-xs ${
                                list.id === active.id
                                    ? 'bg-white/[0.07] text-neutral-200'
                                    : 'text-neutral-500 hover:bg-white/[0.04] hover:text-neutral-300'
                            }`}
                        >
                            <FileText size={13} />
                            <span className="min-w-0 flex-1 truncate">{list.title || 'Untitled'}</span>
                        </button>
                    ))}
                </div>
            </aside>

            <main className="min-w-0 flex-1 overflow-y-auto">
                <div className="mx-auto max-w-3xl px-8 pb-24 pt-12">
                    <div className="mb-7 flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                            <input
                                value={active.title}
                                onChange={(event) => updateActive((list) => ({ ...list, title: event.target.value }))}
                                className="w-full bg-transparent text-3xl font-semibold tracking-tight text-neutral-100 outline-none placeholder:text-neutral-700"
                                placeholder="Untitled"
                            />
                            <p className="mt-1 text-[11px] text-neutral-600">
                                {progress.total ? `${progress.done} of ${progress.total} complete` : `Edited ${format(new Date(active.updatedAt), 'MMM d, h:mm a')}`}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                if (lists.length === 1) {
                                    const next = createBlankList();
                                    setLists([next]);
                                    setActiveId(next.id);
                                } else {
                                    setLists((current) => current.filter((list) => list.id !== active.id));
                                    setActiveId(lists.find((list) => list.id !== active.id)?.id ?? '');
                                }
                            }}
                            className="flex items-center gap-1.5 rounded px-2 py-1.5 text-[11px] text-neutral-600 hover:bg-white/[0.05] hover:text-red-400"
                            aria-label="Delete list"
                        >
                            <Trash2 size={13} />
                            Delete list
                        </button>
                    </div>

                    <div className="space-y-2">
                        {active.blocks.map((block) => (
                            <BlockEditor
                                key={block.id}
                                block={block}
                                onChange={(next) =>
                                    updateActive((list) => ({
                                        ...list,
                                        blocks: list.blocks.map((item) => item.id === block.id ? next : item),
                                    }))
                                }
                                onDelete={() => {
                                    if (block.attachment) {
                                        void deleteAttachment(supabase, block.attachment).then((result) => {
                                            if (!result.ok) setAttachmentError(result.error);
                                        });
                                    }
                                    updateActive((list) => ({
                                        ...list,
                                        blocks: list.blocks.filter((item) => item.id !== block.id),
                                    }));
                                }}
                                onError={setAttachmentError}
                            />
                        ))}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-1">
                        {BLOCK_OPTIONS.map(({ type, label, icon: Icon }) => (
                            <button
                                key={type}
                                type="button"
                                onClick={() => updateActive((list) => ({ ...list, blocks: [...list.blocks, newBlock(type)] }))}
                                className="flex h-7 items-center gap-1.5 rounded px-2 text-[11px] text-neutral-600 hover:bg-white/[0.05] hover:text-neutral-300"
                            >
                                <Icon size={12} />
                                {label}
                            </button>
                        ))}
                        <button
                            type="button"
                            disabled={uploading}
                            onClick={() => {
                                if (isPro) fileInputRef.current?.click();
                                else setAttachmentError('Attachments are available on Pro.');
                            }}
                            className="flex h-7 items-center gap-1.5 rounded px-2 text-[11px] text-neutral-600 hover:bg-white/[0.05] hover:text-neutral-300 disabled:opacity-50"
                        >
                            {uploading ? <Loader2 size={12} className="animate-spin" /> : <Paperclip size={12} />}
                            {uploading ? 'Uploading…' : 'Attachment'}
                            {!isPro && <span className="rounded bg-amber-400/10 px-1 text-[9px] text-amber-300">PRO</span>}
                        </button>
                    </div>
                    {attachmentError && (
                        <div className="mt-3 flex items-center gap-3 rounded-lg border border-amber-400/15 bg-amber-400/[0.05] px-3 py-2 text-[11px] text-amber-200">
                            <span className="flex-1">{attachmentError}</span>
                            {!isPro && (
                                <button
                                    type="button"
                                    onClick={() => void upgradeToPro()}
                                    className="rounded bg-amber-300 px-2 py-1 font-semibold text-neutral-950"
                                >
                                    Upgrade
                                </button>
                            )}
                            <button type="button" onClick={() => setAttachmentError('')} aria-label="Dismiss">×</button>
                        </div>
                    )}

                    <div className="mt-10 rounded-lg border border-white/[0.07] bg-white/[0.025] p-3">
                        <div className="flex items-center gap-2">
                            <Sparkles size={14} className="text-neutral-400" />
                            <input
                                value={aiPrompt}
                                onChange={(event) => setAiPrompt(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') void generateWithAi();
                                }}
                                placeholder="Generate a packing list, sprint plan, study guide…"
                                className="min-w-0 flex-1 bg-transparent text-xs text-neutral-200 outline-none placeholder:text-neutral-600"
                            />
                            <button
                                type="button"
                                disabled={!aiPrompt.trim() || generating}
                                onClick={() => void generateWithAi()}
                                className="rounded bg-neutral-200 px-2.5 py-1 text-[11px] font-medium text-neutral-950 disabled:opacity-40"
                            >
                                {generating ? 'Writing…' : 'Generate'}
                            </button>
                        </div>
                        {aiError && <p className="mt-2 text-[11px] text-red-400">{aiError}</p>}
                    </div>

                    <ScheduleList list={active} onChange={updateActive} onSync={syncCalendar} />
                </div>
            </main>

            <aside className="w-[340px] shrink-0 overflow-y-auto border-l border-white/[0.07] bg-[#0f0f10] p-3">
                <div className="flex items-center justify-between px-1 pb-2">
                    <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-600">Presets</p>
                    {presets.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setManagingPresets((value) => !value)}
                            className="text-[10px] text-neutral-600 hover:text-neutral-300"
                        >
                            {managingPresets ? 'Done' : 'Manage'}
                        </button>
                    )}
                </div>
                <div className="space-y-2">
                    {TEMPLATES.map((template) => (
                        <PresetCard
                            key={template.id}
                            name={template.name}
                            description={template.description}
                            accent={template.accent}
                            blocks={template.blocks()}
                            onClick={() => applyTemplate(template)}
                        />
                    ))}
                    {presets.map((preset) => (
                        <div key={preset.id} className="relative">
                            <PresetCard
                                name={preset.title}
                                description={preset.description}
                                accent={preset.accent}
                                blocks={preset.blocks}
                                onClick={() => applyPreset(preset)}
                            />
                            {managingPresets && (
                                <button
                                    type="button"
                                    onClick={() => setPresets((current) => current.filter((item) => item.id !== preset.id))}
                                    className="absolute right-2 top-2 z-30 rounded-md border border-red-400/20 bg-[#171718]/95 p-1.5 text-red-400 shadow-lg hover:bg-red-400/10"
                                    aria-label={`Delete ${preset.title} preset`}
                                >
                                    <Trash2 size={12} />
                                </button>
                            )}
                        </div>
                    ))}
                    <button
                        type="button"
                        onClick={openPresetModal}
                        className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-white/[0.12] text-[11px] text-neutral-500 transition-colors hover:border-white/[0.2] hover:bg-white/[0.03] hover:text-neutral-300"
                    >
                        <Plus size={13} />
                        Add new preset
                    </button>
                </div>
            </aside>

            <AnimatePresence>
                {showPresetModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[210] flex items-center justify-center bg-black/65 p-6 backdrop-blur-sm"
                        onMouseDown={(event) => {
                            if (event.target === event.currentTarget) setShowPresetModal(false);
                        }}
                    >
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 6, scale: 0.98 }}
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="preset-dialog-title"
                            className="w-full max-w-md rounded-xl border border-white/[0.1] bg-[#151516] p-5 shadow-2xl"
                        >
                            <div className="flex items-start justify-between">
                                <div>
                                    <h2 id="preset-dialog-title" className="text-sm font-semibold text-neutral-100">Create a preset</h2>
                                    <p className="mt-1 text-[11px] text-neutral-500">Save reusable blocks from one of your lists.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowPresetModal(false)}
                                    className="rounded p-1 text-neutral-600 hover:bg-white/[0.05] hover:text-neutral-300"
                                    aria-label="Close"
                                >
                                    <X size={15} />
                                </button>
                            </div>
                            <div className="mt-5 space-y-4">
                                <label className="block text-[11px] text-neutral-400">
                                    Source list
                                    <select
                                        value={presetSourceId}
                                        onChange={(event) => setPresetSourceId(event.target.value)}
                                        className="mt-1.5 w-full rounded-lg border border-white/[0.09] bg-black/30 px-3 py-2 text-xs text-neutral-200 outline-none focus:border-blue-400/40"
                                    >
                                        {lists.map((list) => (
                                            <option key={list.id} value={list.id}>{list.title || 'Untitled'}</option>
                                        ))}
                                    </select>
                                </label>
                                <label className="block text-[11px] text-neutral-400">
                                    Preset name
                                    <input
                                        value={presetName}
                                        onChange={(event) => setPresetName(event.target.value)}
                                        className="mt-1.5 w-full rounded-lg border border-white/[0.09] bg-black/30 px-3 py-2 text-xs text-neutral-200 outline-none focus:border-blue-400/40"
                                        placeholder="Weekly review"
                                        autoFocus
                                    />
                                </label>
                                <label className="block text-[11px] text-neutral-400">
                                    Description
                                    <input
                                        value={presetDescription}
                                        onChange={(event) => setPresetDescription(event.target.value)}
                                        className="mt-1.5 w-full rounded-lg border border-white/[0.09] bg-black/30 px-3 py-2 text-xs text-neutral-200 outline-none focus:border-blue-400/40"
                                        placeholder="A quick structure for every Friday."
                                    />
                                </label>
                                <label className="flex items-center justify-between rounded-lg border border-white/[0.07] bg-black/20 px-3 py-2.5 text-[11px] text-neutral-400">
                                    Accent line color
                                    <input
                                        type="color"
                                        value={presetAccent}
                                        onChange={(event) => setPresetAccent(event.target.value)}
                                        className="h-7 w-10 cursor-pointer rounded border-0 bg-transparent p-0"
                                    />
                                </label>
                                {(lists.find((list) => list.id === presetSourceId)?.blocks.some((block) => block.type === 'attachment')) && (
                                    <p className="rounded-lg border border-amber-400/15 bg-amber-400/[0.05] px-3 py-2 text-[10px] leading-4 text-amber-200/80">
                                        Attachments are not included. This keeps stored files safely owned by their original list.
                                    </p>
                                )}
                            </div>
                            <div className="mt-5 flex justify-end gap-2">
                                <button type="button" onClick={() => setShowPresetModal(false)} className="rounded-lg px-3 py-2 text-xs text-neutral-500 hover:text-neutral-200">
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    disabled={!presetName.trim()}
                                    onClick={savePreset}
                                    className="rounded-lg bg-neutral-100 px-3 py-2 text-xs font-medium text-neutral-950 disabled:opacity-40"
                                >
                                    Save preset
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function PresetCard({
    name,
    description,
    accent,
    blocks,
    onClick,
}: {
    name: string;
    description: string;
    accent: string;
    blocks: ListBlock[];
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="list-preset-card relative h-[104px] w-full overflow-hidden rounded-lg border border-white/[0.07] bg-[#131314] text-left transition-colors hover:border-white/[0.14] hover:bg-[#171718] focus-visible:border-white/[0.18] focus-visible:outline-none"
        >
            <span className="absolute inset-y-0 left-0 z-10 flex w-[48%] flex-col justify-center p-3">
                <span className="mb-2 h-1.5 w-8 rounded-full" style={{ backgroundColor: accent }} />
                <span className="truncate text-xs font-medium text-neutral-200">{name}</span>
                <span className="mt-1 line-clamp-2 text-[9px] leading-3.5 text-neutral-600">{description}</span>
            </span>
            <span className="pointer-events-none absolute inset-y-3 left-[47%] z-20 w-px bg-gradient-to-b from-transparent via-white/[0.13] to-transparent" />
            <span
                className="absolute inset-y-0 right-0 w-[58%] overflow-hidden pb-2 pl-9 pr-2 pt-3"
                style={{
                    background: 'linear-gradient(90deg, transparent 0%, var(--list-preview-bg) 24%, var(--list-preview-bg) 100%)',
                    maskImage: 'linear-gradient(90deg, transparent 0%, black 25%, black 100%)',
                    WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, black 25%, black 100%)',
                }}
            >
                <TemplateWidgetPreview blocks={blocks} />
            </span>
        </button>
    );
}

function TemplateWidgetPreview({ blocks: sourceBlocks }: { blocks: ListBlock[] }) {
    const blocks = sourceBlocks.slice(0, 4);
    return (
        <span className="block space-y-1.5">
            {blocks.map((block, index) => {
                if (block.type === 'checklist') {
                    return (
                        <span key={`${block.type}-${index}`} className="block space-y-1">
                            {(block.items ?? []).slice(0, 3).map((item) => (
                                <span key={item.text} className="flex items-center gap-1.5">
                                    <span className="h-2.5 w-2.5 rounded-[2px] border border-white/[0.18]" />
                                    <span className="truncate text-[8px] text-neutral-400">{item.text}</span>
                                </span>
                            ))}
                        </span>
                    );
                }
                if (block.type === 'code') {
                    return (
                        <span key={`${block.type}-${index}`} className="list-preview-code block rounded bg-black/35 p-1.5 font-mono text-[7px] leading-3">
                            <span className="text-[#c586c0]">const</span>
                            <span className="text-neutral-400"> plan = </span>
                            <span className="text-[#ce9178]">&apos;focus&apos;</span>
                        </span>
                    );
                }
                if (block.type === 'heading') {
                    return (
                        <span key={`${block.type}-${index}`} className="block truncate text-[10px] font-semibold text-neutral-200">
                            {block.content}
                        </span>
                    );
                }
                return (
                    <span
                        key={`${block.type}-${index}`}
                        className={`block truncate text-[8px] ${
                            block.type === 'quote'
                                ? 'border-l border-white/[0.18] pl-1.5 italic text-neutral-500'
                                : 'text-neutral-500'
                        }`}
                    >
                        {block.content}
                    </span>
                );
            })}
        </span>
    );
}

function BlockEditor({
    block,
    onChange,
    onDelete,
    onError,
}: {
    block: ListBlock;
    onChange: (block: ListBlock) => void;
    onDelete: () => void;
    onError: (message: string) => void;
}) {
    return (
        <div className="group flex items-start gap-1 rounded-md py-1 hover:bg-white/[0.018]">
            <span className="mt-2 cursor-grab text-neutral-800 opacity-0 transition-opacity group-hover:opacity-100">
                <GripVertical size={13} />
            </span>
            <div className="min-w-0 flex-1">
                {block.type === 'attachment' && block.attachment ? (
                    <AttachmentBlock attachment={block.attachment} onDelete={onDelete} onError={onError} />
                ) : block.type === 'link' ? (
                    <LinkBlockEditor block={block} onChange={onChange} onError={onError} />
                ) : block.type === 'checklist' ? (
                    <div className="space-y-1">
                        {(block.items ?? []).map((item) => (
                            <div key={item.id} className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() =>
                                        onChange({
                                            ...block,
                                            items: block.items?.map((candidate) =>
                                                candidate.id === item.id ? { ...candidate, done: !candidate.done } : candidate,
                                            ),
                                        })
                                    }
                                    className={`flex h-4 w-4 items-center justify-center rounded-[4px] border ${
                                        item.done ? 'border-neutral-300 bg-neutral-300 text-black' : 'border-white/[0.18]'
                                    }`}
                                >
                                    {item.done && <Check size={11} strokeWidth={2.5} />}
                                </button>
                                <input
                                    value={item.text}
                                    onChange={(event) =>
                                        onChange({
                                            ...block,
                                            items: block.items?.map((candidate) =>
                                                candidate.id === item.id ? { ...candidate, text: event.target.value } : candidate,
                                            ),
                                        })
                                    }
                                    className={`min-w-0 flex-1 bg-transparent text-sm outline-none ${
                                        item.done ? 'text-neutral-600 line-through' : 'text-neutral-300'
                                    }`}
                                    placeholder="List item"
                                />
                            </div>
                        ))}
                        <button
                            type="button"
                            onClick={() =>
                                onChange({
                                    ...block,
                                    items: [...(block.items ?? []), { id: newListId('item'), text: '', done: false }],
                                })
                            }
                            className="ml-6 text-[11px] text-neutral-700 hover:text-neutral-400"
                        >
                            + Add item
                        </button>
                    </div>
                ) : block.type === 'code' ? (
                    <CodeBlockEditor block={block} onChange={onChange} />
                ) : (
                    <textarea
                        value={block.content}
                        onChange={(event) => onChange({ ...block, content: event.target.value })}
                        rows={1}
                        placeholder={block.type === 'heading' ? 'Heading' : 'Type something…'}
                        className={`w-full resize-none bg-transparent outline-none placeholder:text-neutral-700 ${
                            block.type === 'heading'
                                ? 'text-xl font-semibold text-neutral-200'
                                : block.type === 'quote'
                                    ? 'border-l-2 border-white/[0.15] pl-3 text-sm italic text-neutral-400'
                                    : 'text-sm leading-6 text-neutral-400'
                        }`}
                    />
                )}
            </div>
            {block.type !== 'attachment' && (
                <button
                    type="button"
                    onClick={onDelete}
                    className="mt-1 rounded p-1 text-neutral-800 opacity-0 hover:text-red-400 group-hover:opacity-100"
                    aria-label="Delete block"
                >
                    <Trash2 size={12} />
                </button>
            )}
        </div>
    );
}

function AttachmentBlock({
    attachment,
    onDelete,
    onError,
}: {
    attachment: AttachmentRecord;
    onDelete: () => void;
    onError: (message: string) => void;
}) {
    const [previewUrl, setPreviewUrl] = useState('');
    const isImage = attachment.mimeType.startsWith('image/');
    const isVideo = attachment.mimeType.startsWith('video/');
    const isAudio = attachment.mimeType.startsWith('audio/');
    const needsPreviewUrl = isImage || isVideo || isAudio;
    const FileTypeIcon = isImage ? Image : isVideo ? Film : isAudio ? Music : FileText;

    useEffect(() => {
        if (!needsPreviewUrl) return;
        let active = true;
        void supabase.storage
            .from('attachments')
            .createSignedUrl(attachment.storagePath, 300)
            .then(({ data }) => {
                if (active) setPreviewUrl(data?.signedUrl ?? '');
            });
        return () => {
            active = false;
        };
    }, [attachment.storagePath, needsPreviewUrl]);

    return (
        <div className="overflow-hidden rounded-lg border border-white/[0.08] bg-[#0d0d0f]">
            {isImage && previewUrl && (
                <img src={previewUrl} alt="" className="max-h-56 w-full bg-black/20 object-contain" />
            )}
            {isVideo && previewUrl && (
                <video src={previewUrl} controls preload="metadata" className="max-h-72 w-full bg-black" />
            )}
            {isAudio && previewUrl && (
                <div className="p-3 pb-0">
                    <audio src={previewUrl} controls preload="metadata" className="w-full" />
                </div>
            )}
            <div className="flex items-center gap-3 p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-neutral-400">
                    <FileTypeIcon size={17} />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-neutral-200">{attachment.fileName}</p>
                    <p className="mt-0.5 text-[10px] text-neutral-600">
                        {attachment.sizeBytes >= 1024 * 1024
                            ? `${(attachment.sizeBytes / (1024 * 1024)).toFixed(1)} MB`
                            : `${(attachment.sizeBytes / 1024).toFixed(1)} KB`}
                        {attachment.extractedText ? ' · Available to AI' : ''}
                    </p>
                    {attachment.extractedText && (
                        <p className="mt-2 line-clamp-2 whitespace-pre-wrap font-mono text-[10px] leading-4 text-neutral-500">
                            {attachment.extractedText.slice(0, 240)}
                        </p>
                    )}
                </div>
                <button
                    type="button"
                    onClick={() => void downloadAttachment(supabase, attachment).then((result) => {
                        if (!result.ok) onError(result.error);
                    })}
                    className="rounded p-2 text-neutral-500 hover:bg-white/[0.05] hover:text-white"
                    aria-label={`Download ${attachment.fileName}`}
                >
                    <Download size={14} />
                </button>
                <button
                    type="button"
                    onClick={onDelete}
                    className="rounded p-2 text-neutral-600 hover:bg-red-400/10 hover:text-red-400"
                    aria-label={`Delete ${attachment.fileName}`}
                >
                    <Trash2 size={14} />
                </button>
            </div>
        </div>
    );
}

function LinkBlockEditor({
    block,
    onChange,
    onError,
}: {
    block: ListBlock;
    onChange: (block: ListBlock) => void;
    onError: (message: string) => void;
}) {
    const [draftUrl, setDraftUrl] = useState(block.content || '');
    const [loading, setLoading] = useState(false);

    const confirmUrl = async () => {
        const raw = draftUrl.trim();
        if (!raw || loading) return;
        setLoading(true);
        try {
            const preview = await fetchLinkPreview(raw);
            onChange({ ...block, content: preview.url, link: preview });
        } catch {
            onError('Could not preview that link.');
        } finally {
            setLoading(false);
        }
    };

    if (block.link) {
        return <LinkEmbedCard preview={block.link} />;
    }

    return (
        <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-[#0d0d0f] p-2">
            <LinkIcon size={14} className="shrink-0 text-neutral-500" />
            <input
                value={draftUrl}
                onChange={(event) => setDraftUrl(event.target.value)}
                onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                        event.preventDefault();
                        void confirmUrl();
                    }
                }}
                placeholder="Paste a link and press Enter…"
                className="min-w-0 flex-1 bg-transparent text-sm text-neutral-300 outline-none placeholder:text-neutral-700"
                autoFocus
            />
            <button
                type="button"
                disabled={!draftUrl.trim() || loading}
                onClick={() => void confirmUrl()}
                className="flex shrink-0 items-center gap-1.5 rounded px-2 py-1 text-[11px] font-medium text-neutral-400 hover:bg-white/[0.06] hover:text-neutral-200 disabled:opacity-40"
            >
                {loading ? <Loader2 size={12} className="animate-spin" /> : null}
                {loading ? 'Loading…' : 'Preview'}
            </button>
        </div>
    );
}

function LinkEmbedCard({ preview }: { preview: LinkPreview }) {
    return (
        <a
            href={preview.url}
            target="_blank"
            rel="noreferrer"
            className="flex gap-3 rounded-lg border border-white/[0.08] bg-[#0d0d0f] p-3 transition-colors hover:border-white/[0.16] hover:bg-[#131315]"
        >
            {preview.image ? (
                <img
                    src={preview.image}
                    alt=""
                    className="h-16 w-16 shrink-0 rounded-md bg-white/[0.05] object-cover"
                    onError={(event) => {
                        event.currentTarget.style.display = 'none';
                    }}
                />
            ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-white/[0.05]">
                    {preview.favicon ? (
                        <img src={preview.favicon} alt="" className="h-7 w-7" />
                    ) : (
                        <LinkIcon size={18} className="text-neutral-500" />
                    )}
                </div>
            )}
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                    {preview.favicon && (
                        <img src={preview.favicon} alt="" className="h-3.5 w-3.5 shrink-0 rounded-sm" />
                    )}
                    <span className="truncate text-[10px] font-medium uppercase tracking-wide text-neutral-500">
                        {preview.siteName}
                    </span>
                </div>
                <p className="mt-1 truncate text-sm font-medium text-neutral-200">{preview.title}</p>
                {preview.description && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-neutral-500">{preview.description}</p>
                )}
            </div>
        </a>
    );
}

const CODE_LANGUAGES = ['typescript', 'javascript', 'python', 'tsx', 'jsx', 'json', 'css', 'markup', 'bash', 'sql'] as const;

function CodeBlockEditor({
    block,
    onChange,
}: {
    block: ListBlock;
    onChange: (block: ListBlock) => void;
}) {
    const isLight = useIsLightDashboard();
    const language = (block.language || 'typescript') as Language;
    const rows = Math.max(5, block.content.split('\n').length + 1);
    return (
        <div className="list-code-editor overflow-hidden rounded-md border border-white/[0.08] bg-[#0d0d0f]">
            <div className="flex h-7 items-center border-b border-white/[0.06] px-2">
                <Code2 size={11} className="mr-1.5 text-neutral-600" />
                <select
                    value={block.language || 'typescript'}
                    onChange={(event) => onChange({ ...block, language: event.target.value })}
                    className="bg-transparent text-[10px] text-neutral-500 outline-none"
                    aria-label="Code language"
                >
                    {CODE_LANGUAGES.map((option) => (
                        <option key={option} value={option}>{option}</option>
                    ))}
                </select>
            </div>
            <div className="relative min-h-[100px] overflow-hidden">
                <Highlight theme={isLight ? themes.github : themes.vsDark} code={block.content || ' '} language={language}>
                    {({ className, style, tokens, getLineProps, getTokenProps }) => (
                        <pre
                            aria-hidden
                            className={`${className} pointer-events-none m-0 min-h-[100px] whitespace-pre-wrap break-words p-3 font-mono text-xs leading-5`}
                            style={{ ...style, background: 'transparent' }}
                        >
                            {tokens.map((line, lineIndex) => (
                                <div key={lineIndex} {...getLineProps({ line })}>
                                    {line.map((token, tokenIndex) => (
                                        <span key={tokenIndex} {...getTokenProps({ token })} />
                                    ))}
                                </div>
                            ))}
                        </pre>
                    )}
                </Highlight>
                <textarea
                    value={block.content}
                    onChange={(event) => onChange({ ...block, content: event.target.value })}
                    rows={rows}
                    spellCheck={false}
                    placeholder="Write or paste code…"
                    className="list-code-input absolute inset-0 h-full w-full resize-none overflow-hidden whitespace-pre-wrap break-words bg-transparent p-3 font-mono text-xs leading-5 text-transparent caret-white outline-none placeholder:text-neutral-700"
                    style={{ WebkitTextFillColor: 'transparent' }}
                    aria-label={`${block.language || 'typescript'} code`}
                />
            </div>
        </div>
    );
}

function ScheduleList({
    list,
    onChange,
    onSync,
}: {
    list: SavedList;
    onChange: (updater: (list: SavedList) => SavedList) => void;
    onSync: (list: SavedList) => Promise<void>;
}) {
    const schedule = list.schedule ?? {
        enabled: false,
        date: format(new Date(), 'yyyy-MM-dd'),
        startMin: 9 * 60,
        durationMin: 30,
        repeat: 'none' as const,
    };
    const patch = (changes: Partial<typeof schedule>) => {
        const next = { ...schedule, ...changes };
        onChange((current) => ({ ...current, schedule: next }));
        window.setTimeout(() => void onSync({ ...list, schedule: next }), 0);
    };

    return (
        <div className="mt-4 rounded-lg border border-white/[0.07] p-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-neutral-400">
                    <CalendarPlus size={14} />
                    Show on calendar
                </div>
                <button
                    type="button"
                    role="switch"
                    aria-checked={schedule.enabled}
                    onClick={() => patch({ enabled: !schedule.enabled })}
                    className={`relative h-5 w-9 rounded-full transition-colors ${schedule.enabled ? 'bg-blue-500' : 'bg-white/[0.1]'}`}
                >
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${schedule.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
            </div>
            {schedule.enabled && (
                <div className="mt-3 space-y-2">
                <div className="grid grid-cols-5 gap-2">
                    <input
                        type="date"
                        value={schedule.date}
                        onChange={(event) => patch({ date: event.target.value })}
                        className="col-span-2 rounded-md border border-white/[0.08] bg-black/30 px-2 py-1.5 text-[11px] text-neutral-300 [color-scheme:dark]"
                    />
                    <input
                        type="time"
                        value={`${String(Math.floor(schedule.startMin / 60)).padStart(2, '0')}:${String(schedule.startMin % 60).padStart(2, '0')}`}
                        onChange={(event) => {
                            const [hour, minute] = event.target.value.split(':').map(Number);
                            patch({ startMin: hour * 60 + minute });
                        }}
                        className="rounded-md border border-white/[0.08] bg-black/30 px-2 py-1.5 text-[11px] text-neutral-300 [color-scheme:dark]"
                    />
                    <select
                        value={schedule.durationMin}
                        onChange={(event) => patch({ durationMin: Number(event.target.value) })}
                        className="rounded-md border border-white/[0.08] bg-black/30 px-2 py-1.5 text-[11px] text-neutral-300"
                    >
                        {[15, 30, 45, 60, 90, 120].map((minutes) => (
                            <option key={minutes} value={minutes}>{minutes} min</option>
                        ))}
                    </select>
                    <select
                        value={schedule.repeat}
                        onChange={(event) => patch({ repeat: event.target.value as typeof schedule.repeat })}
                        className="rounded-md border border-white/[0.08] bg-black/30 px-2 py-1.5 text-[11px] text-neutral-300"
                    >
                        <option value="none">No repeat</option>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                    </select>
                </div>
                {schedule.repeat === 'weekly' && (
                    <div className="flex items-center gap-1.5">
                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, day) => {
                            const selected = (schedule.recurrenceWeekdays ?? [parseISO(`${schedule.date}T12:00:00`).getDay()]).includes(day);
                            return (
                                <button
                                    key={`${label}-${day}`}
                                    type="button"
                                    aria-pressed={selected}
                                    onClick={() => {
                                        const current = schedule.recurrenceWeekdays ?? [parseISO(`${schedule.date}T12:00:00`).getDay()];
                                        const next = selected
                                            ? current.filter((value) => value !== day)
                                            : [...current, day].sort((a, b) => a - b);
                                        if (next.length) patch({ recurrenceWeekdays: next });
                                    }}
                                    className={`flex h-7 w-7 items-center justify-center rounded-md text-[10px] font-medium transition-colors ${
                                        selected
                                            ? 'bg-neutral-200 text-neutral-950'
                                            : 'border border-white/[0.08] text-neutral-600 hover:bg-white/[0.05] hover:text-neutral-300'
                                    }`}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                )}
                </div>
            )}
        </div>
    );
}
