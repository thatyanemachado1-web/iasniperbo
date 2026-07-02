import { PatternMinerMiniCard } from "@/components/patternMiner/PatternMinerMiniCard";
import type { PatternIaLifecycleView, PatternMinerSnapshot } from "@/types/patternMiner";

export function HotPatternDashboardCard({
  snapshot,
  lifecycle,
  isUsingRealData,
}: {
  snapshot: PatternMinerSnapshot;
  lifecycle: PatternIaLifecycleView;
  isUsingRealData: boolean;
}) {
  return (
    <PatternMinerMiniCard
      snapshot={snapshot}
      lifecycle={lifecycle}
      isUsingRealData={isUsingRealData}
      className="h-full w-full"
    />
  );
}
