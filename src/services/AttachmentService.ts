import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";

import { createServiceClient } from "@/lib/supabase/service";
import { OWNER_USER_ID } from "@/lib/owner";

const BUCKET = "finance-attachments";
const ATTACHMENT_LINK_TYPES = [
  "transaction",
  "account",
  "asset",
  "liability",
] as const;
export type AttachmentLinkType = (typeof ATTACHMENT_LINK_TYPES)[number];

async function insertLink(
  supabase: ReturnType<typeof createServiceClient>,
  linkType: AttachmentLinkType,
  linkId: string,
  attachmentId: string,
) {
  switch (linkType) {
    case "transaction":
      return supabase.from("transaction_attachments").insert({
        user_id: OWNER_USER_ID,
        transaction_id: linkId,
        attachment_id: attachmentId,
      });
    case "account":
      return supabase.from("account_attachments").insert({
        user_id: OWNER_USER_ID,
        account_id: linkId,
        attachment_id: attachmentId,
      });
    case "asset":
      return supabase.from("asset_attachments").insert({
        user_id: OWNER_USER_ID,
        asset_id: linkId,
        attachment_id: attachmentId,
      });
    case "liability":
      return supabase.from("liability_attachments").insert({
        user_id: OWNER_USER_ID,
        liability_id: linkId,
        attachment_id: attachmentId,
      });
    default: {
      const exhaustiveCheck: never = linkType;
      throw new Error(
        `Unhandled attachment link type: ${String(exhaustiveCheck)}`,
      );
    }
  }
}

export interface Attachment {
  id: string;
  fileName: string;
  contentType: string | null;
  byteSize: number | null;
  createdAt: string;
}

export interface UploadTarget {
  path: string;
  token: string;
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(0, 200);
}

/**
 * Creates a signed upload URL/token for a private path. The browser
 * uploads directly to Supabase Storage with this — the file bytes never
 * pass through our server. See docs/11: "private bucket, accessed only
 * via short-lived signed URLs, no direct browser writes" — this IS the
 * sanctioned direct write, because it's authorized by a short-lived
 * signed token our server issued, not an open/public bucket.
 *
 * Uses the service-role client since there's no session to scope this
 * to — see src/lib/owner.ts. The path is still prefixed with
 * OWNER_USER_ID for consistency with the storage bucket's folder
 * structure, not for authorization (the signed token is the
 * authorization).
 */
export async function createUploadTarget(
  fileName: string,
): Promise<UploadTarget> {
  const supabase = createServiceClient();
  const path = `${OWNER_USER_ID}/${randomUUID()}-${sanitizeFileName(fileName)}`;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(path);

  if (error) {
    throw new Error(`Failed to create upload target: ${error.message}`);
  }

  return {
    path: data.path,
    token: data.token,
  };
}

export const finalizeAttachmentInputSchema = z.object({
  path: z.string().min(1),
  fileName: z.string().min(1).max(300),
  contentType: z.string().nullable().optional(),
  byteSize: z.number().int().nonnegative().nullable().optional(),
  linkType: z.enum(ATTACHMENT_LINK_TYPES),
  linkId: z.uuid(),
});

export type FinalizeAttachmentInput = z.infer<
  typeof finalizeAttachmentInputSchema
>;

/**
 * Records an already-uploaded object as an attachment and links it to a
 * transaction/account/asset/liability. Not atomic across the two inserts
 * (same caveat as elsewhere — no RPC yet); if the link insert fails, the
 * attachment row is deleted so it doesn't become orphaned, though the
 * uploaded storage object itself is left in place for now rather than
 * also being deleted here (storage cleanup on failure is a follow-up).
 */
export async function finalizeAttachment(
  input: FinalizeAttachmentInput,
): Promise<Attachment> {
  const parsed = finalizeAttachmentInputSchema.parse(input);
  const supabase = createServiceClient();

  const { data: attachmentRow, error: attachmentError } = await supabase
    .from("attachments")
    .insert({
      user_id: OWNER_USER_ID,
      storage_bucket: BUCKET,
      storage_path: parsed.path,
      file_name: parsed.fileName,
      content_type: parsed.contentType ?? null,
      byte_size: parsed.byteSize ?? null,
    })
    .select("id, file_name, content_type, byte_size, created_at")
    .single();

  if (attachmentError) {
    throw new Error(`Failed to record attachment: ${attachmentError.message}`);
  }

  const { error: linkError } = await insertLink(
    supabase,
    parsed.linkType,
    parsed.linkId,
    attachmentRow.id,
  );

  if (linkError) {
    await supabase.from("attachments").delete().eq("id", attachmentRow.id);
    throw new Error(`Failed to link attachment: ${linkError.message}`);
  }

  return {
    id: attachmentRow.id,
    fileName: attachmentRow.file_name,
    contentType: attachmentRow.content_type,
    byteSize: attachmentRow.byte_size,
    createdAt: attachmentRow.created_at,
  };
}

export async function listAttachmentsForAccount(
  accountId: string,
): Promise<Attachment[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("account_attachments")
    .select("attachments(id, file_name, content_type, byte_size, created_at)")
    .eq("account_id", accountId)
    .eq("user_id", OWNER_USER_ID);

  if (error) {
    throw new Error(`Failed to load attachments: ${error.message}`);
  }

  return data
    .map((row) => row.attachments)
    .filter(
      (attachment): attachment is NonNullable<typeof attachment> =>
        attachment !== null,
    )
    .map((attachment) => ({
      id: attachment.id,
      fileName: attachment.file_name,
      contentType: attachment.content_type,
      byteSize: attachment.byte_size,
      createdAt: attachment.created_at,
    }));
}

/**
 * Short-lived (60s) signed download URL. Callers should fetch this
 * immediately before redirecting the browser to it, not cache it.
 */
export async function createDownloadUrl(attachmentId: string): Promise<string> {
  const supabase = createServiceClient();

  const { data: attachment, error: attachmentError } = await supabase
    .from("attachments")
    .select("storage_bucket, storage_path")
    .eq("id", attachmentId)
    .eq("user_id", OWNER_USER_ID)
    .maybeSingle();

  if (attachmentError) {
    throw new Error(`Failed to load attachment: ${attachmentError.message}`);
  }
  if (!attachment) {
    throw new Error("Attachment not found");
  }

  const { data, error } = await supabase.storage
    .from(attachment.storage_bucket)
    .createSignedUrl(attachment.storage_path, 60);

  if (error) {
    throw new Error(`Failed to create download URL: ${error.message}`);
  }

  return data.signedUrl;
}
