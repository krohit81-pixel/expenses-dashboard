/**
 * The report's donut chart — the PDF analog of Intel's own
 * conic-gradient donut (src/app/(app)/intel/page.tsx renderCardDonut).
 * react-pdf has no CSS conic-gradient support, so each slice is drawn
 * as a real SVG arc path via donutArcPath (lib/intel/credit-card-report.ts),
 * fed the exact same top-5-plus-Other slices buildDonutSlices already
 * computes for Intel's real donut.
 */
import { Circle, Path, Svg, Text, View } from "@react-pdf/renderer";

import type { DonutSlice } from "@/lib/intel/donut";
import { donutArcPath } from "@/lib/intel/credit-card-report";
import { moneyToDbNumber, sumMoney } from "@/lib/money";
import { formatMoneyForPdf } from "./format";
import { CATEGORY_COLORS, COLORS } from "./theme";

const SIZE = 150;
const CENTER = SIZE / 2;
const R_OUTER = 68;
const R_INNER = 40;

export function ReportDonut({
  slices,
  currency,
}: {
  slices: DonutSlice[];
  currency: string;
}) {
  const total = sumMoney(slices.map((s) => s.total));
  const totalNum = moneyToDbNumber(total);

  let cumulativeAngle = 0;
  const arcs = slices.map((slice, i) => {
    const pct =
      totalNum > 0 ? (moneyToDbNumber(slice.total) / totalNum) * 100 : 0;
    const start = cumulativeAngle;
    const end = cumulativeAngle + (pct / 100) * 360;
    cumulativeAngle = end;
    return {
      color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
      d: donutArcPath(CENTER, CENTER, R_OUTER, R_INNER, start, end),
    };
  });

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 20 }}>
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        {slices.length === 1 ? (
          <Circle
            cx={CENTER}
            cy={CENTER}
            r={(R_OUTER + R_INNER) / 2}
            stroke={arcs[0].color}
            strokeWidth={R_OUTER - R_INNER}
            fill="none"
          />
        ) : (
          arcs.map((arc, i) => <Path key={i} d={arc.d} fill={arc.color} />)
        )}
      </Svg>
      <View style={{ flex: 1 }}>
        {slices.map((slice, i) => (
          <View
            key={slice.name}
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 5,
            }}
          >
            <View
              style={{
                width: 8,
                height: 8,
                backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
                borderRadius: 2,
                marginRight: 6,
              }}
            />
            <Text style={{ fontSize: 9, color: COLORS.ink, flex: 1 }}>
              {slice.name}
            </Text>
            <Text style={{ fontSize: 9, color: COLORS.inkSoft }}>
              {formatMoneyForPdf(slice.total, currency)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
