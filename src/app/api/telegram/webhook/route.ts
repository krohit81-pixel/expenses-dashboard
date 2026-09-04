import { NextResponse, type NextRequest } from "next/server";

import { checkTelegramWebhookAuth } from "@/lib/telegram/webhook-auth";
import { extractReminderFromMessage } from "@/lib/telegram/parse-reminder";
import { getSendTarget } from "@/services/NotificationChannelService";
import { createCalendarEvent } from "@/services/CalendarEventService";
import { telegramProvider } from "@/lib/notifications/providers/telegram";

/**
 * v3.7.0 — the household's first inbound webhook. Telegram POSTs every
 * message in the linked group chat here; a message containing "remind"
 * (any form, anywhere, case-insensitive — real phrasing includes "can
 * you remind Rohana...", not just "remind me") gets parsed by
 * lib/telegram/parse-reminder.ts and, if a title and date come out of
 * it, turned into a real calendar_events row via the same
 * createCalendarEvent every other event-creation path already uses.
 * Always replies in the same chat, either confirming what got created
 * or asking for whatever's missing — the safety net for any parsing
 * imperfection, since the trigger word alone is broad.
 *
 * Bypasses the access-gate cookie entirely (see middleware.ts's
 * PUBLIC_PATHS) — Telegram has no browser session to carry one. Auth
 * is checkTelegramWebhookAuth (a secret Telegram echoes back on every
 * call once registered via setWebhook), plus a second, independent
 * check below that the message's own chat id matches the household's
 * configured Telegram target — defense in depth so only the linked
 * group can ever trigger a write, even in principle.
 *
 * Every branch returns 200 — Telegram retries a non-2xx response,
 * which would risk double-creating an event or double-sending a reply
 * on any transient failure, so even the "something went wrong" path
 * below stays a 200 with a best-effort apology reply rather than a
 * 500.
 */

interface TelegramUpdate {
  message?: {
    chat?: { id?: number };
    from?: { first_name?: string };
    text?: string;
  };
}

const REMIND_PATTERN = /remind/i;

export async function POST(request: NextRequest) {
  const auth = checkTelegramWebhookAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let update: TelegramUpdate;
  try {
    update = await request.json();
  } catch {
    // Malformed body — ack anyway so Telegram doesn't retry-storm it.
    return NextResponse.json({ ok: true });
  }

  const text = update.message?.text;
  const chatId = update.message?.chat?.id;
  const senderFirstName = update.message?.from?.first_name ?? "Someone";

  if (!text || chatId === undefined || !REMIND_PATTERN.test(text)) {
    return NextResponse.json({ ok: true }); // no trigger word — silent no-op
  }

  const configuredChatId = await getSendTarget("telegram");
  if (!configuredChatId || configuredChatId !== chatId.toString()) {
    return NextResponse.json({ ok: true }); // not the household's linked chat
  }

  const target = chatId.toString();

  try {
    const result = await extractReminderFromMessage(text, senderFirstName);

    if (!result.ok) {
      const body =
        result.reason === "no-date"
          ? 'I caught the reminder but couldn\'t tell what date it\'s for — try something like "remind me tomorrow to..." or "remind me on the 12th to...".'
          : 'I couldn\'t tell what to remind you about from that message — try phrasing like "remind me tomorrow at 6pm to call the plumber".';
      await telegramProvider.send(target, {
        title: "Couldn't create that reminder",
        body,
      });
      return NextResponse.json({ ok: true });
    }

    const event = await createCalendarEvent({
      title: result.event.title,
      tag: result.event.tag,
      people: result.event.people,
      startDate: result.event.startDate,
      endDate: result.event.startDate,
      startTime: result.event.startTime,
      endTime: null,
      notes: result.event.notes,
      remindEnabled: true,
      remindLeadDays: result.event.remindLeadDays,
      remindLeadHours: result.event.remindLeadHours,
    });

    await telegramProvider.send(target, {
      title: "Reminder created",
      body: [
        `📅 ${event.title}`,
        `${event.startDate}${event.startTime ? ` at ${event.startTime}` : ""}`,
        event.people.length > 0 ? `👥 ${event.people.join(", ")}` : null,
        event.remindLeadHours !== null
          ? `⏰ ${event.remindLeadHours}h before`
          : `⏰ ${event.remindLeadDays === 0 ? "same day" : `${event.remindLeadDays}d before`}`,
      ]
        .filter((line): line is string => Boolean(line))
        .join("\n"),
    });

    return NextResponse.json({ ok: true, eventId: event.id });
  } catch (error) {
    console.error("Telegram webhook failed to create a reminder:", error);
    await telegramProvider
      .send(target, {
        title: "Something went wrong",
        body: "I couldn't create that reminder — please try again or add it directly in Atlas.",
      })
      .catch(() => {
        // Best-effort — if even the apology fails to send, there's
        // nothing more useful to do than let this request return 200.
      });
    return NextResponse.json({ ok: true });
  }
}
