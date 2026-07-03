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
    <div className="h-full min-w-0">
      <PatternMinerMiniCard snapshot={snapshot} isUsingRealData={isUsingRealData} />
    </div>
  );
}
