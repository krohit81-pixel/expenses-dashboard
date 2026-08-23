import type { Metadata } from "next";

import { AhaanaLoginForm } from "@/features/ahaana/components/AhaanaLoginForm";

export const metadata: Metadata = {
  title: "Ahaana's Studies",
};

/**
 * v3.4.0 — sits outside the (app) route group entirely (this whole
 * /ahaana tree isn't nested under it), mirroring how /login itself
 * sits outside (app) — a full-screen standalone page, not the main
 * app's chrome. middleware.ts treats this exact path as public (see
 * its own comment) so the form can render before any gate check.
 */
export default function AhaanaLoginPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-[hsl(var(--hero-1))] to-[hsl(var(--hero-2))] px-5">
      <div className="w-full max-w-sm text-center">
        <h1 className="mb-1 font-display text-xl font-extrabold text-white">
          Ahaana&apos;s Studies
        </h1>
        <p className="mb-8 text-sm text-white/60">
          Enter your password to continue.
        </p>
        <AhaanaLoginForm />
      </div>
    </div>
  );
}
