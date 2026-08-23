"use server";

import { setWebPushSubscription } from "@/services/NotificationChannelService";
import type { WebPushSubscription } from "@/lib/notifications/provider";

export interface SavePushSubscriptionResult {
  success: boolean;
  error?: string;
}

/**
 * v3.4.0 Phase 2 — a plain callable server action, not a <form> action:
 * EnablePushButton calls this directly with the subscription object
 * `pushManager.subscribe()` returns, right after getting it — there's
 * no form involved in this flow at all.
 */
export async function saveAhaanaPushSubscriptionAction(
  subscription: WebPushSubscription,
): Promise<SavePushSubscriptionResult> {
  try {
    await setWebPushSubscription(subscription);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Something went wrong",
    };
  }
}
