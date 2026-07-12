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
function WalletIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <rect x="3.5" y="6.5" width="17" height="12" rx="2.5" />
      <path d="M3.5 10.5h17" />
      <circle cx="16.5" cy="14.5" r="0.9" fill="currentColor" stroke="none" />
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
  { href: "/dashboard", label: "Dashboard", icon: HomeIcon },
  { href: "/transactions", label: "Transactions", icon: SwapIcon },
  { href: "/budgets", label: "Budgets", icon: WalletIcon },
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
        "/settings",
        "/more",
      ].some((path) => pathname.startsWith(path))
    : pathname.startsWith(href);
}

/** Desktop nav, rendered inside the gradient Hero — translucent pill links on the dark background. */
/** Desktop nav — lives in the shared (app)/layout.tsx, present on every page regardless of whether that page has a Hero. */
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
              "rounded-full px-3.5 py-2 font-display text-[13px] font-semibold transition-colors",
              active
                ? "bg-accent-soft text-accent"
                : "text-ink-faint hover:text-ink",
            )}
          >
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
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface sm:hidden"
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
                  "flex flex-col items-center gap-1 py-3 font-display text-[10px] font-semibold tracking-wide",
                  active ? "font-extrabold text-ink" : "text-ink-faint",
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
