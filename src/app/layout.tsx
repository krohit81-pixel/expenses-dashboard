import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { headers } from "next/headers";

import "./globals.css";

export const metadata: Metadata = {
  applicationName: "Atlas",
  title: {
    default: "Atlas",
    template: "%s | Atlas",
  },
  description: "A private personal finance dashboard.",
  // NOT `manifest` here (or `app/manifest.ts` as a route file — see
  // public/manifest.webmanifest instead) — v3.4.3 found, the hard way,
  // that Next.js auto-injects a `<link rel="manifest">` from an
  // `app/manifest.ts` file-convention route into EVERY page
  // unconditionally, regardless of what any `metadata.manifest` field
  // anywhere in the tree says (verified with an actual `next build` +
  // `next start` + curl, not just the dev server, which happens to
  // mask this). `/ahaana/*` needs its own different manifest, so both
  // manifests are now plain static files under `public/`, and the
  // `<link rel="manifest">` is rendered explicitly, conditionally,
  // below — a real element in this layout's own JSX, not the metadata
  // API's special-cased field.
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Atlas",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#241457",
};

/**
 * Fonts are loaded via a plain <link>, not next/font/google. next/font
 * fetches font files at BUILD time, which needs network access to
 * fonts.googleapis.com from wherever `next build` runs — that's not
 * available in the sandbox this was built in, so it couldn't be verified
 * there. A plain <link> fetches at request time from the visitor's own
 * browser instead, which is fully within Next.js's supported patterns for
 * external fonts and doesn't depend on the build environment's network
 * access. Trade-off: no self-hosting/preload optimization next/font
 * provides — worth revisiting once this can be verified somewhere with
 * broader network access.
 */
export default async function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  // v3.4.3 — which manifest to link depends on path (Atlas's own vs.
  // Ahaana's), read from the header middleware.ts's nextWithPathname
  // forwards (Server Components have no built-in "current pathname"
  // API the way Client Components' usePathname() does).
  const pathname = (await headers()).get("x-pathname") ?? "";
  const isAhaana = pathname === "/ahaana" || pathname.startsWith("/ahaana/");
  const manifestHref = isAhaana
    ? "/ahaana-manifest.webmanifest"
    : "/manifest.webmanifest";

  return (
    <html lang="en">
      <head>
        <link rel="manifest" href={manifestHref} />
        {/* Runs before hydration to avoid a flash of the wrong theme —
            standard pattern for class-based dark mode with SSR. Falls
            back to system preference only when the person hasn't
            explicitly chosen yet (no stored value).
            v3.4.3: /ahaana always stays light, full stop — her section
            has no ThemeToggle at all (nothing to switch it back with),
            and defaulting to *her device's* own system preference (dark,
            in the report that prompted this) looked broken/unfinished
            rather than intentional. Checked via pathname, not the shared
            'atlas-theme' localStorage key, since that key is one shared
            value across the whole origin — reading it here would still
            pick up whatever the household last set for their own
            side of the app. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(location.pathname.startsWith('/ahaana'))return;var t=localStorage.getItem('atlas-theme');var d=t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();`,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- this rule targets the Pages Router's per-page _document.js; App Router's root layout is the correct single place for site-wide fonts */}
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700;800&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body">{children}</body>
    </html>
  );
}
