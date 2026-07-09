import { PatternMinerMiniCard } from "@/components/patternMiner/PatternMinerMiniCard";
import type { PatternMinerSnapshot } from "@/types/patternMiner";

export function HotPatternDashboardCard({
  snapshot,
  isUsingRealData,
  latestRoundId,
  rounds,
  resultRounds,
  feedStatus,
  dashboardUpdatedAt,
  aiPatternSignal,
  patternHotSignal,
  patternIaServerCycle,
  persistedResults,
}: {
  snapshot: PatternMinerSnapshot;
  isUsingRealData: boolean;
  latestRoundId?: number;
  rounds?: Parameters<typeof PatternMinerMiniCard>[0]["rounds"];
  resultRounds?: Parameters<typeof PatternMinerMiniCard>[0]["resultRounds"];
  feedStatus?: string | null;
  dashboardUpdatedAt?: string | null;
  aiPatternSignal?: unknown;
  patternHotSignal?: unknown;
  patternIaServerCycle?: unknown;
  persistedResults?: Parameters<typeof PatternMinerMiniCard>[0]["persistedResults"];
}) {
  return (
    <PatternMinerMiniCard
      snapshot={snapshot}
      isUsingRealData={isUsingRealData}
      latestRoundId={latestRoundId}
      rounds={rounds}
      resultRounds={resultRounds}
      feedStatus={feedStatus}
      dashboardUpdatedAt={dashboardUpdatedAt}
      aiPatternSignal={aiPatternSignal}
      patternHotSignal={patternHotSignal}
      patternIaServerCycle={patternIaServerCycle}
      persistedResults={persistedResults}
      className="h-full w-full"
    />
  );
}
