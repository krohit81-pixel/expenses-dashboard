import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import { OWNER_USER_ID } from "@/lib/owner";
import type { ChannelType } from "@/lib/notifications/provider";

/**
 * The one place in the app that knows how a channel's send-target
 * (e.g. a Telegram chat ID) was obtained and where it lives — v3.2.0,
 * built specifically so the rest of the app (ReminderService, the
 * Telegram provider, the manual "Run reminders now" trigger) never
 * touches finance.notification_channels or the manual-entry Settings
 * form directly. Everything else just calls getSendTarget().
 *
 * Today that's a chat ID typed into Settings by hand
 * (TelegramSettingsForm -> saveTelegramChatIdAction -> setTelegramTarget
 * below). A future `/start`-webhook linking flow only ever needs to
 * change what's INSIDE this file (a webhook handler calling
 * setTelegramTarget with a chat ID it learned from Telegram instead of
 * from a form) — every caller of getSendTarget stays unchanged.
 */
export interface NotificationChannel {
  channelType: ChannelType;
  isEnabled: boolean;
  target: string | null;
  isVerified: boolean;
}

function mapRow(row: {
  channel_type: ChannelType;
  is_enabled: boolean;
  config: unknown;
  verified_at: string | null;
}): NotificationChannel {
  const config = (row.config ?? {}) as { chat_id?: string };
  return {
    channelType: row.channel_type,
    isEnabled: row.is_enabled,
    target: config.chat_id ?? null,
    isVerified: row.verified_at !== null,
  };
}

export async function getChannel(
  channelType: ChannelType,
): Promise<NotificationChannel | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("notification_channels")
    .select("channel_type, is_enabled, config, verified_at")
    .eq("user_id", OWNER_USER_ID)
    .eq("channel_type", channelType)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load notification channel: ${error.message}`);
  }
  return data ? mapRow(data) : null;
}

/**
 * The send target for a channel, or null if it isn't linked/enabled —
 * this is the ONLY function ReminderService calls to find out where a
 * reminder should go. Returns null (not a target) whenever the channel
 * is disabled, unlinked, or its config is missing the expected field,
 * so a caller only ever has to check "did I get a string back," never
 * reach into config shape itself.
 */
export async function getSendTarget(
  channelType: ChannelType,
): Promise<string | null> {
  const channel = await getChannel(channelType);
  if (!channel || !channel.isEnabled) return null;
  return channel.target;
}

/** Telegram-specific: store a manually-entered chat ID. Resets verified_at — a changed chat ID needs a fresh "Send test message" before it's trusted, same as a changed statement password isn't assumed correct until it's actually decrypted something. */
export async function setTelegramTarget(chatId: string): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.from("notification_channels").upsert(
    {
      user_id: OWNER_USER_ID,
      channel_type: "telegram",
      is_enabled: true,
      config: { chat_id: chatId },
      verified_at: null,
    },
    { onConflict: "user_id,channel_type" },
  );

  if (error) {
    throw new Error(`Failed to save Telegram chat ID: ${error.message}`);
  }
}

export async function markChannelVerified(
  channelType: ChannelType,
): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("notification_channels")
    .update({ verified_at: new Date().toISOString() })
    .eq("user_id", OWNER_USER_ID)
    .eq("channel_type", channelType);

  if (error) {
    throw new Error(`Failed to mark channel verified: ${error.message}`);
  }
}
