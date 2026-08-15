"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "atlas-theme";

/**
 * Starts as null (not yet known) rather than guessing "light" —
 * document.documentElement's actual class is set synchronously before
 * hydration by the inline script in the root layout, so reading it
 * during the initial render would disagree with the server's render
 * (which has no DOM to read at all) and trigger a hydration mismatch.
 * Syncing in an effect after mount avoids that; both ThemeToggle and
 * ThemeToggleButton briefly show no selection highlighted, which is a
 * fair trade against a hydration warning.
 *
 * v2.5.2: extracted out of ThemeToggle so ThemeToggleButton (the
 * compact single-icon variant used on the public /calendar page — see
 * that component) can share the exact same read/write logic rather than
 * re-implementing it and risking the two drifting apart.
 */
function useTheme() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(
      document.documentElement.classList.contains("dark") ? "dark" : "light",
    );
  }, []);

  function choose(next: Theme) {
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private browsing / storage disabled — theme still applies for
      // this session, it just won't persist across reloads.
    }
  }

  return { theme, choose };
}

/** The full "Appearance" card — Settings/More, behind the access gate. */
export function ThemeToggle() {
  const { theme, choose } = useTheme();

  return (
    <div className="rounded-[20px] bg-surface p-[18px] shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
      <p className="mb-3 text-sm font-semibold text-ink">Appearance</p>
      <div className="flex gap-2 rounded-full bg-bg p-1">
        <button
          type="button"
          onClick={() => choose("light")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 font-display text-xs font-bold transition-colors ${
            theme === "light"
              ? "bg-surface text-ink shadow-sm"
              : "text-ink-faint"
          }`}
        >
          <Sun className="size-3.5" aria-hidden="true" />
          Light
        </button>
        <button
          type="button"
          onClick={() => choose("dark")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 font-display text-xs font-bold transition-colors ${
            theme === "dark"
              ? "bg-surface text-ink shadow-sm"
              : "text-ink-faint"
          }`}
        >
          <Moon className="size-3.5" aria-hidden="true" />
          Dark
        </button>
      </div>
    </div>
  );
}

/**
 * Compact single-icon variant (v2.5.2) — for /calendar, the one page
 * reachable without logging in (see src/middleware.ts's PUBLIC_PATHS),
 * where the full "Appearance" card above isn't reachable at all since
 * it only lives on More, behind the access gate. Shows the icon for the
 * theme a tap would switch *to* (sun while dark, moon while light) —
 * the same convention as most single-button theme switchers — rather
 * than the two-option segmented control, which needs more room than a
 * header action affords.
 *
 * v3.0.0: recolored from a white-on-indigo pill (`bg-white/15`) to
 * `bg-ink/5`/`text-ink-soft` — this button only ever renders inside
 * Hero's `topRightAction`, and Hero dropped its indigo gradient
 * background in the same release (see `components/ui/hero.tsx`).
 */
export function ThemeToggleButton({ className }: { className?: string }) {
  const { theme, choose } = useTheme();

  return (
    <button
      type="button"
      onClick={() => choose(theme === "dark" ? "light" : "dark")}
      aria-label={
        theme === "dark" ? "Switch to light theme" : "Switch to dark theme"
      }
      className={`flex size-8 shrink-0 items-center justify-center rounded-full bg-ink/5 text-ink-soft transition-colors hover:bg-ink/10 ${className ?? ""}`}
    >
      {theme === "dark" ? (
        <Sun className="size-4" aria-hidden="true" />
      ) : (
        <Moon className="size-4" aria-hidden="true" />
      )}
    </button>
  );
}
