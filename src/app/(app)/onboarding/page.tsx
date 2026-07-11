import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { requireUser } from "@/lib/auth/require-user";
import { getUserSettings } from "@/services/UserSettingsService";
import { OnboardingForm } from "@/features/onboarding/components/OnboardingForm";

export const metadata: Metadata = {
  title: "Set up your dashboard",
};

export default async function OnboardingPage() {
  const user = await requireUser();
  const settings = await getUserSettings(user.id);

  if (settings) {
    redirect("/dashboard");
  }

  return <OnboardingForm />;
}
