import "server-only";

import type { Database } from "@/lib/db/database-types";
import { dbNumberToMoney, sumMoney, ZERO, type Money } from "@/lib/money";
import { OWNER_USER_ID } from "@/lib/owner";
import { createServiceClient } from "@/lib/supabase/service";

export interface AtlasCategory {
  id: string;
  categoryName: string;
  parentCategoryId: string | null;
  icon: string | null;
  displayOrder: number;
  active: boolean;
}

/**
 * Shared by listAtlasCategories/listAllAtlasCategories: loads rows
 * (optionally active-only) and flattens them into the same
 * top-level-then-its-own-subcategories order every category dropdown
 * and the Categories admin screen (v1.2) both rely on.
 */
async function loadAtlasCategories(
  activeOnly: boolean,
): Promise<AtlasCategory[]> {
  const supabase = createServiceClient();
  let query = supabase
    .from("atlas_categories")
    .select(
      "id, category_name, parent_category_id, icon, display_order, active",
    )
    .eq("user_id", OWNER_USER_ID);
  if (activeOnly) query = query.eq("active", true);

  const { data, error } = await query.order("display_order");

  if (error) {
    throw new Error(`Failed to load categories: ${error.message}`);
  }

  const rows: AtlasCategory[] = data.map((row) => ({
    id: row.id,
    categoryName: row.category_name,
    parentCategoryId: row.parent_category_id,
    icon: row.icon,
    displayOrder: row.display_order,
    active: row.active,
  }));

  const topLevel = rows.filter((r) => r.parentCategoryId === null);
  const byParent = new Map<string, AtlasCategory[]>();
  for (const row of rows) {
    if (row.parentCategoryId === null) continue;
    const siblings = byParent.get(row.parentCategoryId) ?? [];
    siblings.push(row);
    byParent.set(row.parentCategoryId, siblings);
  }

  return topLevel.flatMap((category) => [
    category,
    ...(byParent.get(category.id) ?? []),
  ]);
}

/** Every active category, top-level and subcategory alike, ordered for a flat dropdown (top-level categories first by display_order, each immediately followed by its own subcategories). */
export async function listAtlasCategories(): Promise<AtlasCategory[]> {
  return loadAtlasCategories(true);
}

/** Every category regardless of active state -- backs the Categories admin screen (v1.2), which needs to show (and let you reactivate) a deactivated category too, not just hide it. */
export async function listAllAtlasCategories(): Promise<AtlasCategory[]> {
  return loadAtlasCategories(false);
}

/** Postgres' unique_violation code -- see the two partial unique indexes on atlas_categories (top-level name, and name-within-parent). */
const UNIQUE_VIOLATION = "23505";

export interface CreateAtlasCategoryInput {
  categoryName: string;
  parentCategoryId: string | null;
  icon: string | null;
}

/**
 * Adds a new top-level category or subcategory -- v1.2's Categories
 * admin screen. display_order defaults to "after everything else at
 * this level" so a newly added category doesn't jump ahead of existing
 * ones in every dropdown that orders by display_order.
 */
export async function createAtlasCategory(
  input: CreateAtlasCategoryInput,
): Promise<void> {
  const supabase = createServiceClient();

  // .is() (not .eq()) for the null case -- same reasoning as every
  // other nullable filter in this file (.eq() can't match a literal
  // null the way Postgres' `is null` does).
  let siblingCountQuery = supabase
    .from("atlas_categories")
    .select("id", { count: "exact", head: true })
    .eq("user_id", OWNER_USER_ID);
  siblingCountQuery = input.parentCategoryId
    ? siblingCountQuery.eq("parent_category_id", input.parentCategoryId)
    : siblingCountQuery.is("parent_category_id", null);
  const { count } = await siblingCountQuery;
  const displayOrder = count ?? 0;

  const { error } = await supabase.from("atlas_categories").insert({
    user_id: OWNER_USER_ID,
    category_name: input.categoryName,
    parent_category_id: input.parentCategoryId,
    icon: input.icon,
    display_order: displayOrder,
  });

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      throw new Error(
        input.parentCategoryId
          ? "A subcategory with that name already exists under this category."
          : "A category with that name already exists.",
      );
    }
    throw new Error(`Failed to create category: ${error.message}`);
  }
}

export interface UpdateAtlasCategoryInput {
  categoryId: string;
  categoryName?: string;
  parentCategoryId?: string | null;
  icon?: string | null;
  displayOrder?: number;
  active?: boolean;
}

