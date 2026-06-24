import { HotPatternDashboardCard } from "@/components/dashboard/HotPatternDashboardCard";
import { NeuralPayingDashboardCard } from "@/components/dashboard/NeuralPayingDashboardCard";
import { SurfAnalyzerDashboardCard } from "@/components/dashboard/SurfAnalyzerDashboardCard";
import { TieRadarDashboardCard } from "@/components/dashboard/TieRadarDashboardCard";
import { SurfRoadPanelsStrip } from "@/components/dashboard/SurfRoadPanelsStrip";
import { mockDashboardData } from "@/data/mockDashboardData";
import type { DashboardData, ModuleToggles, SurfAlert } from "@/types/dashboard";
import type { PatternMinerSnapshot } from "@/types/patternMiner";
import type { DailySurfMaxSnapshot } from "@/surf/DailySurfMaxEngine";

export function DashboardMainCardsGrid({
  data,
  surfAlert,
  dailySurfMax,
  patternMinerSnapshot,
  patternMinerIsUsingRealData,
  onModuleTogglesChange,
}: {
  data: DashboardData;
  surfAlert?: SurfAlert;
  dailySurfMax: DailySurfMaxSnapshot;
  patternMinerSnapshot: PatternMinerSnapshot;
  patternMinerIsUsingRealData: boolean;
  onModuleTogglesChange?: (toggles: ModuleToggles) => void;
}) {
  const safeSurfAlert = (surfAlert ?? mockDashboardData.currentSurfAlert) as SurfAlert;

  return (
    <div className="space-y-3">
      <section className="main-cards-grid grid w-full grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-4">
        <NeuralPayingDashboardCard data={data} />
        <SurfAnalyzerDashboardCard
          alert={safeSurfAlert}
          dailySurfMax={dailySurfMax}
          toggles={data.moduleToggles}
          onModuleTogglesChange={onModuleTogglesChange}
        />
        <TieRadarDashboardCard
          alert={data.currentTieAlert}
          scoreboard={data.tieAlertScoreboard}
          rounds={data.rounds}
          patternMinerSnapshot={patternMinerSnapshot}
          toggles={data.moduleToggles}
          onModuleTogglesChange={onModuleTogglesChange}
        />
        <HotPatternDashboardCard
          snapshot={patternMinerSnapshot}
          isUsingRealData={patternMinerIsUsingRealData}
        />
      </section>
      <SurfRoadPanelsStrip alert={safeSurfAlert} />
    </div>
  );
}
