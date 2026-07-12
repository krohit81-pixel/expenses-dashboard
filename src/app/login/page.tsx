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
        <h1 className="mb-1 font-display text-xl font-extrabold text-white">
          Expense Dashboard
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
