import type { Metadata } from "next";

import { Hero } from "@/components/ui/hero";

export const metadata: Metadata = {
  title: "Imports",
};

/**
 * Placeholder. Real "Imports" functionality is scoped to a later milestone —
 * see docs/12-roadmap-and-implementation-order.md. This page exists now so
 * the (app) shell nav has no dead links.
 */
export default function ImportsPage() {
  return (
    <div>
      <Hero title="Imports" />
      <div className="p-5 sm:p-8">
        <p className="text-sm text-ink-faint">Not implemented yet.</p>
      </div>
    </div>
  );
}
