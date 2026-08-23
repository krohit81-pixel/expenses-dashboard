"use client";

import { useEffect, useState } from "react";
import { Bell, BellRing, Smartphone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { saveAhaanaPushSubscriptionAction } from "@/features/ahaana/api/push-actions";

type Status =
  | "checking"
  | "unsupported"
  | "ios-needs-install"
  | "off"
  | "denied"
  | "on"
  | "requesting"
  | "error";

/** Standard boilerplate for turning a base64url VAPID public key into the Uint8Array pushManager.subscribe() wants as applicationServerKey. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64Safe);
  return Uint8Array.from(rawData, (char) => char.charCodeAt(0));
}

/** True only for iOS Safari NOT already added to the Home Screen — the one case Web Push cannot work in at all (iOS 16.4+ only supports it for an installed PWA), where the fix is "add this page to your Home Screen first," not a permission prompt. `navigator.standalone` is iOS Safari's own (non-standard, deliberately checked this way) flag for "already installed." */
function isIosNeedingInstall(): boolean {
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- navigator.standalone is iOS Safari-only, not in the standard lib.dom types
  const isStandalone = (navigator as any).standalone === true;
  return isIos && !isStandalone;
}

/**
 * v3.4.0 Phase 2 — Ahaana's "enable reminders" control. Adapts to
 * whichever of three real states the browser is actually in, rather
 * than assuming a single device type:
 * 1. iOS Safari, not installed to Home Screen — shows an install
 *    instruction instead of a button that would just silently fail
 *    (Web Push doesn't exist at all for a plain iOS Safari tab).
 * 2. Not yet subscribed anywhere else (Android/desktop Chrome, or iOS
 *    already installed) — a real "Enable reminders" button.
 * 3. Already subscribed — a quiet confirmation, no button.
 */
export function EnablePushButton({
  vapidPublicKey,
}: {
  vapidPublicKey: string | null;
}) {
  const [status, setStatus] = useState<Status>("checking");
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    if (isIosNeedingInstall()) {
      setStatus("ios-needs-install");
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }

    navigator.serviceWorker
      .getRegistration("/ahaana-sw.js")
      .then((registration) => registration?.pushManager.getSubscription())
      .then((subscription) => setStatus(subscription ? "on" : "off"))
      .catch(() => setStatus("off"));
  }, []);

  async function handleEnable() {
    if (!vapidPublicKey) {
      setStatus("error");
      setError("Push notifications aren't configured yet — ask your parent.");
      return;
    }

    setStatus("requesting");
    setError(undefined);

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("denied");
        return;
      }

      await navigator.serviceWorker.register("/ahaana-sw.js");
      // v3.4.7 — register() resolves as soon as the worker starts
      // installing, not once it's actually active; pushManager.subscribe()
      // needs an ACTIVE worker and throws InvalidStateError otherwise
      // (a real bug caught from the household's own retry, not a
      // hypothetical). navigator.serviceWorker.ready resolves only once
      // there's an active worker controlling this scope, on a fresh
      // registration or an existing one alike.
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        // TS's lib.dom types for BufferSource want a Uint8Array backed
        // specifically by ArrayBuffer, not the wider ArrayBufferLike
        // (which also covers SharedArrayBuffer) a plain
        // Uint8Array.from(...) produces — the actual runtime value is
        // always a real ArrayBuffer here, this is a type-level-only
        // mismatch.
        applicationServerKey: urlBase64ToUint8Array(
          vapidPublicKey,
        ) as BufferSource,
      });

      const result = await saveAhaanaPushSubscriptionAction(
        subscription.toJSON() as never,
      );
      if (!result.success) {
        setStatus("error");
        setError(result.error ?? "Something went wrong");
        return;
      }
      setStatus("on");
    } catch (err) {
      // v3.4.5 — was a fixed "try again" string with the real cause
      // thrown away, which made a real failure (WebKit push
      // subscription errors are usually a specific DOMException name
      // like AbortError/NotAllowedError, not a generic one) impossible
      // to diagnose from a report alone. Showing the actual message
      // costs nothing (this only ever runs on Ahaana's own device,
      // there's no sensitive data in a DOMException's name/message) and
      // turns "it didn't work" into something actionable.
      setStatus("error");
      setError(
        err instanceof Error
          ? `Couldn't enable reminders: ${err.name}: ${err.message}`
          : "Couldn't enable reminders — try again.",
      );
    }
  }

  if (status === "checking" || status === "unsupported") {
    return null;
  }

  if (status === "ios-needs-install") {
    return (
      <div className="flex items-center gap-3 rounded-[16px] border border-line bg-surface p-3.5">
        <Smartphone className="size-5 shrink-0 text-ink-faint" />
        <p className="text-[12px] leading-relaxed text-ink-soft">
          To get reminders on this iPhone, add this page to your Home Screen
          first (Share → Add to Home Screen), then open it from there.
        </p>
      </div>
    );
  }

  if (status === "on") {
    return (
      <div className="flex items-center gap-2.5 rounded-[16px] border border-line bg-surface p-3.5 text-[12.5px] font-semibold text-positive">
        <BellRing className="size-4.5 shrink-0" />
        Reminders are on for this device
      </div>
    );
  }

  return (
    <div className="rounded-[16px] border border-line bg-surface p-3.5">
      <Button
        type="button"
        variant="outline"
        loading={status === "requesting"}
        onClick={handleEnable}
        className="w-full"
      >
        <Bell className="size-4" />
        {status === "denied"
          ? "Notifications blocked — check your browser settings"
          : "Enable reminders on this device"}
      </Button>
      {error && <p className="mt-2 text-[11px] text-negative">{error}</p>}
    </div>
  );
}
