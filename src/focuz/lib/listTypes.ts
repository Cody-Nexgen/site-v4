import type { AttachmentRecord } from './attachmentApi';

export type ListBlockType = 'text' | 'heading' | 'checklist' | 'code' | 'quote' | 'attachment';

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
    items?: ListChecklistItem[];
    attachment?: AttachmentRecord;
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

export function newBlock(type: ListBlockType = 'text', content = ''): ListBlock {
    return {
        id: newListId('block'),
        type,
        content,
        ...(type === 'code' ? { language: 'text' } : {}),
        ...(type === 'checklist'
            ? { items: [{ id: newListId('item'), text: '', done: false }] }
            : {}),
    };
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

export function cloneReusableBlocks(blocks: ListBlock[]): ListBlock[] {
    return blocks
        .filter((block) => block.type !== 'attachment')
        .map((block) => ({
            ...block,
            id: newListId('block'),
            attachment: undefined,
            items: block.items?.map((item) => ({
                ...item,
                id: newListId('item'),
            })),
        }));
}
