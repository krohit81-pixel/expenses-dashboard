"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  AHAANA_ACCESS_COOKIE_NAME,
  checkAhaanaAccessPassword,
  createAhaanaAccessToken,
} from "@/lib/ahaana-gate";

export interface AhaanaAccessFormState {
  error?: string;
}

export async function submitAhaanaAccessPasswordAction(
  _prevState: AhaanaAccessFormState,
  formData: FormData,
): Promise<AhaanaAccessFormState> {
  const password = String(formData.get("password") ?? "");

  if (!checkAhaanaAccessPassword(password)) {
    return { error: "Incorrect password." };
  }

  const cookieStore = await cookies();
  cookieStore.set(AHAANA_ACCESS_COOKIE_NAME, createAhaanaAccessToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    // Scoped to /ahaana only — the browser won't even send this
    // cookie on a request to any other path, a small extra layer on
    // top of middleware.ts's own real enforcement.
    path: "/ahaana",
    maxAge: 60 * 60 * 24 * 30, // 30 days, matches the token's own expiry
  });

  redirect("/ahaana");
}

export async function ahaanaLogoutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete({ name: AHAANA_ACCESS_COOKIE_NAME, path: "/ahaana" });
  redirect("/ahaana/login");
}
