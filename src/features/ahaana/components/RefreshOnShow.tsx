"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * v3.4.3 — no visible UI; fixes a real symptom the household reported:
 * an activity that had just been added didn't show up on the weekly
 * schedule until she tapped something on the page, at which point it
 * "suddenly appeared."
 *
 * The likely cause is iOS Safari's standalone-PWA behavior: reopening
 * an app from the Home Screen icon often restores the exact DOM/JS
 * snapshot from when it was last backgrounded (a `pageshow` event with
 * `persisted: true`, or the tab simply never having been torn down)
 * instead of doing a fresh navigation — so a change made server-side
 * since she last had the app open doesn't show until *something* forces
 * a real re-render, e.g. submitting the mark-complete form's own
 * server action. That fits the report closely: the row was stale, not
 * missing, and any real interaction was enough to reveal the current
 * state underneath it.
 *
 * `router.refresh()` re-fetches this page's Server Components against
 * live data without a full reload/losing scroll position. Triggered on
 * `pageshow` (persisted only — a fresh load already fetches live data,
 * no need to double up) and on `visibilitychange` becoming visible
 * (covers the same "reopened after being backgrounded" case on
 * browsers/OSes that don't reliably fire `pageshow` for it).
 */
export function RefreshOnShow() {
  const router = useRouter();

  useEffect(() => {
    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        router.refresh();
      }
    }
    function handleVisibility() {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    }

    window.addEventListener("pageshow", handlePageShow);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("pageshow", handlePageShow);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [router]);

  return null;
}
