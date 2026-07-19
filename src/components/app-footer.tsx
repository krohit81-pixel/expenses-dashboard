/**
 * v1.2 — a simple sign-off at the bottom of every page: who built this
 * for the household, and a one-line reminder of what it's for. Sits
 * inside the normal document flow after <main>, above the fixed
 * BottomNav on mobile (the shell's pb-28 already reserves room for
 * BottomNav's fixed height, so this doesn't get hidden behind it) and
 * at the true bottom of the page on desktop, where BottomNav doesn't
 * render at all.
 */
export function AppFooter() {
  return (
    <footer className="px-5 py-8 text-center sm:px-8">
      <p className="font-display text-[11.5px] font-bold text-ink-soft">
        Prepared by Rohit Kohli
      </p>
      <p className="mt-1 text-[11px] text-ink-faint">
        Your complete financial and life navigation system.
      </p>
    </footer>
  );
}