/**
 * Edits a category -- rename, reparent, change icon/order, or
 * activate/deactivate. v1.2, at the household's request to rename
 * "Groceries" to "Groceries & Food Delivery" (and any future rename)
 * without touching a migration. Deactivating (not deleting) is the
 * only "remove" this offers, same convention as merchants' own
 * active toggle -- a hard delete would either cascade-orphan every
 * merchant that points at this category (atlas_category_id is
 * `on delete set null`) or, for a category with subcategories, simply
 * fail outright (parent_category_id is `on delete restrict`), neither
 * of which is what "delete" should quietly do from an admin screen.
 */
export async function updateAtlasCategory(
  input: UpdateAtlasCategoryInput,
): Promise<void> {
  const supabase = createServiceClient();

  const update: Database["finance"]["Tables"]["atlas_categories"]["Update"] =
    {};
  if (input.categoryName !== undefined)
    update.category_name = input.categoryName;
  if (input.parentCategoryId !== undefined)
    update.parent_category_id = input.parentCategoryId;
  if (input.icon !== undefined) update.icon = input.icon;
  if (input.displayOrder !== undefined)
    update.display_order = input.displayOrder;
  if (input.active !== undefined) update.active = input.active;

  const { error } = await supabase
    .from("atlas_categories")
    .update(update)
    .eq("id", input.categoryId)
    .eq("user_id", OWNER_USER_ID);

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      throw new Error(
        "Another category already uses that name at the same level.",
      );
    }
    if (error.code === "23503") {
      throw new Error(
        "Can't change this category's parent to itself or one of its own subcategories.",
      );
    }
    throw new Error(`Failed to update category: ${error.message}`);
  }
}

export interface MerchantSummary {
  id: string;
  merchantName: string;
  displayName: string;
  atlasCategoryId: string | null;
  atlasSubcategoryId: string | null;
  merchantType: string | null;
  isRecurring: boolean;
  isSubscription: boolean;
  isTransfer: boolean;
  isIncome: boolean;
  defaultCurrency: string;
  active: boolean;
  transactionCount: number;
  /** Sum of debit-direction transactions only — a credit under a merchant (rare; see the migration's note on merchant_id being null for known credit types) was never "spend". */
  totalSpend: Money;
  firstTransactionDate: string | null;
  lastTransactionDate: string | null;
}

interface MerchantAggregate {
  transactionCount: number;
  debitTotal: Money;
  firstTransactionDate: string | null;
  lastTransactionDate: string | null;
}

/**
 * Sums in application code, not a SQL aggregate — same reasoning as
 * every other service in this codebase (see ReportingService's note):
 * no aggregate RPC/view exists yet, and this app's data volume doesn't
 * need one. First candidate to move server-side if that ever changes.
 */
async function loadTransactionAggregates(
  supabase: ReturnType<typeof createServiceClient>,
  merchantIds: string[],
): Promise<Map<string, MerchantAggregate>> {
  const aggregates = new Map<string, MerchantAggregate>();
  if (merchantIds.length === 0) return aggregates;

  const { data, error } = await supabase
    .from("credit_card_transactions")
    .select("merchant_id, amount, transaction_type, transaction_date")
    .eq("user_id", OWNER_USER_ID)
    .in("merchant_id", merchantIds);

  if (error) {
    throw new Error(
      `Failed to load merchant transaction totals: ${error.message}`,
    );
  }

  for (const row of data) {
    if (!row.merchant_id) continue;
    const existing = aggregates.get(row.merchant_id) ?? {
      transactionCount: 0,
      debitTotal: ZERO,
      firstTransactionDate: null,
      lastTransactionDate: null,
    };

    existing.transactionCount += 1;
    if (row.transaction_type === "debit") {
      existing.debitTotal = sumMoney([
        existing.debitTotal,
        dbNumberToMoney(row.amount),
      ]);
    }
    if (
      !existing.firstTransactionDate ||
      row.transaction_date < existing.firstTransactionDate
    ) {
      existing.firstTransactionDate = row.transaction_date;
    }
    if (
      !existing.lastTransactionDate ||
      row.transaction_date > existing.lastTransactionDate
    ) {
      existing.lastTransactionDate = row.transaction_date;
    }

    aggregates.set(row.merchant_id, existing);
  }

  return aggregates;
}

