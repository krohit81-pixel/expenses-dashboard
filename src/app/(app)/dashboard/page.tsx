import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
};

/**
 * Placeholder. The real cash-flow dashboard is Milestone 1 scope — see
 * docs/12-roadmap-and-implementation-order.md. This page exists now so the
 * post-sign-in redirect target resolves instead of 404ing.
 */
export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold">Dashboard</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Not implemented yet — this is the Milestone 0 placeholder.
      </p>
    </div>
  );
}
