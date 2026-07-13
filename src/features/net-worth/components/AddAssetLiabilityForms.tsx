"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  createAssetAction,
  createLiabilityAction,
  type CreateAssetFormState,
  type CreateLiabilityFormState,
} from "@/features/net-worth/api/actions";

const ASSET_TYPES = ["real_estate", "vehicle", "valuable", "other"] as const;
const LIABILITY_TYPES = ["personal", "tax", "medical", "other"] as const;

const initialAssetState: CreateAssetFormState = {};
const initialLiabilityState: CreateLiabilityFormState = {};

export function AddAssetForm({ defaultCurrency }: { defaultCurrency: string }) {
  const [state, formAction, isPending] = useActionState(
    createAssetAction,
    initialAssetState,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="asset-name">Name</Label>
        <Input
          id="asset-name"
          name="name"
          placeholder="e.g. Family home"
          required
          maxLength={200}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="assetType">Type</Label>
          <Select id="assetType" name="assetType" defaultValue="other">
            {ASSET_TYPES.map((type) => (
              <option key={type} value={type}>
                {type.replace("_", " ")}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="acquisitionCost">Value</Label>
          <Input
            id="acquisitionCost"
            name="acquisitionCost"
            inputMode="decimal"
            placeholder="0.00"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="asset-currencyCode">Currency</Label>
          <Input
            id="asset-currencyCode"
            name="currencyCode"
            defaultValue={defaultCurrency}
            maxLength={3}
            required
            className="uppercase"
          />
        </div>
      </div>
      <FieldError message={state.error} />
      <Button type="submit" variant="outline" loading={isPending}>
        Add asset
      </Button>
    </form>
  );
}

export function AddLiabilityForm({
  defaultCurrency,
}: {
  defaultCurrency: string;
}) {
  const [state, formAction, isPending] = useActionState(
    createLiabilityAction,
    initialLiabilityState,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="liability-name">Name</Label>
        <Input
          id="liability-name"
          name="name"
          placeholder="e.g. Personal loan"
          required
          maxLength={200}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="liabilityType">Type</Label>
          <Select id="liabilityType" name="liabilityType" defaultValue="other">
            {LIABILITY_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="originalAmount">Amount owed</Label>
          <Input
            id="originalAmount"
            name="originalAmount"
            inputMode="decimal"
            placeholder="0.00"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="liability-currencyCode">Currency</Label>
          <Input
            id="liability-currencyCode"
            name="currencyCode"
            defaultValue={defaultCurrency}
            maxLength={3}
            required
            className="uppercase"
          />
        </div>
      </div>
      <FieldError message={state.error} />
      <Button type="submit" variant="outline" loading={isPending}>
        Add liability
      </Button>
    </form>
  );
}
