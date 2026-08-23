/**
 * v3.4.0 Phase 2 — the minimal service worker behind Ahaana's mini
 * app's push reminders. Registered only from /ahaana (never the main
 * app) by EnablePushButton (src/features/ahaana/components/). Two
 * jobs only: show a Notification when a push arrives, and focus/open
 * /ahaana when she taps it.
 *
 * Deliberately its own file, not shared with any future main-app
 * service worker — this app has no other push/offline infrastructure
 * today, and scoping this file to exactly what /ahaana needs keeps it
 * simple to reason about.
 */

// v3.4.7 — without these two, an UPDATED version of this file (any
// future edit to it) would sit "waiting" behind whatever version
// already controls the page until every open tab/instance of the app
// closes — which would make navigator.serviceWorker.ready hang
// waiting for activation (EnablePushButton's own fix for the sibling
// InvalidStateError bug this same pass), not just on first install.
// skipWaiting() activates a new worker immediately instead of waiting;
// clients.claim() lets it start controlling already-open pages right
// away instead of only new ones. Safe here specifically because this
// worker has no versioned cache to worry about stepping on mid-use
// (it does nothing but show notifications) — a worker doing real
// caching would need more care around this.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = { title: "Ahaana's Studies", body: "You have a reminder." };
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      // Not JSON for some reason — fall back to the default above
      // rather than showing a blank/broken notification.
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes("/ahaana") && "focus" in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow("/ahaana");
        }
        return undefined;
      }),
  );
});
