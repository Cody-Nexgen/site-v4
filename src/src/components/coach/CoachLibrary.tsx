import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
    ChevronDown,
    Download,
    Ellipsis,
    FilePlus2,
    ImagePlus,
    LayoutGrid,
    List,
    MessageSquareText,
    Pencil,
    Search,
    Sparkles,
    Star,
    Trash2,
    X,
} from 'lucide-react';
import { Menu, type MenuItem } from '../fz/Menu';
import { Dialog } from '../fz/Dialog';
import { Button } from '../fz/Button';
import { EASE, listStagger, reducedMotion } from '../../lib/motion';
import { DOC_TYPE_LABEL, docFileName, previewLines } from '../../lib/coach/docBlocks';
import {
    deleteLibraryItem,
    downloadFile,
    updateLibraryItem,
    type LibraryDocItem,
    type LibraryImageItem,
    type LibraryItem,
} from '../../lib/coach/library';
import { DocTypeTile } from './CoachDocs';

type Tab = 'all' | 'docs' | 'images' | 'favorites';
type View = 'grid' | 'list';

const TABS: { id: Tab; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'docs', label: 'Documents' },
    { id: 'images', label: 'Images' },
    { id: 'favorites', label: 'Favorites' },
];

const PAGE = 24;

const fmtDate = (ms: number) => {
    const d = new Date(ms);
    const sameYear = d.getFullYear() === new Date().getFullYear();
    return d.toLocaleDateString(undefined, sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
};

const glass = { background: 'color-mix(in oklch, var(--fz-bg-overlay) 80%, transparent)' } as const;

export type CoachLibraryProps = {
    items: LibraryItem[] | null;
    onOpenDoc: (doc: LibraryDocItem) => void;
    onChatAbout: (item: LibraryItem) => void;
    onUploadFiles: (files: File[]) => void;
    onNewBlankDoc: () => void;
    onAskCoach: (prompt: string) => void;
};

/** AI Coach Library — uploaded images + coach-written documents. */
export function CoachLibrary({ items, onOpenDoc, onChatAbout, onUploadFiles, onNewBlankDoc, onAskCoach }: CoachLibraryProps) {
    const [tab, setTab] = useState<Tab>('all');
    const [view, setView] = useState<View>(() => {
        try {
            return window.localStorage.getItem('focuznow-coach-library-view') === 'list' ? 'list' : 'grid';
        } catch {
            return 'grid';
        }
    });
    const [query, setQuery] = useState('');
    const [limit, setLimit] = useState(PAGE);
    const [menu, setMenu] = useState<{ item: LibraryItem; point: { x: number; y: number } } | null>(null);
    const [newOpen, setNewOpen] = useState(false);
    const [renaming, setRenaming] = useState<LibraryItem | null>(null);
    const [renameDraft, setRenameDraft] = useState('');
    const [deleting, setDeleting] = useState<LibraryItem | null>(null);
    const [lightbox, setLightbox] = useState<LibraryImageItem | null>(null);
    const newRef = useRef<HTMLButtonElement>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const RM = reducedMotion.matches();

    useEffect(() => {
        try {
            window.localStorage.setItem('focuznow-coach-library-view', view);
        } catch {
            /* ignore */
        }
    }, [view]);

    const counts = useMemo(() => {
        const all = items ?? [];
        return {
            all: all.length,
            docs: all.filter((i) => i.kind === 'doc').length,
            images: all.filter((i) => i.kind === 'image').length,
            favorites: all.filter((i) => i.favorite).length,
        };
    }, [items]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return (items ?? []).filter((i) => {
            if (tab === 'docs' && i.kind !== 'doc') return false;
            if (tab === 'images' && i.kind !== 'image') return false;
            if (tab === 'favorites' && !i.favorite) return false;
            if (!q) return true;
            return i.title.toLowerCase().includes(q) || (i.kind === 'doc' && i.markdown.toLowerCase().includes(q));
        });
    }, [items, tab, query]);
    const shown = filtered.slice(0, limit);

    const openItem = (item: LibraryItem) => (item.kind === 'doc' ? onOpenDoc(item) : setLightbox(item));
    const openMenu = (item: LibraryItem, el: HTMLElement) => {
        const r = el.getBoundingClientRect();
        setMenu({ item, point: { x: r.right - 200, y: r.bottom + 6 } });
    };
    const download = (item: LibraryItem) =>
        item.kind === 'doc'
            ? downloadFile(docFileName(item.title), new Blob([item.markdown], { type: 'text/markdown' }))
            : downloadFile(`${docFileName(item.title, 'jpg')}`, item.dataUrl);

    const menuItems = (item: LibraryItem): MenuItem[] => [
        { id: 'chat', label: 'Chat about this', icon: <MessageSquareText size={15} strokeWidth={1.6} />, onSelect: () => onChatAbout(item) },
        {
            id: 'fav',
            label: item.favorite ? 'Remove from Favorites' : 'Add to Favorites',
            icon: <Star size={15} strokeWidth={1.6} />,
            onSelect: () => void updateLibraryItem(item.id, { favorite: !item.favorite }),
        },
        { id: 'dl', label: 'Download', icon: <Download size={15} strokeWidth={1.6} />, onSelect: () => download(item) },
        {
            id: 'rename',
            label: 'Rename',
            icon: <Pencil size={15} strokeWidth={1.6} />,
            onSelect: () => {
                setRenameDraft(item.title);
                setRenaming(item);
            },
        },
        { type: 'separator', id: 'sep' },
        { id: 'delete', label: 'Delete', danger: true, icon: <Trash2 size={15} strokeWidth={1.6} />, onSelect: () => setDeleting(item) },
    ];

    const newItems: MenuItem[] = [
        { id: 'upload', label: 'Upload image', icon: <ImagePlus size={15} strokeWidth={1.6} />, onSelect: () => fileRef.current?.click() },
        { id: 'blank', label: 'Blank document', icon: <FilePlus2 size={15} strokeWidth={1.6} />, onSelect: onNewBlankDoc },
        { type: 'separator', id: 'sep' },
        { type: 'label', id: 'ask', label: 'Ask your coach' },
        { id: 'plan', label: 'Weekly focus plan', icon: <Sparkles size={15} strokeWidth={1.6} />, onSelect: () => onAskCoach('Create a document with my focus plan for this week — deep-work blocks, priorities, and what to block.') },
        { id: 'study', label: 'Study plan', icon: <Sparkles size={15} strokeWidth={1.6} />, onSelect: () => onAskCoach('Create a study plan document for this week with spaced sessions and breaks.') },
        { id: 'routine', label: 'Morning routine', icon: <Sparkles size={15} strokeWidth={1.6} />, onSelect: () => onAskCoach('Create a morning routine document that sets me up for a focused day.') },
    ];

    const onFile = (e: ChangeEvent<HTMLInputElement>) => {
        const files = [...(e.target.files ?? [])].filter((f) => f.type.startsWith('image/'));
        e.target.value = '';
        if (files.length) onUploadFiles(files);
    };

    const tileIn = (i: number) =>
        RM
            ? {}
            : {
                  initial: { opacity: 0, y: 8 },
                  animate: { opacity: 1, y: 0 },
                  transition: reducedMotion.safe({ delay: listStagger(i), duration: 0.32, ease: [...EASE.out] }),
              };

    const moreBtn = (item: LibraryItem, cls = '') => (
        <button
            type="button"
            aria-label={`Options for ${item.title}`}
            onClick={(e) => {
                e.stopPropagation();
                openMenu(item, e.currentTarget);
            }}
            data-open={menu?.item.id === item.id || undefined}
            className={`flex size-8 items-center justify-center rounded-full border border-[var(--fz-border)] text-[var(--fz-text-2)] backdrop-blur transition-opacity duration-150 hover:text-[var(--fz-text-1)] focus-visible:opacity-100 focus-visible:outline-none data-[open]:opacity-100 ${cls}`}
            style={glass}
        >
            <Ellipsis size={16} strokeWidth={1.8} />
        </button>
    );

    return (
        <div className="mx-auto w-full max-w-[1180px] px-4 pb-16 pt-5 sm:px-6">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-[22px] font-semibold tracking-[-0.015em] text-[var(--fz-text-1)]">Library</h1>
                <div className="flex items-center gap-2">
                    <div className="flex rounded-lg border border-[var(--fz-border)] bg-[var(--fz-bg-raised)] p-0.5" role="group" aria-label="View">
                        {(['grid', 'list'] as View[]).map((v) => (
                            <button
                                key={v}
                                type="button"
                                aria-label={v === 'grid' ? 'Grid view' : 'List view'}
                                aria-pressed={view === v}
                                onClick={() => setView(v)}
                                className="flex size-7 items-center justify-center rounded-md text-[var(--fz-text-3)] transition-colors hover:text-[var(--fz-text-1)] aria-pressed:bg-[var(--fz-bg-active)] aria-pressed:text-[var(--fz-text-1)] aria-pressed:shadow-[var(--fz-edge)]"
                            >
                                {v === 'grid' ? <LayoutGrid size={14} strokeWidth={1.6} /> : <List size={15} strokeWidth={1.6} />}
                            </button>
                        ))}
                    </div>
                    <label className="flex h-8 w-44 items-center gap-2 rounded-full border border-[var(--fz-border)] bg-[var(--fz-bg-raised)] px-3 text-[var(--fz-text-4)] transition-colors focus-within:border-[var(--fz-border-strong)] sm:w-60">
                        <Search size={14} strokeWidth={1.6} className="shrink-0" />
                        <input
                            value={query}
                            onChange={(e) => {
                                setQuery(e.target.value);
                                setLimit(PAGE);
                            }}
                            onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
                            placeholder="Search library"
                            className="min-w-0 flex-1 bg-transparent text-[13px] text-[var(--fz-text-1)] outline-none placeholder:text-[var(--fz-text-4)]"
                        />
                    </label>
                    <button
                        ref={newRef}
                        type="button"
                        onClick={() => setNewOpen((v) => !v)}
                        aria-expanded={newOpen}
                        className="flex h-8 items-center gap-1 rounded-full bg-[var(--fz-accent)] pl-3.5 pr-2.5 text-[13px] font-medium text-[var(--fz-accent-fg)] transition-[filter] hover:brightness-110 focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--fz-focus-ring)]"
                        style={{ boxShadow: 'var(--fz-btn-edge)' }}
                    >
                        New
                        <ChevronDown size={14} strokeWidth={1.8} className={`transition-transform ${newOpen ? 'rotate-180' : ''}`} />
                    </button>
                    <Menu open={newOpen} onClose={() => setNewOpen(false)} anchor={newRef} items={newItems} align="end" minWidth={220} className="z-[70]" />
                    <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onFile} />
                </div>
            </div>

            {/* Tabs */}
            <div className="mt-4 flex items-center gap-1 overflow-x-auto" role="tablist" aria-label="Library filter">
                {TABS.map((t) => (
                    <button
                        key={t.id}
                        type="button"
                        role="tab"
                        aria-selected={tab === t.id}
                        onClick={() => {
                            setTab(t.id);
                            setLimit(PAGE);
                        }}
                        className="flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium text-[var(--fz-text-3)] transition-colors hover:text-[var(--fz-text-1)] aria-selected:bg-[var(--fz-bg-active)] aria-selected:text-[var(--fz-text-1)] aria-selected:shadow-[var(--fz-edge)]"
                    >
                        {t.label}
                        {counts[t.id] > 0 && <span className="text-[11px] tabular-nums text-[var(--fz-text-4)]">{counts[t.id]}</span>}
                    </button>
                ))}
            </div>

            {/* Body */}
            <div className="mt-5">
                {items === null ? (
                    <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4">
                        {Array.from({ length: 8 }, (_, i) => (
                            <div key={i} className="h-44 animate-pulse rounded-2xl bg-[var(--fz-bg-raised)]" />
                        ))}
                    </div>
                ) : shown.length === 0 ? (
                    <EmptyLibrary
                        tab={tab}
                        searching={Boolean(query.trim())}
                        onUpload={() => fileRef.current?.click()}
                        onAskPlan={() => onAskCoach('Create a document with my focus plan for this week — deep-work blocks, priorities, and what to block.')}
                    />
                ) : view === 'grid' ? (
                    <div style={{ columnWidth: 212, columnGap: 14 }}>
                        {shown.map((item, i) =>
                            item.kind === 'image' ? (
                                <motion.div
                                    key={item.id}
                                    {...tileIn(i)}
                                    className="group relative mb-3.5 cursor-zoom-in break-inside-avoid overflow-hidden rounded-2xl border border-[var(--fz-border)] bg-[var(--fz-bg-raised)]"
                                    onClick={() => setLightbox(item)}
                                >
                                    <img
                                        src={item.dataUrl}
                                        alt={item.title}
                                        loading="lazy"
                                        className="block h-auto w-full transition-transform duration-500 ease-out group-hover:scale-[1.02]"
                                        style={item.width && item.height ? { aspectRatio: `${item.width} / ${item.height}` } : undefined}
                                    />
                                    <div className="absolute right-2 top-2">{moreBtn(item, 'opacity-0 group-hover:opacity-100')}</div>
                                    {item.favorite && <FavBadge />}
                                </motion.div>
                            ) : (
                                <motion.div
                                    key={item.id}
                                    {...tileIn(i)}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => onOpenDoc(item)}
                                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpenDoc(item))}
                                    className="group relative mb-3.5 cursor-pointer break-inside-avoid overflow-hidden rounded-2xl border border-[var(--fz-border)] bg-[var(--fz-bg-raised)] transition-colors duration-150 hover:border-[var(--fz-border-strong)] focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--fz-focus-ring)]"
                                    style={{ boxShadow: 'var(--fz-elev-card)' }}
                                >
                                    <DocPage doc={item} />
                                    <div className="flex items-center gap-2.5 px-3 pb-3 pt-2.5">
                                        <DocTypeTile docType={item.docType} size={28} />
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-[13.5px] font-medium leading-4 text-[var(--fz-text-1)]">{item.title}</p>
                                            <p className="mt-1 truncate text-[11.5px] leading-3 text-[var(--fz-text-4)]">
                                                {DOC_TYPE_LABEL[item.docType]} · {fmtDate(item.updatedAt)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="absolute right-2 top-2">{moreBtn(item, 'opacity-0 group-hover:opacity-100')}</div>
                                    {item.favorite && <FavBadge />}
                                </motion.div>
                            ),
                        )}
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-2xl border border-[var(--fz-border)] bg-[var(--fz-bg-panel)]" style={{ boxShadow: 'var(--fz-edge)' }}>
                        {shown.map((item, i) => (
                            <motion.div
                                key={item.id}
                                {...tileIn(i)}
                                role="button"
                                tabIndex={0}
                                onClick={() => openItem(item)}
                                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), openItem(item))}
                                className="group flex cursor-pointer items-center gap-3 border-t border-[var(--fz-border)] px-3 py-2.5 transition-colors first:border-t-0 hover:bg-[var(--fz-bg-hover)] focus-visible:bg-[var(--fz-bg-hover)] focus-visible:outline-none"
                            >
                                {item.kind === 'image' ? (
                                    <img src={item.dataUrl} alt="" className="size-10 shrink-0 rounded-[10px] border border-[var(--fz-border)] object-cover" />
                                ) : (
                                    <DocTypeTile docType={item.docType} size={40} />
                                )}
                                <div className="min-w-0 flex-1">
                                    <p className="flex items-center gap-1.5 truncate text-[14px] font-medium text-[var(--fz-text-1)]">
                                        <span className="truncate">{item.title}</span>
                                        {item.favorite && <Star size={12} strokeWidth={1.8} className="shrink-0 fill-current text-[var(--fz-text-3)]" />}
                                    </p>
                                    <p className="mt-0.5 truncate text-[12px] text-[var(--fz-text-4)]">
                                        {item.kind === 'doc'
                                            ? `${DOC_TYPE_LABEL[item.docType]} · ${previewLines(item.markdown, 2).slice(1).join(' ') || 'Document'}`
                                            : `Image${item.width ? ` · ${item.width}×${item.height}` : ''}`}
                                    </p>
                                </div>
                                <span className="hidden shrink-0 text-[12px] tabular-nums text-[var(--fz-text-4)] sm:block">{fmtDate(item.updatedAt)}</span>
                                {moreBtn(item, 'opacity-60 group-hover:opacity-100')}
                            </motion.div>
                        ))}
                    </div>
                )}

                {filtered.length > shown.length && (
                    <div className="mt-6 flex justify-center">
                        <button
                            type="button"
                            onClick={() => setLimit((l) => l + PAGE)}
                            className="h-9 rounded-full border border-[var(--fz-border)] bg-[var(--fz-bg-raised)] px-4 text-[13px] font-medium text-[var(--fz-text-1)] transition-colors hover:border-[var(--fz-border-strong)] hover:bg-[var(--fz-bg-hover)]"
                            style={{ boxShadow: 'var(--fz-edge)' }}
                        >
                            Load more
                        </button>
                    </div>
                )}
            </div>

            <Menu
                open={Boolean(menu)}
                onClose={() => setMenu(null)}
                point={menu?.point}
                items={menu ? menuItems(menu.item) : []}
                minWidth={200}
                className="z-[70]"
            />

            <Dialog
                open={Boolean(renaming)}
                onClose={() => setRenaming(null)}
                title="Rename"
                size="sm"
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setRenaming(null)}>
                            Cancel
                        </Button>
                        <Button
                            variant="primary"
                            onClick={() => {
                                const t = renameDraft.trim();
                                if (renaming && t) void updateLibraryItem(renaming.id, { title: t.slice(0, 120) });
                                setRenaming(null);
                            }}
                        >
                            Save
                        </Button>
                    </>
                }
            >
                <input
                    autoFocus
                    value={renameDraft}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && renaming && renameDraft.trim()) {
                            void updateLibraryItem(renaming.id, { title: renameDraft.trim().slice(0, 120) });
                            setRenaming(null);
                        }
                    }}
                    className="h-9 w-full rounded-lg border border-[var(--fz-border)] bg-[var(--fz-bg-raised)] px-3 text-[14px] text-[var(--fz-text-1)] outline-none focus:border-[var(--fz-border-strong)]"
                />
            </Dialog>

            <Dialog
                open={Boolean(deleting)}
                onClose={() => setDeleting(null)}
                title={deleting?.kind === 'image' ? 'Delete image' : 'Delete document'}
                size="sm"
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setDeleting(null)}>
                            Cancel
                        </Button>
                        <Button
                            variant="danger-solid"
                            onClick={() => {
                                if (deleting) void deleteLibraryItem(deleting.id);
                                if (lightbox?.id === deleting?.id) setLightbox(null);
                                setDeleting(null);
                            }}
                        >
                            Delete
                        </Button>
                    </>
                }
            >
                <p className="text-[14px] text-[var(--fz-text-2)]">
                    “{deleting?.title}” will be removed from your Library.
                </p>
            </Dialog>

            <Lightbox
                item={lightbox}
                onClose={() => setLightbox(null)}
                onDownload={(it) => download(it)}
                onChat={(it) => {
                    setLightbox(null);
                    onChatAbout(it);
                }}
            />
        </div>
    );
}

