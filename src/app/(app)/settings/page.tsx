import type { Metadata } from "next";

import { requireUser } from "@/lib/auth/require-user";
import { getUserSettings } from "@/services/UserSettingsService";
import { Hero } from "@/components/ui/hero";
import { SettingsForm } from "@/features/onboarding/components/SettingsForm";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  const user = await requireUser();
  const settings = await getUserSettings(user.id);

  return (
    <div>
      <Hero title="Settings" />
      <div className="p-5 sm:p-8">
        <div className="rounded-[20px] bg-surface p-[18px] shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
          <SettingsForm
            baseCurrency={settings?.baseCurrency ?? "USD"}
            timezone={settings?.timezone ?? "UTC"}
          />
        </div>
      </div>
    </div>
  );
}