export interface MerchantListFilters {
  /** Matched against display_name and merchant_name, case-insensitively. */
  search?: string;
  /** Matches a merchant whose category OR subcategory is this id. */
  categoryId?: string;
  /** Only merchants with no category assigned yet (atlas_category_id is null). */
  uncategorizedOnly?: boolean;
  /** Exact match against merchants.merchant_type. */
  merchantType?: string;
  /**
   * Only merchants with at least one transaction billed in this cycle
   * month ("YYYY-MM"). cycle_month lives on credit_card_statements, not
   * on the transaction or the merchant itself (see
   * src/lib/statement-cycle.ts), so this requires a separate lookup
   * (loadMerchantIdsForCycleMonth below) rather than a plain .eq() on
   * the merchants query.
   */
  cycleMonth?: string;
}

/**
 * Every merchant_id with at least one debit-or-credit transaction
 * billed in the given cycle month -- the join credit_card_transactions
 * needs through credit_card_statements to answer "which merchants were
 * active this cycle" (cycle_month only exists on the statement row).
 */
async function loadMerchantIdsForCycleMonth(
  supabase: ReturnType<typeof createServiceClient>,
  cycleMonth: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("credit_card_transactions")
    .select("merchant_id, credit_card_statements!inner(cycle_month)")
    .eq("user_id", OWNER_USER_ID)
    .eq("credit_card_statements.cycle_month", cycleMonth)
    .not("merchant_id", "is", null);

  if (error) {
    throw new Error(
      `Failed to load merchants for cycle month: ${error.message}`,
    );
  }

  return Array.from(
    new Set(
      data
        .map((row) => row.merchant_id)
        .filter((id): id is string => id !== null),
    ),
  );
}

/** Every distinct, non-empty merchant_type in use -- backs the Merchants list page's type filter dropdown. */
export async function listMerchantTypes(): Promise<string[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("merchants")
    .select("merchant_type")
    .eq("user_id", OWNER_USER_ID)
    .not("merchant_type", "is", null);

  if (error) {
    throw new Error(`Failed to load merchant types: ${error.message}`);
  }

  return Array.from(
    new Set(
      data
        .map((row) => row.merchant_type)
        .filter((t): t is string => t !== null && t.trim() !== ""),
    ),
  ).sort((a, b) => a.localeCompare(b));
}

/** Every distinct cycle month ("YYYY-MM") with an imported statement, newest first -- backs the Merchants list page's cycle month filter dropdown. */
export async function listCreditCardCycleMonths(): Promise<string[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("credit_card_statements")
    .select("cycle_month")
    .eq("user_id", OWNER_USER_ID);

  if (error) {
    throw new Error(`Failed to load cycle months: ${error.message}`);
  }

  return Array.from(new Set(data.map((row) => row.cycle_month))).sort((a, b) =>
    b.localeCompare(a),
  );
}

export async function listMerchants(
  filters: MerchantListFilters = {},
): Promise<MerchantSummary[]> {
  const supabase = createServiceClient();

  let cycleMerchantIds: string[] | null = null;
  if (filters.cycleMonth) {
    cycleMerchantIds = await loadMerchantIdsForCycleMonth(
      supabase,
      filters.cycleMonth,
    );
    if (cycleMerchantIds.length === 0) return [];
  }

  let query = supabase
    .from("merchants")
    .select(
      "id, merchant_name, display_name, atlas_category_id, atlas_subcategory_id, merchant_type, is_recurring, is_subscription, is_transfer, is_income, default_currency, active",
    )
    .eq("user_id", OWNER_USER_ID);

  if (filters.search) {
    const term = filters.search.trim();
    if (term) {
      query = query.or(
        `display_name.ilike.%${term}%,merchant_name.ilike.%${term}%`,
      );
    }
  }
  if (filters.uncategorizedOnly) {
    query = query.is("atlas_category_id", null);
  } else if (filters.categoryId) {
    query = query.or(
      `atlas_category_id.eq.${filters.categoryId},atlas_subcategory_id.eq.${filters.categoryId}`,
    );
  }
  if (filters.merchantType) {
    query = query.eq("merchant_type", filters.merchantType);
  }
  if (cycleMerchantIds) {
    query = query.in("id", cycleMerchantIds);
  }

  const { data, error } = await query.order("display_name");
  if (error) {
    throw new Error(`Failed to load merchants: ${error.message}`);
  }

  const aggregates = await loadTransactionAggregates(
    supabase,
    data.map((row) => row.id),
  );

  return data.map((row) => {
    const aggregate = aggregates.get(row.id);
    return {
      id: row.id,
      merchantName: row.merchant_name,
      displayName: row.display_name,
      atlasCategoryId: row.atlas_category_id,
      atlasSubcategoryId: row.atlas_subcategory_id,
      merchantType: row.merchant_type,
      isRecurring: row.is_recurring,
      isSubscription: row.is_subscription,
      isTransfer: row.is_transfer,
      isIncome: row.is_income,
      defaultCurrency: row.default_currency,
      active: row.active,
      transactionCount: aggregate?.transactionCount ?? 0,
      totalSpend: aggregate?.debitTotal ?? ZERO,
      firstTransactionDate: aggregate?.firstTransactionDate ?? null,
      lastTransactionDate: aggregate?.lastTransactionDate ?? null,
    };
  });
}

