import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env/server", () => ({
  serverEnv: {
    APP_SESSION_SECRET: "a".repeat(32),
    TELEGRAM_WEBHOOK_SECRET: "fixture-secret",
  },
}));
vi.mock("@/services/NotificationChannelService", () => ({
  getSendTarget: vi.fn(),
}));
vi.mock("@/services/CalendarEventService", () => ({
  listCalendarEvents: vi.fn(),
  createCalendarEvent: vi.fn(),
}));
vi.mock("@/services/TripService", () => ({ listTrips: vi.fn() }));
vi.mock("@/services/RecurringCalendarEventService", () => ({
  listRecurringCalendarEvents: vi.fn(),
}));
vi.mock("@/lib/ai/providers", () => ({ callConfiguredProvider: vi.fn() }));
vi.mock("@/lib/telegram/parse-reminder", () => ({
  extractReminderFromMessage: vi.fn(),
}));
vi.mock("@/lib/notifications/providers/telegram", () => ({
  telegramProvider: { send: vi.fn() },
}));

import { callConfiguredProvider } from "@/lib/ai/providers";
import { telegramProvider } from "@/lib/notifications/providers/telegram";
import { extractReminderFromMessage } from "@/lib/telegram/parse-reminder";
import { getSendTarget } from "@/services/NotificationChannelService";
import {
  listCalendarEvents,
  createCalendarEvent,
} from "@/services/CalendarEventService";
import { listTrips } from "@/services/TripService";
import { listRecurringCalendarEvents } from "@/services/RecurringCalendarEventService";
import { POST } from "./route";

const extraction = {
  intent: "calendar",
  from: "2026-11-01",
  to: "2026-11-30",
  people: ["Ahaana"],
  tag: "vacation",
  keywords: [],
  focus: "end",
  next: false,
};

function request(
  text = "when does Ahaana vacation is ending this month",
  chatId = -123,
  secret = "fixture-secret",
) {
  return new NextRequest("http://localhost/api/telegram/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-telegram-bot-api-secret-token": secret,
    },
    body: JSON.stringify({
      update_id: 123,
      message: {
        chat: { id: chatId },
        from: { first_name: "Rohit" },
        text,
        date: Date.parse("2026-11-11T12:00:00Z") / 1000,
      },
    }),
  });
}

