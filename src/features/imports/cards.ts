/**
 * The set of statement sources the Imports page knows about — shared
 * between server code (StatementImportService, which maps each card to
 * its env-var password) and client code (StatementUploadForm's card
 * picker). Deliberately its own small, plain module with no
 * "server-only" import and no env access, so the client component can
 * import it without pulling the server-only service (and its secret
 * lookup) into the client bundle.
 *
 * v1.3.0 milestone 1: one card. A second card means a second entry here
 * plus a second env var in StatementImportService, not a redesign --
 * v1.7.0's Axis Horizon addition (see the axis-horizon parser module) is
 * exactly that: a second entry, plus its own password env var
 * (originally AXIS_HORIZON_STATEMENT_PASSWORD). v1.8.0 added a single
 * "icici-amazon" entry for Amazon Pay statements; v1.9.0 renamed it to
 * "icici-amazon-rupay" after a second real statement (a RuPay-variant
 * card, spent almost entirely via UPI) turned out to reconcile against
 * the exact same parser with no structural changes -- one shared entry
 * covering both, not two separate ones, since ICICI itself uses the same
 * password scheme and PDF layout for both. v1.10.0 did the same thing
 * again for Axis: "axis-horizon" renamed to "axis-horizon-airtel" after
 * a real Airtel-co-branded Mastercard statement reconciled against the
 * unmodified axis-horizon parser with zero code changes needed -- same
 * bank, same password scheme, same PDF layout, just a different rewards
 * section (cashback instead of eDGE Miles points). Env var renamed to
 * match: AXIS_STATEMENT_PASSWORD, not AXIS_HORIZON_....
 *
 * v1.11.0 added a fourth entry, "hdfc-tata-neu", for a real Tata Neu Plus
 * HDFC Bank Credit Card statement -- reconciled against the unmodified
 * hdfc-infinia parser's transaction table with zero changes needed (only
 * the header's rewards section needed variant-aware handling; see the
 * renamed hdfc-infinia-tata module's parse-header.ts). Unlike the Axis/
 * ICICI cases above, this one did NOT collapse into a single shared
 * entry: the user explicitly wants a distinct password env var per card
 * (HDFC_TATA_STATEMENT_PASSWORD, not reusing HDFC_INFINIA_STATEMENT_PASSWORD)
 * even though both entries dispatch to the exact same underlying parser
 * module and save function -- see StatementImportService.ts and
 * CreditCardStatementService.ts's saveHdfcStatement.
 */
export type CardStatementSource =
  | "hdfc-infinia"
  | "hdfc-tata-neu"
  | "axis-horizon-airtel"
  | "icici-amazon-rupay";

export const CARD_STATEMENT_LABELS: Record<CardStatementSource, string> = {
  "hdfc-infinia": "HDFC Infinia",
  "hdfc-tata-neu": "HDFC Tata Neu Plus",
  "axis-horizon-airtel": "Axis Horizon / Airtel",
  "icici-amazon-rupay": "ICICI Amazon Pay / RuPay",
};
