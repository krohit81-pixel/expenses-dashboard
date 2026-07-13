"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  createRecurringTransactionAction,
  type CreateRecurringFormState,
} from "@/features/recurring/api/actions";
import type { Account } from "@/services/AccountService";
import type { Category } from "@/services/CategoryService";

const FREQUENCIES = [
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "yearly",
] as const;

const initialState: CreateRecurringFormState = {};

export function CreateRecurringTransactionForm({
  accounts,
  categories,
  defaultCurrency,
}: {
  accounts: Account[];
  categories: Category[];
  defaultCurrency: string;
}) {
  const [state, formAction, isPending] = useActionState(
    createRecurringTransactionAction,
    initialState,
  );
  const [kind, setKind] = useState<"income" | "expense" | "transfer">(
    "expense",
  );
  const relevantCategories = categories.filter(
    (category) => category.kind === kind,
  );
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="space-y-4">
      <div className="flex gap-2">
        {(["expense", "income", "transfer"] as const).map((option) => (
          <Button
            key={option}
            type="button"
            variant={kind === option ? "default" : "outline"}
            size="sm"
            onClick={() => setKind(option)}
          >
            {option[0].toUpperCase() + option.slice(1)}
          </Button>
        ))}
        <input type="hidden" name="kind" value={kind} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="payee">
          Name{kind === "transfer" ? " (optional)" : ""}
        </Label>
        <Input
          id="payee"
          name="payee"
          maxLength={300}
          required={kind !== "transfer"}
          placeholder={
            kind === "transfer"
              ? "e.g. Move salary to joint account"
              : "e.g. Home Loan EMI — Apt 2"
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="accountId">
            {kind === "transfer" ? "From account" : "Account"}
          </Label>
          <Select id="accountId" name="accountId" required>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </Select>
        </div>
        {kind === "transfer" ? (
          <div className="space-y-2">
            <Label htmlFor="transferAccountId">To account</Label>
            <Select id="transferAccountId" name="transferAccountId" required>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </Select>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="categoryId">Category</Label>
            <Select id="categoryId" name="categoryId" required>
              {relevantCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="amount">Amount</Label>
          <Input
            id="amount"
            name="amount"
            inputMode="decimal"
            placeholder="0.00"
            required
          />
        </div>
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
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="frequency">Repeats</Label>
          <Select
            id="frequency"
            name="frequency"
            defaultValue="monthly"
            required
          >
            {FREQUENCIES.map((freq) => (
              <option key={freq} value={freq}>
                {freq[0].toUpperCase() + freq.slice(1)}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="intervalCount">Every</Label>
          <Input
            id="intervalCount"
            name="intervalCount"
            type="number"
            min={1}
            max={365}
            defaultValue={1}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="startsOn">Starts</Label>
          <Input
            id="startsOn"
            name="startsOn"
            type="date"
            defaultValue={today}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endsOn">Ends (optional)</Label>
          <Input id="endsOn" name="endsOn" type="date" />
        </div>
      </div>

      <FieldError message={state.error} />

      <Button type="submit" loading={isPending}>
        Create recurring transaction
      </Button>
    </form>
  );
}
