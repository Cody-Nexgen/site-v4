import { useEffect, useRef, useState } from 'react';
import { CoachMarkdown } from './CoachMarkdown';
import {
    BarChart3,
    BookOpen,
    CalendarRange,
    Check,
    Copy,
    Download,
    ListChecks,
    MessageSquareText,
    NotebookPen,
    Pencil,
    Star,
    Sunrise,
    X,
    type LucideIcon,
} from 'lucide-react';
import { DOC_TYPE_LABEL, docFileName, type DocType } from '../../lib/coach/docBlocks';
import { downloadFile } from '../../lib/coach/library';

const DOC_TYPE_ICON: Record<DocType, LucideIcon> = {
    plan: CalendarRange,
    routine: Sunrise,
    study: BookOpen,
    checklist: ListChecks,
    notes: NotebookPen,
    report: BarChart3,
};

export type OpenDoc = {
    /** Library id when the doc is saved. */
    id?: string;
    title: string;
    docType: DocType;
    markdown: string;
    favorite?: boolean;
};

export function DocTypeTile({ docType, size = 36 }: { docType: DocType; size?: number }) {
    const Icon = DOC_TYPE_ICON[docType];
    return (
        <span
            className="flex shrink-0 items-center justify-center rounded-[10px] border border-[var(--fz-border)] text-[var(--fz-text-2)]"
            style={{
                width: size,
                height: size,
                background: 'linear-gradient(180deg, var(--fz-bg-overlay), var(--fz-bg-raised))',
                boxShadow: 'var(--fz-edge)',
            }}
        >
            <Icon size={Math.round(size * 0.44)} strokeWidth={1.6} />
        </span>
    );
}

/** Artifact card shown inline in a coach reply. */
export function CoachDocCard({
    title,
    docType,
    lines,
    writing,
    saved,
    onOpen,
}: {
    title: string;
    docType: DocType;
    lines: number;
    writing: boolean;
    saved: boolean;
    onOpen: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onOpen}
            disabled={writing}
            className="group my-3 flex w-full max-w-[480px] items-center gap-3 rounded-2xl border border-[var(--fz-border)] bg-[var(--fz-bg-raised)] p-2.5 pr-3 text-left transition-colors duration-150 hover:border-[var(--fz-border-strong)] disabled:cursor-default focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--fz-focus-ring)]"
            style={{ boxShadow: 'var(--fz-elev-card)' }}
        >
            <DocTypeTile docType={docType} size={40} />
            <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium leading-5 text-[var(--fz-text-1)]">
                    {title || 'Untitled document'}
                </span>
                <span className="mt-0.5 block truncate text-[12px] leading-4 text-[var(--fz-text-3)]">
                    {writing ? (
                        <span className="coach-thinking-shimmer">Writing document · {lines} lines</span>
                    ) : (
                        <>
                            {DOC_TYPE_LABEL[docType]} · {saved ? 'Saved to Library' : 'Document'}
                        </>
                    )}
                </span>
            </span>
            {!writing && (
                <span className="shrink-0 rounded-lg border border-[var(--fz-border)] px-2.5 py-1 text-[12px] font-medium text-[var(--fz-text-2)] transition-colors group-hover:border-[var(--fz-border-strong)] group-hover:text-[var(--fz-text-1)]">
                    Open
                </span>
            )}
        </button>
    );
}

