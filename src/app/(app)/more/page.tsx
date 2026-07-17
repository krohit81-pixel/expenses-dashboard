import Link from "next/link";
import {
  Landmark,
  LogOut,
  Repeat,
  Settings,
  TrendingUp,
  Upload,
  Wallet,
} from "lucide-react";
import type { Metadata } from "next";

import { Hero } from "@/components/ui/hero";
import { ThemeToggle } from "@/features/settings/ThemeToggle";
import { logoutAction } from "@/features/access-gate/api/actions";

export const metadata: Metadata = {
  title: "More",
};

const ITEMS = [
  {
    href: "/budgets",
    label: "Budgets",
    description: "Income & fixed expenses, editable.",
    icon: Wallet,
  },
  {
    href: "/accounts",
    label: "Accounts",
    description: "Banks, cards, cash — balances and where money lives.",
    icon: Landmark,
  },
  {
    href: "/recurring",
    label: "Recurring",
    description:
      "Every recurring template, including transfers — the full list behind Budgets.",
    icon: Repeat,
  },
  {
    href: "/net-worth",
    label: "Net worth",
    description: "Everything you own minus everything you owe.",
    icon: TrendingUp,
  },
  {
    href: "/imports",
    label: "Imports",
    description: "Bring in bank statements. Not built yet.",
    icon: Upload,
  },
  {
    href: "/settings",
    label: "Settings",
    description: "Base currency, timezone.",
    icon: Settings,
  },
] as const;

export default function MorePage() {
  return (
    <div>
      <Hero title="More" />
      <div className="space-y-4 p-5 sm:p-8">
        <ul className="rounded-[20px] bg-surface shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
          {ITEMS.map((item) => (
            <li
              key={item.href}
              className="border-b border-line last:border-b-0"
            >
              <Link
                href={item.href}
                className="flex items-center gap-4 px-[18px] py-3.5 transition-colors hover:bg-bg"
              >
                <item.icon
                  className="size-5 shrink-0 text-ink-faint"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">{item.label}</p>
                  <p className="text-xs text-ink-faint">{item.description}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>

        <ThemeToggle />

        <form action={logoutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-[20px] bg-negative-soft px-[18px] py-3.5 text-sm font-semibold text-negative transition-colors hover:opacity-80"
          >
            <LogOut className="size-5 shrink-0" aria-hidden="true" />
            Log out of this device
          </button>
        </form>
      </div>
    </div>
  );
}