function FavBadge() {
    return (
        <span
            className="pointer-events-none absolute left-2 top-2 flex size-6 items-center justify-center rounded-full border border-[var(--fz-border)] text-[var(--fz-text-1)] backdrop-blur"
            style={glass}
            aria-label="Favorite"
        >
            <Star size={11} strokeWidth={1.8} className="fill-current" />
        </span>
    );
}

/** Miniature "page" preview for document tiles. */
function DocPage({ doc }: { doc: LibraryDocItem }) {
    const lines = previewLines(doc.markdown, 11);
    const [head, ...rest] = lines[0] === doc.title ? lines : [doc.title, ...lines];
    return (
        <div className="relative px-3 pt-3">
            <div
                className="relative h-[168px] overflow-hidden rounded-t-[10px] border border-b-0 border-[var(--fz-border)] bg-[var(--fz-bg-panel)] px-3.5 pt-3.5"
                style={{ boxShadow: 'var(--fz-edge)' }}
            >
                <p className="truncate text-[11.5px] font-semibold text-[var(--fz-text-1)]">{head}</p>
                <div className="mt-1.5 space-y-[3px]">
                    {rest.map((l, i) => (
                        <p key={i} className="truncate text-[10px] leading-[1.45] text-[var(--fz-text-3)]">
                            {l}
                        </p>
                    ))}
                </div>
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-14"
                    style={{ background: 'linear-gradient(180deg, transparent, var(--fz-bg-raised))' }}
                />
            </div>
            <div className="h-px bg-[var(--fz-border)]" />
        </div>
    );
}

