"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import { ZERO } from "@/lib/money";
import { CardDonut } from "@/features/intel/components/CardDonut";
import { CardRewardsSection } from "@/features/cards/components/CardRewardsSection";
import type {
  CardBreakdown,
  CardRewardsSummary,
} from "@/services/CreditCardIntelService";

/**
 * v3.8.0 — the 6 real cards this household actually has, one row per
 * (issuer, card_type) in finance.credit_card_statements (confirmed live
 * against production: AXIS|airtel|4386, AXIS|horizon|3395,
 * HDFC|Infinia|5252, HDFC|Tata Neu Plus|9936, ICICI|RuPay|3003,
 * ICICI|Amazon Pay|0005 — no reissues yet, so this is 1:1 today). Order
 * here is the exact order the household asked for the buttons in.
 *
 * Deliberately matched on (issuer, cardType) below, never the full
 * cardKey ("issuer|cardType|cardLast4") a CardBreakdown row carries --
 * CreditCardIntelService builds that key fresh from each row's own three
 * columns every time, with no persisted card-identity concept. Matching
 * on the full key would silently orphan a card's whole history under a
 * new key the moment it's reissued with a different last4; (issuer,
 * cardType) survives that.
 */
const CARD_BUTTONS = [
  { key: "infinia", label: "Infinia", issuer: "HDFC", cardType: "Infinia" },
  {
    key: "tataneu",
    label: "TataNeu",
    issuer: "HDFC",
    cardType: "Tata Neu Plus",
  },
  { key: "amazon", label: "Amazon", issuer: "ICICI", cardType: "Amazon Pay" },
  { key: "rupay", label: "Rupay", issuer: "ICICI", cardType: "RuPay" },
  { key: "airtel", label: "Airtel", issuer: "AXIS", cardType: "airtel" },
  { key: "horizon", label: "Horizon", issuer: "AXIS", cardType: "horizon" },
] as const;

/**
 * The pill switcher + whichever card's own donut+drill-down is
 * currently selected below it -- mirrors TravelCalendarSection.tsx's
 * Summary/Details/Log switcher exactly (same `flex gap-1 rounded-full
 * bg-line p-1` pill row, same bg-accent/text-white active state, plain
 * useState -- not synced to a URL searchParam, matching that same
 * precedent). Defaults to the first button (Infinia) so the page never
 * opens on an empty "nothing selected" state.
 *
 * `atlasCategoryNamePairs` arrives as a plain array, not a Map: a Map
 * instance can't cross the Server -> Client prop boundary (this
 * component is "use client", the page that renders it isn't), so the
 * page builds pairs from the same listAtlasCategories() call it's
 * already making, and this component reconstructs the Map itself.
 * `cards`/`currency`/`cardMonth` need no such treatment -- Money is a
 * plain branded string, CardBreakdown/CardCategoryAmount are plain
 * object literals.
 */
export function CardTypeToggle({
  cards,
  atlasCategoryNamePairs,
  currency,
  cardMonth,
  rewards,
}: {
  cards: CardBreakdown[];
  atlasCategoryNamePairs: [string, string][];
  currency: string;
  cardMonth: string;
  /** Infinia's own latest-statement rewards — null means no statement imported for it yet. Only Infinia's toggle shows this for now; the other 5 cards get their own turn later. */
  rewards: CardRewardsSummary | null;
}) {
  const [selectedKey, setSelectedKey] = useState<string>(CARD_BUTTONS[0].key);
  const atlasCategoryName = new Map(atlasCategoryNamePairs);

  const selected =
    CARD_BUTTONS.find((b) => b.key === selectedKey) ?? CARD_BUTTONS[0];
  const match = cards.find((c) => {
    const [issuer, cardType] = c.cardKey.split("|");
    return issuer === selected.issuer && cardType === selected.cardType;
  });
  // No entry for this card this month (zero spend) -- CardDonut's own
  // "No spend recorded." branch already handles an empty slice list, so
  // this needs no separate empty-state UI of its own.
  const breakdown = match ?? { totalSpend: ZERO, byCategory: [] };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 rounded-full bg-line p-1">
        {CARD_BUTTONS.map((b) => (
          <button
            key={b.key}
            type="button"
            onClick={() => setSelectedKey(b.key)}
            className={cn(
              "min-w-[31%] flex-1 rounded-full py-2 text-center font-display text-[12.5px] font-bold transition-colors",
              selectedKey === b.key ? "bg-accent text-white" : "text-ink-soft",
            )}
          >
            {b.label}
          </button>
        ))}
      </div>
      <CardDonut
        key={selected.key}
        label={selected.label}
        breakdown={breakdown}
        atlasCategoryName={atlasCategoryName}
        currency={currency}
        cardMonth={cardMonth}
        cardKeyForLink={match?.cardKey ?? "none"}
        variant="card"
      />
      {selected.key === "infinia" && (
        <CardRewardsSection rewards={rewards} currency={currency} />
      )}
    </div>
  );
}
