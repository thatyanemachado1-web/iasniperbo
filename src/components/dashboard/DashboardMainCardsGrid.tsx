import { HotPatternDashboardCard } from "@/components/dashboard/HotPatternDashboardCard";
import { NeuralPayingDashboardCard } from "@/components/dashboard/NeuralPayingDashboardCard";
import { SurfAnalyzerDashboardCard } from "@/components/dashboard/SurfAnalyzerDashboardCard";
import { TieRadarDashboardCard } from "@/components/dashboard/TieRadarDashboardCard";
import { SurfRoadPanelsStrip } from "@/components/dashboard/SurfRoadPanelsStrip";
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
  surfAlert: SurfAlert;
  dailySurfMax: DailySurfMaxSnapshot;
  patternMinerSnapshot: PatternMinerSnapshot;
  patternMinerIsUsingRealData: boolean;
  onModuleTogglesChange?: (toggles: ModuleToggles) => void;
}) {
  return (
    <div className="space-y-3">
      <section className="main-cards-grid grid w-full grid-cols-2 items-start gap-2 min-w-0 sm:gap-3 md:grid-cols-2 xl:grid-cols-4 xl:gap-4">
        <div className="min-w-0">
          <NeuralPayingDashboardCard data={data} />
        </div>
        <div className="min-w-0">
          <SurfAnalyzerDashboardCard
            alert={surfAlert}
            dailySurfMax={dailySurfMax}
            toggles={data.moduleToggles}
            onModuleTogglesChange={onModuleTogglesChange}
          />
        </div>
        <div className="min-w-0">
          <TieRadarDashboardCard
            alert={data.currentTieAlert}
            scoreboard={data.tieAlertScoreboard}
            rounds={data.rounds}
            patternMinerSnapshot={patternMinerSnapshot}
            toggles={data.moduleToggles}
            onModuleTogglesChange={onModuleTogglesChange}
          />
        </div>
        <div className="min-w-0">
          <HotPatternDashboardCard
            snapshot={patternMinerSnapshot}
            isUsingRealData={patternMinerIsUsingRealData}
          />
        </div>
      </section>
      <SurfRoadPanelsStrip alert={surfAlert} />
    </div>
  );
}
