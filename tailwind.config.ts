import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",

        // Locked design-system tokens — see globals.css for values/derivation.
        bg: "hsl(var(--bg))",
        surface: "hsl(var(--surface))",
        ink: {
          DEFAULT: "hsl(var(--ink))",
          soft: "hsl(var(--ink-soft))",
          faint: "hsl(var(--ink-faint))",
        },
        hero: {
          1: "hsl(var(--hero-1))",
          2: "hsl(var(--hero-2))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          soft: "hsl(var(--accent-soft))",
        },
        positive: {
          DEFAULT: "hsl(var(--positive))",
          soft: "hsl(var(--positive-soft))",
        },
        negative: {
          DEFAULT: "hsl(var(--negative))",
          soft: "hsl(var(--negative-soft))",
        },
        line: "hsl(var(--line))",

        // Compatibility aliases for pages not yet rewritten in this
        // redesign (Accounts, Recurring, Net worth, Settings, More,
        // onboarding) — mapped to the closest new-palette equivalent so
        // they don't silently break before their turn in a later phase.
        // Prefer the tokens above (ink-faint, negative, accent, etc.) in
        // any new or rewritten page; don't reach for these on purpose.
        muted: {
          DEFAULT: "hsl(var(--bg))",
          foreground: "hsl(var(--ink-faint))",
        },
        destructive: {
          DEFAULT: "hsl(var(--negative))",
          foreground: "#ffffff",
        },
        primary: {
          DEFAULT: "hsl(var(--ink))",
          foreground: "#ffffff",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 6px)",
        sm: "var(--radius-sm)",
      },
      fontFamily: {
        display: ["Manrope", "ui-sans-serif", "sans-serif"],
        body: ["Inter", "ui-sans-serif", "sans-serif"],
      },
    },
  },
  plugins: [animate],
};

export default config;
