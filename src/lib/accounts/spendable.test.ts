import { describe, expect, it } from "vitest";

import { isSpendableAccountType } from "@/lib/accounts/spendable";

describe("isSpendableAccountType", () => {
  it.each(["checking", "savings", "cash"] as const)(
    "%s is spendable",
    (type) => {
      expect(isSpendableAccountType(type)).toBe(true);
    },
  );

  it.each(["credit_card", "investment", "loan", "asset", "liability"] as const)(
    "%s is not spendable",
    (type) => {
      expect(isSpendableAccountType(type)).toBe(false);
    },
  );
});
