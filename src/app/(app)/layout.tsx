import Link from "next/link";
import type { ReactNode } from "react";

import { requireUser } from "@/lib/auth/require-user";

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

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/transactions", label: "Transactions" },
  { href: "/accounts", label: "Accounts" },
  { href: "/budgets", label: "Budgets" },
  { href: "/recurring", label: "Recurring" },
  { href: "/imports", label: "Imports" },
  { href: "/net-worth", label: "Net worth" },
  { href: "/settings", label: "Settings" },
] as const;

/**
 * Shell for every authenticated route. Redundant with middleware by design
 * (docs/11-security-and-privacy.md): middleware protects navigation,
 * requireUser() here protects direct Server Component data fetches.
 *
 * Individual feature pages (Milestone 1+) own their own content; this layout
 * only owns the persistent nav chrome.
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
        <nav
          aria-label="Primary"
          className="flex flex-wrap gap-x-4 gap-y-2 p-4"
        >
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main id="main-content" className="flex-1 p-4">
        {children}
      </main>
    </div>
  );
}
