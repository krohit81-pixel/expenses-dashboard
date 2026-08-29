"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SVGProps } from "react";

import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: (props: SVGProps<SVGSVGElement>) => React.ReactElement;
}

function HomeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v9h5v-6h2v6h5v-9" />
    </svg>
  );
}
function BarsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path d="M5 19V10" />
      <path d="M12 19V5" />
      <path d="M19 19v-6" />
    </svg>
  );
}
function LogIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <rect x="5" y="4" width="14" height="17" rx="2.2" />
      <path d="M9 3.3v3" />
      <path d="M15 3.3v3" />
      <path d="M8.5 12.5 10.5 14.5 15 9.5" />
    </svg>
  );
}
function CalendarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <rect x="3.5" y="5.5" width="17" height="15" rx="2.5" />
      <path d="M3.5 10h17" />
      <path d="M8 3.5v3" />
      <path d="M16 3.5v3" />
    </svg>
  );
}
/**
 * v2.1.0: Dashboard / Log / Intel / Calendar, plus More — up from the
 * v2.0.0 three-tab set (Home/Calendar/Intel). Two changes, both at the
 * household's explicit request:
 *
 * - "Home" is relabeled "Dashboard" (same /dashboard route) now that it
 *   absorbs Budgets' full breakdown too — "where I see the budget:
 *   monthly cycle-wise break up of expenses/income," in their words.
 * - "Log" is new: a landing hub (add/edit a transaction, correct an
 *   account balance, import a statement) for the things that used to
 *   be scattered under More as separate destinations.
 *
 * Accounts, Transactions, and Imports move out of the More-group
 * matcher below accordingly — they're reachable from Log now, not
 * More. (Recurring used to be here too — removed entirely in v3.4.14,
 * see docs/00-current-state.md.)
 *
 * v2.5.8: More itself is gone from here — it's a hamburger icon next
 * to the logo in Hero now (components/ui/hero.tsx), not a fifth item
 * in either nav bar. Both TopNav and BottomNav render exactly these
 * four now; BottomNav's grid went 5 columns -> 4 accordingly.
 */
const PRIMARY_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: HomeIcon },
  { href: "/log", label: "Log", icon: LogIcon },
  { href: "/intel", label: "Intel", icon: BarsIcon },
  { href: "/calendar", label: "Calendar", icon: CalendarIcon },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/log") {
    return ["/log", "/transactions", "/accounts", "/imports"].some((path) =>
      pathname.startsWith(path),
    );
  }
  return pathname.startsWith(href);
}

/** Desktop nav, rendered inside the gradient Hero — translucent pill links on the dark background. */
/** Desktop nav — lives in the shared (app)/layout.tsx, present on every page regardless of whether that page has a Hero. */
/** v1.1.6: label text bumped 13px -> 14.5px, alongside the same bump on BottomNav below, at the user's request. */
/** v1.2: gained the same stroke icons BottomNav already had — TopNav never had icons at all (not a regression, just never built with them), which read as missing/broken on iPad and Mac where TopNav is what's visible. */
export function TopNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="hidden items-center gap-1.5 sm:flex">
      {PRIMARY_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3.5 py-2 font-display text-[14.5px] font-semibold transition-colors",
              active
                ? "bg-[hsl(var(--accent-soft))] text-[hsl(var(--accent))]"
                : "text-[hsl(var(--ink-faint))] hover:text-[hsl(var(--ink))]",
            )}
          >
            <item.icon className="size-[17px] fill-none stroke-current stroke-[1.7] [stroke-linecap:round] [stroke-linejoin:round]" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Mobile bottom nav — plain stroke SVG icons (currentColor, no fill/badge),
 * a thin top hairline, and color/weight as the only active-state signal.
 * Deliberately not a filled pill: reference apps (Bloomberg, a voice
 * assistant app) the person pointed to use exactly this quieter pattern.
 *
 * v1.1.6: label text bumped 10px -> 11.5px, at the user's request.
 *
 * v3.1.1: each link's own bottom padding trimmed (py-3 -> pt-2.5 pb-1.5)
 * — stacked on top of this nav's own `env(safe-area-inset-bottom)`
 * padding below, `py-3`'s full 12px read as a visibly oversized gap
 * under every label on a real notched phone, not just extra breathing
 * room. Top padding barely touched, so the tap target doesn't shrink
 * much; the safe-area inset itself is untouched — that's the real
 * device-mandated gap protecting the home-indicator gesture area, not
 * the bug being fixed here.
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[hsl(var(--line))] bg-[hsl(var(--surface))] sm:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-4">
        {PRIMARY_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 pb-1.5 pt-2.5 font-display text-[11.5px] font-semibold tracking-wide",
                  active
                    ? "font-extrabold text-[hsl(var(--ink))]"
                    : "text-[hsl(var(--ink-faint))]",
                )}
              >
                <item.icon className="size-[21px] fill-none stroke-current stroke-[1.7] [stroke-linecap:round] [stroke-linejoin:round]" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
