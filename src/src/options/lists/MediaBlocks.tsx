import { useState, type ReactNode } from 'react';
import { Highlight, themes, type Language } from 'prism-react-renderer';
import {
    AppWindow,
    AudioLines,
    Check,
    Code2,
    Copy,
    Download,
    FileSymlink,
    FileText,
    Film,
    Image as ImageIcon,
    Link as LinkIcon,
    Loader2,
    Paperclip,
    Pencil,
    Plus,
    Search,
    Sparkles,
    Trash2,
    Upload,
    Video,
} from 'lucide-react';
import { deleteAttachment, downloadAttachment, type AttachmentRecord } from '../../lib/attachmentApi';
import { fetchLinkPreview, type LinkPreview } from '../../lib/linkPreviewApi';
import type { ListBlock, SavedList } from '../../lib/listTypes';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/fz/Button';
import { IconButton } from '../../components/fz/IconButton';
import { PageIcon } from './EmojiPicker';
import { AudioPlayer } from './AudioPlayer';
import { useAttachmentUrl, videoEmbedUrl } from './editorUtils';

export type BlockProps = {
    block: ListBlock;
    onChange: (next: ListBlock) => void;
};

export type UploadProps = {
    isPro: boolean;
    onUpload: (file: File) => Promise<AttachmentRecord | null>;
    onError: (message: string) => void;
};

/* ── shared ─────────────────────────────────────────────────────────── */

function formatBytes(n: number) {
    return n >= 1024 * 1024 ? `${(n / (1024 * 1024)).toFixed(1)} MB` : `${(n / 1024).toFixed(1)} KB`;
}

function Caption({ block, onChange }: BlockProps) {
    return (
        <input
            value={block.caption ?? ''}
            onChange={(e) => onChange({ ...block, caption: e.target.value })}
            placeholder="Add a caption"
            className="list-doc-field mt-1.5 w-full bg-transparent text-[13px] text-[var(--fz-text-3)] outline-none placeholder:text-transparent focus:placeholder:text-[var(--fz-text-4)] group-hover/block:placeholder:text-[var(--fz-text-4)]"
        />
    );
}

/**
 * Empty media block: "Add an image" row that opens Upload / Embed link,
 * like Notion's placeholder.
 */
