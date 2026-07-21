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
 * (AXIS_HORIZON_STATEMENT_PASSWORD), same pattern as HDFC's.
 */
export type CardStatementSource = "hdfc-infinia" | "axis-horizon";

export const CARD_STATEMENT_LABELS: Record<CardStatementSource, string> = {
  "hdfc-infinia": "HDFC Infinia",
  "axis-horizon": "Axis Horizon",
};
