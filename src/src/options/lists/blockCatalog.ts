import {
    AppWindow,
    AudioLines,
    Bookmark,
    CheckSquare,
    ChevronRight,
    Code2,
    FileSymlink,
    FileText,
    Heading1,
    Heading2,
    Heading3,
    Image,
    List,
    ListOrdered,
    ListTree,
    MessageSquareText,
    Minus,
    Paperclip,
    Quote,
    Sparkles,
    Table,
    Type,
    Video,
    type LucideIcon,
} from 'lucide-react';
import { newBlock, newListId, type ListBlock, type ListBlockType } from '../../lib/listTypes';

export type CommandGroup = 'Basic blocks' | 'Media' | 'Advanced' | 'AI';

export type BlockCommand = {
    id: string;
    label: string;
    hint: string;
    group: CommandGroup;
    icon: LucideIcon;
    keywords: string;
    /** Markdown shortcut shown on the right of the menu row. */
    shortcut?: string;
    /** Blocks that need the editor's help (sub-page creation, file picker). */
    special?: 'subpage' | 'file';
    make: () => ListBlock;
};

const heading = (level: 1 | 2 | 3) => (): ListBlock => ({ ...newBlock('heading'), level });

export const BLOCK_COMMANDS: BlockCommand[] = [
    { id: 'text', label: 'Text', hint: 'Just start writing with plain text.', group: 'Basic blocks', icon: Type, keywords: 'paragraph plain', make: () => newBlock('text') },
    { id: 'h1', label: 'Heading 1', hint: 'Big section heading.', group: 'Basic blocks', icon: Heading1, keywords: 'title h1 big', shortcut: '#', make: heading(1) },
    { id: 'h2', label: 'Heading 2', hint: 'Medium section heading.', group: 'Basic blocks', icon: Heading2, keywords: 'subtitle h2', shortcut: '##', make: heading(2) },
    { id: 'h3', label: 'Heading 3', hint: 'Small section heading.', group: 'Basic blocks', icon: Heading3, keywords: 'h3 small', shortcut: '###', make: heading(3) },
    { id: 'todo', label: 'To-do list', hint: 'Track tasks with a checklist.', group: 'Basic blocks', icon: CheckSquare, keywords: 'checklist checkbox task todo', shortcut: '[]', make: () => newBlock('checklist') },
    { id: 'bullets', label: 'Bulleted list', hint: 'Create a simple bulleted list.', group: 'Basic blocks', icon: List, keywords: 'unordered bullet points ul', shortcut: '-', make: () => newBlock('bullets') },
    { id: 'numbered', label: 'Numbered list', hint: 'Create a list with numbering.', group: 'Basic blocks', icon: ListOrdered, keywords: 'ordered numbers ol', shortcut: '1.', make: () => newBlock('numbered') },
    { id: 'toggle', label: 'Toggle list', hint: 'Show or hide content under it.', group: 'Basic blocks', icon: ChevronRight, keywords: 'collapse expand faq details', shortcut: '>', make: () => newBlock('toggle') },
    { id: 'quote', label: 'Quote', hint: 'Capture a quote.', group: 'Basic blocks', icon: Quote, keywords: 'blockquote citation', shortcut: '"', make: () => newBlock('quote') },
    { id: 'callout', label: 'Callout', hint: 'Make writing stand out.', group: 'Basic blocks', icon: MessageSquareText, keywords: 'note tip info warning box', make: () => newBlock('callout') },
    { id: 'divider', label: 'Divider', hint: 'Visually divide blocks.', group: 'Basic blocks', icon: Minus, keywords: 'separator line hr rule', shortcut: '---', make: () => newBlock('divider') },
    { id: 'page', label: 'Page', hint: 'Embed a sub-page inside this page.', group: 'Basic blocks', icon: FileText, keywords: 'subpage sub page new nested', special: 'subpage', make: () => newBlock('page') },
    { id: 'linkpage', label: 'Link to page', hint: 'Link to one of your lists.', group: 'Basic blocks', icon: FileSymlink, keywords: 'mention reference existing', make: () => newBlock('page') },
    { id: 'image', label: 'Image', hint: 'Upload or embed with a link.', group: 'Media', icon: Image, keywords: 'picture photo img', make: () => newBlock('image') },
    { id: 'video', label: 'Video', hint: 'YouTube, Vimeo, Loom or a video file.', group: 'Media', icon: Video, keywords: 'youtube vimeo loom movie clip', make: () => newBlock('video') },
    { id: 'audio', label: 'Audio', hint: 'Upload or embed an audio file.', group: 'Media', icon: AudioLines, keywords: 'sound music mp3 podcast', make: () => newBlock('audio') },
    { id: 'file', label: 'File', hint: 'Upload any file.', group: 'Media', icon: Paperclip, keywords: 'attachment upload pdf document', special: 'file', make: () => newBlock('attachment') },
    { id: 'bookmark', label: 'Web bookmark', hint: 'Save a link as a visual card.', group: 'Media', icon: Bookmark, keywords: 'link url preview website embed', make: () => newBlock('link') },
    { id: 'code', label: 'Code', hint: 'Capture a code snippet.', group: 'Media', icon: Code2, keywords: 'snippet programming syntax', shortcut: '```', make: () => ({ ...newBlock('code'), language: 'typescript' }) },
    { id: 'table', label: 'Table', hint: 'Add a simple table.', group: 'Advanced', icon: Table, keywords: 'grid rows columns spreadsheet', make: () => newBlock('table') },
    { id: 'toc', label: 'Table of contents', hint: 'Show an outline of this page.', group: 'Advanced', icon: ListTree, keywords: 'toc outline headings index', make: () => newBlock('toc') },
    { id: 'embed', label: 'Embed', hint: 'Paste HTML or embed a web page.', group: 'Advanced', icon: AppWindow, keywords: 'html iframe widget', make: () => newBlock('embed') },
    { id: 'ai', label: 'Ask AI to write', hint: 'Describe it and AI writes the blocks.', group: 'AI', icon: Sparkles, keywords: 'ai generate write assistant', make: () => newBlock('ai') },
];

