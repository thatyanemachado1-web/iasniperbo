import { PatternMinerMiniCard } from "@/components/patternMiner/PatternMinerMiniCard";
import type { PatternMinerSnapshot } from "@/types/patternMiner";

export function HotPatternDashboardCard({
  snapshot,
  isUsingRealData,
  latestRoundId,
}: {
  snapshot: PatternMinerSnapshot;
  isUsingRealData: boolean;
  latestRoundId?: number;
}) {
  return (
    <PatternMinerMiniCard
      snapshot={snapshot}
      isUsingRealData={isUsingRealData}
      latestRoundId={latestRoundId}
      className="h-full w-full"
    />
  );
}
