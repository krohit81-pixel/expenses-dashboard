import type { ReactNode } from "react";
import Link from "next/link";

import { ahaanaLogoutAction } from "@/features/ahaana/api/actions";

/**
 * v3.4.0 — the chrome for every gated page under /ahaana (the weekly
 * view, /ahaana/manage). Deliberately NOT the main app's (app)/layout.tsx
 * — no BottomNav/TopNav pointing at Dashboard/Log/Intel/Calendar, since
 * this section has nothing to do with the rest of Atlas and she should
 * never be one tap away from it. middleware.ts is what actually
 * enforces her gate (see its own comment) — this layout only ever
 * renders once that's already passed.
 */
export const dynamic = "force-dynamic";

export default function AhaanaGatedLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <div className="min-h-dvh bg-bg">
      <header className="flex items-center justify-between border-b border-line bg-surface px-5 py-4 sm:px-8">
        <div>
          <div className="font-display text-[15px] font-extrabold text-ink">
            Ahaana&apos;s Studies
          </div>
          <Link
            href="/ahaana/manage"
            className="text-[11px] font-semibold text-accent"
          >
            Manage activities
          </Link>
        </div>
        <form action={ahaanaLogoutAction}>
          <button
            type="submit"
            className="rounded-full border border-line px-3 py-1.5 font-display text-[11px] font-bold text-ink-soft"
          >
            Log out
          </button>
        </form>
      </header>
      <main className="p-5 sm:p-8">{children}</main>
    </div>
  );
}
