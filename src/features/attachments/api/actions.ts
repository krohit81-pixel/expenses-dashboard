"use server";

import { revalidatePath } from "next/cache";

import {
  createUploadTarget,
  finalizeAttachment,
  finalizeAttachmentInputSchema,
} from "@/services/AttachmentService";

export async function createUploadTargetAction(fileName: string) {
  return createUploadTarget(fileName);
}

export interface FinalizeAttachmentFormState {
  error?: string;
  success?: boolean;
}

export async function finalizeAttachmentAction(input: {
  path: string;
  fileName: string;
  contentType: string | null;
  byteSize: number | null;
  linkType: "transaction" | "account" | "asset" | "liability";
  linkId: string;
}): Promise<FinalizeAttachmentFormState> {
  const parsed = finalizeAttachmentInputSchema.safeParse(input);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await finalizeAttachment(parsed.data);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Something went wrong",
    };
  }

  revalidatePath("/accounts");
  return { success: true };
}
