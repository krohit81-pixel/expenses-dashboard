/**
 * Shared color/style constants for the combined credit card PDF report
 * (v3.6.0) — react-pdf renders with its own layout engine, not a real
 * browser, so Atlas's CSS custom properties (src/app/globals.css)
 * aren't reachable here; these are that same light-mode palette's hex
 * equivalents, hand-converted once and hardcoded, the same way Intel's
 * own CATEGORY_COLORS is already a separate hardcoded hex array for
 * Recharts (see src/app/(app)/intel/page.tsx) rather than a Tailwind
 * class. No custom font files are bundled anywhere in this repo, so
 * every text style below uses react-pdf's built-in Helvetica family —
 * a deliberate choice, not an oversight (see the plan for this
 * feature).
 */

import { StyleSheet } from "@react-pdf/renderer";

export const COLORS = {
  bg: "#F5EFF3",
  surface: "#FFFFFF",
  ink: "#1C1424",
  inkSoft: "#6F667F",
  inkFaint: "#A9A0B6",
  accent: "#2E6DEA",
  accentSoft: "#E7EEFD",
  positive: "#17A155",
  negative: "#DF3459",
  line: "#EEE7EE",
} as const;

/** The exact palette Intel's own donuts use (src/app/(app)/intel/page.tsx CATEGORY_COLORS) — reused verbatim so the report's donut looks like the same app, not a redesign. */
export const CATEGORY_COLORS = [
  "#5b21b6",
  "#9061e0",
  "#17a054",
  "#e0355b",
  "#f0a63a",
  "#cabfd6",
] as const;

export const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 48,
    paddingHorizontal: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: COLORS.ink,
    backgroundColor: COLORS.surface,
  },
  accentBand: {
    backgroundColor: COLORS.accent,
    marginHorizontal: -40,
    marginTop: -40,
    paddingHorizontal: 40,
    paddingTop: 32,
    paddingBottom: 24,
    marginBottom: 24,
  },
  wordmark: {
    fontFamily: "Helvetica-Bold",
    fontSize: 12,
    color: "#FFFFFF",
    letterSpacing: 1,
  },
  coverTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 22,
    color: "#FFFFFF",
    marginTop: 10,
  },
  coverSubtitle: {
    fontSize: 10,
    color: COLORS.accentSoft,
    marginTop: 4,
  },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.accent,
    paddingBottom: 6,
  },
  sectionNumber: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    color: COLORS.accent,
    marginRight: 8,
  },
  sectionTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 13,
    color: COLORS.ink,
  },
  body: {
    fontSize: 10,
    color: COLORS.ink,
    lineHeight: 1.5,
  },
  caption: {
    fontSize: 8,
    color: COLORS.inkFaint,
  },
  kpiRow: {
    flexDirection: "row",
    marginTop: 16,
    gap: 16,
  },
  kpiTile: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 4,
    padding: 10,
  },
  kpiLabel: {
    fontSize: 8,
    color: COLORS.accentSoft,
  },
  kpiValue: {
    fontFamily: "Helvetica-Bold",
    fontSize: 15,
    color: "#FFFFFF",
    marginTop: 2,
  },
  table: {
    marginTop: 4,
  },
  tableHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.ink,
    paddingBottom: 4,
    marginBottom: 4,
  },
  tableHeaderCell: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: COLORS.inkSoft,
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.line,
    paddingVertical: 4,
  },
  tableCell: {
    fontSize: 9,
    color: COLORS.ink,
  },
  tableCellMuted: {
    fontSize: 9,
    color: COLORS.inkSoft,
  },
  tableCellRight: {
    fontSize: 9,
    color: COLORS.ink,
    textAlign: "right",
  },
  categoryHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: COLORS.bg,
    padding: 6,
    marginTop: 10,
    marginBottom: 4,
  },
  categoryHeaderText: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    color: COLORS.ink,
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: COLORS.inkFaint,
  },
  appendixHeading: {
    fontFamily: "Helvetica-Bold",
    fontSize: 13,
    color: COLORS.ink,
    marginBottom: 8,
  },
  promptBlock: {
    backgroundColor: COLORS.bg,
    padding: 12,
    fontFamily: "Courier",
    fontSize: 8,
    lineHeight: 1.5,
    color: COLORS.ink,
  },
});
