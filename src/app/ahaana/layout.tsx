import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * v3.4.3 — metadata-only wrapper for the entire /ahaana tree (both
 * `/ahaana/login` and the `(gated)` group), so "Add to Home Screen"
 * shows her own app identity instead of inheriting the root layout's
 * `manifest`/`appleWebApp` (which point at Atlas itself, name "Atlas",
 * start_url "/"). Metadata fields not re-declared by a page under here
 * (most only set `title`) inherit these — same Next.js metadata
 * cascade every other nested layout/page pair in this app already
 * relies on.
 *
 * Renders `children` directly with no DOM of its own — the actual
 * chrome for the gated pages lives in `(gated)/layout.tsx`, and
 * `/ahaana/login` is a full-screen page with no shared chrome at all;
 * this layer exists purely so both can share one metadata
 * declaration instead of each repeating it.
 */
export const metadata: Metadata = {
  title: {
    // `absolute`, not `default` — a plain `default` here would still
    // get wrapped by the ROOT layout's own "%s | Atlas" template
    // (title templates only skip an ancestor's template for a segment
    // that provides no title object of its own; this one does, so it
    // needs `absolute` to fully opt out and read as just "Ahaana's
    // Studies", not "Ahaana's Studies | Atlas"). `template` below still
    // applies normally to pages nested under this layout that provide
    // a plain string title (e.g. "This Week" -> "This Week | Ahaana's
    // Studies").
    absolute: "Ahaana's Studies",
    template: "%s | Ahaana's Studies",
  },
  manifest: "/ahaana-manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Ahaana's Studies",
  },
};

export default function AhaanaRootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return children;
}
