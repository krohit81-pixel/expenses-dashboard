"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const TABS = [
  { href: "/ahaana", label: "Dashboard" },
  { href: "/ahaana/manage", label: "Log Activity" },
] as const;

/**
 * v3.4.10 — a real Client Component using `usePathname()`, not the
 * `(gated)/layout.tsx`'s own server-side `headers()` read this
 * replaces. That server-side approach (added v3.4.8) computed the
 * active tab once per real request, but `(gated)/layout.tsx` is a
 * SHARED layout segment for both `/ahaana` and `/ahaana/manage` —
 * Next.js's App Router reuses an already-rendered shared layout
 * across a client-side navigation between siblings under it rather
 * than re-rendering it, so that server-computed pathname never
 * updated after the first load: clicking "Log Activity" correctly
 * navigated, but "Dashboard" stayed highlighted blue (a real reported
 * bug, not hypothetical). `usePathname()` is the actual fix — a
 * reactive hook that updates on every client-side navigation
 * regardless of which layouts are shared, exactly why Next.js
 * provides it for this exact "highlight the active nav tab" case
 * (same pattern `components/app-nav.tsx`'s own TopNav/BottomNav
 * already use for the main app).
 */
export function AhaanaTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1.5 pb-3">
      {TABS.map((tab) => {
        const isActive =
          tab.href === "/ahaana"
            ? pathname === "/ahaana"
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "rounded-full px-3.5 py-1.5 font-display text-[12.5px] font-bold transition-colors",
              isActive
                ? "bg-accent text-white"
                : "bg-bg text-ink-faint hover:text-ink-soft",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
