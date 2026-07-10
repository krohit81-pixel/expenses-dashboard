import type { Database } from "./database-types";

type FinanceSchema = Database["finance"];

/** Row shape for a table in the `finance` schema, e.g. `TableRow<"transactions">`. */
export type TableRow<T extends keyof FinanceSchema["Tables"]> =
  FinanceSchema["Tables"][T]["Row"];

/** Insert shape for a table in the `finance` schema. */
export type TableInsert<T extends keyof FinanceSchema["Tables"]> =
  FinanceSchema["Tables"][T]["Insert"];

/** Update shape for a table in the `finance` schema. */
export type TableUpdate<T extends keyof FinanceSchema["Tables"]> =
  FinanceSchema["Tables"][T]["Update"];

/** Enum value type, e.g. `Enum<"transaction_kind">`. */
export type Enum<T extends keyof FinanceSchema["Enums"]> =
  FinanceSchema["Enums"][T];
