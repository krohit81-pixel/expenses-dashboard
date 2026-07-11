import type { ReactNode } from "react";

import { requireUser } from "@/lib/auth/require-user";
import { BottomNav, TopNav } from "@/components/app-nav";

/**
 * Every page under this layout reads live data via the service-role
 * client (src/lib/supabase/service.ts), which has no per-request dynamic
 * API call (no cookies(), no headers()) to signal that to Next.js the way
 * the old session-based client did automatically. Without this, Next.js
 * tries to statically prerender these pages at build time — which
 * actually attempts to hit Supabase during the build and fails. This
 * segment config applies to the whole subtree under (app).
 */
export const dynamic = "force-dynamic";

/**
 * Shell for every route. Nav is two different components for the same
 * four-item (plus More) list — a compact top bar on desktop, a fixed
 * bottom tab bar on mobile — rather than one nav that tries to serve
 * both, since the interaction pattern (click vs. thumb-reach) is
 * different enough to warrant it. See src/components/app-nav.tsx for the
 * actual item list and the reasoning behind what made the cut.
 */
export default async function AppLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  await requireUser();

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-background focus:px-3 focus:py-2 focus:text-foreground focus:outline focus:outline-2"
      >
        Skip to content
      </a>
      <header className="border-b">
        <div className="flex items-center justify-between p-4">
          <span className="text-sm font-semibold">Finance</span>
          <TopNav />
        </div>
      </header>
      <main id="main-content" className="flex-1 p-4 pb-20 sm:pb-4">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
