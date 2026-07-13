/**
 * The display title for a transaction: its payee if set, otherwise a
 * sensible derived label. Extracted after finding this logic duplicated
 * between the Transactions page (which correctly derived "Transfer to X"
 * for payee-less transfers) and the Dashboard page (which didn't, and
 * just showed "Untitled" for the exact same kind of transaction — e.g.
 * every card payment logged via the Transactions tab's quick-log, which
 * never sets a payee). One function now, used everywhere a transaction's
 * title needs to be shown.
 */
export function transactionDisplayTitle(
  transaction: {
    payee: string | null;
    kind: string;
    transferAccountId: string | null;
  },
  accountName: Map<string, string>,
): string {
  if (transaction.payee) {
    return transaction.payee;
  }
  if (transaction.kind === "transfer") {
    const target = transaction.transferAccountId
      ? accountName.get(transaction.transferAccountId)
      : undefined;
    return `Transfer to ${target ?? "another account"}`;
  }
  return "Untitled";
}
