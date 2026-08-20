import { supabase } from "@/lib/supabase";

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

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

export async function getAttachmentPlayUrl(attachment: Pick<AttachmentRecord, "storagePath">, expiresIn = 3600) {
  const { data, error } = await supabase.storage
    .from("attachments")
    .createSignedUrl(attachment.storagePath, expiresIn);
  if (error || !data?.signedUrl) {
    return { ok: false as const, error: error?.message ?? "Could not open attachment." };
  }
  return { ok: true as const, url: data.signedUrl };
}

export function isPlayableAttachmentMime(mimeType: string | undefined | null): "image" | "video" | "audio" | null {
  const mime = (mimeType || "").toLowerCase();
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/") || mime === "application/ogg") return "audio";
  return null;
}

export async function deleteAttachment(attachment: AttachmentRecord) {
  const { error: objectError } = await supabase.storage.from("attachments").remove([attachment.storagePath]);
  if (objectError) return { ok: false as const, error: objectError.message };
  const { error } = await supabase.from("attachments").delete().eq("id", attachment.id);
  return error ? { ok: false as const, error: error.message } : { ok: true as const };
}
