import Link from "next/link";
import type { Metadata } from "next";
import { Landmark, Receipt, Upload } from "lucide-react";

import { Hero } from "@/components/ui/hero";

export const metadata: Metadata = {
  title: "Log",
};

const ITEMS = [
  {
    href: "/transactions",
    label: "Transactions",
    description: "Add, edit, or delete a transaction — tag it to a cycle.",
    icon: Receipt,
  },
  {
    href: "/accounts",
    label: "Accounts",
    description: "Balances, and a place to correct one that's drifted.",
    icon: Landmark,
  },
  {
    href: "/imports",
    label: "Imports",
    description: "Upload a credit card statement PDF — parsed automatically.",
    icon: Upload,
  },
] as const;

/**
 * v2.1: new primary tab, replacing Transactions in the bottom nav (a
 * landing hub for the things that used to be scattered under More).
 *
 * v3.4.14: the Recurring card is gone — Recurring (templates + bulk
 * cycle-tag) was removed entirely, too complicated for how this
 * household actually uses the app (see docs/00-current-state.md).
 * Transactions takes its place instead: it's the primary add/edit/
 * delete/cycle-tag screen again (reversing its v2.0.0 read-only
 * demotion), so it belongs here, one tap away, rather than under More.
 */
export default function LogPage() {
  return (
    <div>
      <Hero
        title="Log"
        sub="Add or edit a transaction, correct a balance, or import a statement."
      />
      <div className="space-y-4 p-5 sm:p-8">
        <ul className="rounded-[20px] bg-surface shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
          {ITEMS.map((item) => (
            <li
              key={item.href}
              className="border-b border-line last:border-b-0"
            >
              <Link
                href={item.href}
                className="flex items-center gap-4 px-[18px] py-4 transition-colors hover:bg-bg"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-accent-soft text-accent">
                  <item.icon className="size-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">{item.label}</p>
                  <p className="text-xs text-ink-faint">{item.description}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
