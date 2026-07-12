"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  ACCESS_COOKIE_NAME,
  checkAccessPassword,
  createAccessToken,
} from "@/lib/access-gate";

export interface AccessGateFormState {
  error?: string;
}

export async function submitAccessPasswordAction(
  _prevState: AccessGateFormState,
  formData: FormData,
): Promise<AccessGateFormState> {
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/dashboard");

  if (!checkAccessPassword(password)) {
    return { error: "Incorrect password." };
  }

  const cookieStore = await cookies();
  cookieStore.set(ACCESS_COOKIE_NAME, createAccessToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days, matches the token's own expiry
  });

  redirect(next.startsWith("/") ? next : "/dashboard");
}

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ACCESS_COOKIE_NAME);
  redirect("/login");
}
