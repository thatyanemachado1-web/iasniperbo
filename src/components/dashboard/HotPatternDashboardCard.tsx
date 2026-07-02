import { PatternMinerMiniCard } from "@/components/patternMiner/PatternMinerMiniCard";
import { PatternMinerClassicCard } from "@/components/patternMiner/PatternMinerClassicCard";
import type { PatternMinerSnapshot } from "@/types/patternMiner";

export function HotPatternDashboardCard({
  snapshot,
  isUsingRealData,
}: {
  snapshot: PatternMinerSnapshot;
  isUsingRealData: boolean;
}) {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="flex h-full flex-1 flex-col md:hidden">
        <PatternMinerMiniCard
          snapshot={snapshot}
          isUsingRealData={isUsingRealData}
          essentialOnly
          className="h-full w-full"
        />
      </div>
      <div className="hidden h-full flex-1 flex-col md:flex">
        <PatternMinerClassicCard
          snapshot={snapshot}
          isUsingRealData={isUsingRealData}
          className="h-full w-full"
        />
      </div>
    </div>
  );
}
