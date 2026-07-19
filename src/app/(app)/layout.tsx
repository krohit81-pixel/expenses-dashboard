import type { ReactNode } from "react";

import { requireUser } from "@/lib/auth/require-user";
import { AppFooter } from "@/components/app-footer";
import { BottomNav, TopNav } from "@/components/app-nav";

/**
 * Every page under this layout reads live data via the service-role
 * client (src/lib/supabase/service.ts), which has no per-request dynamic
 * API call to signal that to Next.js automatically. Without this, Next.js
 * tries to statically prerender these pages at build time — which
 * actually attempts to hit Supabase during the build and fails.
 */
export const dynamic = "force-dynamic";

/**
 * Shell for every route. Both nav bars live here now, unconditionally —
 * they used to live inside each page's <Hero> (mobile bottom nav still
 * does), but that meant the desktop top nav only existed on the four
 * pages that had a Hero (Dashboard, Transactions, Budgets, Intel).
 * Accounts, Recurring, Net worth, Settings, and More had no way to
 * navigate away from them on desktop at all — a real regression, caught
 * from actual usage, not a hypothetical. Single persistent nav location
 * fixes it for every page at once, past and future.
 */
export default async function AppLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  await requireUser();

  return (
    <div className="min-h-dvh bg-[hsl(var(--bg))] pb-28 sm:pb-0">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-[hsl(var(--surface))] focus:px-3 focus:py-2 focus:text-[hsl(var(--ink))] focus:outline focus:outline-2"
      >
        Skip to content
      </a>
      <div className="hidden items-center justify-end border-b border-[hsl(var(--line))] bg-[hsl(var(--surface))] px-8 py-3 sm:flex">
        <TopNav />
      </div>
      <main id="main-content">{children}</main>
      <AppFooter />
      <BottomNav />
    </div>
  );
}
