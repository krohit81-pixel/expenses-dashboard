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
