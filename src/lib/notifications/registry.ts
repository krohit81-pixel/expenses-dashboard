import "server-only";

import type {
  ChannelType,
  NotificationProvider,
} from "@/lib/notifications/provider";
import { telegramProvider } from "@/lib/notifications/providers/telegram";

/**
 * The only place ReminderService (or anything else) should go to find
 * a NotificationProvider — adding a second channel later means adding
 * one entry here, not touching any caller. See provider.ts's own
 * comment for the reasoning.
 */
const PROVIDERS: Record<ChannelType, NotificationProvider> = {
  telegram: telegramProvider,
};

export function getProvider(channelType: ChannelType): NotificationProvider {
  return PROVIDERS[channelType];
}

export function listChannelTypes(): ChannelType[] {
  return Object.keys(PROVIDERS) as ChannelType[];
}
