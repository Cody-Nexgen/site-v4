import {
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type KeyboardEvent as ReactKeyboardEvent,
    type ReactNode,
    type RefObject,
    type TextareaHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    ArrowDown,
    ArrowUp,
    ChevronRight,
    Copy,
    GripVertical,
    ImagePlus,
    Plus,
    RefreshCw,
    Repeat2,
    Smile,
    Table as TableIcon,
    Trash2,
} from 'lucide-react';
import type { AttachmentRecord } from '../../lib/attachmentApi';
import { fetchLinkPreview } from '../../lib/linkPreviewApi';
import { newBlock, newListId, type ListBlock, type ListChecklistItem, type SavedList } from '../../lib/listTypes';
import { Checkbox } from '../../components/fz/Checkbox';
import { Menu, type MenuItem } from '../../components/fz/Menu';
import { Popover } from '../../components/fz/Popover';
import { EmojiPicker, PageIcon } from './EmojiPicker';
import { COVERS, TEXTUAL, coverStyle, isEmptyList, useIsLightDashboard } from './editorUtils';
import {
    CONVERTIBLE,
    TURN_INTO,
    filterCommands,
    markdownShortcut,
    type BlockCommand,
    type CommandGroup,
} from './blockCatalog';
import {
    AiBlock,
    AttachmentBlock,
    AudioBlock,
    BookmarkBlock,
    CodeBlock,
    EmbedBlock,
    FilePlaceholder,
    ImageBlock,
    PageBlock,
    TableBlock,
    TocBlock,
    VideoBlock,
} from './MediaBlocks';

/** Textarea that grows with its content. */
function AutoTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
    const ref = useRef<HTMLTextAreaElement>(null);
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        el.style.height = '0px';
        el.style.height = `${el.scrollHeight}px`;
    }, [props.value]);
    return (
        <textarea
            ref={ref}
            rows={1}
            {...props}
            className={`list-doc-field block w-full resize-none overflow-hidden bg-transparent outline-none ${props.className ?? ''}`}
        />
    );
}

function isSingleLine(el: HTMLTextAreaElement) {
    const lh = parseFloat(getComputedStyle(el).lineHeight) || 24;
    return el.scrollHeight < lh * 1.6 + 8;
}

type SlashState = { blockId: string; query: string; start: number };

export type EditorTemplate = { id: string; name: string; description: string; accent: string; make: () => ListBlock[] };

export type ListEditorProps = {
    list: SavedList;
    lists: SavedList[];
    onChange: (updater: (list: SavedList) => SavedList) => void;
    onOpenList: (id: string) => void;
    onCreateSubpage: () => string;
    isPro: boolean;
    onUpload: (file: File) => Promise<AttachmentRecord | null>;
    onError: (message: string) => void;
    onAi: (prompt: string) => Promise<ListBlock[] | null>;
    templates: EditorTemplate[];
    onApplyTemplate: (name: string, blocks: ListBlock[]) => void;
    children?: ReactNode;
};

