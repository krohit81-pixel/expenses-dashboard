import type { Metadata } from "next";

import { Hero } from "@/components/ui/hero";

export const metadata: Metadata = {
  title: "AIS",
};

/**
 * v1.13.0: Annual Information Statement (AIS) explorer, FY 2025-26.
 *
 * Static page — the numbers below are transcribed from the household's
 * own AIS PDF (XXXPK7242X_2025-26_AIS.pdf, downloaded from the Income
 * Tax Compliance Portal), not read from the database. Atlas doesn't
 * parse AIS PDFs yet the way it parses credit card statements; this
 * page exists to make one dense, hard-to-read government PDF legible
 * as a real Atlas tab, per the household's request. A natural next
 * version would import the AIS PDF the same way statement imports
 * already work and render this same layout from parsed rows instead
 * of the AIS_DATA constant below — until then, update the constant by
 * hand each year the household downloads a fresh AIS.
 *
 * Only "Active" AIS rows are included in every total on this page.
 * Revised TDS/TCS filings mark the old row "Inactive" and add a new
 * "Active" row in its place — summing both would double count, which
 * is why the AIS PDF itself carries both but this page doesn't.
 */

const CATEGORY_COLORS = [
  "#5b21b6",
  "#9061e0",
  "#17a054",
  "#e0355b",
  "#f0a63a",
  "#cabfd6",
];