function MediaPlaceholder({
    icon,
    label,
    accept,
    linkHint,
    onLink,
    isPro,
    onUpload,
    onError,
    onUploaded,
}: UploadProps & {
    icon: ReactNode;
    label: string;
    accept: string;
    linkHint: string;
    onLink: (url: string) => void;
    onUploaded: (record: AttachmentRecord) => void;
}) {
    const [open, setOpen] = useState(false);
    const [mode, setMode] = useState<'upload' | 'link'>('link');
    const [url, setUrl] = useState('');
    const [busy, setBusy] = useState(false);

    return (
        <div className="rounded-lg bg-[var(--fz-bg-hover)]">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="flex h-12 w-full items-center gap-3 px-4 text-left text-[14px] text-[var(--fz-text-3)] transition-colors hover:text-[var(--fz-text-2)]"
            >
                <span className="text-[var(--fz-text-3)]">{icon}</span>
                {label}
            </button>
            {open && (
                <div className="border-t border-[var(--fz-border)] px-4 pb-4 pt-2">
                    <div className="mb-3 flex gap-4">
                        {(['link', 'upload'] as const).map((m) => (
                            <button
                                key={m}
                                type="button"
                                onClick={() => setMode(m)}
                                className={`relative h-8 text-[13px] ${
                                    mode === m ? 'font-medium text-[var(--fz-text-1)]' : 'text-[var(--fz-text-3)] hover:text-[var(--fz-text-2)]'
                                }`}
                            >
                                {m === 'link' ? 'Embed link' : 'Upload'}
                                {mode === m && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[var(--fz-text-1)]" />}
                            </button>
                        ))}
                    </div>
                    {mode === 'link' ? (
                        <form
                            className="flex gap-2"
                            onSubmit={(e) => {
                                e.preventDefault();
                                const v = url.trim();
                                if (!/^https?:\/\//i.test(v)) {
                                    onError('Paste a full link that starts with https://');
                                    return;
                                }
                                onLink(v);
                            }}
                        >
                            <input
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder={linkHint}
                                autoFocus
                                className="h-8 min-w-0 flex-1 rounded-md border border-[var(--fz-border)] bg-[var(--fz-bg-panel)] px-2.5 text-[13px] text-[var(--fz-text-1)] outline-none placeholder:text-[var(--fz-text-4)] focus:border-[var(--fz-border-strong)]"
                            />
                            <Button type="submit" variant="primary" size="sm" disabled={!url.trim()}>
                                Embed
                            </Button>
                        </form>
                    ) : isPro ? (
                        <label className="flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-[var(--fz-border)] bg-[var(--fz-bg-panel)] text-[13px] text-[var(--fz-text-2)] transition-colors hover:border-[var(--fz-border-strong)]">
                            {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                            {busy ? 'Uploading…' : 'Choose a file'}
                            <input
                                type="file"
                                accept={accept}
                                className="hidden"
                                disabled={busy}
                                onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    e.target.value = '';
                                    if (!file) return;
                                    setBusy(true);
                                    const record = await onUpload(file);
                                    setBusy(false);
                                    if (record) onUploaded(record);
                                }}
                            />
                        </label>
                    ) : (
                        <p className="text-[13px] text-[var(--fz-text-3)]">
                            Uploading files is a Pro feature — you can still embed a link.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}

/* ── image ──────────────────────────────────────────────────────────── */

export function ImageBlock({ block, onChange, ...upload }: BlockProps & UploadProps) {
    const signed = useAttachmentUrl(block.attachment);
    const src = block.url || signed;
    if (!block.url && !block.attachment) {
        return (
            <MediaPlaceholder
                {...upload}
                icon={<ImageIcon size={18} />}
                label="Add an image"
                accept="image/*"
                linkHint="Paste an image link…"
                onLink={(url) => onChange({ ...block, url })}
                onUploaded={(attachment) => onChange({ ...block, attachment })}
            />
        );
    }
    return (
        <figure>
            {src ? (
                <img src={src} alt={block.caption || ''} className="max-h-[520px] w-full rounded-md object-contain" />
            ) : (
                <div className="flex h-40 items-center justify-center rounded-md bg-[var(--fz-bg-hover)]">
                    <Loader2 size={16} className="animate-spin text-[var(--fz-text-4)]" />
                </div>
            )}
            <Caption block={block} onChange={onChange} />
        </figure>
    );
}

/* ── video ──────────────────────────────────────────────────────────── */

export function VideoBlock({ block, onChange, ...upload }: BlockProps & UploadProps) {
    const signed = useAttachmentUrl(block.attachment);
    if (!block.url && !block.attachment) {
        return (
            <MediaPlaceholder
                {...upload}
                icon={<Video size={18} />}
                label="Embed or upload a video"
                accept="video/*"
                linkHint="YouTube, Vimeo, Loom or a .mp4 link…"
                onLink={(url) => onChange({ ...block, url })}
                onUploaded={(attachment) => onChange({ ...block, attachment })}
            />
        );
    }
    const embed = block.url ? videoEmbedUrl(block.url) : null;
    return (
        <figure>
            <div className="overflow-hidden rounded-md bg-black">
                {embed ? (
                    <iframe
                        src={embed}
                        title={block.caption || 'Video'}
                        className="aspect-video w-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                        allowFullScreen
                    />
                ) : (
                    <video src={block.url || signed} controls preload="metadata" className="max-h-[480px] w-full" />
                )}
            </div>
            <Caption block={block} onChange={onChange} />
        </figure>
    );
}

/* ── audio ──────────────────────────────────────────────────────────── */

export function AudioBlock({ block, onChange, ...upload }: BlockProps & UploadProps) {
    const signed = useAttachmentUrl(block.attachment);
    if (!block.url && !block.attachment) {
        return (
            <MediaPlaceholder
                {...upload}
                icon={<AudioLines size={18} />}
                label="Add an audio file"
                accept="audio/*"
                linkHint="Paste a link to an .mp3, .wav…"
                onLink={(url) => onChange({ ...block, url })}
                onUploaded={(attachment) => onChange({ ...block, attachment })}
            />
        );
    }
    const attachment = block.attachment;
    return (
        <figure>
            <AudioPlayer
                src={block.url || signed}
                cacheKey={attachment?.storagePath ?? block.url ?? block.id}
                name={attachment?.fileName ?? block.url ?? 'Audio'}
                sizeBytes={attachment?.sizeBytes}
                href={block.url}
                onDownload={
                    attachment
                        ? () =>
                              void downloadAttachment(supabase, attachment).then((r) => {
                                  if ('error' in r) upload.onError(r.error);
                              })
                        : undefined
                }
            />
            <Caption block={block} onChange={onChange} />
        </figure>
    );
}

/* ── file ───────────────────────────────────────────────────────────── */

export function AttachmentBlock({
    attachment,
    onDelete,
    onError,
}: {
    attachment: AttachmentRecord;
    onDelete: () => void;
    onError: (message: string) => void;
}) {
    const isImage = attachment.mimeType.startsWith('image/');
    const isVideo = attachment.mimeType.startsWith('video/');
    const isAudio = attachment.mimeType.startsWith('audio/');
    const preview = useAttachmentUrl(isImage || isVideo || isAudio ? attachment : undefined);
    const FileTypeIcon = isImage ? ImageIcon : isVideo ? Film : FileText;
    if (isAudio) {
        return (
            <div className="group/audio relative">
                <AudioPlayer
                    src={preview}
                    cacheKey={attachment.storagePath}
                    name={attachment.fileName}
                    sizeBytes={attachment.sizeBytes}
                    onDownload={() =>
                        void downloadAttachment(supabase, attachment).then((r) => {
                            if ('error' in r) onError(r.error);
                        })
                    }
                />
                <div className="absolute -right-2 -top-2 opacity-0 transition-opacity group-hover/audio:opacity-100 focus-within:opacity-100">
                    <IconButton
                        icon={<Trash2 size={13} />}
                        tooltip={`Delete ${attachment.fileName}`}
                        className="border border-[var(--fz-border)] bg-[var(--fz-bg-panel)]"
                        onClick={() => {
                            void deleteAttachment(supabase, attachment);
                            onDelete();
                        }}
                    />
                </div>
            </div>
        );
    }
    return (
        <div className="overflow-hidden rounded-lg border border-[var(--fz-border)] bg-[var(--fz-bg-panel)]">
            {isImage && preview && <img src={preview} alt="" className="max-h-64 w-full bg-[var(--fz-bg-hover)] object-contain" />}
            {isVideo && preview && <video src={preview} controls preload="metadata" className="max-h-72 w-full bg-black" />}
            <div className="flex items-center gap-3 p-2.5 pl-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-[var(--fz-bg-hover)] text-[var(--fz-text-3)]">
                    <FileTypeIcon size={15} />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-[var(--fz-text-1)]">{attachment.fileName}</p>
                    <p className="text-meta">
                        {formatBytes(attachment.sizeBytes)}
                        {attachment.extractedText ? ' · AI can read this' : ''}
                    </p>
                </div>
                <IconButton
                    icon={<Download size={14} />}
                    tooltip={`Download ${attachment.fileName}`}
                    onClick={() =>
                        void downloadAttachment(supabase, attachment).then((r) => {
                            if (!r.ok) onError(r.error);
                        })
                    }
                />
                <IconButton
                    icon={<Trash2 size={14} />}
                    tooltip={`Delete ${attachment.fileName}`}
                    onClick={() => {
                        void deleteAttachment(supabase, attachment);
                        onDelete();
                    }}
                />
            </div>
        </div>
    );
}

export function FilePlaceholder({ onPick, busy }: { onPick: () => void; busy: boolean }) {
    return (
        <button
            type="button"
            onClick={onPick}
            className="flex h-12 w-full items-center gap-3 rounded-lg bg-[var(--fz-bg-hover)] px-4 text-left text-[14px] text-[var(--fz-text-3)] transition-colors hover:text-[var(--fz-text-2)]"
        >
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Paperclip size={18} />}
            {busy ? 'Uploading…' : 'Upload a file'}
        </button>
    );
}

/* ── web bookmark ───────────────────────────────────────────────────── */

export function BookmarkBlock({ block, onChange, onError }: BlockProps & { onError: (m: string) => void }) {
    const [draft, setDraft] = useState(block.content || '');
    const [loading, setLoading] = useState(false);

    const confirm = async () => {
        const raw = draft.trim();
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

    if (block.link) return <BookmarkCard preview={block.link} />;

    return (
        <form
            className="flex items-center gap-2 rounded-lg bg-[var(--fz-bg-hover)] py-1.5 pl-4 pr-1.5"
            onSubmit={(e) => {
                e.preventDefault();
                void confirm();
            }}
        >
            <LinkIcon size={16} className="shrink-0 text-[var(--fz-text-3)]" />
            <input
                data-focus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Paste a link to create a bookmark…"
                className="list-doc-field h-8 min-w-0 flex-1 bg-transparent text-[14px] text-[var(--fz-text-1)] outline-none placeholder:text-[var(--fz-text-3)]"
                autoFocus
            />
            <Button type="submit" variant="primary" size="sm" loading={loading} disabled={!draft.trim()}>
                Create
            </Button>
        </form>
    );
}

function BookmarkCard({ preview }: { preview: LinkPreview }) {
    return (
        <a
            href={preview.url}
            target="_blank"
            rel="noreferrer"
            className="flex overflow-hidden rounded-lg border border-[var(--fz-border)] transition-colors hover:bg-[var(--fz-bg-hover)]"
        >
            <div className="min-w-0 flex-1 px-4 py-3">
                <p className="truncate text-[14px] text-[var(--fz-text-1)]">{preview.title || preview.url}</p>
                {preview.description && (
                    <p className="mt-1 line-clamp-2 text-[12.5px] leading-[18px] text-[var(--fz-text-3)]">{preview.description}</p>
                )}
                <p className="mt-2 flex items-center gap-1.5 text-[12px] text-[var(--fz-text-2)]">
                    {preview.favicon && <img src={preview.favicon} alt="" className="size-3.5 shrink-0 rounded-sm" />}
                    <span className="truncate">{preview.url}</span>
                </p>
            </div>
            {preview.image && (
                <img
                    src={preview.image}
                    alt=""
                    className="hidden w-[34%] max-w-[240px] shrink-0 object-cover sm:block"
                    onError={(e) => {
                        e.currentTarget.style.display = 'none';
                    }}
                />
            )}
        </a>
    );
}

/* ── code ───────────────────────────────────────────────────────────── */

const CODE_LANGUAGES = ['typescript', 'javascript', 'python', 'tsx', 'jsx', 'json', 'css', 'markup', 'bash', 'sql', 'text'] as const;

export function CodeBlock({ block, onChange, isLight }: BlockProps & { isLight: boolean }) {
    const [copied, setCopied] = useState(false);
    const language = (block.language || 'typescript') as Language;
    const rows = Math.max(3, block.content.split('\n').length + 1);
    return (
        <div className="list-code-editor group/code relative overflow-hidden rounded-lg bg-[var(--fz-bg-hover)]">
            <div className="flex h-9 items-center justify-between px-3">
                <label className="flex items-center gap-1.5 text-[12px] text-[var(--fz-text-3)]">
                    <Code2 size={12} />
                    <select
                        value={block.language || 'typescript'}
                        onChange={(e) => onChange({ ...block, language: e.target.value })}
                        className="bg-transparent outline-none"
                        aria-label="Code language"
                    >
                        {CODE_LANGUAGES.map((l) => (
                            <option key={l} value={l}>{l === 'markup' ? 'html' : l}</option>
                        ))}
                    </select>
                </label>
                <button
                    type="button"
                    onClick={() => {
                        void navigator.clipboard?.writeText(block.content).then(() => {
                            setCopied(true);
                            window.setTimeout(() => setCopied(false), 1200);
                        });
                    }}
                    className="flex h-6 items-center gap-1 rounded-md px-1.5 text-[12px] text-[var(--fz-text-3)] opacity-0 transition-opacity hover:bg-[var(--fz-bg-active)] hover:text-[var(--fz-text-1)] group-hover/code:opacity-100"
                >
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                    {copied ? 'Copied' : 'Copy'}
                </button>
            </div>
            <div className="relative">
                <Highlight theme={isLight ? themes.github : themes.vsDark} code={block.content || ' '} language={language}>
                    {({ className, style, tokens, getLineProps, getTokenProps }) => (
                        <pre
                            aria-hidden
                            className={`${className} pointer-events-none m-0 whitespace-pre-wrap break-words px-4 pb-4 pt-0.5 font-mono text-[13px] leading-5`}
                            style={{ ...style, background: 'transparent', minHeight: rows * 20 + 18 }}
                        >
                            {tokens.map((line, i) => (
                                <div key={i} {...getLineProps({ line })}>
                                    {line.map((token, j) => (
                                        <span key={j} {...getTokenProps({ token })} />
                                    ))}
                                </div>
                            ))}
                        </pre>
                    )}
                </Highlight>
                <textarea
                    data-focus
                    value={block.content}
                    onChange={(e) => onChange({ ...block, content: e.target.value })}
                    onKeyDown={(e) => {
                        if (e.key === 'Tab') {
                            e.preventDefault();
                            const el = e.currentTarget;
                            const start = el.selectionStart;
                            const next = `${block.content.slice(0, start)}  ${block.content.slice(el.selectionEnd)}`;
                            onChange({ ...block, content: next });
                            requestAnimationFrame(() => el.setSelectionRange(start + 2, start + 2));
                        }
                    }}
                    spellCheck={false}
                    placeholder="Write or paste code…"
                    className="list-code-input list-doc-field absolute inset-0 h-full w-full resize-none overflow-hidden whitespace-pre-wrap break-words bg-transparent px-4 pb-4 pt-0.5 font-mono text-[13px] leading-5 text-transparent caret-white outline-none placeholder:text-[var(--fz-text-4)]"
                    style={{ WebkitTextFillColor: 'transparent' }}
                    aria-label="Code"
                />
            </div>
        </div>
    );
}

/* ── table ──────────────────────────────────────────────────────────── */

export function TableBlock({ block, onChange }: BlockProps) {
    const rows = block.rows?.length ? block.rows : [['']];
    const cols = Math.max(...rows.map((r) => r.length));
    const setRows = (next: string[][]) => onChange({ ...block, rows: next });
    const setCell = (r: number, c: number, v: string) =>
        setRows(rows.map((row, ri) => (ri === r ? Array.from({ length: cols }, (_, ci) => (ci === c ? v : row[ci] ?? '')) : row)));
    const addRow = () => setRows([...rows, Array.from({ length: cols }, () => '')]);
    const addCol = () => setRows(rows.map((row) => [...row, '']));

    return (
        <div className="group/table relative pb-5 pr-5">
            <div className="cal-scroll overflow-x-auto">
                <table className="w-full border-collapse text-[14px]" style={{ tableLayout: 'fixed', minWidth: cols * 120 }}>
                    <tbody>
                        {rows.map((row, r) => (
                            <tr key={r}>
                                {Array.from({ length: cols }, (_, c) => (
                                    <td
                                        key={c}
                                        className={`border border-[var(--fz-border-strong)] p-0 align-top ${
                                            block.headerRow && r === 0 ? 'bg-[var(--fz-bg-hover)] font-medium' : ''
                                        }`}
                                    >
                                        <input
                                            data-focus={r === 0 && c === 0 ? '' : undefined}
                                            value={row[c] ?? ''}
                                            onChange={(e) => setCell(r, c, e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    if (r === rows.length - 1) addRow();
                                                    requestAnimationFrame(() => {
                                                        const table = (e.target as HTMLElement).closest('table');
                                                        table?.querySelectorAll('tr')[r + 1]?.querySelectorAll('input')[c]?.focus();
                                                    });
                                                }
                                            }}
                                            className="list-doc-field w-full bg-transparent px-2.5 py-2 text-[var(--fz-text-1)] outline-none"
                                        />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <button
                type="button"
                onClick={addCol}
                aria-label="Add column"
                className="absolute bottom-5 right-0 top-0 flex w-4 items-center justify-center rounded-md bg-[var(--fz-bg-hover)] text-[var(--fz-text-3)] opacity-0 transition-opacity hover:bg-[var(--fz-bg-active)] group-hover/table:opacity-100"
            >
                <Plus size={12} />
            </button>
            <button
                type="button"
                onClick={addRow}
                aria-label="Add row"
                className="absolute bottom-0 left-0 right-5 flex h-4 items-center justify-center rounded-md bg-[var(--fz-bg-hover)] text-[var(--fz-text-3)] opacity-0 transition-opacity hover:bg-[var(--fz-bg-active)] group-hover/table:opacity-100"
            >
                <Plus size={12} />
            </button>
        </div>
    );
}

/* ── table of contents ─────────────────────────────────────────────── */

export function TocBlock({ headings }: { headings: ListBlock[] }) {
    if (!headings.length) {
        return (
            <p className="rounded-md bg-[var(--fz-bg-hover)] px-3 py-2.5 text-[13px] text-[var(--fz-text-3)]">
                Add headings to this page to build a table of contents.
            </p>
        );
    }
    return (
        <nav className="space-y-0.5 py-1" aria-label="Table of contents">
            {headings.map((h) => (
                <button
                    key={h.id}
                    type="button"
                    onClick={() =>
                        document.querySelector(`[data-block-id="${h.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }
                    className="block w-full truncate rounded-md py-1 text-left text-[14px] text-[var(--fz-text-3)] underline decoration-[var(--fz-border-strong)] underline-offset-4 transition-colors hover:bg-[var(--fz-bg-hover)] hover:text-[var(--fz-text-1)]"
                    style={{ paddingLeft: 6 + ((h.level ?? 2) - 1) * 18 }}
                >
                    {h.content || 'Untitled heading'}
                </button>
            ))}
        </nav>
    );
}

/* ── page link ─────────────────────────────────────────────────────── */

export function PageBlock({
    block,
    onChange,
    lists,
    currentId,
    onOpen,
}: BlockProps & { lists: SavedList[]; currentId: string; onOpen: (id: string) => void }) {
    const [query, setQuery] = useState('');
    const target = block.pageId ? lists.find((l) => l.id === block.pageId) : undefined;

    if (block.pageId && target) {
        return (
            <button
                type="button"
                onClick={() => onOpen(target.id)}
                className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left transition-colors hover:bg-[var(--fz-bg-hover)]"
            >
                {target.icon ? <PageIcon icon={target.icon} size={18} /> : <FileText size={17} className="text-[var(--fz-text-3)]" />}
                <span className="truncate text-[15px] font-medium text-[var(--fz-text-1)] underline decoration-[var(--fz-border-strong)] underline-offset-4">
                    {target.title || 'Untitled'}
                </span>
            </button>
        );
    }
    if (block.pageId && !target) {
        return (
            <p className="flex items-center gap-2 px-1 py-1 text-[14px] text-[var(--fz-text-4)]">
                <FileSymlink size={16} />
                This page was deleted.
            </p>
        );
    }
    const options = lists.filter(
        (l) => l.id !== currentId && (l.title || 'Untitled').toLowerCase().includes(query.trim().toLowerCase()),
    );
    return (
        <div className="rounded-lg border border-[var(--fz-border)] bg-[var(--fz-bg-panel)] p-1.5">
            <label className="flex h-8 items-center gap-2 px-2">
                <Search size={13} className="text-[var(--fz-text-4)]" />
                <input
                    data-focus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Link to a page…"
                    autoFocus
                    className="list-doc-field min-w-0 flex-1 bg-transparent text-[14px] text-[var(--fz-text-1)] outline-none placeholder:text-[var(--fz-text-4)]"
                />
            </label>
            <div className="max-h-48 overflow-y-auto">
                {options.length === 0 ? (
                    <p className="px-2 py-2 text-[13px] text-[var(--fz-text-3)]">No other lists yet.</p>
                ) : (
                    options.map((l) => (
                        <button
                            key={l.id}
                            type="button"
                            onClick={() => onChange({ ...block, pageId: l.id })}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[14px] text-[var(--fz-text-2)] hover:bg-[var(--fz-bg-hover)] hover:text-[var(--fz-text-1)]"
                        >
                            {l.icon ? <PageIcon icon={l.icon} size={16} /> : <FileText size={15} className="text-[var(--fz-text-4)]" />}
                            <span className="truncate">{l.title || 'Untitled'}</span>
                        </button>
                    ))
                )}
            </div>
        </div>
    );
}

/* ── embed (HTML or a web page) ─────────────────────────────────────── */

function hostOf(url: string) {
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    } catch {
        return url;
    }
}

export function EmbedBlock({ block, onChange }: BlockProps) {
    const [editing, setEditing] = useState(!block.html && !block.url);
    const [mode, setMode] = useState<'html' | 'url'>(block.url ? 'url' : 'html');
    const [draft, setDraft] = useState(block.html || block.url || '');

    if (editing) {
        return (
            <div className="rounded-lg bg-[var(--fz-bg-hover)] p-3">
                <div className="mb-2 flex items-center gap-4 px-1">
                    {(['html', 'url'] as const).map((m) => (
                        <button
                            key={m}
                            type="button"
                            onClick={() => setMode(m)}
                            className={`relative h-7 text-[13px] ${
                                mode === m ? 'font-medium text-[var(--fz-text-1)]' : 'text-[var(--fz-text-3)] hover:text-[var(--fz-text-2)]'
                            }`}
                        >
                            {m === 'html' ? 'HTML' : 'Web page'}
                            {mode === m && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[var(--fz-text-1)]" />}
                        </button>
                    ))}
                </div>
                {mode === 'html' ? (
                    <textarea
                        data-focus
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        rows={6}
                        spellCheck={false}
                        placeholder="<div>Paste HTML here</div>"
                        className="list-doc-field w-full resize-y rounded-md border border-[var(--fz-border)] bg-[var(--fz-bg-panel)] p-2.5 font-mono text-[12.5px] leading-5 text-[var(--fz-text-1)] outline-none placeholder:text-[var(--fz-text-4)]"
                    />
                ) : (
                    <input
                        data-focus
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder="https://…"
                        className="list-doc-field h-9 w-full rounded-md border border-[var(--fz-border)] bg-[var(--fz-bg-panel)] px-2.5 text-[13px] text-[var(--fz-text-1)] outline-none placeholder:text-[var(--fz-text-4)]"
                    />
                )}
                <div className="mt-2 flex justify-end gap-2">
                    {(block.html || block.url) && (
                        <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                            Cancel
                        </Button>
                    )}
                    <Button
                        variant="primary"
                        size="sm"
                        disabled={!draft.trim() || (mode === 'url' && !/^https?:\/\//i.test(draft.trim()))}
                        onClick={() => {
                            onChange(mode === 'html' ? { ...block, html: draft, url: undefined } : { ...block, url: draft.trim(), html: undefined });
                            setEditing(false);
                        }}
                    >
                        Embed
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <figure>
            <div className="mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[12px] text-[var(--fz-text-3)]">
                    <AppWindow size={12} />
                    {block.url ? hostOf(block.url) : 'HTML embed'}
                </span>
                <IconButton icon={<Pencil size={12} />} tooltip="Edit embed" onClick={() => setEditing(true)} />
            </div>
            <div className="h-[360px] min-h-[140px] resize-y overflow-hidden rounded-lg border border-[var(--fz-border)]">
                <iframe
                    title="Embed"
                    className="h-full w-full bg-white"
                    sandbox={block.url ? 'allow-scripts allow-same-origin allow-popups allow-forms' : 'allow-scripts allow-popups'}
                    {...(block.url
                        ? { src: block.url }
                        : { srcDoc: `<!doctype html><style>html,body{margin:0;height:100%}</style>${block.html ?? ''}` })}
                />
            </div>
            <Caption block={block} onChange={onChange} />
        </figure>
    );
}

/* ── AI ─────────────────────────────────────────────────────────────── */

export function AiBlock({
    onGenerate,
    onCancel,
}: {
    onGenerate: (prompt: string) => Promise<void>;
    onCancel: () => void;
}) {
    const [prompt, setPrompt] = useState('');
    const [busy, setBusy] = useState(false);
    return (
        <form
            className="flex items-center gap-2 rounded-lg border border-[var(--fz-border-strong)] bg-[var(--fz-bg-panel)] py-1.5 pl-3 pr-1.5 shadow-[var(--fz-elev-card)]"
            onSubmit={async (e) => {
                e.preventDefault();
                if (!prompt.trim() || busy) return;
                setBusy(true);
                await onGenerate(prompt.trim());
                setBusy(false);
            }}
        >
            <Sparkles size={15} className="shrink-0 text-[var(--fz-text-2)]" />
            <input
                data-focus
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Escape' || (e.key === 'Backspace' && !prompt)) {
                        e.preventDefault();
                        onCancel();
                    }
                }}
                disabled={busy}
                autoFocus
                placeholder="Ask AI to write — a packing list, sprint plan, study guide…"
                className="list-doc-field h-8 min-w-0 flex-1 bg-transparent text-[14px] text-[var(--fz-text-1)] outline-none placeholder:text-[var(--fz-text-4)] disabled:opacity-60"
            />
            <Button type="submit" variant="primary" size="sm" loading={busy} disabled={!prompt.trim()}>
                Write
            </Button>
        </form>
    );
}
