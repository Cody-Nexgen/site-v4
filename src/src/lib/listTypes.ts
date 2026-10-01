import type { AttachmentRecord } from './attachmentApi';
import type { LinkPreview } from './linkPreviewApi';

export type ListBlockType =
    | 'text'
    | 'heading'
    | 'checklist'
    | 'bullets'
    | 'numbered'
    | 'toggle'
    | 'quote'
    | 'callout'
    | 'divider'
    | 'code'
    | 'table'
    | 'toc'
    | 'page'
    | 'link'
    | 'image'
    | 'video'
    | 'audio'
    | 'embed'
    | 'attachment'
    | 'ai';

export type ListChecklistItem = {
    id: string;
    text: string;
    done: boolean;
};

export type ListBlock = {
    id: string;
    type: ListBlockType;
    content: string;
    language?: string;
    /** checklist / bullets / numbered */
    items?: ListChecklistItem[];
    attachment?: AttachmentRecord;
    link?: LinkPreview;
    /** heading: 1–3 (legacy headings without a level render as 2) */
    level?: 1 | 2 | 3;
    /** toggle: the hidden text under the summary line */
    body?: string;
    /** toggle: expanded */
    open?: boolean;
    /** callout: emoji or icon token (see PageIcon) */
    icon?: string;
    /** table: rows of cells */
    rows?: string[][];
    /** table: first row styled as a header */
    headerRow?: boolean;
    /** page: the linked list */
    pageId?: string;
    /** image / video / audio / embed: external source */
    url?: string;
    /** embed: raw HTML rendered in a sandboxed frame */
    html?: string;
    caption?: string;
};

export type ListSchedule = {
    enabled: boolean;
    date: string;
    startMin: number;
    durationMin: number;
    repeat: 'none' | 'daily' | 'weekly';
    recurrenceWeekdays?: number[];
};

export type SavedList = {
    id: string;
    title: string;
    blocks: ListBlock[];
    createdAt: string;
    updatedAt: string;
    schedule?: ListSchedule;
    /** Emoji, `icon:<name>:<color>` or `img:<data url>` */
    icon?: string;
    /** `gradient:<id>` or an image URL */
    cover?: string;
    /** Sub-pages point at the list they live in. */
    parentId?: string;
};

export const SAVED_LISTS_KEY = 'focuznow_saved_lists_v1';
export const LIST_PRESETS_KEY = 'focuznow_list_presets_v1';

export type ListPreset = {
    id: string;
    title: string;
    description: string;
    accent: string;
    blocks: ListBlock[];
    createdAt: string;
};

type StoredListPreset = Partial<ListPreset> & {
    name?: unknown;
};

export function newListId(prefix = 'list'): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

const emptyItem = (): ListChecklistItem => ({ id: newListId('item'), text: '', done: false });

export function newBlock(type: ListBlockType = 'text', content = ''): ListBlock {
    const base: ListBlock = { id: newListId('block'), type, content };
    switch (type) {
        case 'code':
            return { ...base, language: 'text' };
        case 'checklist':
        case 'bullets':
        case 'numbered':
            return { ...base, items: [{ ...emptyItem(), text: content }], content: '' };
        case 'heading':
            return { ...base, level: 2 };
        case 'toggle':
            return { ...base, body: '', open: true };
        case 'callout':
            return { ...base, icon: '💡' };
        case 'table':
            return {
                ...base,
                headerRow: true,
                rows: [
                    ['', '', ''],
                    ['', '', ''],
                    ['', '', ''],
                ],
            };
        default:
            return base;
    }
}

export function createBlankList(title = 'Untitled'): SavedList {
    const now = new Date().toISOString();
    return {
        id: newListId(),
        title,
        blocks: [newBlock('text')],
        createdAt: now,
        updatedAt: now,
    };
}

export function createListPreset(input: {
    title: string;
    description: string;
    accent: string;
    blocks: ListBlock[];
}): ListPreset {
    return {
        id: newListId('preset'),
        title: input.title.trim(),
        description: input.description,
        accent: input.accent,
        blocks: cloneReusableBlocks(input.blocks),
        createdAt: new Date().toISOString(),
    };
}

export function normalizeListPreset(raw: unknown): ListPreset | null {
    if (!raw || typeof raw !== 'object') return null;
    const stored = raw as StoredListPreset;
    const title = typeof stored.title === 'string'
        ? stored.title.trim()
        : typeof stored.name === 'string'
            ? stored.name.trim()
            : '';
    if (!title || typeof stored.id !== 'string' || !Array.isArray(stored.blocks)) return null;
    return {
        id: stored.id,
        title,
        description: typeof stored.description === 'string' ? stored.description : '',
        accent: typeof stored.accent === 'string' ? stored.accent : '#5ea2ff',
        blocks: stored.blocks,
        createdAt: typeof stored.createdAt === 'string'
            ? stored.createdAt
            : new Date().toISOString(),
    };
}

/** Copies blocks for reuse: fresh ids, no stored files, no links into other pages. */
export function cloneReusableBlocks(blocks: ListBlock[]): ListBlock[] {
    return blocks
        .filter((block) => block.type !== 'attachment' && block.type !== 'page' && block.type !== 'ai')
        .map((block) => ({
            ...block,
            id: newListId('block'),
            attachment: undefined,
            items: block.items?.map((item) => ({
                ...item,
                id: newListId('item'),
            })),
            rows: block.rows?.map((row) => [...row]),
        }));
}
