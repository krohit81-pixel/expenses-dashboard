import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  applicationName: "Atlas",
  title: {
    default: "Atlas",
    template: "%s | Atlas",
  },
  description: "A private personal finance dashboard.",
  manifest: "/manifest.webmanifest",
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
export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head>
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
