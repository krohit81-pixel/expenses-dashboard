"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  createTransactionAction,
  type CreateTransactionFormState,
} from "@/features/transactions/api/actions";
import type { Account } from "@/services/AccountService";
import type { Category } from "@/services/CategoryService";

const initialState: CreateTransactionFormState = {};

interface SplitRow {
  key: number;
  categoryId: string;
  amount: string;
}

export function CreateTransactionForm({
  accounts,
  categories,
  defaultCurrency,
}: {
  accounts: Account[];
  categories: Category[];
  defaultCurrency: string;
}) {
  const [state, formAction, isPending] = useActionState(
    createTransactionAction,
    initialState,
  );
  const [kind, setKind] = useState<"income" | "expense" | "transfer">(
    "expense",
  );
  const [mode, setMode] = useState<"single" | "split">("single");
  const [splits, setSplits] = useState<SplitRow[]>([
    { key: 0, categoryId: "", amount: "" },
    { key: 1, categoryId: "", amount: "" },
  ]);

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

      <div className="grid grid-cols-2 gap-4">
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
            <Label htmlFor="occurredOn">Date</Label>
            <Input
              id="occurredOn"
              name="occurredOn"
              type="date"
              defaultValue={today}
              required
            />
          </div>
        )}
      </div>

      {kind === "transfer" && (
        <div className="space-y-2">
          <Label htmlFor="occurredOn">Date</Label>
          <Input
            id="occurredOn"
            name="occurredOn"
            type="date"
            defaultValue={today}
            required
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
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

      <div className="space-y-2">
        <Label htmlFor="payee">Payee (optional)</Label>
        <Input id="payee" name="payee" maxLength={300} />
      </div>

      {kind !== "transfer" && (
        <div className="space-y-4 rounded-md border p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Category</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setMode(mode === "single" ? "split" : "single")}
            >
              {mode === "single"
                ? "Split into multiple categories"
                : "Use a single category"}
            </Button>
          </div>
          <input type="hidden" name="mode" value={mode} />

          {mode === "single" ? (
            <Select id="categoryId" name="categoryId" required>
              {relevantCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          ) : (
            <div className="space-y-3">
              {splits.map((split, index) => (
                <div key={split.key} className="flex items-end gap-2">
                  <div className="flex-1 space-y-2">
                    <Label htmlFor={`split-category-${split.key}`}>
                      Category
                    </Label>
                    <Select
                      id={`split-category-${split.key}`}
                      name="splitCategoryId"
                      required
                      defaultValue={split.categoryId}
                    >
                      <option value="" disabled>
                        Choose a category
                      </option>
                      {relevantCategories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="w-32 space-y-2">
                    <Label htmlFor={`split-amount-${split.key}`}>Amount</Label>
                    <Input
                      id={`split-amount-${split.key}`}
                      name="splitAmount"
                      inputMode="decimal"
                      placeholder="0.00"
                      required
                      defaultValue={split.amount}
                    />
                  </div>
                  {splits.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setSplits(splits.filter((_, i) => i !== index))
                      }
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setSplits([
                    ...splits,
                    { key: Date.now(), categoryId: "", amount: "" },
                  ])
                }
              >
                Add split
              </Button>
            </div>
          )}
        </div>
      )}

      <FieldError message={state.error} />

      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving…" : "Add transaction"}
      </Button>
    </form>
  );
}
