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
 * Syncing in an effect after mount avoids that; the toggle itself
 * briefly shows no selection highlighted, which is a fair trade against
 * a hydration warning.
 */
export function ThemeToggle() {
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