export function ListEditor({
    list,
    lists,
    onChange,
    onOpenList,
    onCreateSubpage,
    isPro,
    onUpload,
    onError,
    onAi,
    templates,
    onApplyTemplate,
    children,
}: ListEditorProps) {
    const rootRef = useRef<HTMLDivElement>(null);
    const iconAnchor = useRef<HTMLButtonElement>(null);
    const coverAnchor = useRef<HTMLButtonElement>(null);
    const calloutAnchor = useRef<HTMLElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const pendingFileBlock = useRef<string | null>(null);
    const [slash, setSlash] = useState<SlashState | null>(null);
    const [slashIndex, setSlashIndex] = useState(0);
    const [iconOpen, setIconOpen] = useState(false);
    const [coverOpen, setCoverOpen] = useState(false);
    const [calloutPicker, setCalloutPicker] = useState<string | null>(null);
    const [uploadingId, setUploadingId] = useState<string | null>(null);
    const isLight = useIsLightDashboard();
    const blocks = list.blocks;
    const focusTitle = () => rootRef.current?.querySelector<HTMLTextAreaElement>('[data-title]')?.focus();
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

    // New, untouched page → start in the title.
    useEffect(() => {
        if (isEmptyList(list) && (!list.title || list.title === 'Untitled')) {
            requestAnimationFrame(focusTitle);
        }
        // Only when a page opens (the editor is keyed by page id).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [list.id]);

    /* ── block operations ─────────────────────────────────────────── */

    const setBlocks = (fn: (b: ListBlock[]) => ListBlock[]) =>
        onChange((l) => {
            const next = fn(l.blocks);
            return { ...l, blocks: next.length ? next : [newBlock('text')] };
        });
    const patchBlock = (id: string, next: ListBlock | ((b: ListBlock) => ListBlock)) =>
        setBlocks((bs) => bs.map((b) => (b.id === id ? (typeof next === 'function' ? next(b) : next) : b)));
    const insertAfter = (id: string, added: ListBlock[]) =>
        setBlocks((bs) => {
            const i = bs.findIndex((b) => b.id === id);
            return i < 0 ? [...bs, ...added] : [...bs.slice(0, i + 1), ...added, ...bs.slice(i + 1)];
        });
    const removeBlock = (id: string) => setBlocks((bs) => bs.filter((b) => b.id !== id));
    const replaceBlock = (id: string, added: ListBlock[]) => setBlocks((bs) => bs.flatMap((b) => (b.id === id ? added : [b])));

    const focusBlock = (id: string, at: 'start' | 'end' | number = 'end') =>
        requestAnimationFrame(() => {
            const els = rootRef.current?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
                `[data-block-id="${id}"] [data-focus]`,
            );
            if (!els?.length) return;
            const el = at === 'start' ? els[0] : els[els.length - 1];
            el.focus();
            const len = el.value.length;
            const pos = typeof at === 'number' ? Math.min(at, len) : at === 'start' ? 0 : len;
            try {
                el.setSelectionRange(pos, pos);
            } catch {
                /* inputs like type=file */
            }
        });

    const duplicate = (block: ListBlock) => {
        const copy: ListBlock = {
            ...block,
            id: newListId('block'),
            items: block.items?.map((i) => ({ ...i, id: newListId('item') })),
            rows: block.rows?.map((r) => [...r]),
        };
        insertAfter(block.id, [copy]);
    };

    const moveBy = (id: string, delta: -1 | 1) =>
        setBlocks((bs) => {
            const i = bs.findIndex((b) => b.id === id);
            const j = i + delta;
            if (i < 0 || j < 0 || j >= bs.length) return bs;
            return arrayMove(bs, i, j);
        });

    const onDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        setBlocks((bs) => {
            const from = bs.findIndex((b) => b.id === active.id);
            const to = bs.findIndex((b) => b.id === over.id);
            return from < 0 || to < 0 ? bs : arrayMove(bs, from, to);
        });
    };

    /* ── slash menu ───────────────────────────────────────────────── */

    const commands = useMemo(() => (slash ? filterCommands(slash.query) : []), [slash]);

    const applyCommand = (cmd: BlockCommand) => {
        const s = slash;
        if (!s) return;
        const block = blocks.find((b) => b.id === s.blockId);
        setSlash(null);
        if (!block) return;
        const remaining = block.content.slice(0, s.start) + block.content.slice(s.start + 1 + s.query.length);
        let created = cmd.make();
        if (cmd.special === 'subpage') created = { ...created, pageId: onCreateSubpage() };
        if (remaining.trim()) {
            patchBlock(block.id, { ...block, content: remaining });
            insertAfter(block.id, [created]);
        } else {
            replaceBlock(block.id, [created]);
        }
        if (cmd.special === 'file') {
            if (isPro) {
                pendingFileBlock.current = created.id;
                fileInputRef.current?.click();
            } else {
                onError('Uploading files is a Pro feature.');
            }
        }
        if (cmd.special === 'subpage' && created.pageId) {
            onOpenList(created.pageId);
            return;
        }
        focusBlock(created.id, 'start');
    };

    const openSlashAfter = (block: ListBlock) => {
        if (block.type === 'text' && !block.content) {
            patchBlock(block.id, { ...block, content: '/' });
            setSlash({ blockId: block.id, query: '', start: 0 });
            setSlashIndex(0);
            focusBlock(block.id, 'end');
            return;
        }
        const nb = newBlock('text', '/');
        insertAfter(block.id, [nb]);
        setSlash({ blockId: nb.id, query: '', start: 0 });
        setSlashIndex(0);
        focusBlock(nb.id, 'end');
    };

    /* ── text editing ─────────────────────────────────────────────── */

    const onTextChange = (block: ListBlock, value: string, caret: number) => {
        if (block.type === 'text') {
            const sc = markdownShortcut(value);
            if (sc) {
                const nb = { ...sc.make(), id: block.id };
                setSlash(null);
                if (nb.type === 'divider') {
                    const after = newBlock('text');
                    replaceBlock(block.id, [nb, after]);
                    focusBlock(after.id, 'start');
                } else {
                    patchBlock(block.id, nb);
                    focusBlock(block.id, 'end');
                }
                return;
            }
        }
        patchBlock(block.id, (b) => ({ ...b, content: value }));
        const m = value.slice(0, caret).match(/(?:^|\s)\/([^\s/]{0,30})$/);
        if (m) {
            const next = { blockId: block.id, query: m[1], start: caret - m[1].length - 1 };
            if (!slash || slash.blockId !== next.blockId || slash.query !== next.query) setSlashIndex(0);
            setSlash(next);
        } else if (slash?.blockId === block.id) {
            setSlash(null);
        }
    };

    const onTextKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>, block: ListBlock) => {
        if (e.nativeEvent.isComposing) return;
        if (slash && slash.blockId === block.id) {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                const n = Math.max(1, commands.length);
                setSlashIndex((i) => (i + (e.key === 'ArrowDown' ? 1 : n - 1)) % n);
                return;
            }
            if ((e.key === 'Enter' || e.key === 'Tab') && commands.length) {
                e.preventDefault();
                applyCommand(commands[Math.min(slashIndex, commands.length - 1)]);
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                setSlash(null);
                return;
            }
        }
        const el = e.currentTarget;
        const pos = el.selectionStart;
        const end = el.selectionEnd;
        const value = el.value;
        const idx = blocks.findIndex((b) => b.id === block.id);

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!value && block.type !== 'text') {
                patchBlock(block.id, { id: block.id, type: 'text', content: '' });
                focusBlock(block.id, 'start');
                return;
            }
            const nb = newBlock('text', value.slice(end));
            patchBlock(block.id, (b) => ({ ...b, content: value.slice(0, pos) }));
            insertAfter(block.id, [nb]);
            focusBlock(nb.id, 'start');
            return;
        }
        if (e.key === 'Backspace' && pos === 0 && end === 0) {
            if (block.type !== 'text') {
                e.preventDefault();
                patchBlock(block.id, { id: block.id, type: 'text', content: block.content });
                focusBlock(block.id, 'start');
                return;
            }
            const prev = blocks[idx - 1];
            if (!value) {
                e.preventDefault();
                if (blocks.length > 1) removeBlock(block.id);
                if (prev) focusBlock(prev.id, 'end');
                return;
            }
            if (prev && TEXTUAL.has(prev.type)) {
                e.preventDefault();
                const at = prev.content.length;
                patchBlock(prev.id, (b) => ({ ...b, content: b.content + value }));
                removeBlock(block.id);
                focusBlock(prev.id, at);
                return;
            }
        }
        if (e.key === 'ArrowUp' && pos === end && (isSingleLine(el) ? true : pos === 0)) {
            if (idx === 0) {
                e.preventDefault();
                focusTitle();
                return;
            }
            e.preventDefault();
            focusBlock(blocks[idx - 1].id, 'end');
        }
        if (e.key === 'ArrowDown' && pos === end && (isSingleLine(el) ? true : pos === value.length)) {
            const next = blocks[idx + 1];
            if (next) {
                e.preventDefault();
                focusBlock(next.id, 'start');
            }
        }
    };

    /* ── uploads (File command, media blocks) ────────────────────── */

    const runFileUpload = async (file: File) => {
        const target = pendingFileBlock.current;
        pendingFileBlock.current = null;
        if (!target) return;
        setUploadingId(target);
        const record = await onUpload(file);
        setUploadingId(null);
        if (record) patchBlock(target, (b) => ({ ...b, type: 'attachment', content: record.fileName, attachment: record }));
    };

    /* ── rendering ────────────────────────────────────────────────── */

    const headings = blocks.filter((b) => b.type === 'heading');
    const onlyBlock = blocks.length === 1;

    const textArea = (block: ListBlock, className: string, placeholder: string, alwaysShow = false) => (
        <AutoTextarea
            data-focus
            value={block.content}
            onChange={(e) => onTextChange(block, e.target.value, e.target.selectionStart)}
            onKeyDown={(e) => onTextKeyDown(e, block)}
            onBlur={() => window.setTimeout(() => setSlash((s) => (s?.blockId === block.id && !document.activeElement?.closest?.('[data-slash-menu]') ? null : s)), 120)}
            placeholder={placeholder}
            className={`${className} ${alwaysShow ? 'placeholder:text-[var(--fz-text-4)]' : 'placeholder:text-transparent focus:placeholder:text-[var(--fz-text-4)]'}`}
        />
    );

    const renderBlock = (block: ListBlock, index: number): ReactNode => {
        switch (block.type) {
            case 'text':
                return textArea(
                    block,
                    'py-[3px] text-[15.5px] leading-[26px] text-[var(--fz-text-1)]',
                    onlyBlock ? "Write something, or type '/' for commands…" : "Type '/' for commands",
                    onlyBlock,
                );
            case 'heading': {
                const level = block.level ?? 2;
                const cls =
                    level === 1
                        ? 'text-[30px] font-bold leading-[38px] tracking-[-0.02em]'
                        : level === 2
                          ? 'text-[23px] font-semibold leading-[31px] tracking-[-0.015em]'
                          : 'text-[19px] font-semibold leading-[27px] tracking-[-0.01em]';
                return textArea(block, `${cls} text-[var(--fz-text-1)]`, `Heading ${level}`, true);
            }
            case 'quote':
                return (
                    <div className="border-l-[3px] border-[var(--fz-text-1)] pl-4">
                        {textArea(block, 'py-[3px] text-[15.5px] leading-[26px] text-[var(--fz-text-1)]', 'Empty quote', true)}
                    </div>
                );
            case 'callout':
                return (
                    <div className="flex gap-2.5 rounded-lg bg-[var(--fz-bg-hover)] px-4 py-3">
                        <button
                            type="button"
                            onClick={(e) => {
                                calloutAnchor.current = e.currentTarget;
                                setCalloutPicker(block.id);
                            }}
                            className="mt-[3px] flex size-6 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-[var(--fz-bg-active)]"
                            aria-label="Change callout icon"
                        >
                            <PageIcon icon={block.icon || '💡'} size={19} />
                        </button>
                        {textArea(block, 'py-[3px] text-[15.5px] leading-[26px] text-[var(--fz-text-1)]', 'Type something…', true)}
                    </div>
                );
            case 'toggle':
                return (
                    <div>
                        <div className="flex items-start gap-1">
                            <button
                                type="button"
                                onClick={() => patchBlock(block.id, (b) => ({ ...b, open: !b.open }))}
                                className="mt-[4px] flex size-6 shrink-0 items-center justify-center rounded-md text-[var(--fz-text-2)] transition-colors hover:bg-[var(--fz-bg-hover)]"
                                aria-label={block.open ? 'Collapse' : 'Expand'}
                                aria-expanded={!!block.open}
                            >
                                <ChevronRight size={16} className={`transition-transform ${block.open ? 'rotate-90' : ''}`} />
                            </button>
                            {textArea(block, 'py-[3px] text-[15.5px] leading-[26px] text-[var(--fz-text-1)]', 'Toggle', true)}
                        </div>
                        {block.open && (
                            <div className="pl-7">
                                <AutoTextarea
                                    value={block.body ?? ''}
                                    onChange={(e) => patchBlock(block.id, (b) => ({ ...b, body: e.target.value }))}
                                    placeholder="Empty toggle — write what goes inside."
                                    className="py-[3px] text-[15.5px] leading-[26px] text-[var(--fz-text-2)] placeholder:text-[var(--fz-text-4)]"
                                />
                            </div>
                        )}
                    </div>
                );
            case 'checklist':
            case 'bullets':
            case 'numbered':
                return (
                    <ListItemsBlock
                        block={block}
                        onChange={(next) => patchBlock(block.id, next)}
                        onExit={(text) => {
                            const nb = newBlock('text', text);
                            insertAfter(block.id, [nb]);
                            focusBlock(nb.id, 'start');
                        }}
                        onBecomeText={() => {
                            patchBlock(block.id, { id: block.id, type: 'text', content: '' });
                            focusBlock(block.id, 'start');
                        }}
                        onFocusPrev={() => (index > 0 ? focusBlock(blocks[index - 1].id, 'end') : focusTitle())}
                        onFocusNext={() => blocks[index + 1] && focusBlock(blocks[index + 1].id, 'start')}
                    />
                );
            case 'divider':
                return (
                    <div className="py-2.5">
                        <hr className="border-0 border-t border-[var(--fz-border-strong)]" />
                    </div>
                );
            case 'code':
                return <CodeBlock block={block} onChange={(next) => patchBlock(block.id, next)} isLight={isLight} />;
            case 'table':
                return <TableBlock block={block} onChange={(next) => patchBlock(block.id, next)} />;
            case 'toc':
                return <TocBlock headings={headings} />;
            case 'page':
                return (
                    <PageBlock
                        block={block}
                        onChange={(next) => patchBlock(block.id, next)}
                        lists={lists}
                        currentId={list.id}
                        onOpen={onOpenList}
                    />
                );
            case 'link':
                return <BookmarkBlock block={block} onChange={(next) => patchBlock(block.id, next)} onError={onError} />;
            case 'image':
            case 'video':
            case 'audio': {
                const Comp = block.type === 'image' ? ImageBlock : block.type === 'video' ? VideoBlock : AudioBlock;
                return (
                    <Comp
                        block={block}
                        onChange={(next) => patchBlock(block.id, next)}
                        isPro={isPro}
                        onUpload={onUpload}
                        onError={onError}
                    />
                );
            }
            case 'embed':
                return <EmbedBlock block={block} onChange={(next) => patchBlock(block.id, next)} />;
            case 'attachment':
                return block.attachment ? (
                    <AttachmentBlock attachment={block.attachment} onDelete={() => removeBlock(block.id)} onError={onError} />
                ) : (
                    <FilePlaceholder
                        busy={uploadingId === block.id}
                        onPick={() => {
                            if (!isPro) {
                                onError('Uploading files is a Pro feature.');
                                return;
                            }
                            pendingFileBlock.current = block.id;
                            fileInputRef.current?.click();
                        }}
                    />
                );
            case 'ai':
                return (
                    <AiBlock
                        onCancel={() => removeBlock(block.id)}
                        onGenerate={async (prompt) => {
                            const generated = await onAi(prompt);
                            if (generated?.length) replaceBlock(block.id, generated);
                        }}
                    />
                );
            default:
                return null;
        }
    };

    const blockMenu = (block: ListBlock, index: number): MenuItem[] => {
        const items: MenuItem[] = [];
        if (CONVERTIBLE.includes(block.type)) {
            items.push({
                id: 'turn',
                label: 'Turn into',
                icon: <Repeat2 size={13} />,
                submenu: TURN_INTO.map((t) => ({
                    id: `turn-${t.label}`,
                    label: t.label,
                    icon: <t.icon size={13} />,
                    onSelect: () => {
                        patchBlock(block.id, t.apply(block));
                        focusBlock(block.id, 'end');
                    },
                })),
            });
        }
        if (block.type === 'callout') {
            items.push({
                id: 'icon',
                label: 'Change icon',
                icon: <Smile size={13} />,
                onSelect: () => {
                    calloutAnchor.current = rootRef.current?.querySelector(`[data-block-id="${block.id}"] button`) ?? null;
                    setCalloutPicker(block.id);
                },
            });
        }
        if (block.type === 'table') {
            const rows = block.rows ?? [];
            const cols = Math.max(0, ...rows.map((r) => r.length));
            items.push(
                {
                    id: 'hdr',
                    label: 'Header row',
                    icon: <TableIcon size={13} />,
                    checked: !!block.headerRow,
                    onSelect: () => patchBlock(block.id, (b) => ({ ...b, headerRow: !b.headerRow })),
                },
                {
                    id: 'del-row',
                    label: 'Remove last row',
                    disabled: rows.length <= 1,
                    onSelect: () => patchBlock(block.id, (b) => ({ ...b, rows: (b.rows ?? []).slice(0, -1) })),
                },
                {
                    id: 'del-col',
                    label: 'Remove last column',
                    disabled: cols <= 1,
                    onSelect: () => patchBlock(block.id, (b) => ({ ...b, rows: (b.rows ?? []).map((r) => r.slice(0, -1)) })),
                },
            );
        }
        if (block.type === 'link' && block.link) {
            const url = block.link.url;
            items.push({
                id: 'refresh',
                label: 'Refresh preview',
                icon: <RefreshCw size={13} />,
                onSelect: () =>
                    void fetchLinkPreview(url).then((link) => patchBlock(block.id, (b) => ({ ...b, content: link.url, link }))),
            });
        }
        if ((block.type === 'image' || block.type === 'video' || block.type === 'audio' || block.type === 'link') && (block.url || block.attachment || block.link)) {
            items.push({
                id: 'replace',
                label: 'Replace',
                icon: <ImagePlus size={13} />,
                onSelect: () => patchBlock(block.id, (b) => ({ ...b, url: undefined, attachment: undefined, link: undefined, content: '' })),
            });
        }
        items.push(
            { id: 'dup', label: 'Duplicate', icon: <Copy size={13} />, onSelect: () => duplicate(block) },
            { id: 'up', label: 'Move up', icon: <ArrowUp size={13} />, disabled: index === 0, onSelect: () => moveBy(block.id, -1) },
            { id: 'down', label: 'Move down', icon: <ArrowDown size={13} />, disabled: index === blocks.length - 1, onSelect: () => moveBy(block.id, 1) },
            { type: 'separator', id: 'sep' },
            { id: 'del', label: 'Delete', icon: <Trash2 size={13} />, danger: true, onSelect: () => removeBlock(block.id) },
        );
        return items;
    };

    const emptyPage = isEmptyList(list);

    return (
        <div ref={rootRef} className="relative">
            <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) void runFileUpload(file);
                    else pendingFileBlock.current = null;
                }}
            />

            {/* Cover */}
            {list.cover && (
                <div className="group/cover relative h-[190px] w-full" style={coverStyle(list.cover)}>
                    <div className="absolute bottom-3 right-4 flex gap-1 opacity-0 transition-opacity group-hover/cover:opacity-100">
                        <button
                            ref={coverAnchor}
                            type="button"
                            onClick={() => setCoverOpen(true)}
                            className="h-7 rounded-md bg-[var(--fz-bg-overlay)]/90 px-2.5 text-[12.5px] text-[var(--fz-text-2)] shadow-sm backdrop-blur hover:text-[var(--fz-text-1)]"
                        >
                            Change cover
                        </button>
                        <button
                            type="button"
                            onClick={() => onChange((l) => ({ ...l, cover: undefined }))}
                            className="h-7 rounded-md bg-[var(--fz-bg-overlay)]/90 px-2.5 text-[12.5px] text-[var(--fz-text-2)] shadow-sm backdrop-blur hover:text-[var(--fz-text-1)]"
                        >
                            Remove
                        </button>
                    </div>
                </div>
            )}

            <div className="mx-auto w-full max-w-[760px] px-6 pb-8 md:px-16">
                {/* Icon + title */}
                <div className="group/header">
                    {list.icon ? (
                        <button
                            ref={iconAnchor}
                            type="button"
                            onClick={() => setIconOpen(true)}
                            className={`relative z-[1] flex size-[78px] items-center justify-center rounded-lg transition-colors hover:bg-[var(--fz-bg-hover)] ${
                                list.cover ? '-mt-[42px]' : 'mt-14'
                            }`}
                            aria-label="Change icon"
                        >
                            <PageIcon icon={list.icon} size={62} />
                        </button>
                    ) : null}
                    <div
                        className={`flex h-9 items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover/header:opacity-100 ${
                            list.icon || list.cover ? 'mt-2' : 'mt-14'
                        }`}
                    >
                        {!list.icon && (
                            <button
                                ref={iconAnchor}
                                type="button"
                                onClick={() => setIconOpen(true)}
                                className="flex h-7 items-center gap-1.5 rounded-md px-2 text-[13px] text-[var(--fz-text-3)] transition-colors hover:bg-[var(--fz-bg-hover)] hover:text-[var(--fz-text-2)]"
                            >
                                <Smile size={14} />
                                Add icon
                            </button>
                        )}
                        {!list.cover && (
                            <button
                                type="button"
                                onClick={() =>
                                    onChange((l) => ({ ...l, cover: `gradient:${COVERS[Math.floor(Math.random() * COVERS.length)].id}` }))
                                }
                                className="flex h-7 items-center gap-1.5 rounded-md px-2 text-[13px] text-[var(--fz-text-3)] transition-colors hover:bg-[var(--fz-bg-hover)] hover:text-[var(--fz-text-2)]"
                            >
                                <ImagePlus size={14} />
                                Add cover
                            </button>
                        )}
                    </div>
                    <AutoTextarea
                        value={list.title}
                        onChange={(e) => onChange((l) => ({ ...l, title: e.target.value.replace(/\n/g, ' ') }))}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === 'ArrowDown') {
                                e.preventDefault();
                                const first = blocks[0];
                                if (first) focusBlock(first.id, 'start');
                            }
                        }}
                        placeholder="Untitled"
                        aria-label="Page title"
                        data-title
                        className="mt-1 text-[40px] font-bold leading-[48px] tracking-[-0.025em] text-[var(--fz-text-1)] placeholder:text-[var(--fz-text-4)]"
                    />
                </div>

                {children}

                {/* Blocks */}
                <div className="mt-4">
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                        <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                            {blocks.map((block, index) => (
                                <BlockShell
                                    key={block.id}
                                    block={block}
                                    menuItems={() => blockMenu(block, index)}
                                    onPlus={() => openSlashAfter(block)}
                                >
                                    {renderBlock(block, index)}
                                </BlockShell>
                            ))}
                        </SortableContext>
                    </DndContext>
                </div>

                {/* Click the empty space below to keep writing */}
                <div
                    className="min-h-[120px] cursor-text"
                    onClick={() => {
                        const last = blocks[blocks.length - 1];
                        if (last && last.type === 'text' && !last.content) {
                            focusBlock(last.id, 'end');
                        } else {
                            const nb = newBlock('text');
                            setBlocks((bs) => [...bs, nb]);
                            focusBlock(nb.id, 'start');
                        }
                    }}
                />

                {emptyPage && templates.length > 0 && (
                    <div className="-mt-20 pb-10">
                        <p className="text-meta mb-2.5">Or start with a template</p>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {templates.map((t) => (
                                <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => onApplyTemplate(t.name, t.make())}
                                    className="rounded-lg border border-[var(--fz-border)] px-3.5 py-3 text-left transition-colors hover:border-[var(--fz-border-strong)] hover:bg-[var(--fz-bg-hover)]"
                                >
                                    <span className="flex items-center gap-2 text-[13px] font-medium text-[var(--fz-text-1)]">
                                        <span className="size-2 rounded-full" style={{ backgroundColor: t.accent }} />
                                        {t.name}
                                    </span>
                                    <span className="text-meta mt-1 block truncate">{t.description}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {slash && (
                <SlashMenu
                    rootRef={rootRef}
                    blockId={slash.blockId}
                    commands={commands}
                    query={slash.query}
                    activeIndex={Math.min(slashIndex, Math.max(0, commands.length - 1))}
                    onHover={setSlashIndex}
                    onPick={applyCommand}
                    onClose={() => setSlash(null)}
                />
            )}

            <EmojiPicker
                open={iconOpen}
                onClose={() => setIconOpen(false)}
                anchor={iconAnchor}
                onSelect={(icon) => onChange((l) => ({ ...l, icon }))}
                onRemove={list.icon ? () => onChange((l) => ({ ...l, icon: undefined })) : undefined}
            />
            <EmojiPicker
                open={!!calloutPicker}
                onClose={() => setCalloutPicker(null)}
                anchor={calloutAnchor}
                onSelect={(icon) => calloutPicker && patchBlock(calloutPicker, (b) => ({ ...b, icon }))}
            />
            <CoverPicker
                open={coverOpen}
                onClose={() => setCoverOpen(false)}
                anchor={coverAnchor}
                onPick={(cover) => onChange((l) => ({ ...l, cover }))}
            />
        </div>
    );
}

/* ── block shell: hover +, drag handle / menu ─────────────────────── */

function BlockShell({
    block,
    menuItems,
    onPlus,
    children,
}: {
    block: ListBlock;
    menuItems: () => MenuItem[];
    onPlus: () => void;
    children: ReactNode;
}) {
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
        id: block.id,
    });
    const [menuOpen, setMenuOpen] = useState(false);
    const handleRef = useRef<HTMLButtonElement | null>(null);

    const level = block.level ?? 2;
    const pad =
        block.type === 'heading'
            ? level === 1
                ? 'pt-7 pb-1'
                : level === 2
                  ? 'pt-5 pb-0.5'
                  : 'pt-3.5'
            : block.type === 'divider'
              ? 'py-0'
              : 'py-[3px]';
    const handleTop =
        block.type === 'heading'
            ? level === 1
                ? 35
                : level === 2
                  ? 24
                  : 16
            : block.type === 'callout'
              ? 17
              : block.type === 'divider'
                ? 8
                : 4;

    return (
        <div
            ref={setNodeRef}
            data-block-id={block.id}
            style={{ transform: CSS.Translate.toString(transform), transition }}
            className={`group/block relative ${pad} ${isDragging ? 'z-10 rounded-md bg-[var(--fz-bg-hover)] opacity-80' : ''}`}
        >
            <div
                className={`absolute -left-[50px] hidden items-center transition-opacity md:flex ${
                    menuOpen ? 'opacity-100' : 'opacity-0 group-hover/block:opacity-100'
                }`}
                style={{ top: handleTop }}
            >
                <button
                    type="button"
                    onClick={onPlus}
                    aria-label="Add a block below"
                    className="flex size-6 items-center justify-center rounded-md text-[var(--fz-text-4)] transition-colors hover:bg-[var(--fz-bg-hover)] hover:text-[var(--fz-text-2)]"
                >
                    <Plus size={16} />
                </button>
                <button
                    ref={(el) => {
                        handleRef.current = el;
                        setActivatorNodeRef(el);
                    }}
                    type="button"
                    {...attributes}
                    {...listeners}
                    onClick={() => setMenuOpen((v) => !v)}
                    aria-label="Drag to move, click for options"
                    className="flex h-6 w-5 cursor-grab items-center justify-center rounded-md text-[var(--fz-text-4)] transition-colors hover:bg-[var(--fz-bg-hover)] hover:text-[var(--fz-text-2)] active:cursor-grabbing"
                >
                    <GripVertical size={15} />
                </button>
            </div>
            {children}
            {menuOpen && <Menu open onClose={() => setMenuOpen(false)} anchor={handleRef} side="bottom" align="start" items={menuItems()} />}
        </div>
    );
}

