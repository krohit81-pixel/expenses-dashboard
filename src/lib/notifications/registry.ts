import "server-only";

import type {
  ChannelType,
  NotificationProvider,
} from "@/lib/notifications/provider";
import { telegramProvider } from "@/lib/notifications/providers/telegram";
import { webPushProvider } from "@/lib/notifications/providers/web-push";

/**
 * The only place ReminderService (or anything else) should go to find
 * a NotificationProvider — adding a second channel later means adding
 * one entry here, not touching any caller. See provider.ts's own
 * comment for the reasoning.
 *
 * v3.4.0 Phase 2 added `web_push` (Ahaana's mini app) as the second
 * real entry here — see `listChannelTypes()`'s own comment for why
 * that made `ReminderService.sendCandidates()` need an explicit
 * per-caller channel list instead of always trying every registered
 * channel.
 */
const PROVIDERS: Record<ChannelType, NotificationProvider> = {
  telegram: telegramProvider,
  web_push: webPushProvider,
};

export function getProvider(channelType: ChannelType): NotificationProvider {
  return PROVIDERS[channelType];
}

/**
 * Every registered channel — used as sendCandidates()'s *default*
 * only. Since v3.4.0 Phase 2 added `web_push` (targeting Ahaana's
 * device specifically, never the household), no real caller should
 * actually rely on this default anymore: `runReminders()`/
 * `runHourlyReminders()` explicitly pass `["telegram"]` and
 * `runAhaanaReminders()` explicitly passes `["web_push"]`, so an
 * event meant for the household Telegram group never also fires at
 * Ahaana's device and vice versa. Kept as a real function (not
 * removed) since a caller with no opinion — a future manual "test
 * every configured channel" tool, say — still has a sane default to
 * fall back to.
 */
export function listChannelTypes(): ChannelType[] {
  return Object.keys(PROVIDERS) as ChannelType[];
}
