import { HotPatternDashboardCard } from "@/components/dashboard/HotPatternDashboardCard";
import { NeuralPayingDashboardCard } from "@/components/dashboard/NeuralPayingDashboardCard";
import { SurfAnalyzerDashboardCard } from "@/components/dashboard/SurfAnalyzerDashboardCard";
import { TieRadarDashboardCard } from "@/components/dashboard/TieRadarDashboardCard";
import { SurfRoadPanelsStrip } from "@/components/dashboard/SurfRoadPanelsStrip";
import {
  DASHBOARD_MAIN_CARDS_GRID,
  DASHBOARD_MODULE_CARD_SLOT,
} from "@/components/dashboard/dashboardModuleCardLayout";
import type { DashboardData, ModuleToggles, SurfAlert } from "@/types/dashboard";
import type { PatternMinerSnapshot } from "@/types/patternMiner";
import type { DailySurfMaxSnapshot } from "@/surf/DailySurfMaxEngine";

export function DashboardMainCardsGrid({
  data,
  mode,
  surfAlert,
  dailySurfMax,
  patternMinerSnapshot,
  patternMinerRounds,
  patternMinerIsUsingRealData,
  patternMinerFeedStatus,
  onModuleTogglesChange,
}: {
  data: DashboardData;
  mode: "live" | "mock" | "connecting" | "fallback";
  surfAlert: SurfAlert;
  dailySurfMax: DailySurfMaxSnapshot;
  patternMinerSnapshot: PatternMinerSnapshot;
  patternMinerRounds?: DashboardData["rounds"];
  patternMinerIsUsingRealData: boolean;
  patternMinerFeedStatus?: string | null;
  onModuleTogglesChange?: (toggles: ModuleToggles) => void;
}) {
  return (
    <div className="space-y-3">
      <section className={DASHBOARD_MAIN_CARDS_GRID}>
        <div className={DASHBOARD_MODULE_CARD_SLOT}>
          <NeuralPayingDashboardCard data={data} mode={mode} />
        </div>
        <div className={DASHBOARD_MODULE_CARD_SLOT}>
          <SurfAnalyzerDashboardCard
            alert={surfAlert}
            dailySurfMax={dailySurfMax}
            toggles={data.moduleToggles}
            onModuleTogglesChange={onModuleTogglesChange}
            persistedResults={data.dailyResultsByModule?.SURF_ANALYZER ?? []}
          />
        </div>
        <div className={DASHBOARD_MODULE_CARD_SLOT}>
          <TieRadarDashboardCard
            alert={data.currentTieAlert}
            scoreboard={data.tieAlertScoreboard}
            history={data.tieRadarHistory ?? data.monthlyTieStats}
            rounds={data.rounds}
            patternMinerSnapshot={patternMinerSnapshot}
            toggles={data.moduleToggles}
            onModuleTogglesChange={onModuleTogglesChange}
          />
        </div>
        <div className={DASHBOARD_MODULE_CARD_SLOT}>
          <HotPatternDashboardCard
            snapshot={patternMinerSnapshot}
            isUsingRealData={patternMinerIsUsingRealData}
            latestRoundId={data.rounds.at(-1)?.id}
            rounds={patternMinerRounds ?? data.rounds}
            resultRounds={data.rounds}
            feedStatus={patternMinerFeedStatus}
            dashboardUpdatedAt={data.updatedAt}
            aiPatternSignal={data.aiPatternSignal}
            patternHotSignal={data.patternHotSignal}
            patternIaServerCycle={data.patternIaServerCycle}
            persistedResults={data.dailyResultsByModule?.PADROES_IA ?? []}
          />
        </div>
      </section>
      <SurfRoadPanelsStrip alert={surfAlert} />
    </div>
  );
}
