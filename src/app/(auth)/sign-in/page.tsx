import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in",
};

/**
 * Placeholder. Real sign-in (magic link or OAuth via Supabase Auth) is
 * Milestone 1 scope — see docs/12-roadmap-and-implementation-order.md.
 * This page exists now so middleware has a real, non-404 redirect target.
 */
export default function SignInPage() {
  return (
    <div className="space-y-2 text-center">
      <h1 className="text-lg font-semibold">Sign in</h1>
      <p className="text-sm text-muted-foreground">
        Sign-in is not implemented yet. This page is a placeholder for Milestone
        1.
      </p>
    </div>
  );
}