function inr(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

const AIS_DATA = {
  generatedOn: "08 Jul 2026",
  pan: "AMDPK****F",
  income: [
    { name: "Salary", value: 12943900 },
    { name: "EPF interest", value: 165650 },
    { name: "Bank interest", value: 33165 },
  ],
  salaryQuarters: [
    { quarter: "Q1 (Apr–Jun)", paid: 2682375, tds: 830130 },
    { quarter: "Q2 (Jul–Sep)", paid: 2682375, tds: 830130 },
    { quarter: "Q3 (Oct–Dec)", paid: 2682374, tds: 830129 },
    { quarter: "Q4 (Jan–Mar)", paid: 4896775, tds: 1624653 },
  ],
  salaryRows: [
    { quarter: "Q4 (Jan–Mar)", date: "31/03/2026", paid: 913325, tds: 283597 },
    {
      quarter: "Q4 (Jan–Mar)",
      date: "28/02/2026",
      paid: 3091725,
      tds: 1065208,
    },
    { quarter: "Q4 (Jan–Mar)", date: "31/01/2026", paid: 891725, tds: 275848 },
    { quarter: "Q3 (Oct–Dec)", date: "31/12/2025", paid: 894125, tds: 276709 },
    { quarter: "Q3 (Oct–Dec)", date: "30/11/2025", paid: 894125, tds: 276710 },
    { quarter: "Q3 (Oct–Dec)", date: "31/10/2025", paid: 894125, tds: 276710 },
    { quarter: "Q2 (Jul–Sep)", date: "30/09/2025", paid: 894125, tds: 276710 },
    { quarter: "Q2 (Jul–Sep)", date: "31/08/2025", paid: 894125, tds: 276710 },
    { quarter: "Q2 (Jul–Sep)", date: "31/07/2025", paid: 894125, tds: 276710 },
    { quarter: "Q1 (Apr–Jun)", date: "30/06/2025", paid: 894125, tds: 276710 },
    { quarter: "Q1 (Apr–Jun)", date: "31/05/2025", paid: 894125, tds: 276710 },
    { quarter: "Q1 (Apr–Jun)", date: "30/04/2025", paid: 894125, tds: 276710 },
  ],
  interestAccounts: [
    { bank: "SBM Bank (India)", type: "Term deposit", value: 23509 },
    { bank: "HDFC Bank", type: "Savings", value: 3270 },
    { bank: "ICICI Bank", type: "Term deposit (×2)", value: 1669 },
    { bank: "ICICI Bank", type: "Savings", value: 2822 },
    { bank: "DBS Bank India", type: "Savings", value: 609 },
    { bank: "HDFC Bank", type: "Term deposit", value: 981 },
    { bank: "SBM Bank (India)", type: "Savings", value: 305 },
  ],
  vehiclePurchase: {
    seller: "Bavaria Motors Private Limited",
    date: "08 Jan 2026",
    amount: 4653710,
    tcs: 46537,
  },
  creditCardPayments: [
    { bank: "ICICI Bank", value: 4131225 },
    { bank: "HDFC Bank", value: 3980774 },
    { bank: "Axis Bank", value: 1313599 },
  ],
  mutualFunds: [
    { quarter: "Q2 (Jul–Sep)", amc: "PPFAS Asset Management", value: 149992 },
    { quarter: "Q4 (Jan–Mar)", amc: "PPFAS Asset Management", value: 149992 },
  ],
  lrsQuarters: [
    { quarter: "Q1", icici: 0, dbs: 0 },
    { quarter: "Q2", icici: 104475, dbs: 0 },
    { quarter: "Q3", icici: 69210, dbs: 0 },
    { quarter: "Q4", icici: 36590, dbs: 106450 },
  ],
  singaporeRemittances: [
    { date: "20 Mar 2026", amount: 37050 },
    { date: "27 Feb 2026", amount: 36685 },
    { date: "18 Feb 2026", amount: 18223 },
    { date: "05 Feb 2026", amount: 14492 },
  ],
  forexPurchases: [
    {
      bank: "ICICI Bank",
      date: "31 May 2026",
      gross: 2306543,
      paidToYou: 316744,
    },
    { bank: "HDFC Bank", date: "23 May 2026", gross: 1060470, paidToYou: 4232 },
  ],
  selfAssessment: [
    {
      forYear: "2024-25",
      date: "05 Sep 2025",
      challan: "22534",
      amount: 14670,
    },
  ],
} as const;

const totalIncome = AIS_DATA.income.reduce((s, i) => s + i.value, 0);
const totalTDS = AIS_DATA.salaryQuarters.reduce((s, q) => s + q.tds, 0) + 16565;
const totalCC = AIS_DATA.creditCardPayments.reduce((s, c) => s + c.value, 0);
const totalLRS = AIS_DATA.lrsQuarters.reduce((s, q) => s + q.icici + q.dbs, 0);
const totalMF = AIS_DATA.mutualFunds.reduce((s, m) => s + m.value, 0);
const maxSalaryQuarter = Math.max(
  ...AIS_DATA.salaryQuarters.map((q) => q.paid),
);
const maxInterest = Math.max(...AIS_DATA.interestAccounts.map((a) => a.value));
const maxCC = Math.max(...AIS_DATA.creditCardPayments.map((c) => c.value));
const maxLRSQuarter = Math.max(
  ...AIS_DATA.lrsQuarters.map((q) => q.icici + q.dbs),
);

function buildGradientStops(): string {
  let acc = 0;
  const stops: string[] = [];
  AIS_DATA.income.forEach((slice, i) => {
    const start = (acc / totalIncome) * 360;
    acc += slice.value;
    const end = (acc / totalIncome) * 360;
    stops.push(
      `${CATEGORY_COLORS[i % CATEGORY_COLORS.length]} ${start}deg ${end}deg`,
    );
  });
  return stops.join(", ");
}

function StatCard({
  label,
  value,
  note,
  tone = "default",
}: {
  label: string;
  value: string;
  note: string;
  tone?: "default" | "accent" | "positive" | "amber";
}) {
  const toneClasses =
    tone === "accent"
      ? "bg-accent-soft"
      : tone === "positive"
        ? "bg-surface"
        : tone === "amber"
          ? "bg-surface"
          : "bg-surface";
  const valueClasses =
    tone === "accent"
      ? "text-accent"
      : tone === "positive"
        ? "text-positive"
        : tone === "amber"
          ? "text-amber"
          : "text-ink";
  return (
    <div
      className={`rounded-[18px] p-4 shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)] ${toneClasses}`}
    >
      <div className="font-display text-[10px] font-bold uppercase tracking-wide text-ink-faint">
        {label}
      </div>
      <div
        className={`mt-1.5 font-display text-lg font-extrabold ${valueClasses}`}
      >
        {value}
      </div>
      <div className="mt-1 text-[11px] text-ink-soft">{note}</div>
    </div>
  );
}

function SectionHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-1">
      <h2 className="font-display text-[15px] font-bold text-ink">{title}</h2>
      {hint && <span className="text-[11.5px] text-ink-faint">{hint}</span>}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[20px] bg-surface p-5 shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
      {children}
    </div>
  );
}

