"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  updateSettingsAction,
  type UpdateSettingsFormState,
} from "@/features/onboarding/api/update-settings-action";

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

const initialState: UpdateSettingsFormState = {};

export function SettingsForm({
  baseCurrency,
  timezone,
}: {
  baseCurrency: string;
  timezone: string;
}) {
  const [state, formAction, isPending] = useActionState(
    updateSettingsAction,
    initialState,
  );
  const timezones = detectTimezones();

  return (
    <form action={formAction} className="max-w-sm space-y-6">
      <div className="space-y-2">
        <Label htmlFor="baseCurrency">Base currency</Label>
        <Select
          id="baseCurrency"
          name="baseCurrency"
          defaultValue={baseCurrency}
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
        <Select id="timezone" name="timezone" defaultValue={timezone} required>
          {timezones.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </Select>
      </div>

      <FieldError message={state.error} />
      {state.success && <p className="text-sm text-emerald-600">Saved.</p>}

      <Button type="submit" loading={isPending}>
        Save changes
      </Button>
    </form>
  );
}
