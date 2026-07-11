"use client";

import { useRouter } from "next/navigation";
import { useState, type ChangeEvent } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  createUploadTargetAction,
  finalizeAttachmentAction,
} from "@/features/attachments/api/actions";
import { createClient } from "@/lib/supabase/client";

export function AccountAttachmentUploader({
  accountId,
}: {
  accountId: string;
}) {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setIsUploading(true);
    setError(null);

    try {
      const { path, token } = await createUploadTargetAction(file.name);

      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from("finance-attachments")
        .uploadToSignedUrl(path, token, file);

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const result = await finalizeAttachmentAction({
        path,
        fileName: file.name,
        contentType: file.type || null,
        byteSize: file.size,
        linkType: "account",
        linkId: accountId,
      });

      if (result.error) {
        throw new Error(result.error);
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="space-y-1">
      <Label htmlFor={`attachment-${accountId}`} className="sr-only">
        Attach a file
      </Label>
      <input
        id={`attachment-${accountId}`}
        type="file"
        onChange={handleFileChange}
        disabled={isUploading}
        className="text-sm"
      />
      {isUploading && (
        <p className="text-xs text-muted-foreground">Uploading…</p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function AttachmentList({
  attachments,
}: {
  attachments: { id: string; fileName: string }[];
}) {
  if (attachments.length === 0) return null;

  return (
    <ul className="mt-2 space-y-1">
      {attachments.map((attachment) => (
        <li key={attachment.id}>
          <Button asChild variant="ghost" size="sm">
            <a href={`/api/attachments/${attachment.id}/download`}>
              {attachment.fileName}
            </a>
          </Button>
        </li>
      ))}
    </ul>
  );
}
