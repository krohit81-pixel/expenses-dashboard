import type { Metadata } from "next";

import { requireUser } from "@/lib/auth/require-user";
import { getUserSettings } from "@/services/UserSettingsService";
import {
  getCardCategoryBreakdown,
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
 * CombinedReportSection already follows) — the other 5 cards get their
 * own turn later. This also fixed a real gating bug: <CardTypeToggle>
 * used to be skipped entirely on a month with zero card spend across
 * every card, which would have hidden Infinia's rewards section too on
 * such a month even though it has nothing to do with the viewed
 * month — it's unconditional now, same as CardDonut's own existing
 * "No spend recorded." handling already covers a single card's
 * zero-spend month without needing a page-level message on top of it.
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

  const [cardBreakdown, atlasCategories, anyCardStatements, infiniaRewards] =
    await Promise.all([
      getCardCategoryBreakdown(cardMonth),
      listAtlasCategories(),
      hasAnyCreditCardStatement(),
      getLatestCardRewardsSummary("HDFC", "Infinia"),
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
            variant="aggregate"
          />
        )}

        <CardTypeToggle
          cards={cardBreakdown.cards}
          atlasCategoryNamePairs={atlasCategoryNamePairs}
          currency={currency}
          cardMonth={cardMonth}
          rewards={infiniaRewards}
        />

        <div className="pt-2">
          <CombinedReportSection />
        </div>
      </div>
    </div>
  );
}
