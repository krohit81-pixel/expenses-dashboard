import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // v3.6.0 -- @react-pdf/renderer's underlying `pdfkit` loads its
  // standard-14 font data files (standard-fonts/Helvetica.cjs, etc.) via
  // a runtime-computed path, not a static import/require Next's output
  // file tracer can see. Worked locally (next start runs the whole repo
  // as one process) but broke in the real Vercel deployment: the
  // serverless function for this route was built without those files
  // ("Cannot find module '.../pdfkit/js/standard-fonts/Helvetica.cjs'"),
  // confirmed via `vercel logs` against the live 500. This forces them
  // into the traced output for the one route that needs them, regardless
  // of what static analysis can detect.
  outputFileTracingIncludes: {
    "/api/reports/credit-cards": ["./node_modules/pdfkit/js/**"],
  },
};

export default nextConfig;