/* ── to-do / bulleted / numbered ──────────────────────────────────── */

function ListItemsBlock({
    block,
    onChange,
    onExit,
    onBecomeText,
    onFocusPrev,
    onFocusNext,
}: {
    block: ListBlock;
    onChange: (b: ListBlock) => void;
    onExit: (text: string) => void;
    onBecomeText: () => void;
    onFocusPrev: () => void;
    onFocusNext: () => void;
}) {
    const wrapRef = useRef<HTMLDivElement>(null);
    const items = block.items?.length ? block.items : [{ id: newListId('item'), text: '', done: false }];
    const setItems = (next: ListChecklistItem[]) => onChange({ ...block, items: next });
    const focusItem = (id: string, pos?: number) =>
        requestAnimationFrame(() => {
            const el = wrapRef.current?.querySelector<HTMLInputElement>(`[data-item-id="${id}"]`);
            if (!el) return;
            el.focus();
            const p = pos ?? el.value.length;
            el.setSelectionRange(p, p);
        });

    return (
        <div ref={wrapRef}>
            {items.map((item, index) => (
                <div key={item.id} className="flex items-start gap-2 py-[1px]">
                    <span className="flex h-[26px] w-6 shrink-0 items-center justify-center">
                        {block.type === 'checklist' ? (
                            <Checkbox
                                checked={item.done}
                                onCheckedChange={(done) => setItems(items.map((c) => (c.id === item.id ? { ...c, done } : c)))}
                                aria-label={item.done ? 'Mark not done' : 'Mark done'}
                            />
                        ) : block.type === 'bullets' ? (
                            <span className="size-[5px] rounded-full bg-[var(--fz-text-1)]" />
                        ) : (
                            <span className="text-[15px] tabular-nums text-[var(--fz-text-1)]">{index + 1}.</span>
                        )}
                    </span>
                    <input
                        data-focus
                        data-item-id={item.id}
                        value={item.text}
                        onChange={(e) => setItems(items.map((c) => (c.id === item.id ? { ...c, text: e.target.value } : c)))}
                        onKeyDown={(e) => {
                            if (e.nativeEvent.isComposing) return;
                            const el = e.currentTarget;
                            const pos = el.selectionStart ?? 0;
                            const end = el.selectionEnd ?? 0;
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                if (!item.text) {
                                    // Empty item + Enter leaves the list, like Notion.
                                    const rest = items.filter((c) => c.id !== item.id);
                                    if (rest.length) setItems(rest);
                                    else onBecomeText();
                                    if (rest.length) onExit('');
                                    return;
                                }
                                const next = { id: newListId('item'), text: item.text.slice(end), done: false };
                                setItems([
                                    ...items.slice(0, index),
                                    { ...item, text: item.text.slice(0, pos) },
                                    next,
                                    ...items.slice(index + 1),
                                ]);
                                focusItem(next.id, 0);
                            } else if (e.key === 'Backspace' && pos === 0 && end === 0) {
                                if (index === 0 && !item.text) {
                                    e.preventDefault();
                                    if (items.length === 1) onBecomeText();
                                    else {
                                        setItems(items.slice(1));
                                        focusItem(items[1].id, 0);
                                    }
                                } else if (index > 0) {
                                    e.preventDefault();
                                    const prev = items[index - 1];
                                    setItems(
                                        items
                                            .map((c) => (c.id === prev.id ? { ...c, text: prev.text + item.text } : c))
                                            .filter((c) => c.id !== item.id),
                                    );
                                    focusItem(prev.id, prev.text.length);
                                }
                            } else if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                if (index > 0) focusItem(items[index - 1].id);
                                else onFocusPrev();
                            } else if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                if (index < items.length - 1) focusItem(items[index + 1].id);
                                else onFocusNext();
                            }
                        }}
                        placeholder={block.type === 'checklist' ? 'To-do' : 'List'}
                        className={`list-doc-field min-w-0 flex-1 bg-transparent py-[1px] text-[15.5px] leading-[24px] outline-none placeholder:text-transparent focus:placeholder:text-[var(--fz-text-4)] ${
                            block.type === 'checklist' && item.done
                                ? 'text-[var(--fz-text-4)] line-through decoration-[var(--fz-text-4)]'
                                : 'text-[var(--fz-text-1)]'
                        }`}
                    />
                </div>
            ))}
        </div>
    );
}

