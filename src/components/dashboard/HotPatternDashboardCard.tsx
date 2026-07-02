import { PatternMinerMiniCard } from "@/components/patternMiner/PatternMinerMiniCard";
import type { PatternMinerSnapshot } from "@/types/patternMiner";

export function HotPatternDashboardCard({
  snapshot,
  isUsingRealData,
}: {
  snapshot: PatternMinerSnapshot;
  isUsingRealData: boolean;
}) {
  return (
    <PatternMinerMiniCard snapshot={snapshot} isUsingRealData={isUsingRealData} className="h-full w-full" />
  );
}