/** Split-pane document viewer / editor (artifact panel). Key it by document so drafts reset. */
export function CoachDocViewer({
    doc,
    onClose,
    onChatAbout,
    onSave,
    onToggleFavorite,
}: {
    doc: OpenDoc;
    onClose: () => void;
    onChatAbout?: () => void;
    /** Persist edits (title/markdown). */
    onSave?: (next: { title: string; markdown: string }) => void;
    onToggleFavorite?: () => void;
}) {
    const [editing, setEditing] = useState(false);
    const [draftTitle, setDraftTitle] = useState(doc.title);
    const [draft, setDraft] = useState(doc.markdown);
    const [copied, setCopied] = useState(false);
    const areaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !editing) onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [editing, onClose]);

    useEffect(() => {
        if (editing) areaRef.current?.focus();
    }, [editing]);

    const finishEdit = () => {
        setEditing(false);
        const title = draftTitle.trim() || doc.title;
        if (title !== doc.title || draft !== doc.markdown) onSave?.({ title, markdown: draft });
    };

    const iconBtn =
        'flex size-8 items-center justify-center rounded-lg text-[var(--fz-text-3)] transition-colors hover:bg-[var(--fz-bg-hover)] hover:text-[var(--fz-text-1)] focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--fz-focus-ring)]';

    return (
        <div className="flex h-full min-h-0 flex-col bg-[var(--fz-bg-panel)]">
            <header className="flex h-12 shrink-0 items-center gap-2 border-b border-[var(--fz-border)] px-3">
                <DocTypeTile docType={doc.docType} size={26} />
                <div className="min-w-0 flex-1">
                    {editing ? (
                        <input
                            value={draftTitle}
                            onChange={(e) => setDraftTitle(e.target.value)}
                            className="h-7 w-full rounded-md border border-[var(--fz-border)] bg-[var(--fz-bg-raised)] px-2 text-[14px] font-medium text-[var(--fz-text-1)] outline-none focus:border-[var(--fz-border-strong)]"
                        />
                    ) : (
                        <>
                            <p className="truncate text-[14px] font-medium leading-4 text-[var(--fz-text-1)]">{doc.title}</p>
                            <p className="mt-0.5 text-[11px] leading-3 text-[var(--fz-text-4)]">{DOC_TYPE_LABEL[doc.docType]}</p>
                        </>
                    )}
                </div>
                {onToggleFavorite && doc.id && !editing && (
                    <button type="button" className={iconBtn} onClick={onToggleFavorite} aria-label={doc.favorite ? 'Remove from favorites' : 'Add to favorites'} title={doc.favorite ? 'Remove from favorites' : 'Add to favorites'}>
                        <Star size={15} strokeWidth={1.6} className={doc.favorite ? 'fill-current text-[var(--fz-text-1)]' : ''} />
                    </button>
                )}
                {onSave && (
                    <button
                        type="button"
                        className={editing ? 'flex h-8 items-center gap-1.5 rounded-lg bg-[var(--fz-accent)] px-3 text-[13px] font-medium text-[var(--fz-accent-fg)] hover:brightness-110' : iconBtn}
                        onClick={() => (editing ? finishEdit() : setEditing(true))}
                        aria-label={editing ? 'Done editing' : 'Edit document'}
                        title={editing ? 'Done' : 'Edit'}
                    >
                        {editing ? 'Done' : <Pencil size={15} strokeWidth={1.6} />}
                    </button>
                )}
                {!editing && (
                    <>
                        <button
                            type="button"
                            className={iconBtn}
                            aria-label="Copy markdown"
                            title="Copy"
                            onClick={() => {
                                void navigator.clipboard?.writeText(doc.markdown).then(() => {
                                    setCopied(true);
                                    window.setTimeout(() => setCopied(false), 1400);
                                });
                            }}
                        >
                            {copied ? <Check size={15} strokeWidth={1.8} /> : <Copy size={15} strokeWidth={1.6} />}
                        </button>
                        <button
                            type="button"
                            className={iconBtn}
                            aria-label="Download"
                            title="Download .md"
                            onClick={() =>
                                downloadFile(docFileName(doc.title), new Blob([doc.markdown], { type: 'text/markdown' }))
                            }
                        >
                            <Download size={15} strokeWidth={1.6} />
                        </button>
                    </>
                )}
                <button type="button" className={iconBtn} onClick={onClose} aria-label="Close document" title="Close">
                    <X size={16} strokeWidth={1.6} />
                </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto">
                {editing ? (
                    <textarea
                        ref={areaRef}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        spellCheck
                        className="block h-full min-h-full w-full resize-none bg-transparent px-8 py-7 font-mono text-[13px] leading-6 text-[var(--fz-text-1)] outline-none"
                    />
                ) : (
                    <article className="coach-doc-body coach-stream-body mx-auto max-w-[680px] px-8 pb-16 pt-8 text-[14.5px] leading-[1.7] text-[var(--fz-text-2)]">
                        <CoachMarkdown>{doc.markdown}</CoachMarkdown>
                    </article>
                )}
            </div>

            {onChatAbout && !editing && (
                <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-[var(--fz-border)] px-4 py-2.5">
                    <span className="text-[12px] text-[var(--fz-text-4)]">
                        {doc.markdown.split('\n').length} lines · {doc.id ? 'In your Library' : 'Not saved'}
                    </span>
                    <button
                        type="button"
                        onClick={onChatAbout}
                        className="flex h-8 items-center gap-1.5 rounded-lg border border-[var(--fz-border)] bg-[var(--fz-bg-raised)] px-3 text-[13px] font-medium text-[var(--fz-text-1)] transition-colors hover:border-[var(--fz-border-strong)] hover:bg-[var(--fz-bg-hover)]"
                    >
                        <MessageSquareText size={14} strokeWidth={1.6} />
                        Chat about this
                    </button>
                </footer>
            )}
        </div>
    );
}