/* ── slash command menu ───────────────────────────────────────────── */

const GROUP_ORDER: CommandGroup[] = ['Basic blocks', 'Media', 'Advanced', 'AI'];

function SlashMenu({
    rootRef,
    blockId,
    commands,
    query,
    activeIndex,
    onHover,
    onPick,
    onClose,
}: {
    rootRef: RefObject<HTMLDivElement | null>;
    blockId: string;
    commands: BlockCommand[];
    query: string;
    activeIndex: number;
    onHover: (i: number) => void;
    onPick: (c: BlockCommand) => void;
    onClose: () => void;
}) {
    const panelRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

    useLayoutEffect(() => {
        let raf = 0;
        const place = () => {
            const field = rootRef.current?.querySelector<HTMLElement>(`[data-block-id="${blockId}"] [data-focus]`);
            if (!field) {
                raf = requestAnimationFrame(place);
                return;
            }
            const r = field.getBoundingClientRect();
            const h = panelRef.current?.offsetHeight ?? 300;
            const below = r.bottom + 6 + h < window.innerHeight - 8;
            setPos({
                top: below ? r.bottom + 6 : Math.max(8, r.top - h - 6),
                left: Math.min(r.left, window.innerWidth - 260),
            });
        };
        place();
        return () => cancelAnimationFrame(raf);
    }, [rootRef, blockId, query, commands.length]);

    useEffect(() => {
        panelRef.current?.querySelector(`[data-cmd-index="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' });
    }, [activeIndex]);

    useEffect(() => {
        const onDown = (e: MouseEvent) => {
            if (!panelRef.current?.contains(e.target as Node)) onClose();
        };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [onClose]);

    return createPortal(
        <div
            ref={panelRef}
            data-slash-menu
            className={`fixed z-[66] w-[248px] overflow-hidden rounded-lg border border-[var(--fz-border)] bg-[var(--fz-bg-overlay)] shadow-[var(--fz-shadow-overlay)] ${
                pos ? '' : 'opacity-0'
            }`}
            style={{ top: pos?.top ?? 0, left: pos?.left ?? 0 }}
            onMouseDown={(e) => e.preventDefault()}
        >
            <div className="cal-scroll max-h-[288px] overflow-y-auto p-1">
                {commands.length === 0 ? (
                    <p className="px-2.5 py-3 text-[13px] text-[var(--fz-text-3)]">No blocks match “{query}”.</p>
                ) : (
                    GROUP_ORDER.map((group) => {
                        const inGroup = commands.filter((c) => c.group === group);
                        if (!inGroup.length) return null;
                        return (
                            <div key={group}>
                                {!query && <p className="px-2 pb-0.5 pt-1.5 text-[11px] font-medium text-[var(--fz-text-4)]">{group}</p>}
                                {inGroup.map((cmd) => {
                                    const i = commands.indexOf(cmd);
                                    const Icon = cmd.icon;
                                    const active = i === activeIndex;
                                    return (
                                        <button
                                            key={cmd.id}
                                            type="button"
                                            data-cmd-index={i}
                                            onMouseEnter={() => onHover(i)}
                                            onClick={() => onPick(cmd)}
                                            title={cmd.hint}
                                            className={`flex h-7 w-full items-center gap-2 rounded-md px-2 text-left ${
                                                active ? 'bg-[var(--fz-bg-hover)]' : ''
                                            }`}
                                        >
                                            <Icon size={15} strokeWidth={1.75} className="shrink-0 text-[var(--fz-text-3)]" />
                                            <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--fz-text-1)]">{cmd.label}</span>
                                            {cmd.shortcut && (
                                                <span className="shrink-0 font-mono text-[11px] text-[var(--fz-text-4)]">{cmd.shortcut}</span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        );
                    })
                )}
            </div>
            <div className="flex items-center justify-between border-t border-[var(--fz-border)] px-2.5 py-1 text-[11px] text-[var(--fz-text-4)]">
                <span>↑↓ ↵ to insert</span>
                <span>esc</span>
            </div>
        </div>,
        document.body,
    );
}

/* ── cover picker ─────────────────────────────────────────────────── */

function CoverPicker({
    open,
    onClose,
    anchor,
    onPick,
}: {
    open: boolean;
    onClose: () => void;
    anchor: RefObject<HTMLElement | null>;
    onPick: (cover: string) => void;
}) {
    const [url, setUrl] = useState('');
    return (
        <Popover open={open} onClose={onClose} anchor={anchor} align="end" className="w-[340px] p-3">
            <p className="mb-2 text-[12px] font-medium text-[var(--fz-text-3)]">Gradients</p>
            <div className="grid grid-cols-4 gap-2">
                {COVERS.map((c) => (
                    <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                            onPick(`gradient:${c.id}`);
                            onClose();
                        }}
                        className="h-12 rounded-md transition-transform hover:scale-[1.04]"
                        style={{ backgroundImage: c.css }}
                        aria-label={`${c.id} cover`}
                    />
                ))}
            </div>
            <p className="mb-2 mt-4 text-[12px] font-medium text-[var(--fz-text-3)]">Image link</p>
            <form
                className="flex gap-2"
                onSubmit={(e) => {
                    e.preventDefault();
                    if (/^https?:\/\//i.test(url.trim())) {
                        onPick(url.trim());
                        onClose();
                    }
                }}
            >
                <input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://…"
                    className="h-8 min-w-0 flex-1 rounded-md border border-[var(--fz-border)] bg-[var(--fz-bg-panel)] px-2.5 text-[13px] text-[var(--fz-text-1)] outline-none placeholder:text-[var(--fz-text-4)] focus:border-[var(--fz-border-strong)]"
                />
                <button
                    type="submit"
                    disabled={!/^https?:\/\//i.test(url.trim())}
                    className="h-8 rounded-md bg-[var(--fz-accent)] px-3 text-[13px] font-medium text-[var(--fz-accent-fg)] disabled:opacity-40"
                >
                    Use
                </button>
            </form>
        </Popover>
    );
}

