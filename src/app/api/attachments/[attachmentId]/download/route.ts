import { NextResponse, type NextRequest } from "next/server";

import { requireUser } from "@/lib/auth/require-user";
import { createDownloadUrl } from "@/services/AttachmentService";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ attachmentId: string }> },
) {
  await requireUser();
  const { attachmentId } = await params;

  try {
    const signedUrl = await createDownloadUrl(attachmentId);
    return NextResponse.redirect(signedUrl);
  } catch {
    return NextResponse.json(
      { error: "Attachment not found" },
      { status: 404 },
    );
  }
}
