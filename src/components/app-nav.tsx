"use client";

import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  Settings,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/**
 * These four are the whole nav, on purpose — see the "More" item for
 * everything else. Chosen directly from what the person said they
 * actually use day to day, not the full feature list. Accounts,
 * Recurring, and Net worth still exist and work exactly as before; they
 * just aren't important enough to earn a permanent tap target on a
 * phone screen. Revisit this list if daily habits change, not by
 * default as new features ship.
 */
const PRIMARY_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/budgets", label: "Budgets", icon: Wallet },
  { href: "/settings", label: "Settings", icon: Settings },
];

const MORE_ITEM: NavItem = {
  href: "/more",
  label: "More",
  icon: MoreHorizontal,
};

function isActive(pathname: string, href: string): boolean {
  return href === "/more"
    ? ["/accounts", "/recurring", "/net-worth", "/imports", "/more"].some(
        (path) => pathname.startsWith(path),
      )
    : pathname.startsWith(href);
}

export function TopNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="hidden items-center gap-1 sm:flex">
      {[...PRIMARY_ITEMS, MORE_ITEM].map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <item.icon className="size-4" aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur sm:hidden"
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
                  "flex flex-col items-center gap-1 py-2 text-xs font-medium transition-colors",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <item.icon className="size-5" aria-hidden="true" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