export function filterCommands(query: string): BlockCommand[] {
    const q = query.trim().toLowerCase();
    if (!q) return BLOCK_COMMANDS;
    return BLOCK_COMMANDS.filter(
        (c) => c.label.toLowerCase().includes(q) || c.keywords.includes(q) || c.id.startsWith(q),
    ).sort((a, b) => Number(!a.label.toLowerCase().startsWith(q)) - Number(!b.label.toLowerCase().startsWith(q)));
}

/** Plain-text blocks you can switch between from the block menu ("Turn into"). */
export const TURN_INTO: { label: string; icon: LucideIcon; apply: (b: ListBlock) => ListBlock }[] = [
    { label: 'Text', icon: Type, apply: (b) => toText(b, 'text') },
    { label: 'Heading 1', icon: Heading1, apply: (b) => ({ ...toText(b, 'heading'), level: 1 }) },
    { label: 'Heading 2', icon: Heading2, apply: (b) => ({ ...toText(b, 'heading'), level: 2 }) },
    { label: 'Heading 3', icon: Heading3, apply: (b) => ({ ...toText(b, 'heading'), level: 3 }) },
    { label: 'To-do list', icon: CheckSquare, apply: (b) => toItems(b, 'checklist') },
    { label: 'Bulleted list', icon: List, apply: (b) => toItems(b, 'bullets') },
    { label: 'Numbered list', icon: ListOrdered, apply: (b) => toItems(b, 'numbered') },
    { label: 'Toggle list', icon: ChevronRight, apply: (b) => ({ ...toText(b, 'toggle'), open: true, body: b.body ?? '' }) },
    { label: 'Quote', icon: Quote, apply: (b) => toText(b, 'quote') },
    { label: 'Callout', icon: MessageSquareText, apply: (b) => ({ ...toText(b, 'callout'), icon: b.icon ?? '💡' }) },
];

export const CONVERTIBLE: ListBlockType[] = ['text', 'heading', 'checklist', 'bullets', 'numbered', 'toggle', 'quote', 'callout'];

function plainText(b: ListBlock): string {
    if (b.items) return b.items.map((i) => i.text).filter(Boolean).join('\n');
    return b.content;
}

