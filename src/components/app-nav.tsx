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
function SwapIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path d="M4 8h13l-3-3" />
      <path d="M20 16H7l3 3" />
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
function MoreIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * Four primary destinations plus More — chosen from what the person said
 * they actually use daily, not the full feature list. Accounts, Recurring,
 * and Net worth live under /more; nothing was deleted, just demoted.
 */
const PRIMARY_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: HomeIcon },
  { href: "/transactions", label: "Transactions", icon: SwapIcon },
  { href: "/calendar", label: "Calendar", icon: CalendarIcon },
  { href: "/intel", label: "Intel", icon: BarsIcon },
];

const MORE_ITEM: NavItem = { href: "/more", label: "More", icon: MoreIcon };

function isActive(pathname: string, href: string): boolean {
  return href === "/more"
    ? [
        "/accounts",
        "/recurring",
        "/net-worth",
        "/imports",
        "/budgets",
        "/settings",
        "/more",
      ].some((path) => pathname.startsWith(path))
    : pathname.startsWith(href);
}

/** Desktop nav, rendered inside the gradient Hero — translucent pill links on the dark background. */
/** Desktop nav — lives in the shared (app)/layout.tsx, present on every page regardless of whether that page has a Hero. */
/** v1.1.6: label text bumped 13px -> 14.5px, alongside the same bump on BottomNav below, at the user's request. */
/** v1.2: gained the same stroke icons BottomNav already had — TopNav never had icons at all (not a regression, just never built with them), which read as missing/broken on iPad and Mac where TopNav is what's visible. */
export function TopNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="hidden items-center gap-1.5 sm:flex">
      {[...PRIMARY_ITEMS, MORE_ITEM].map((item) => {
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
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[hsl(var(--line))] bg-[hsl(var(--surface))] sm:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-5">
        {[...PRIMARY_ITEMS, MORE_ITEM].map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 py-3 font-display text-[11.5px] font-semibold tracking-wide",
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
