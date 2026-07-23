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
 * (AXIS_HORIZON_STATEMENT_PASSWORD), same pattern as HDFC's. v1.8.0
 * added a single "icici-amazon" entry for Amazon Pay statements; v1.9.0
 * renamed it to "icici-amazon-rupay" after a second real statement (a
 * RuPay-variant card, spent almost entirely via UPI) turned out to
 * reconcile against the exact same parser with no structural changes --
 * one shared entry covering both, not two separate ones, since ICICI
 * itself uses the same password scheme and PDF layout for both.
 */
export type CardStatementSource =
  "hdfc-infinia" | "axis-horizon" | "icici-amazon-rupay";

export const CARD_STATEMENT_LABELS: Record<CardStatementSource, string> = {
  "hdfc-infinia": "HDFC Infinia",
  "axis-horizon": "Axis Horizon",
  "icici-amazon-rupay": "ICICI Amazon Pay / RuPay",
};
