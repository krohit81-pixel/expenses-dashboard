import "server-only";

/**
 * The generic notification-provider shape (v3.2.0) — deliberately mirrors
 * src/lib/ai/providers.ts's pattern (a thin, server-only interface per
 * external service, env-gated, "optional enhancement, never crashes the
 * app" philosophy), so a second channel (email, push, WhatsApp) later is
 * a new file implementing this same interface, not a change to
 * ReminderService or anything calendar-side.
 *
 * `channelType` matches finance.notification_channel_type
 * (supabase/migrations/20260822061100_create_notifications.sql) — kept
 * as a plain string union here rather than importing the generated enum
 * type, since this module has no reason to depend on the DB layer at
 * all (a provider only ever sends; it never reads or writes a row).
 *
 * "web_push" added v3.4.0 Phase 2 — Ahaana's mini app, real device
 * push since she has no Telegram (providers/web-push.ts).
 */
export type ChannelType = "telegram" | "web_push";

/**
 * The shape a browser's `PushSubscription.toJSON()` produces — v3.4.0
 * Phase 2. Stored as JSON inside `finance.notification_channels.config`
 * (NotificationChannelService), then JSON-stringified into the plain
 * `target: string` every other channel already uses, so nothing about
 * getSendTarget()/ReminderService's shape needed to change for this
 * channel to exist.
 */
export interface WebPushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface NotificationMessage {
  title: string;
  body: string;
}

export interface SendResult {
  ok: boolean;
  /** The provider's own id for the sent message, if it returns one — stored on notification_log for debugging, never required. */
  providerMessageId?: string;
  /** Present when ok is false. Truncated before logging by the caller, same convention as lib/ai/providers.ts's error bodies. */
  error?: string;
}

export interface NotificationProvider {
  channelType: ChannelType;
  /** Env-level check only (e.g. is TELEGRAM_BOT_TOKEN set) — says nothing about whether any particular user has actually linked this channel. See NotificationChannelService for that. */
  isConfigured(): boolean;
  send(target: string, message: NotificationMessage): Promise<SendResult>;
}
