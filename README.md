# Personal Finance Dashboard

Foundation for a private, installable personal finance dashboard. Product features are deliberately not implemented.

## Structure

- `src/app`: Next.js routes, layout, and PWA manifest
- `src/components/ui`: shadcn/ui primitives
- `src/features`: feature-owned UI and logic
- `src/services`: external service orchestration
- `src/lib`: shared utilities and Supabase clients
- `src/hooks`: reusable React hooks
- `src/types`: shared TypeScript contracts

## Setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and supply Supabase values.
3. Run `npm run dev`.

PWA icons are intentionally reserved at `public/icons/icon-192.png` and `public/icons/icon-512.png` for product branding.
