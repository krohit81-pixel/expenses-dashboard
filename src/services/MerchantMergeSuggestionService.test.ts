import { describe, expect, it, vi } from "vitest";

// server-only throws unconditionally outside a real Next.js build —
// same convention as retry.test.ts / env/server.test.ts. serverEnv is
// also mocked: this file only exercises splitCandidates/parseSuggestions
// (pure, no env access), but importing MerchantMergeSuggestionService.ts
// transitively imports lib/owner.ts and lib/ai/providers.ts, both of
// which read serverEnv eagerly at module load (fail-fast-on-boot, see
// env/server.test.ts's own comment) — without this mock, loading this
// test file at all would throw before a single test runs, over env vars
// this file's actual test cases never touch.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/env/server", () => ({
  serverEnv: {
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
    APP_OWNER_USER_ID: "550e8400-e29b-41d4-a716-446655440000",
    APP_ACCESS_PASSWORD: "test-password",
    APP_SESSION_SECRET: "a".repeat(32),
  },
}));
vi.mock("@/lib/env/public", () => ({
  publicEnv: {
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
  },
}));

import {
  parseSuggestions,
  splitCandidates,
} from "@/services/MerchantMergeSuggestionService";
import type { MerchantSummary } from "@/services/MerchantService";
import type { Money } from "@/lib/money";

function merchant(overrides: Partial<MerchantSummary>): MerchantSummary {
  return {
    id: "id",
    merchantName: "merchant",
    displayName: "Merchant",
    atlasCategoryId: null,
    atlasSubcategoryId: null,
    merchantType: null,
    isRecurring: false,
    isSubscription: false,
    isTransfer: false,
    isIncome: false,
    defaultCurrency: "INR",
    active: true,
    transactionCount: 1,
    totalSpend: "0" as Money,
    firstTransactionDate: null,
    lastTransactionDate: null,
    ...overrides,
  };
}

describe("splitCandidates", () => {
  it("splits by atlasCategoryId, sorted by transactionCount descending", () => {
    const merchants = [
      merchant({
        id: "u1",
        displayName: "GOOGLE CLOUDMUMBAI",
        atlasCategoryId: null,
        transactionCount: 1,
      }),
      merchant({
        id: "u2",
        displayName: "SWIGGY*38292",
        atlasCategoryId: null,
        transactionCount: 5,
      }),
      merchant({
        id: "e1",
        displayName: "Swiggy",
        atlasCategoryId: "cat-food",
        transactionCount: 20,
      }),
      merchant({
        id: "e2",
        displayName: "Google Cloud",
        atlasCategoryId: "cat-cloud",
        transactionCount: 3,
      }),
    ];

    const { unmapped, established } = splitCandidates(merchants);

    expect(unmapped.map((m) => m.id)).toEqual(["u2", "u1"]);
    expect(established.map((m) => m.id)).toEqual(["e1", "e2"]);
  });

  it("excludes deactivated merchants from both sides", () => {
    const merchants = [
      merchant({ id: "u1", atlasCategoryId: null, active: false }),
      merchant({ id: "e1", atlasCategoryId: "cat", active: false }),
    ];

    const { unmapped, established } = splitCandidates(merchants);

    expect(unmapped).toHaveLength(0);
    expect(established).toHaveLength(0);
  });
});

describe("parseSuggestions", () => {
  const unmapped = [
    merchant({ id: "u1", displayName: "GOOGLE CLOUDMUMBAI" }),
    merchant({ id: "u2", displayName: "SWIGGY*38292" }),
  ];
  const established = [
    merchant({ id: "e1", displayName: "Swiggy", atlasCategoryId: "cat" }),
    merchant({ id: "e2", displayName: "Google Cloud", atlasCategoryId: "cat" }),
  ];

  it("maps 1-based indices back to real merchant ids", () => {
    const response = JSON.stringify([
      {
        newIndex: 1,
        establishedIndex: 2,
        confidence: "high",
        reason: "same cloud billing entity, different city suffix",
      },
      {
        newIndex: 2,
        establishedIndex: 1,
        confidence: "medium",
        reason: "order-id suffix",
      },
    ]);

    const result = parseSuggestions(response, unmapped, established);

    expect(result).toEqual([
      {
        sourceMerchantId: "u1",
        sourceName: "GOOGLE CLOUDMUMBAI",
        targetMerchantId: "e2",
        targetName: "Google Cloud",
        confidence: "high",
        reason: "same cloud billing entity, different city suffix",
      },
      {
        sourceMerchantId: "u2",
        sourceName: "SWIGGY*38292",
        targetMerchantId: "e1",
        targetName: "Swiggy",
        confidence: "medium",
        reason: "order-id suffix",
      },
    ]);
  });

  it("strips a ```json code fence around the array", () => {
    const response =
      '```json\n[{"newIndex":1,"establishedIndex":2,"confidence":"high","reason":"x"}]\n```';

    expect(parseSuggestions(response, unmapped, established)).toHaveLength(1);
  });

  it("returns an empty list for unparseable JSON, never throws", () => {
    expect(parseSuggestions("not json at all", unmapped, established)).toEqual(
      [],
    );
  });

  it("returns an empty list for a well-formed non-array JSON value", () => {
    expect(parseSuggestions('{"foo":"bar"}', unmapped, established)).toEqual(
      [],
    );
  });

  it("drops entries with an out-of-range index", () => {
    const response = JSON.stringify([
      { newIndex: 99, establishedIndex: 1, confidence: "high", reason: "x" },
      { newIndex: 1, establishedIndex: 99, confidence: "high", reason: "x" },
    ]);

    expect(parseSuggestions(response, unmapped, established)).toEqual([]);
  });

  it("drops entries with a confidence value other than high/medium", () => {
    const response = JSON.stringify([
      { newIndex: 1, establishedIndex: 1, confidence: "low", reason: "x" },
      { newIndex: 1, establishedIndex: 1, confidence: "certain", reason: "x" },
    ]);

    expect(parseSuggestions(response, unmapped, established)).toEqual([]);
  });

  it("keeps only the first suggestion when the model names the same source merchant twice", () => {
    const response = JSON.stringify([
      { newIndex: 1, establishedIndex: 1, confidence: "high", reason: "first" },
      {
        newIndex: 1,
        establishedIndex: 2,
        confidence: "high",
        reason: "second",
      },
    ]);

    const result = parseSuggestions(response, unmapped, established);

    expect(result).toHaveLength(1);
    expect(result[0].reason).toBe("first");
  });

  it("returns an empty array for an explicit empty-array response", () => {
    expect(parseSuggestions("[]", unmapped, established)).toEqual([]);
  });
});
