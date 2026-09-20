import type { Metadata } from "next";

import { requireUser } from "@/lib/auth/require-user";
import { getUserSettings } from "@/services/UserSettingsService";
import {
  getCardCategoryBreakdown,
  getLatestCardPointsBalance,
  getLatestCardRewardsSummary,
  hasAnyCreditCardStatement,
} from "@/services/CreditCardIntelService";
import { listAtlasCategories } from "@/services/MerchantService";
import { currentCycleMonth, isValidMonth } from "@/lib/dates/month";
import { Hero } from "@/components/ui/hero";
import { CardMonthNav } from "@/features/intel/components/CardMonthNav";
import { CardDonut } from "@/features/intel/components/CardDonut";
import { CombinedReportSection } from "@/features/intel/components/CombinedReportSection";
import { CardTypeToggle } from "@/features/cards/components/CardTypeToggle";

export const metadata: Metadata = {
  title: "Cards",
};

/**
 * v3.8.0 — a dedicated home for credit card spend, replacing Dashboard
 * and Intel in primary nav (both hidden, not deleted — still reachable
 * by direct URL, see app-nav.tsx). Reuses the exact same combined +
 * per-card donut/drill-down UI Intel's own "Card-level breakdown"
 * section already had — CardDonut and CombinedReportSection are the
 * same shared components that section now imports too (see
 * intel/page.tsx), just arranged as this page's own primary content
 * instead of one collapsible section among several.
 *
 * Two deliberate differences from how Intel showed this data:
 * - The combined/aggregate donut shows whenever there's ANY card spend
 *   this month (cardBreakdown.cards.length > 0), not only when more
 *   than one card had spend (Intel's `hasMultipleCards` gate) — this
 *   page is the dedicated home for the combined view now, not a
 *   secondary breakdown alongside other things.
 * - Per-card donuts are reached one at a time through a 6-button
 *   toggle (CardTypeToggle, one button per real card) instead of a
 *   side-by-side grid — the grid worked when this was a small section
 *   on a busier page; a full-width single-card view reads better as
 *   this page's own primary content.
 *
 * No <Suspense> split like Intel's own CardLevelBreakdownSection —
 * unlike Intel, nothing else on this page competes for the initial
 * paint, so one top-level await is simpler.
 *
 * v3.9.0 — Infinia's toggle gained a real rewards section
 * (CardRewardsSection): a reconciliation strip, a top-5 point-earning
 * transactions list, and the statement's own "Rewards Program Points
 * Summary" table, always for the card's own LATEST statement
 * (independent of whichever month is selected above, same convention
 * CombinedReportSection already follows). This also fixed a real gating
 * bug: <CardTypeToggle> used to be skipped entirely on a month with zero
 * card spend across every card, which would have hidden Infinia's
 * rewards section too on such a month even though it has nothing to do
 * with the viewed month — it's unconditional now, same as CardDonut's
 * own existing "No spend recorded." handling already covers a single
 * card's zero-spend month without needing a page-level message on top
 * of it.
 *
 * v4.1.0 — ICICI RuPay's toggle reuses the exact same CardRewardsSection
 * as Infinia (getLatestCardRewardsSummary is already issuer-agnostic;
 * its statement's per-transaction points sum to its own printed "Total
 * Points earned" exactly, same reconciliation shape as Infinia, just
 * with an empty bonus-program table). Axis Horizon's toggle gets the
 * lighter CardPointsBalanceSection instead — its statement only ever
 * prints a running eDGE Miles balance, no per-transaction points or
 * cycle-earned total to reconcile against. Airtel/Tata Neu still have no
 * rewards section — their own turn later.
 *
 * v4.1.1 — Infinia's toggle also gets CardPointsBalanceSection, stacked
 * below its existing CardRewardsSection: Infinia's statement prints a
 * real running "Reward Points" closing balance (already parsed/stored,
 * see hdfc-infinia-tata/parse-header.ts's parseRewardsBlock — just never
 * surfaced in the UI before now), reusing the exact same
 * getLatestCardPointsBalance() Horizon's own balance card already calls.
 * RuPay deliberately does NOT get one — its statement never prints a
 * running balance at all (only the per-cycle "Total Points earned"
 * total CardRewardsSection already shows), so
 * getLatestCardPointsBalance("ICICI", "RuPay") would always read 0 —
 * confirmed with the household this isn't worth showing as a card.
 */
export default async function CardsPage({
  searchParams,
}: {
  searchParams: Promise<{ cardMonth?: string }>;
}) {
  const { cardMonth: cardMonthParam } = await searchParams;
  const cardMonth = isValidMonth(cardMonthParam)
    ? cardMonthParam
    : currentCycleMonth();
  const isCurrentCardMonth = cardMonth === currentCycleMonth();

  const user = await requireUser();
  const settings = await getUserSettings(user.id);
  const currency = settings?.baseCurrency ?? "USD";

  const [
    cardBreakdown,
    atlasCategories,
    anyCardStatements,
    infiniaRewards,
    rupayRewards,
    horizonBalance,
    infiniaBalance,
  ] = await Promise.all([
    getCardCategoryBreakdown(cardMonth),
    listAtlasCategories(),
    hasAnyCreditCardStatement(),
    getLatestCardRewardsSummary("HDFC", "Infinia"),
    getLatestCardRewardsSummary("ICICI", "RuPay"),
    getLatestCardPointsBalance("AXIS", "horizon"),
    getLatestCardPointsBalance("HDFC", "Infinia"),
  ]);

  if (!anyCardStatements) {
    return (
      <div>
        <Hero title="Cards" />
        <div className="p-5 sm:p-8">
          <div className="rounded-[20px] border-[1.5px] border-dashed border-line bg-surface p-5 text-center text-ink-faint">
            <div className="mb-1.5 font-display text-[13px] font-bold text-ink-soft">
              Needs statement imports
            </div>
            <p className="mx-auto max-w-[440px] text-sm leading-relaxed">
              Once you upload a credit card statement PDF on the Imports page,
              this tab will break each card&apos;s spend into categories and
              compare card-by-card.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const atlasCategoryNamePairs: [string, string][] = atlasCategories.map(
    (c) => [c.id, c.categoryName],
  );
  const atlasCategoryName = new Map(atlasCategoryNamePairs);

  return (
    <div>
      <Hero title="Cards" />
      <div className="space-y-4 p-5 sm:p-8">
        <CardMonthNav
          cardMonth={cardMonth}
          isCurrentCardMonth={isCurrentCardMonth}
          basePath="/cards"
        />

        {cardBreakdown.cards.length > 0 && (
          <CardDonut
            key="all-cards"
            label="All cards"
            breakdown={cardBreakdown.aggregate}
            atlasCategoryName={atlasCategoryName}
            currency={currency}
            cardMonth={cardMonth}
            cardKeyForLink="all"
            basePath="/cards"
            variant="aggregate"
          />
        )}

        <CardTypeToggle
          cards={cardBreakdown.cards}
          atlasCategoryNamePairs={atlasCategoryNamePairs}
          currency={currency}
          cardMonth={cardMonth}
          infiniaRewards={infiniaRewards}
          rupayRewards={rupayRewards}
          horizonBalance={horizonBalance}
          infiniaBalance={infiniaBalance}
        />

        <div className="pt-2">
          <CombinedReportSection />
        </div>
      </div>
    </div>
  );
}
