import Image from "next/image";

import { AhaanaLoginForm } from "@/features/ahaana/components/AhaanaLoginForm";

/**
 * v3.4.0 — sits outside the (app) route group entirely (this whole
 * /ahaana tree isn't nested under it), mirroring how /login itself
 * sits outside (app) — a full-screen standalone page, not the main
 * app's chrome. middleware.ts treats this exact path as public (see
 * its own comment) so the form can render before any gate check.
 * No own `metadata` export — inherits the parent ahaana/layout.tsx's
 * default title ("Ahaana's Studies") as-is rather than composing it
 * through that layout's own "%s | Ahaana's Studies" template, which
 * would otherwise double up into "Ahaana's Studies | Ahaana's Studies".
 */
export default function AhaanaLoginPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-[hsl(var(--hero-1))] to-[hsl(var(--hero-2))] px-5">
      <div className="w-full max-w-sm text-center">
        {/* Same mark as the main /login page — still Atlas underneath,
            just her own section of it. Same translate nudge as that
            page's own Image (see its comment): compensates for the
            source PNG's off-center artwork, not a layout bug here. */}
        <Image
          src="/atlas-mark.png"
          alt="Atlas"
          width={140}
          height={164}
          className="mx-auto mb-4 translate-x-[7%] translate-y-[5%]"
          priority
        />
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
