import { supabase } from "@/lib/supabase";

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const SAFE_MIME_TYPES = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf",
  "text/plain", "text/markdown", "text/csv", "application/json",
  "text/javascript", "application/javascript", "text/typescript", "text/jsx",
  "text/tsx", "text/css",
]);
const TEXT_EXTENSIONS = new Set([
  "txt", "md", "markdown", "csv", "json", "js", "mjs", "cjs", "ts", "tsx", "jsx",
  "css", "html", "htm", "xml", "py", "rb", "go", "rs", "java", "kt", "swift",
  "c", "h", "cpp", "hpp", "cs", "php", "sh", "bash", "zsh", "sql", "yaml", "yml",
]);

export type AttachmentRecord = {
  id: string;
  ownerId: string;
  context: "list" | "room";
  listId: string | null;
  roomId: string | null;
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  extractedText: string | null;
  createdAt: string;
};

type Row = {
  id: string; owner_id: string; context: "list" | "room"; list_id: string | null;
  room_id: string | null; storage_path: string; file_name: string; mime_type: string;
  size_bytes: number; extracted_text: string | null; created_at: string;
};

function fromRow(row: Row): AttachmentRecord {
  return {
    id: row.id, ownerId: row.owner_id, context: row.context, listId: row.list_id,
    roomId: row.room_id, storagePath: row.storage_path, fileName: row.file_name,
    mimeType: row.mime_type, sizeBytes: row.size_bytes, extractedText: row.extracted_text,
    createdAt: row.created_at,
  };
}

function safeName(name: string) {
  return (name.normalize("NFKC").replace(/[^a-zA-Z0-9._-]+/g, "-") || "attachment").slice(-120);
}

export async function uploadRoomAttachment(file: File, roomId: string) {
  const extension = file.name.toLowerCase().split(".").pop() ?? "";
  const mimeType = SAFE_MIME_TYPES.has(file.type)
    ? file.type
    : TEXT_EXTENSIONS.has(extension) ? "text/plain" : file.type;
  if (file.size === 0) return { ok: false as const, error: "Empty files cannot be attached." };
  if (file.size > MAX_ATTACHMENT_BYTES) return { ok: false as const, error: "Attachments must be 10MB or smaller." };
  if (!SAFE_MIME_TYPES.has(mimeType)) return { ok: false as const, error: "This file type is not supported." };
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false as const, error: "Sign in to upload attachments." };
  const storagePath = `${auth.user.id}/room/${roomId}/${crypto.randomUUID()}-${safeName(file.name)}`;
  const { error: uploadError } = await supabase.storage.from("attachments").upload(storagePath, file, {
    contentType: mimeType,
    upsert: false,
  });
  if (uploadError) {
    return {
      ok: false as const,
      error: /row-level security|policy/i.test(uploadError.message)
        ? "Chat attachments are available on Pro."
        : uploadError.message,
    };
  }
  const textLike = mimeType.startsWith("text/") || ["application/json", "application/xml"].includes(mimeType);
  const extractedText = textLike ? (await file.text()).slice(0, 100_000) : null;
  const { data, error } = await supabase.from("attachments").insert({
    owner_id: auth.user.id,
    context: "room",
    room_id: roomId,
    list_id: null,
    storage_path: storagePath,
    file_name: file.name.slice(0, 255),
    mime_type: mimeType,
    size_bytes: file.size,
    extracted_text: extractedText,
  }).select("*").single();
  if (error || !data) {
    await supabase.storage.from("attachments").remove([storagePath]);
    return { ok: false as const, error: error?.message ?? "Could not save attachment." };
  }
  return { ok: true as const, attachment: fromRow(data as Row) };
}

export async function downloadAttachment(attachment: AttachmentRecord) {
  const { data, error } = await supabase.storage.from("attachments").download(attachment.storagePath);
  if (error || !data) return { ok: false as const, error: error?.message ?? "Download failed." };
  const url = URL.createObjectURL(data);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = attachment.fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { ok: true as const };
}

export async function deleteAttachment(attachment: AttachmentRecord) {
  const { error: objectError } = await supabase.storage.from("attachments").remove([attachment.storagePath]);
  if (objectError) return { ok: false as const, error: objectError.message };
  const { error } = await supabase.from("attachments").delete().eq("id", attachment.id);
  return error ? { ok: false as const, error: error.message } : { ok: true as const };
}
