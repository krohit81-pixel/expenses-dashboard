import type { Metadata } from "next";

import { requireUser } from "@/lib/auth/require-user";
import { getUserSettings } from "@/services/UserSettingsService";
import { getChannel } from "@/services/NotificationChannelService";
import { Hero } from "@/components/ui/hero";
import { SettingsForm } from "@/features/onboarding/components/SettingsForm";
import { TelegramSettingsForm } from "@/features/notifications/components/TelegramSettingsForm";
import { RunRemindersButton } from "@/features/notifications/components/RunRemindersButton";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  const user = await requireUser();
  const [settings, telegramChannel] = await Promise.all([
    getUserSettings(user.id),
    getChannel("telegram"),
  ]);

  return (
    <div>
      <Hero title="Settings" />
      <div className="space-y-4 p-5 sm:p-8">
        <div className="rounded-[20px] bg-surface p-[18px] shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
          <SettingsForm
            baseCurrency={settings?.baseCurrency ?? "USD"}
            timezone={settings?.timezone ?? "UTC"}
          />
        </div>

        {/* v3.2.0 — reminders for calendar events/trips/recurring
            events, first channel Telegram. See
            docs/00-current-state.md's v3.2.0 section for the full
            architecture. */}
        <div className="rounded-[20px] bg-surface p-[18px] shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
          <h2 className="mb-3 font-display text-[15px] font-bold text-ink">
            Reminders
          </h2>
          <TelegramSettingsForm
            initialChatId={telegramChannel?.target ?? null}
            isVerified={telegramChannel?.isVerified ?? false}
          />
          <div className="mt-4 border-t border-line pt-4">
            <p className="mb-2 text-xs text-ink-faint">
              Checks every calendar event, trip, and recurring event with
              reminders turned on, and sends anything due today. Runs
              automatically once a schedule is wired up — for now, run it by
              hand.
            </p>
            <RunRemindersButton />
          </div>
        </div>
      </div>
    </div>
  );
}
