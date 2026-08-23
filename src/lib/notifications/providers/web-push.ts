import "server-only";

import webpush from "web-push";

import { serverEnv } from "@/lib/env/server";
import type {
  NotificationMessage,
  NotificationProvider,
  SendResult,
  WebPushSubscription,
} from "@/lib/notifications/provider";

/**
 * v3.4.0 Phase 2 — real device push for Ahaana's mini app (she has no
 * Telegram). `target` is a JSON-stringified WebPushSubscription
 * (NotificationChannelService.mapRow builds it that way so this
 * channel fits the same `target: string` shape every other channel
 * already uses) — this is the one place that parses it back.
 *
 * ahaana-sw.js (public/) is the client-side half: it's what actually
 * displays a Notification from the payload this sends, and what
 * handles a tap on it (focuses/opens /ahaana).
 */
function vapidConfigured(): boolean {
  return Boolean(
    serverEnv.VAPID_PUBLIC_KEY &&
    serverEnv.VAPID_PRIVATE_KEY &&
    serverEnv.VAPID_SUBJECT,
  );
}

async function sendWebPush(
  subscription: WebPushSubscription,
  message: NotificationMessage,
): Promise<SendResult> {
  webpush.setVapidDetails(
    serverEnv.VAPID_SUBJECT!,
    serverEnv.VAPID_PUBLIC_KEY!,
    serverEnv.VAPID_PRIVATE_KEY!,
  );

  try {
    const result = await webpush.sendNotification(
      subscription,
      JSON.stringify({ title: message.title, body: message.body }),
    );
    return { ok: true, providerMessageId: String(result.statusCode) };
  } catch (error) {
    // web-push rejects with a WebPushError carrying statusCode/body on
    // an actual push-service response (e.g. 410 Gone — the
    // subscription expired or was revoked on the device), or a plain
    // Error for a network failure — either way, the message is enough
    // to log and act on, same convention as the Telegram provider's
    // own error handling.
    const message = error instanceof Error ? error.message : "Push send failed";
    return { ok: false, error: message };
  }
}

export const webPushProvider: NotificationProvider = {
  channelType: "web_push",
  isConfigured(): boolean {
    return vapidConfigured();
  },
  async send(target, message) {
    if (!vapidConfigured()) {
      return { ok: false, error: "VAPID keys are not configured" };
    }

    let subscription: WebPushSubscription;
    try {
      subscription = JSON.parse(target);
    } catch {
      return { ok: false, error: "Stored push subscription is not valid JSON" };
    }

    return sendWebPush(subscription, message);
  },
};
