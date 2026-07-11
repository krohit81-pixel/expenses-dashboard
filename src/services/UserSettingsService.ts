import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  userSettingsInputSchema,
  type UserSettingsInput,
} from "@/features/onboarding/schemas";

export type { UserSettingsInput };

export interface UserSettings {
  userId: string;
  baseCurrency: string;
  timezone: string;
}

export async function getUserSettings(
  userId: string,
): Promise<UserSettings | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_settings")
    .select("user_id, base_currency, timezone")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load user settings: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return {
    userId: data.user_id,
    baseCurrency: data.base_currency,
    timezone: data.timezone,
  };
}

/**
 * Creates the user_settings row that marks onboarding as complete.
 * Idempotent: if a row already exists this updates it rather than erroring,
 * so a resubmitted onboarding form doesn't fail.
 */
export async function completeOnboarding(
  userId: string,
  input: UserSettingsInput,
): Promise<UserSettings> {
  const parsed = userSettingsInputSchema.parse(input);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("user_settings")
    .upsert(
      {
        user_id: userId,
        base_currency: parsed.baseCurrency,
        timezone: parsed.timezone,
      },
      { onConflict: "user_id" },
    )
    .select("user_id, base_currency, timezone")
    .single();

  if (error) {
    throw new Error(`Failed to save user settings: ${error.message}`);
  }

  return {
    userId: data.user_id,
    baseCurrency: data.base_currency,
    timezone: data.timezone,
  };
}
