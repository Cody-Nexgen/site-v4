import type { SupabaseClient } from '@supabase/supabase-js';

export const ATTACHMENT_BUCKET = 'attachments';
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

const TEXT_EXTENSIONS = new Set([
    'txt', 'md', 'markdown', 'csv', 'json', 'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx',
    'css', 'html', 'htm', 'xml', 'py', 'rb', 'go', 'rs', 'java', 'kt', 'swift',
    'c', 'h', 'cpp', 'hpp', 'cs', 'php', 'sh', 'bash', 'zsh', 'sql', 'yaml', 'yml',
]);

export type AttachmentContext = 'list' | 'room';

export type AttachmentRecord = {
    id: string;
    ownerId: string;
    context: AttachmentContext;
    listId: string | null;
    roomId: string | null;
    storagePath: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    extractedText: string | null;
    createdAt: string;
};

type AttachmentRow = {
    id: string;
    owner_id: string;
    context: AttachmentContext;
    list_id: string | null;
    room_id: string | null;
    storage_path: string;
    file_name: string;
    mime_type: string;
    size_bytes: number;
    extracted_text: string | null;
    created_at: string;
};

function fromRow(row: AttachmentRow): AttachmentRecord {
    return {
        id: row.id,
        ownerId: row.owner_id,
        context: row.context,
        listId: row.list_id,
        roomId: row.room_id,
        storagePath: row.storage_path,
        fileName: row.file_name,
        mimeType: row.mime_type,
        sizeBytes: row.size_bytes,
        extractedText: row.extracted_text,
        createdAt: row.created_at,
    };
}

function fileExtension(name: string): string {
    return name.toLowerCase().split('.').pop() ?? '';
}

export function isTextAttachment(file: Pick<File, 'name' | 'type'>): boolean {
    return file.type.startsWith('text/') ||
        file.type === 'application/json' ||
        file.type === 'application/xml' ||
        TEXT_EXTENSIONS.has(fileExtension(file.name));
}

/**
 * Any file type is allowed — we just normalize what the browser gives us so uploads
 * always carry a usable mime type, falling back to extension sniffing or a generic
 * binary type when the browser can't identify the file.
 */
export function normalizedAttachmentMime(file: Pick<File, 'name' | 'type'>): string {
    if (file.type) return file.type;
    return TEXT_EXTENSIONS.has(fileExtension(file.name)) ? 'text/plain' : 'application/octet-stream';
}

export function validateAttachment(file: Pick<File, 'name' | 'type' | 'size'>): string | null {
    if (file.size === 0) return 'Empty files cannot be attached.';
    if (file.size > MAX_ATTACHMENT_BYTES) return 'Attachments must be 10MB or smaller.';
    return null;
}

function safeFileName(name: string): string {
    const cleaned = name.normalize('NFKC').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
    return (cleaned || 'attachment').slice(-120);
}

export async function uploadAttachment(
    supabase: SupabaseClient,
    file: File,
    target: { context: 'list'; listId: string } | { context: 'room'; roomId: string },
): Promise<{ ok: true; attachment: AttachmentRecord } | { ok: false; error: string }> {
    const validationError = validateAttachment(file);
    if (validationError) return { ok: false, error: validationError };
    const mimeType = normalizedAttachmentMime(file);

    const { data: userData, error: userError } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (userError || !userId) return { ok: false, error: 'Sign in to upload attachments.' };

    const targetId = target.context === 'list' ? target.listId : target.roomId;
    const storagePath = `${userId}/${target.context}/${targetId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
    const { error: uploadError } = await supabase.storage
        .from(ATTACHMENT_BUCKET)
        .upload(storagePath, file, { contentType: mimeType, upsert: false });
    if (uploadError) {
        const message = /row-level security|policy/i.test(uploadError.message)
            ? 'Attachments are a Pro feature. Upgrade to upload files.'
            : uploadError.message;
        return { ok: false, error: message };
    }

    let extractedText: string | null = null;
    if (isTextAttachment(file)) {
        try {
            extractedText = (await file.text()).slice(0, 100_000);
        } catch {
            extractedText = null;
        }
    }

    const row = {
        owner_id: userId,
        context: target.context,
        list_id: target.context === 'list' ? target.listId : null,
        room_id: target.context === 'room' ? target.roomId : null,
        storage_path: storagePath,
        file_name: file.name.slice(0, 255),
        mime_type: mimeType,
        size_bytes: file.size,
        extracted_text: extractedText,
    };
    const { data, error } = await supabase
        .from('attachments')
        .insert(row)
        .select('*')
        .single();
    if (error || !data) {
        await supabase.storage.from(ATTACHMENT_BUCKET).remove([storagePath]);
        return {
            ok: false,
            error: /row-level security|policy/i.test(error?.message ?? '')
                ? 'Attachments are a Pro feature. Upgrade to upload files.'
                : error?.message ?? 'Could not save attachment.',
        };
    }
    return { ok: true, attachment: fromRow(data as AttachmentRow) };
}

export async function listAttachments(
    supabase: SupabaseClient,
    target: { context: 'list'; listId: string } | { context: 'room'; roomId: string },
): Promise<{ attachments: AttachmentRecord[]; error?: string }> {
    const column = target.context === 'list' ? 'list_id' : 'room_id';
    const value = target.context === 'list' ? target.listId : target.roomId;
    const { data, error } = await supabase
        .from('attachments')
        .select('*')
        .eq('context', target.context)
        .eq(column, value)
        .order('created_at', { ascending: true });
    if (error) return { attachments: [], error: error.message };
    return { attachments: (data as AttachmentRow[]).map(fromRow) };
}

export async function downloadAttachment(
    supabase: SupabaseClient,
    attachment: Pick<AttachmentRecord, 'storagePath' | 'fileName'>,
): Promise<{ ok: true } | { ok: false; error: string }> {
    const { data, error } = await supabase.storage.from(ATTACHMENT_BUCKET).download(attachment.storagePath);
    if (error || !data) return { ok: false, error: error?.message ?? 'Download failed.' };
    const url = URL.createObjectURL(data);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = attachment.fileName;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { ok: true };
}

export async function deleteAttachment(
    supabase: SupabaseClient,
    attachment: Pick<AttachmentRecord, 'id' | 'storagePath'>,
): Promise<{ ok: true } | { ok: false; error: string }> {
    const { error: storageError } = await supabase.storage
        .from(ATTACHMENT_BUCKET)
        .remove([attachment.storagePath]);
    if (storageError) return { ok: false, error: storageError.message };
    const { error } = await supabase.from('attachments').delete().eq('id', attachment.id);
    return error ? { ok: false, error: error.message } : { ok: true };
}