export interface MerchantAlias {
  id: string;
  alias: string;
  sourceBank: string | null;
  confidence: number | null;
  createdAt: string;
}

export interface MerchantTransactionRow {
  id: string;
  transactionDate: string;
  description: string;
  amount: Money;
  currency: string;
  transactionType: "debit" | "credit";
  /** e.g. "HDFC Infinia •••• 5252" */
  cardLabel: string;
}

export interface MerchantDetail extends MerchantSummary {
  notes: string | null;
  website: string | null;
  logoUrl: string | null;
  averageTransaction: Money;
  aliases: MerchantAlias[];
  cardsUsed: string[];
  recentTransactions: MerchantTransactionRow[];
}

const RECENT_TRANSACTIONS_LIMIT = 20;

export async function getMerchantDetail(
  merchantId: string,
): Promise<MerchantDetail | null> {
  const supabase = createServiceClient();

  const { data: merchant, error: merchantError } = await supabase
    .from("merchants")
    .select(
      "id, merchant_name, display_name, atlas_category_id, atlas_subcategory_id, merchant_type, is_recurring, is_subscription, is_transfer, is_income, default_currency, active, notes, website, logo_url",
    )
    .eq("user_id", OWNER_USER_ID)
    .eq("id", merchantId)
    .maybeSingle();

  if (merchantError) {
    throw new Error(`Failed to load merchant: ${merchantError.message}`);
  }
  if (!merchant) return null;

  const [
    { data: aliasRows, error: aliasError },
    { data: txnRows, error: txnError },
  ] = await Promise.all([
    supabase
      .from("merchant_aliases")
      .select("id, alias, source_bank, confidence, created_at")
      .eq("user_id", OWNER_USER_ID)
      .eq("merchant_id", merchantId)
      .order("created_at"),
    supabase
      .from("credit_card_transactions")
      .select(
        "id, transaction_date, description, amount, currency, transaction_type, statement_id, credit_card_statements(issuer, card_type, card_last4)",
      )
      .eq("user_id", OWNER_USER_ID)
      .eq("merchant_id", merchantId)
      .order("transaction_date", { ascending: false })
      .order("sequence_number", { ascending: false }),
  ]);

  if (aliasError) {
    throw new Error(`Failed to load merchant aliases: ${aliasError.message}`);
  }
  if (txnError) {
    throw new Error(
      `Failed to load merchant transactions: ${txnError.message}`,
    );
  }

  const debitTotals = txnRows
    .filter((t) => t.transaction_type === "debit")
    .map((t) => dbNumberToMoney(t.amount));
  const totalSpend = sumMoney(debitTotals);
  const averageTransaction =
    debitTotals.length > 0
      ? dbNumberToMoney(
          Number(totalSpend) === 0
            ? 0
            : parseFloat(totalSpend) / debitTotals.length,
        )
      : ZERO;

  const cardLabelFor = (statement: {
    issuer: string;
    card_type: string;
    card_last4: string;
  }) =>
    `${statement.issuer} ${statement.card_type} •••• ${statement.card_last4}`;

  const cardsUsed = Array.from(
    new Set(
      txnRows
        .map((t) =>
          t.credit_card_statements
            ? cardLabelFor(t.credit_card_statements)
            : null,
        )
        .filter((label): label is string => label !== null),
    ),
  );

  const dates = txnRows.map((t) => t.transaction_date);
  const firstTransactionDate =
    dates.length > 0 ? dates.reduce((a, b) => (a < b ? a : b)) : null;
  const lastTransactionDate =
    dates.length > 0 ? dates.reduce((a, b) => (a > b ? a : b)) : null;

  return {
    id: merchant.id,
    merchantName: merchant.merchant_name,
    displayName: merchant.display_name,
    atlasCategoryId: merchant.atlas_category_id,
    atlasSubcategoryId: merchant.atlas_subcategory_id,
    merchantType: merchant.merchant_type,
    isRecurring: merchant.is_recurring,
    isSubscription: merchant.is_subscription,
    isTransfer: merchant.is_transfer,
    isIncome: merchant.is_income,
    defaultCurrency: merchant.default_currency,
    active: merchant.active,
    notes: merchant.notes,
    website: merchant.website,
    logoUrl: merchant.logo_url,
    transactionCount: txnRows.length,
    totalSpend,
    averageTransaction,
    firstTransactionDate,
    lastTransactionDate,
    aliases: aliasRows.map((row) => ({
      id: row.id,
      alias: row.alias,
      sourceBank: row.source_bank,
      confidence: row.confidence,
      createdAt: row.created_at,
    })),
    cardsUsed,
    recentTransactions: txnRows
      .slice(0, RECENT_TRANSACTIONS_LIMIT)
      .map((row) => ({
        id: row.id,
        transactionDate: row.transaction_date,
        description: row.description,
        amount: dbNumberToMoney(row.amount),
        currency: row.currency,
        transactionType: row.transaction_type as "debit" | "credit",
        cardLabel: row.credit_card_statements
          ? cardLabelFor(row.credit_card_statements)
          : "Unknown card",
      })),
  };
}