function EmptyLibrary({
    tab,
    searching,
    onUpload,
    onAskPlan,
}: {
    tab: Tab;
    searching: boolean;
    onUpload: () => void;
    onAskPlan: () => void;
}) {
    const copy: Record<Tab, { title: string; body: string }> = {
        all: { title: 'Your Library is empty', body: 'Images you attach and documents your coach writes — focus plans, routines, study guides — collect here.' },
        docs: { title: 'No documents yet', body: 'Ask your coach for a focus plan, routine or study guide and it’ll be saved here as a document.' },
        images: { title: 'No images yet', body: 'Screenshots you attach in chat or upload here show up in this tab.' },
        favorites: { title: 'No favorites yet', body: 'Star documents and images from their ••• menu to keep them close.' },
    };
    const { title, body } = searching ? { title: 'No matches', body: 'Try a different search.' } : copy[tab];
    const actions: ReactNode =
        searching || tab === 'favorites' ? null : (
            <div className="mt-5 flex items-center justify-center gap-2">
                {tab !== 'docs' && (
                    <Button variant="secondary" iconLeft={<ImagePlus size={14} strokeWidth={1.6} />} onClick={onUpload}>
                        Upload image
                    </Button>
                )}
                {tab !== 'images' && (
                    <Button variant="primary" iconLeft={<Sparkles size={14} strokeWidth={1.6} />} onClick={onAskPlan}>
                        Create a focus plan
                    </Button>
                )}
            </div>
        );
    return (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-[var(--fz-border)] px-6 py-16 text-center">
            <div className="relative mb-4 h-12 w-16">
                <span className="absolute left-0 top-1 h-11 w-9 -rotate-6 rounded-lg border border-[var(--fz-border)] bg-[var(--fz-bg-raised)]" style={{ boxShadow: 'var(--fz-edge)' }} />
                <span className="absolute right-0 top-0 h-11 w-9 rotate-6 rounded-lg border border-[var(--fz-border-strong)] bg-[var(--fz-bg-overlay)]" style={{ boxShadow: 'var(--fz-elev-card)' }}>
                    <span className="mx-2 mt-2.5 block h-1 rounded-full bg-[var(--fz-border-strong)]" />
                    <span className="mx-2 mt-1 block h-1 w-3 rounded-full bg-[var(--fz-border)]" />
                </span>
            </div>
            <p className="text-[15px] font-medium text-[var(--fz-text-1)]">{title}</p>
            <p className="mt-1 max-w-sm text-[13px] leading-5 text-[var(--fz-text-3)]">{body}</p>
            {actions}
        </div>
    );
}

