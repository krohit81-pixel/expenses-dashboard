import Link from "next/link";
import { Landmark, Repeat, Settings, TrendingUp, Upload } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "More",
};

const ITEMS = [
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
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">More</h1>
      <ul className="divide-y rounded-lg border">
        {ITEMS.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="flex items-center gap-4 p-4 transition-colors hover:bg-bg"
            >
              <item.icon
                className="size-5 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <div>
                <p className="font-medium">{item.label}</p>
                <p className="text-sm text-muted-foreground">
                  {item.description}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
