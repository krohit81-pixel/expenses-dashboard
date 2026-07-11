import type { Metadata } from "next";

import { requireUser } from "@/lib/auth/require-user";
import { getUserSettings } from "@/services/UserSettingsService";
import { SettingsForm } from "@/features/onboarding/components/SettingsForm";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  const user = await requireUser();
  const settings = await getUserSettings(user.id);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Settings</h1>
      <SettingsForm
        baseCurrency={settings?.baseCurrency ?? "USD"}
        timezone={settings?.timezone ?? "UTC"}
      />
    </div>
  );
}
