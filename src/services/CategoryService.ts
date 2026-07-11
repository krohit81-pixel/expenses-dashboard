import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import { OWNER_USER_ID } from "@/lib/owner";
import {
  createCategoryInputSchema,
  type CreateCategoryInput,
} from "@/features/categories/schemas";

export type { CreateCategoryInput };

export interface Category {
  id: string;
  parentId: string | null;
  kind: "income" | "expense";
  name: string;
  color: string | null;
  icon: string | null;
  isArchived: boolean;
}

function mapRow(row: {
  id: string;
  parent_id: string | null;
  kind: "income" | "expense";
  name: string;
  color: string | null;
  icon: string | null;
  is_archived: boolean;
}): Category {
  return {
    id: row.id,
    parentId: row.parent_id,
    kind: row.kind,
    name: row.name,
    color: row.color,
    icon: row.icon,
    isArchived: row.is_archived,
  };
}

export async function listCategories(
  includeArchived = false,
): Promise<Category[]> {
  const supabase = createServiceClient();
  let query = supabase
    .from("categories")
    .select("id, parent_id, kind, name, color, icon, is_archived")
    .eq("user_id", OWNER_USER_ID)
    .order("kind")
    .order("name");

  if (!includeArchived) {
    query = query.eq("is_archived", false);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to load categories: ${error.message}`);
  }

  return data.map(mapRow);
}

export async function createCategory(
  input: CreateCategoryInput,
): Promise<Category> {
  const parsed = createCategoryInputSchema.parse(input);
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("categories")
    .insert({
      user_id: OWNER_USER_ID,
      kind: parsed.kind,
      name: parsed.name,
      parent_id: parsed.parentId ?? null,
      color: parsed.color ?? null,
    })
    .select("id, parent_id, kind, name, color, icon, is_archived")
    .single();

  if (error) {
    throw new Error(`Failed to create category: ${error.message}`);
  }

  return mapRow(data);
}

/**
 * A reasonable, editable starting point — not a fixed taxonomy. The person
 * is expected to rename, merge, or delete these; nothing else in the app
 * depends on these exact names existing.
 */
const DEFAULT_CATEGORIES: Array<{ kind: "income" | "expense"; name: string }> =
  [
    { kind: "income", name: "Salary" },
    { kind: "income", name: "Rent received" },
    { kind: "income", name: "Other income" },
    { kind: "expense", name: "Housing & loans" },
    { kind: "expense", name: "Utilities" },
    { kind: "expense", name: "Groceries & food" },
    { kind: "expense", name: "Transportation" },
    { kind: "expense", name: "Education" },
    { kind: "expense", name: "Health" },
    { kind: "expense", name: "Entertainment" },
    { kind: "expense", name: "Personal & shopping" },
    { kind: "expense", name: "Debt payments" },
    { kind: "expense", name: "Other" },
  ];

/**
 * Seeds default categories for a new user during onboarding. Safe to call
 * more than once: checks what already exists (by kind + name, top-level
 * only) and only inserts what's missing, rather than relying on Supabase's
 * upsert onConflict — the DB's uniqueness guard here is a coalesce()
 * expression index (see migration 20260710000100), which PostgREST's
 * column-name-based onConflict cannot target directly.
 */
export async function seedDefaultCategories(): Promise<void> {
  const supabase = createServiceClient();

  const { data: existing, error: selectError } = await supabase
    .from("categories")
    .select("kind, name")
    .eq("user_id", OWNER_USER_ID)
    .is("parent_id", null);

  if (selectError) {
    throw new Error(
      `Failed to check existing categories: ${selectError.message}`,
    );
  }

  const existingKeys = new Set(
    existing.map((row) => `${row.kind}:${row.name}`),
  );
  const missing = DEFAULT_CATEGORIES.filter(
    (category) => !existingKeys.has(`${category.kind}:${category.name}`),
  );

  if (missing.length === 0) {
    return;
  }

  const { error: insertError } = await supabase
    .from("categories")
    .insert(
      missing.map((category) => ({ ...category, user_id: OWNER_USER_ID })),
    );

  if (insertError) {
    throw new Error(
      `Failed to seed default categories: ${insertError.message}`,
    );
  }
}