describe("Telegram calendar chat through the webhook", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getSendTarget).mockResolvedValue("-123");
    vi.mocked(callConfiguredProvider).mockResolvedValue(
      JSON.stringify(extraction),
    );
    vi.mocked(listCalendarEvents).mockResolvedValue([]);
    vi.mocked(listTrips).mockResolvedValue([]);
    vi.mocked(listRecurringCalendarEvents).mockResolvedValue([]);
    vi.mocked(telegramProvider.send).mockResolvedValue({ ok: true });
  });

  it("answers the supplied vacation question from the real school data without writing", async () => {
    expect((await POST(request())).status).toBe(200);
    expect(telegramProvider.send).toHaveBeenCalledWith("-123", {
      title: "Atlas Calendar",
      body: "Ahaana: Diwali Vacations ends on Tuesday, 17 November 2026.\nStarts: Friday, 6 November 2026.",
    });
    expect(callConfiguredProvider).toHaveBeenCalledWith(
      expect.stringContaining("2026-11-11"),
      2000,
    );
    expect(createCalendarEvent).not.toHaveBeenCalled();
    expect(extractReminderFromMessage).not.toHaveBeenCalled();
  });

  it("rejects an invalid webhook secret before calling AI or fetching data", async () => {
    expect((await POST(request(undefined, -123, "wrong"))).status).toBe(401);
    expect(getSendTarget).not.toHaveBeenCalled();
    expect(callConfiguredProvider).not.toHaveBeenCalled();
  });

  it("ignores unlinked chats before invoking AI", async () => {
    await POST(request(undefined, -999));
    expect(callConfiguredProvider).not.toHaveBeenCalled();
    expect(telegramProvider.send).not.toHaveBeenCalled();
  });

  it("silently ignores ordinary messages and unrelated questions", async () => {
    await POST(request("Good morning everyone"));
    expect(callConfiguredProvider).not.toHaveBeenCalled();
    vi.mocked(callConfiguredProvider).mockResolvedValue('{"intent":"ignore"}');
    await POST(request("What is the weather?"));
    expect(telegramProvider.send).not.toHaveBeenCalled();
    expect(listCalendarEvents).not.toHaveBeenCalled();
  });

  it("gives a clear response when AI is unavailable", async () => {
    vi.mocked(callConfiguredProvider).mockResolvedValue(null);
    await POST(request());
    expect(telegramProvider.send).toHaveBeenCalledWith(
      "-123",
      expect.objectContaining({
        body: expect.stringContaining("provider configured"),
      }),
    );
    expect(listCalendarEvents).not.toHaveBeenCalled();
  });

  it("asks for clarification when extraction fails validation", async () => {
    vi.mocked(callConfiguredProvider).mockResolvedValue("broken JSON");
    await POST(request());
    expect(telegramProvider.send).toHaveBeenCalledWith(
      "-123",
      expect.objectContaining({
        body: expect.stringContaining("Please include"),
      }),
    );
    expect(createCalendarEvent).not.toHaveBeenCalled();
  });

  it("includes database events, trips and expanded recurring classes", async () => {
    vi.mocked(callConfiguredProvider).mockResolvedValue(
      JSON.stringify({
        ...extraction,
        people: [],
        tag: null,
        focus: "schedule",
      }),
    );
    vi.mocked(listCalendarEvents).mockResolvedValue([
      {
        id: "event-fixture",
        title: "Dentist",
        tag: "event",
        people: ["Rohit"],
        startDate: "2026-11-03",
        endDate: "2026-11-03",
        startTime: "09:00",
        endTime: "10:00",
        notes: null,
        remindEnabled: false,
        remindLeadDays: 0,
        remindLeadHours: null,
      },
    ]);
    vi.mocked(listTrips).mockResolvedValue([
      {
        id: "trip-fixture",
        destination: "Fixture trip",
        travelerNames: ["Aradhana"],
        startDate: "2026-11-01",
        endDate: "2026-11-03",
        flight: null,
        notes: null,
        remindEnabled: false,
        remindLeadDays: 0,
      },
    ]);
    vi.mocked(listRecurringCalendarEvents).mockResolvedValue([
      {
        id: "class-fixture",
        title: "French",
        people: ["Ahaana"],
        mode: null,
        daysOfWeek: [1],
        startDate: "2026-11-02",
        endDate: "2026-11-02",
        startTime: "08:00",
        endTime: "09:00",
        notes: null,
        remindEnabled: false,
        remindLeadDays: 0,
        remindLeadHours: null,
      },
    ]);
    await POST(request("What is on this month?"));
    const answer = vi.mocked(telegramProvider.send).mock.calls[0][1].body;
    expect(answer).toContain("Dentist");
    expect(answer).toContain("Fixture trip");
    expect(answer).toContain("French");
  });

  it("does not answer from partial data if a source fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(listTrips).mockRejectedValue(new Error("fixture failure"));
    expect((await POST(request())).status).toBe(200);
    expect(telegramProvider.send).toHaveBeenCalledWith(
      "-123",
      expect.objectContaining({
        body: expect.stringContaining("couldn't load"),
      }),
    );
    log.mockRestore();
  });

  it("still routes explicit reminder requests to the existing creation flow", async () => {
    vi.mocked(extractReminderFromMessage).mockResolvedValue({
      ok: false,
      reason: "no-date",
    });
    await POST(request("Can you remind me to call the plumber?"));
    expect(extractReminderFromMessage).toHaveBeenCalledOnce();
    expect(callConfiguredProvider).not.toHaveBeenCalled();
  });
});