export interface UpdateMerchantInput {
  merchantId: string;
  displayName?: string;
  atlasCategoryId?: string | null;
  atlasSubcategoryId?: string | null;
  merchantType?: string | null;
  isRecurring?: boolean;
  isSubscription?: boolean;
  active?: boolean;
}

/**
 * Edits a merchant. If atlasCategoryId is being set to a non-null value,
 * this ALSO clears needs_review on every transaction that references
 * this merchant, in one explicit bulk statement — the one deliberate
 * exception to "categories are resolved live through merchant_id, no
 * transaction updates" (see the migration's comment on
 * credit_card_transactions.needs_review for why that flag specifically
 * is stored, not derived, and so needs this one explicit transition).
 * The category itself is never written to the transaction row.
 */
export async function updateMerchant(
  input: UpdateMerchantInput,
): Promise<void> {
  const supabase = createServiceClient();

  const update: Database["finance"]["Tables"]["merchants"]["Update"] = {};
  if (input.displayName !== undefined) update.display_name = input.displayName;
  if (input.atlasCategoryId !== undefined)
    update.atlas_category_id = input.atlasCategoryId;
  if (input.atlasSubcategoryId !== undefined)
    update.atlas_subcategory_id = input.atlasSubcategoryId;
  if (input.merchantType !== undefined)
    update.merchant_type = input.merchantType;
  if (input.isRecurring !== undefined) update.is_recurring = input.isRecurring;
  if (input.isSubscription !== undefined)
    update.is_subscription = input.isSubscription;
  if (input.active !== undefined) update.active = input.active;

  const { error } = await supabase
    .from("merchants")
    .update(update)
    .eq("id", input.merchantId)
    .eq("user_id", OWNER_USER_ID);

  if (error) {
    throw new Error(`Failed to update merchant: ${error.message}`);
  }

  if (input.atlasCategoryId) {
    const { error: reviewError } = await supabase
      .from("credit_card_transactions")
      .update({ needs_review: false })
      .eq("user_id", OWNER_USER_ID)
      .eq("merchant_id", input.merchantId)
      .eq("needs_review", true);

    if (reviewError) {
      throw new Error(
        `Merchant was categorized, but failed to clear its transactions' review flag: ${reviewError.message}`,
      );
    }
  }
}

/**
 * Removes this one transaction's merchant tag (merchant_id -> null),
 * leaving every other transaction tagged to that merchant untouched --
 * the one-off undo the bulk `updateMerchant`/`mergeMerchants` writes
 * don't cover. needs_review is cleared alongside it: that flag means
 * "this transaction's merchant has no category yet" (see the migration
 * comment on credit_card_transactions.needs_review), and an untagged
 * transaction has no merchant at all, so there's nothing left to
 * review until it's tagged again. merchant_raw/normalized are left as
 * they were, so the transaction can still be re-matched or re-tagged
 * later without losing the original statement text.
 */
