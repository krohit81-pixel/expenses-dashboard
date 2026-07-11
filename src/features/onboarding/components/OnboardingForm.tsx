"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  submitOnboarding,
  type OnboardingFormState,
} from "@/features/onboarding/api/actions";

const COMMON_CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "INR",
  "AUD",
  "CAD",
  "JPY",
  "SGD",
  "AED",
];

function detectTimezones(): string[] {
  if (typeof Intl.supportedValuesOf === "function") {
    return Intl.supportedValuesOf("timeZone");
  }
  return ["UTC"];
}

function detectDefaultTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

const initialState: OnboardingFormState = {};

export function OnboardingForm() {
  const [state, formAction, isPending] = useActionState(
    submitOnboarding,
    initialState,
  );
  const timezones = detectTimezones();
  const defaultTimezone = detectDefaultTimezone();

  return (
    <form action={formAction} className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-lg font-semibold">Set up your dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Pick the currency and timezone you want your finances tracked in. You
          can change these later in Settings.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="baseCurrency">Base currency</Label>
        <Select
          id="baseCurrency"
          name="baseCurrency"
          defaultValue="USD"
          required
        >
          {COMMON_CURRENCIES.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="timezone">Timezone</Label>
        <Select
          id="timezone"
          name="timezone"
          defaultValue={defaultTimezone}
          required
        >
          {timezones.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </Select>
      </div>

      <FieldError message={state.error} />

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Saving…" : "Continue"}
      </Button>
    </form>
  );
}
