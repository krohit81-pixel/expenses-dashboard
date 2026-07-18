import Image from "next/image";
import type { Metadata } from "next";

import { LoginForm } from "@/features/access-gate/components/LoginForm";

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-[hsl(var(--hero-1))] to-[hsl(var(--hero-2))] px-5">
      <div className="w-full max-w-sm text-center">
        {/* translate-x/y compensate for the source PNG itself, not a
            layout bug: measured the actual artwork's visible content
            (the ring + the "A") and its centroid sits about 11% left
            and 9% above the true center of its own canvas — the ambient
            glow background is full-bleed so getbbox()/eyeballing it
            both miss that. mx-auto centers this element's box correctly;
            the nudge re-centers what's actually visible *inside* that
            box. If the source asset (public/atlas-mark.png) ever gets
            re-exported centered, remove this and the raw mx-auto will
            be correct again. */}
        <Image
          src="/atlas-mark.png"
          alt="Atlas"
          width={140}
          height={164}
          className="mx-auto mb-4 translate-x-[7%] translate-y-[5%]"
          priority
        />
        <h1 className="mb-1 font-display text-xl font-extrabold text-white">
          Atlas
        </h1>
        <p className="mb-8 text-sm text-white/60">
          Enter the password to continue.
        </p>
        <LoginForm next={next ?? "/dashboard"} />
        <p className="mt-8 text-xs text-white/40">
          Looking for the shared calendar?{" "}
          <a href="/calendar" className="underline">
            No password needed
          </a>
          .
        </p>
      </div>
    </div>
  );
}