function toText(b: ListBlock, type: ListBlockType): ListBlock {
    return { id: b.id, type, content: plainText(b), icon: b.icon, body: b.body };
}

function toItems(b: ListBlock, type: ListBlockType): ListBlock {
    const lines = b.items ? b.items.map((i) => i.text) : b.content.split('\n');
    const items = (lines.length ? lines : ['']).map((text, i) => ({
        id: b.items?.[i]?.id ?? newListId('item'),
        text,
        done: type === 'checklist' ? Boolean(b.items?.[i]?.done) : false,
    }));
    return { id: b.id, type, content: '', items };
}

/**
 * Markdown typed at the start of a text block turns it into another block,
 * like Notion: "# " heading, "- " bullets, "[] " to-do, "1. " numbered,
 * "> " toggle, '" ' quote, "---" divider, "```" code.
 */
export function markdownShortcut(value: string): { make: () => ListBlock } | null {
    const rules: [RegExp, (rest: string) => ListBlock][] = [
        [/^###\s/, (rest) => ({ ...newBlock('heading', rest), level: 3 })],
        [/^##\s/, (rest) => ({ ...newBlock('heading', rest), level: 2 })],
        [/^#\s/, (rest) => ({ ...newBlock('heading', rest), level: 1 })],
        [/^\[\s?\]\s/, (rest) => newBlock('checklist', rest)],
        [/^[-*+]\s/, (rest) => newBlock('bullets', rest)],
        [/^1[.)]\s/, (rest) => newBlock('numbered', rest)],
        [/^>\s/, (rest) => newBlock('toggle', rest)],
        [/^["“]\s/, (rest) => newBlock('quote', rest)],
    ];
    for (const [re, make] of rules) {
        const m = value.match(re);
        if (m) return { make: () => make(value.slice(m[0].length)) };
    }
    if (value === '---' || value === '—-' || value === '***') return { make: () => newBlock('divider') };
    if (value === '```') return { make: () => ({ ...newBlock('code'), language: 'typescript' }) };
    return null;
}

/** Markdown (from the AI) → blocks. */
export function parseMarkdownBlocks(content: string): ListBlock[] {
    const blocks: ListBlock[] = [];
    const lines = content
        .replace(/```(\w+)?\n([\s\S]*?)```/g, (_m, language, code) => {
            blocks.push({ ...newBlock('code'), language: language || 'text', content: code.trim() });
            return `@@code:${blocks.length - 1}@@`;
        })
        .split('\n');
    const out: ListBlock[] = [];
    let current: ListBlock | null = null;
    const pushItem = (type: ListBlockType, text: string, done = false) => {
        if (!current || current.type !== type) {
            current = { ...newBlock(type), items: [] };
            out.push(current);
        }
        current.items!.push({ id: newListId('item'), text, done });
    };
    for (const raw of lines) {
        const line = raw.trim();
        const codeRef = line.match(/^@@code:(\d+)@@$/);
        if (codeRef) {
            out.push(blocks[Number(codeRef[1])]);
            current = null;
            continue;
        }
        if (!line) {
            current = null;
            continue;
        }
        let m: RegExpMatchArray | null;
        if ((m = line.match(/^(#{1,6})\s*(.*)$/))) {
            out.push({ ...newBlock('heading', m[2]), level: Math.min(3, m[1].length) as 1 | 2 | 3 });
            current = null;
        } else if ((m = line.match(/^[-*]\s+\[([ xX])\]\s*(.*)$/))) {
            pushItem('checklist', m[2], m[1].toLowerCase() === 'x');
        } else if ((m = line.match(/^[-*+]\s+(.*)$/))) {
            pushItem('bullets', m[1]);
        } else if ((m = line.match(/^\d+[.)]\s+(.*)$/))) {
            pushItem('numbered', m[1]);
        } else if ((m = line.match(/^>\s?(.*)$/))) {
            out.push(newBlock('quote', m[1]));
            current = null;
        } else if (/^(-{3,}|\*{3,})$/.test(line)) {
            out.push(newBlock('divider'));
            current = null;
        } else {
            out.push(newBlock('text', line.replace(/\*\*(.+?)\*\*/g, '$1')));
            current = null;
        }
    }
    return out.length ? out : [newBlock('text', content.trim())];
}
