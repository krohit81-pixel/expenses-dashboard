import { NextResponse, type NextRequest } from "next/server";
import { registerGroceryWebhook } from "@/lib/telegram/grocery/api";

/** Browser access-gate middleware protects this route; same-origin POST prevents CSRF. */
export async function POST(request: NextRequest) {
  const origin = new URL(request.url).origin;
  if (request.headers.get("origin") !== origin)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    await registerGroceryWebhook(origin);
  } catch {
    return NextResponse.json(
      {
        error:
          "Registration failed. Check configuration, bot identity and group access on the grocery settings page.",
      },
      { status: 502 },
    );
  }
  return NextResponse.redirect(
    new URL("/settings/grocery?registered=1", request.url),
    303,
  );
}
