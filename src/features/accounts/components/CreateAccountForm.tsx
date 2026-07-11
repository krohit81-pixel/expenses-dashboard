"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  createAccountAction,
  type CreateAccountFormState,
} from "@/features/accounts/api/actions";
import type { Institution } from "@/services/InstitutionService";

const ACCOUNT_TYPES = [
  { value: "checking", label: "Checking" },
  { value: "savings", label: "Savings" },
  { value: "cash", label: "Cash" },
  { value: "credit_card", label: "Credit card" },
  { value: "investment", label: "Investment" },
  { value: "loan", label: "Loan" },
  { value: "asset", label: "Asset" },
  { value: "liability", label: "Liability" },
] as const;

const initialState: CreateAccountFormState = {};

export function CreateAccountForm({
  institutions,
  defaultCurrency,
}: {
  institutions: Institution[];
  defaultCurrency: string;
}) {
  const [state, formAction, isPending] = useActionState(
    createAccountAction,
    initialState,
  );
  const [accountType, setAccountType] = useState<string>("checking");

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Account name</Label>
        <Input id="name" name="name" required maxLength={200} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="accountType">Type</Label>
        <Select
          id="accountType"
          name="accountType"
          value={accountType}
          onChange={(event) => setAccountType(event.target.value)}
        >
          {ACCOUNT_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="institutionId">Institution (optional)</Label>
        <Select id="institutionId" name="institutionId" defaultValue="">
          <option value="">None</option>
          {institutions.map((institution) => (
            <option key={institution.id} value={institution.id}>
              {institution.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="currencyCode">Currency</Label>
          <Input
            id="currencyCode"
            name="currencyCode"
            defaultValue={defaultCurrency}
            maxLength={3}
            required
            className="uppercase"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="openingBalance">Opening balance</Label>
          <Input
            id="openingBalance"
            name="openingBalance"
            defaultValue="0.00"
            inputMode="decimal"
            required
          />
        </div>
      </div>

      {accountType === "credit_card" && (
        <div className="space-y-4 rounded-md border p-4">
          <p className="text-sm font-medium">Credit card details</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="creditLimit">Credit limit</Label>
              <Input
                id="creditLimit"
                name="creditLimit"
                inputMode="decimal"
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="annualPercentageRate">APR %</Label>
              <Input
                id="annualPercentageRate"
                name="annualPercentageRate"
                type="number"
                step="0.01"
                min="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="statementDay">Statement day</Label>
              <Input
                id="statementDay"
                name="statementDay"
                type="number"
                min="1"
                max="31"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentDueDay">Payment due day</Label>
              <Input
                id="paymentDueDay"
                name="paymentDueDay"
                type="number"
                min="1"
                max="31"
              />
            </div>
          </div>
        </div>
      )}

      <FieldError message={state.error} />

      <Button type="submit" disabled={isPending}>
        {isPending ? "Creating…" : "Create account"}
      </Button>
    </form>
  );
}