function Lightbox({
    item,
    onClose,
    onDownload,
    onChat,
}: {
    item: LibraryImageItem | null;
    onClose: () => void;
    onDownload: (item: LibraryImageItem) => void;
    onChat: (item: LibraryImageItem) => void;
}) {
    useEffect(() => {
        if (!item) return;
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [item, onClose]);
    const RM = reducedMotion.matches();
    const btn =
        'flex h-8 items-center gap-1.5 rounded-lg border border-[var(--fz-border)] px-3 text-[13px] font-medium text-[var(--fz-text-1)] backdrop-blur transition-colors hover:border-[var(--fz-border-strong)]';
    return createPortal(
        <AnimatePresence>
            {item && (
                <motion.div
                    key={item.id}
                    className="fixed inset-0 z-[80] flex flex-col bg-[var(--fz-scrim)] backdrop-blur-md"
                    initial={RM ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: RM ? 0.08 : 0.18 }}
                    onClick={onClose}
                    role="dialog"
                    aria-label={item.title}
                >
                    <div className="flex h-14 shrink-0 items-center gap-2 px-4" onClick={(e) => e.stopPropagation()}>
                        <p className="min-w-0 flex-1 truncate text-[14px] font-medium text-[var(--fz-text-1)]">{item.title}</p>
                        <button type="button" className={btn} style={glass} onClick={() => onChat(item)}>
                            <MessageSquareText size={14} strokeWidth={1.6} />
                            Chat about this
                        </button>
                        <button type="button" className={btn} style={glass} onClick={() => onDownload(item)} aria-label="Download">
                            <Download size={14} strokeWidth={1.6} />
                        </button>
                        <button type="button" className={btn} style={glass} onClick={onClose} aria-label="Close">
                            <X size={15} strokeWidth={1.6} />
                        </button>
                    </div>
                    <div className="flex min-h-0 flex-1 items-center justify-center px-6 pb-8">
                        <motion.img
                            src={item.dataUrl}
                            alt={item.title}
                            onClick={(e) => e.stopPropagation()}
                            initial={RM ? false : { scale: 0.97, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.24, ease: [...EASE.out] }}
                            className="max-h-full max-w-full rounded-xl border border-[var(--fz-border)] object-contain"
                            style={{ boxShadow: 'var(--fz-shadow-overlay)' }}
                        />
                    </div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body,
    );
}
