import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import { OWNER_USER_ID } from "@/lib/owner";
import {
  createInstitutionInputSchema,
  type CreateInstitutionInput,
} from "@/features/institutions/schemas";

export type { CreateInstitutionInput };

export interface Institution {
  id: string;
  name: string;
  website: string | null;
}

export async function listInstitutions(): Promise<Institution[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("institutions")
    .select("id, name, website")
    .eq("user_id", OWNER_USER_ID)
    .order("name");

  if (error) {
    throw new Error(`Failed to load institutions: ${error.message}`);
  }

  return data;
}

export async function createInstitution(
  input: CreateInstitutionInput,
): Promise<Institution> {
  const parsed = createInstitutionInputSchema.parse(input);
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("institutions")
    .insert({
      user_id: OWNER_USER_ID,
      name: parsed.name,
      website: parsed.website ?? null,
    })
    .select("id, name, website")
    .single();

  if (error) {
    throw new Error(`Failed to create institution: ${error.message}`);
  }

  return data;
}
