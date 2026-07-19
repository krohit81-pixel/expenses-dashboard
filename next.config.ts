import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // v1.3.1 — pdfjs-dist (statement PDF extraction, src/lib/pdf/extract-text.ts)
  // loads its optional Node canvas/DOMMatrix polyfill (@napi-rs/canvas) via a
  // runtime `require()` written to survive bundlers, but Vercel's deployment
  // file-tracing still can't see that dynamic require when webpack inlines
  // it into a Server Action's bundle, so @napi-rs/canvas's native binary was
  // missing from the deployed function ("DOMMatrix is not defined" in
  // production, despite working fine locally). Marking only @napi-rs/canvas
  // external fixes that: it becomes a plain node_modules require at runtime,
  // which Vercel traces correctly. Deliberately NOT listing pdfjs-dist
  // itself here — it's also used client-side, in AddTripModal's itinerary
  // parsing, which needs webpack to keep bundling it normally for the
  // browser (externalizing it broke that build with an ESM worker-import
  // error). pdfjs-dist itself is pure JS with no native binary, so leaving
  // it bundled server-side is fine; only its native canvas dependency needs
  // to stay external.
  serverExternalPackages: ["@napi-rs/canvas"],
};

export default nextConfig;
