"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createInstitutionAction,
  type CreateInstitutionFormState,
} from "@/features/institutions/api/actions";

const initialState: CreateInstitutionFormState = {};

export function CreateInstitutionForm() {
  const [state, formAction, isPending] = useActionState(
    createInstitutionAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex items-end gap-2">
      <div className="space-y-2">
        <Label htmlFor="institution-name">Add a bank or institution</Label>
        <Input
          id="institution-name"
          name="name"
          placeholder="e.g. HDFC Bank"
          required
        />
      </div>
      <Button type="submit" variant="outline" disabled={isPending}>
        {isPending ? "Adding…" : "Add"}
      </Button>
      <FieldError message={state.error} />
    </form>
  );
}