function Commentary({ title, points }: { title: string; points: string[] }) {
  return (
    <div className="mt-4 rounded-2xl border-[1.5px] border-accent-soft bg-accent-soft/40 p-4">
      <h3 className="mb-2 font-display text-[11px] font-bold uppercase tracking-wide text-accent">
        {title}
      </h3>
      <ul className="space-y-1.5 text-[12.5px] leading-relaxed text-ink-soft">
        {points.map((p, i) => (
          <li key={i}>{p}</li>
        ))}
      </ul>
    </div>
  );
}

function Bar({
  label,
  value,
  max,
  displayValue,
}: {
  label: string;
  value: number;
  max: number;
  displayValue: string;
}) {
  const width = max > 0 ? Math.max((value / max) * 100, 2) : 0;
  return (
    <div className="mb-2.5 last:mb-0">
      <div className="mb-1 flex items-center justify-between gap-2 text-[11.5px]">
        <span className="truncate font-semibold text-ink">{label}</span>
        <span className="shrink-0 font-display font-bold text-ink-faint">
          {displayValue}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-bg">
        <div
          className="h-full rounded-full bg-accent"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

export default function AisPage() {
  const gradientStops = buildGradientStops();

  return (
    <div>
      <Hero
        title="AIS · FY 2025-26"
        label="Total income reported"
        amount={inr(totalIncome)}
        sub={`Annual Information Statement · generated ${AIS_DATA.generatedOn} · PAN ${AIS_DATA.pan}`}
      />

      <div className="space-y-6 p-5 sm:p-8">
        {/* Key numbers */}
        <section>
          <SectionHeading
            title="Key numbers"
            hint="As reported by third parties to the Income Tax Department"
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard
              label="Total income"
              value={inr(totalIncome)}
              note="Salary + EPF + bank interest"
              tone="accent"
            />
            <StatCard
              label="TDS deducted"
              value={inr(totalTDS)}
              note={`≈${pct(totalTDS, totalIncome)}% of income`}
            />
            <StatCard
              label="TCS collected"
              value={inr(46537)}
              note="On the vehicle purchase only"
            />
            <StatCard
              label="Credit card bills paid"
              value={inr(totalCC)}
              note="Reported by 3 card-issuing banks"
              tone="positive"
            />
            <StatCard
              label="LRS remittances abroad"
              value={inr(totalLRS)}
              note="Well under the $250k/yr LRS limit"
            />
            <StatCard
              label="Vehicle purchase"
              value={inr(AIS_DATA.vehiclePurchase.amount)}
              note="Bavaria Motors, Jan 2026"
              tone="amber"
            />
          </div>
        </section>

        {/* Income composition */}
        <section>
          <SectionHeading title="Where the reported income came from" />
          <Card>
            <div className="flex flex-col items-center gap-5 sm:flex-row">
              <div
                className="relative size-[150px] shrink-0 rounded-full"
                style={{ background: `conic-gradient(${gradientStops})` }}
              >
                <div className="absolute inset-[18px] flex flex-col items-center justify-center rounded-full bg-surface text-center">
                  <span className="font-display text-[13px] font-extrabold text-ink">
                    {inr(totalIncome)}
                  </span>
                  <span className="text-[10px] text-ink-faint">total</span>
                </div>
              </div>
              <ul className="w-full min-w-0 flex-1 space-y-2">
                {AIS_DATA.income.map((slice, i) => (
                  <li
                    key={slice.name}
                    className="flex items-center gap-2 text-[13px]"
                  >
                    <span
                      className="size-2.5 shrink-0 rounded-[3px]"
                      style={{
                        background: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
                      }}
                    />
                    <span className="min-w-0 flex-1 truncate font-medium text-ink">
                      {slice.name}
                    </span>
                    <span className="shrink-0 font-display font-bold text-ink">
                      {inr(slice.value)}
                    </span>
                    <span className="w-10 shrink-0 text-right font-display text-[11px] font-bold text-ink-faint">
                      {pct(slice.value, totalIncome)}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <Commentary
              title="Reading this"
              points={[
                "Salary from a single employer (UBS Business Solutions India) for the full year is 98.5% of everything reported — this AIS is dominated by one income source.",
                "EPF interest of ₹1,65,650 already had TDS deducted at source (Section 194A) — taxable interest credited on your provident fund balance, separate from bank interest.",
                "Combined bank interest across 4 banks is small (₹33,165) and none of it individually crossed the ₹40,000 TDS threshold, so no tax was deducted on it directly.",
              ]}
            />
          </Card>
        </section>

        {/* Salary & TDS */}
        <section>
          <SectionHeading
            title="Salary & TDS, quarter by quarter"
            hint="Section 192 · UBS Business Solutions (India)"
          />
          <Card>
            {AIS_DATA.salaryQuarters.map((q) => (
              <Bar
                key={q.quarter}
                label={q.quarter}
                value={q.paid}
                max={maxSalaryQuarter}
                displayValue={`${inr(q.paid)} paid · ${inr(q.tds)} TDS`}
              />
            ))}
            <Commentary
              title="Reading this"
              points={[
                "Q4 stands out — ₹30,91,725 paid on 28 Feb 2026 alone is more than an entire regular quarter, almost certainly an annual bonus or variable pay disbursement on top of base salary.",
                "The effective TDS rate holds steady around 31% for regular months and rises to 33.2% in Q4 once the bonus pushes more income into the top slab.",
              ]}
            />
          </Card>

          <details className="group mt-3 rounded-[20px] bg-surface shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
            <summary className="flex cursor-pointer items-center justify-between px-5 py-3.5 font-display text-[13px] font-bold text-ink">
              Every salary payment this year
              <span className="text-ink-faint transition-transform group-open:rotate-180">
                &#9662;
              </span>
            </summary>
            <div className="overflow-x-auto px-5 pb-5">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="text-left text-[10px] font-bold uppercase tracking-wide text-ink-faint">
                    <th className="pb-2">Quarter</th>
                    <th className="pb-2">Date</th>
                    <th className="pb-2 text-right">Paid</th>
                    <th className="pb-2 text-right">TDS deducted</th>
                  </tr>
                </thead>
                <tbody>
                  {AIS_DATA.salaryRows.map((r, i) => (
                    <tr key={i} className="border-t border-line">
                      <td className="py-2 text-ink-soft">{r.quarter}</td>
                      <td className="py-2 text-ink-soft">{r.date}</td>
                      <td className="py-2 text-right font-semibold text-ink">
                        {inr(r.paid)}
                      </td>
                      <td className="py-2 text-right font-semibold text-ink">
                        {inr(r.tds)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-[11px] text-ink-faint">
                18 rows appear in the raw AIS; 6 are &quot;Inactive&quot;
                duplicates superseded by a correction filing and are excluded
                here.
              </p>
            </div>
          </details>
        </section>

        {/* Interest income */}
        <section>
          <SectionHeading
            title="Interest income by account"
            hint="SFT-016 · savings & term deposits across 4 banks"
          />
          <Card>
            {AIS_DATA.interestAccounts.map((a, i) => (
              <Bar
                key={i}
                label={`${a.bank} · ${a.type}`}
                value={a.value}
                max={maxInterest}
                displayValue={inr(a.value)}
              />
            ))}
            <Commentary
              title="Reading this"
              points={[
                "SBM Bank's term deposit (₹23,509) is by far the largest interest line — worth checking that account's maturity date for FY26-27 planning.",
                "No bank interest crossed the ₹40,000 (or ₹50,000 for seniors) Section 194A threshold individually, so none had TDS deducted — it's still fully taxable and needs to be declared in the return.",
              ]}
            />
          </Card>
        </section>

        {/* Big-ticket transactions */}
        <section>
          <SectionHeading title="Big-ticket transactions" />

          <div className="mb-3 flex items-center gap-3.5 rounded-[20px] bg-surface p-4 shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-[13px] bg-amber-soft text-lg">
              🚗
            </div>
            <div className="min-w-0">
              <div className="font-display text-sm font-bold text-ink">
                Motor vehicle purchase — {inr(AIS_DATA.vehiclePurchase.amount)}
              </div>
              <div className="mt-0.5 text-[11.5px] text-ink-soft">
                {AIS_DATA.vehiclePurchase.seller} &middot;{" "}
                {AIS_DATA.vehiclePurchase.date} &middot; TCS collected{" "}
                {inr(AIS_DATA.vehiclePurchase.tcs)} (1%, Section 206C) &mdash;
                the single largest reported transaction outside salary.
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Card>
              <h3 className="mb-3 font-display text-[13px] font-bold text-ink">
                Credit card bill payments (SFT-006)
              </h3>
              {AIS_DATA.creditCardPayments.map((c) => (
                <Bar
                  key={c.bank}
                  label={c.bank}
                  value={c.value}
                  max={maxCC}
                  displayValue={inr(c.value)}
                />
              ))}
              <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5 text-[12.5px] font-bold text-ink">
                <span>Total</span>
                <span>{inr(totalCC)}</span>
              </div>
            </Card>
            <Card>
              <h3 className="mb-3 font-display text-[13px] font-bold text-ink">
                Mutual fund purchases (SFT-018)
              </h3>
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="text-left text-[10px] font-bold uppercase tracking-wide text-ink-faint">
                    <th className="pb-2">Quarter</th>
                    <th className="pb-2">AMC</th>
                    <th className="pb-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {AIS_DATA.mutualFunds.map((m, i) => (
                    <tr key={i} className="border-t border-line">
                      <td className="py-2 text-ink-soft">{m.quarter}</td>
                      <td className="py-2 text-ink-soft">{m.amc}</td>
                      <td className="py-2 text-right font-semibold text-ink">
                        {inr(m.value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5 text-[12.5px] font-bold text-ink">
                <span>Total</span>
                <span>{inr(totalMF)}</span>
              </div>
              <Commentary
                title="Reading this"
                points={[
                  `The credit card total of ${inr(totalCC)} is bills paid, not spend by category — a good cross-check against Atlas's own tracked card payments once every statement for the year is imported.`,
                  "Only one AMC (PPFAS) shows up via SFT — investments through other platforms may not always appear here depending on the intermediary's reporting.",
                ]}
              />
            </Card>
          </div>
        </section>

        {/* Foreign remittance & forex */}
        <section>
          <SectionHeading
            title="Foreign remittance & forex"
            hint="LRS remittances, forex purchases, and outward transfers"
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Card>
              <h3 className="mb-3 font-display text-[13px] font-bold text-ink">
                LRS remittance by quarter (Section 206C(1G))
              </h3>
              {AIS_DATA.lrsQuarters.map((q) => (
                <Bar
                  key={q.quarter}
                  label={q.quarter}
                  value={q.icici + q.dbs}
                  max={maxLRSQuarter}
                  displayValue={inr(q.icici + q.dbs)}
                />
              ))}
            </Card>
            <Card>
              <h3 className="mb-3 font-display text-[13px] font-bold text-ink">
                4 remittances to Singapore (DBS, family maintenance)
              </h3>
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="text-left text-[10px] font-bold uppercase tracking-wide text-ink-faint">
                    <th className="pb-2">Date</th>
                    <th className="pb-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {AIS_DATA.singaporeRemittances.map((r, i) => (
                    <tr key={i} className="border-t border-line">
                      <td className="py-2 text-ink-soft">{r.date}</td>
                      <td className="py-2 text-right font-semibold text-ink">
                        {inr(r.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <span className="mt-3 inline-block rounded-full bg-bg px-2.5 py-1 text-[11px] font-semibold text-ink-soft">
                Purpose code S1301 &middot; family maintenance & savings
              </span>
            </Card>
          </div>

          <Card>
            <h3 className="mb-3 mt-3 font-display text-[13px] font-bold text-ink">
              Foreign currency purchases (SFT-011)
            </h3>
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-[10px] font-bold uppercase tracking-wide text-ink-faint">
                  <th className="pb-2">Bank</th>
                  <th className="pb-2">Date</th>
                  <th className="pb-2 text-right">Gross amount</th>
                  <th className="pb-2 text-right">Paid to you</th>
                </tr>
              </thead>
              <tbody>
                {AIS_DATA.forexPurchases.map((f, i) => (
                  <tr key={i} className="border-t border-line">
                    <td className="py-2 text-ink-soft">{f.bank}</td>
                    <td className="py-2 text-ink-soft">{f.date}</td>
                    <td className="py-2 text-right font-semibold text-ink">
                      {inr(f.gross)}
                    </td>
                    <td className="py-2 text-right font-semibold text-ink">
                      {inr(f.paidToYou)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Commentary
              title="Reading this — LRS ≠ SFT-011, don't add them together"
              points={[
                "LRS remittances (₹3.17L) and forex purchases under SFT-011 (₹33.67L gross) are reported under different rules by different desks of the same banks, and can overlap — treat them as two separate lenses on foreign-currency activity, not two amounts to sum.",
                "Total LRS remittances for the year are well inside RBI's USD 250,000/year Liberalised Remittance Scheme limit, with plenty of headroom.",
                "None of the LRS transactions triggered TCS — likely because each individual remittance stayed under the applicable per-transaction TCS threshold, or fell under an exempt purpose.",
              ]}
            />
          </Card>
        </section>

        {/* Tax payments & refunds */}
        <section>
          <SectionHeading title="Tax payments & refunds" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Card>
              <h3 className="mb-3 font-display text-[13px] font-bold text-ink">
                Self-assessment tax paid
              </h3>
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="text-left text-[10px] font-bold uppercase tracking-wide text-ink-faint">
                    <th className="pb-2">For FY</th>
                    <th className="pb-2">Date</th>
                    <th className="pb-2">Challan</th>
                    <th className="pb-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {AIS_DATA.selfAssessment.map((s, i) => (
                    <tr key={i} className="border-t border-line">
                      <td className="py-2 text-ink-soft">{s.forYear}</td>
                      <td className="py-2 text-ink-soft">{s.date}</td>
                      <td className="py-2 text-ink-soft">{s.challan}</td>
                      <td className="py-2 text-right font-semibold text-ink">
                        {inr(s.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-[11.5px] text-ink-soft">
                This is self-assessment tax for the previous financial year
                (2024-25), paid during FY 2025-26 — likely a top-up payment made
                while filing that year&apos;s return.
              </p>
            </Card>
            <Card>
              <h3 className="mb-2 font-display text-[13px] font-bold text-ink">
                Refunds
              </h3>
              <p className="mb-2 text-[13px] text-ink-soft">
                No refund transactions on record for this AIS.
              </p>
              <span className="inline-block rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-bold text-accent">
                No transactions present
              </span>
            </Card>
          </div>
        </section>

        {/* Glossary */}
        <details className="group rounded-[20px] bg-surface shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
          <summary className="flex cursor-pointer items-center justify-between px-5 py-3.5 font-display text-[13px] font-bold text-ink">
            How to read an AIS
            <span className="text-ink-faint transition-transform group-open:rotate-180">
              &#9662;
            </span>
          </summary>
          <div className="grid grid-cols-1 gap-2.5 px-5 pb-5 text-[12.5px] sm:grid-cols-2">
            {[
              [
                "TDS vs TCS",
                "TDS is tax deducted from money paid to you (salary, interest); TCS is tax collected from money you pay out (buying a car, remitting abroad).",
              ],
              [
                "SFT",
                "Specified Financial Transaction — high-value transactions banks/institutions must report regardless of whether tax was deducted (card bill payments, FDs, mutual fund purchases).",
              ],
              [
                "Active vs Inactive rows",
                "When a deductor files a correction statement, the old row is marked Inactive and a new Active row replaces it — only Active rows are counted on this page.",
              ],
              [
                "Section 192",
                "TDS on salary — deducted every payroll cycle based on your projected annual tax liability.",
              ],
              [
                "Section 194A",
                "TDS on interest other than interest on securities — bank/EPF interest above the threshold.",
              ],
              [
                "Section 206C(1G)",
                "TCS on outward remittances under the Liberalised Remittance Scheme (LRS) and on overseas tour packages.",
              ],
              [
                "15CC",
                "A quarterly statement banks file for outward foreign remittances, tagged with an RBI purpose code (here, S1301 = family maintenance and savings).",
              ],
            ].map(([term, desc]) => (
              <div key={term} className="rounded-2xl bg-bg p-3">
                <div className="mb-1 font-display text-[12.5px] font-bold text-ink">
                  {term}
                </div>
                <div className="text-ink-soft">{desc}</div>
              </div>
            ))}
          </div>
        </details>

        <p className="text-center text-[11px] text-ink-faint">
          Built from XXXPK7242X_2025-26_AIS.pdf, generated by the Income Tax
          Department&apos;s Compliance Portal on {AIS_DATA.generatedOn}. This is
          a personal summary for understanding your own numbers — always rely on
          Form 26AS / the official AIS on the Compliance Portal when actually
          filing a return.
        </p>
      </div>
    </div>
  );
}
