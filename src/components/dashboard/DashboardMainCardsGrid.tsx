import { HotPatternDashboardCard } from "@/components/dashboard/HotPatternDashboardCard";
import { NeuralPayingDashboardCard } from "@/components/dashboard/NeuralPayingDashboardCard";
import { SurfAnalyzerDashboardCard } from "@/components/dashboard/SurfAnalyzerDashboardCard";
import { TieRadarDashboardCard } from "@/components/dashboard/TieRadarDashboardCard";
import { SurfRoadPanelsStrip } from "@/components/dashboard/SurfRoadPanelsStrip";
import type { DashboardData, ModuleToggles, Round, SurfAlert } from "@/types/dashboard";
import type { PatternMinerSnapshot } from "@/types/patternMiner";

export function DashboardMainCardsGrid({
  data,
  surfAlert,
  surfMaxRounds,
  patternMinerSnapshot,
  patternMinerIsUsingRealData,
  onModuleTogglesChange,
}: {
  data: DashboardData;
  surfAlert: SurfAlert;
  surfMaxRounds?: Round[];
  patternMinerSnapshot: PatternMinerSnapshot;
  patternMinerIsUsingRealData: boolean;
  onModuleTogglesChange?: (toggles: ModuleToggles) => void;
}) {
  return (
    <div className="space-y-3">
      <section className="main-cards-grid grid w-full grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-4">
        <NeuralPayingDashboardCard data={data} />
        <SurfAnalyzerDashboardCard
          alert={surfAlert}
          rounds={surfMaxRounds ?? data.rounds}
          toggles={data.moduleToggles}
          onModuleTogglesChange={onModuleTogglesChange}
        />
        <TieRadarDashboardCard
          alert={data.currentTieAlert}
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
      <SurfRoadPanelsStrip alert={surfAlert} />
    </div>
  );
}