export async function untagTransaction(transactionId: string): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("credit_card_transactions")
    .update({ merchant_id: null, needs_review: false })
    .eq("id", transactionId)
    .eq("user_id", OWNER_USER_ID);

  if (error) {
    throw new Error(`Failed to untag transaction: ${error.message}`);
  }
}

/**
 * The other direction from untagTransaction: manually assigns a
 * transaction that has no merchant_id to an existing merchant -- v1.2.1,
 * for transactions that were deliberately never auto-tagged in the
 * first place. isBankFeeOrTax lines (IGST, FCY markup fee, DCC
 * surcharge -- see e.g. hdfc-infinia/classify-transaction.ts) are
 * parsed with merchant_raw/merchant_id left null on purpose, since each
 * one carries a unique reference number and would otherwise create a
 * brand-new junk merchant per occurrence (see bulk-tag-merchants.mjs's
 * own comment for the historical version of this problem). That means
 * they can never be picked up by the normal alias-resolution pipeline
 * or by mergeMerchants/updateMerchant, which both operate on a
 * transaction's EXISTING merchant_id -- there was previously no way to
 * manually assign one of these to a merchant at all short of a one-off
 * script. needs_review is set to match the target merchant's current
 * category state, same reasoning as mergeMerchants.
 */
export async function tagTransactionToMerchant(params: {
  transactionId: string;
  merchantId: string;
}): Promise<void> {
  const supabase = createServiceClient();

  const { data: merchant, error: merchantError } = await supabase
    .from("merchants")
    .select("atlas_category_id")
    .eq("user_id", OWNER_USER_ID)
    .eq("id", params.merchantId)
    .maybeSingle();

  if (merchantError || !merchant) {
    throw new Error(
      `Failed to load merchant: ${merchantError?.message ?? "not found"}`,
    );
  }

  const { error } = await supabase
    .from("credit_card_transactions")
    .update({
      merchant_id: params.merchantId,
      needs_review: merchant.atlas_category_id === null,
    })
    .eq("id", params.transactionId)
    .eq("user_id", OWNER_USER_ID);

  if (error) {
    throw new Error(`Failed to tag transaction: ${error.message}`);
  }
}

/**
 * Merges sourceMerchantId into targetMerchantId: every alias and every
 * transaction that pointed at the source now points at the target, and
 * the source merchant row is deleted. Aliases can never collide across
 * the two (alias is globally unique per user, so the source and target
 * can't already share one) — the reassignment is always safe.
 * Reassigned transactions' needs_review is set to match the target's
 * current category state, same reasoning as updateMerchant.
 */
export async function mergeMerchants(params: {
  sourceMerchantId: string;
  targetMerchantId: string;
}): Promise<void> {
  const { sourceMerchantId, targetMerchantId } = params;
  if (sourceMerchantId === targetMerchantId) {
    throw new Error("Can't merge a merchant into itself.");
  }

  const supabase = createServiceClient();

  const { data: target, error: targetError } = await supabase
    .from("merchants")
    .select("atlas_category_id")
    .eq("user_id", OWNER_USER_ID)
    .eq("id", targetMerchantId)
    .maybeSingle();

  if (targetError || !target) {
    throw new Error(
      `Failed to load target merchant: ${targetError?.message ?? "not found"}`,
    );
  }

  const { error: aliasError } = await supabase
    .from("merchant_aliases")
    .update({ merchant_id: targetMerchantId })
    .eq("user_id", OWNER_USER_ID)
    .eq("merchant_id", sourceMerchantId);
  if (aliasError) {
    throw new Error(`Failed to reassign aliases: ${aliasError.message}`);
  }

  const { error: txnError } = await supabase
    .from("credit_card_transactions")
    .update({
      merchant_id: targetMerchantId,
      needs_review: target.atlas_category_id === null,
    })
    .eq("user_id", OWNER_USER_ID)
    .eq("merchant_id", sourceMerchantId);
  if (txnError) {
    throw new Error(`Failed to reassign transactions: ${txnError.message}`);
  }

  const { error: deleteError } = await supabase
    .from("merchants")
    .delete()
    .eq("user_id", OWNER_USER_ID)
    .eq("id", sourceMerchantId);
  if (deleteError) {
    throw new Error(
      `Failed to remove the merged merchant: ${deleteError.message}`,
    );
  }
}
