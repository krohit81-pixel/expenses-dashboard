import type { Metadata } from "next";

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
      <h1 className="text-xl font-semibold">Imports</h1>
      <p className="mt-2 text-sm text-muted-foreground">Not implemented yet.</p>
    </div>
  );
}
