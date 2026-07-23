import { SmartTieRadarCard } from "@/components/dashboard/SmartTieRadarCard";
import { HorizontalLinesMonitorCard } from "@/components/dashboard/HorizontalLinesMonitorCard";
import type { BacBoResult } from "@/components/dashboard/BacBoBeadPlate";
import { SurfAnalyzerDashboardCard } from "@/components/dashboard/SurfAnalyzerDashboardCard";
import { SurfRoadPanelsStrip } from "@/components/dashboard/SurfRoadPanelsStrip";
import {
  DASHBOARD_MAIN_CARDS_GRID,
  DASHBOARD_MODULE_CARD_SLOT,
} from "@/components/dashboard/dashboardModuleCardLayout";
import type { DashboardData, ModuleToggles, SurfAlert } from "@/types/dashboard";
import type { DailySurfMaxSnapshot } from "@/surf/DailySurfMaxEngine";

export function DashboardMainCardsGrid({
  data,
  surfAlert,
  dailySurfMax,
  lateralTieResults,
  onModuleTogglesChange,
}: {
  data: DashboardData;
  surfAlert: SurfAlert;
  dailySurfMax: DailySurfMaxSnapshot;
  lateralTieResults: BacBoResult[];
  onModuleTogglesChange?: (toggles: ModuleToggles) => void;
}) {
  return (
    <div className="space-y-3">
      <section className={DASHBOARD_MAIN_CARDS_GRID}>
        <div className={DASHBOARD_MODULE_CARD_SLOT}>
          <SurfAnalyzerDashboardCard
            alert={surfAlert}
            dailySurfMax={dailySurfMax}
            toggles={data.moduleToggles}
            onModuleTogglesChange={onModuleTogglesChange}
            persistedResults={data.dailyResultsByModule?.SURF_ANALYZER ?? []}
          />
        </div>
        <div className={`${DASHBOARD_MODULE_CARD_SLOT} hidden xl:flex`}>
          <SmartTieRadarCard
            alert={data.currentTieAlert}
            scoreboard={data.tieAlertScoreboard}
            history={data.monthlyTieStats ?? data.tieRadarHistory}
            lateralResults={lateralTieResults}
          />
        </div>
        <div className={DASHBOARD_MODULE_CARD_SLOT}>
          <HorizontalLinesMonitorCard results={lateralTieResults} />
        </div>
      </section>
      <SurfRoadPanelsStrip alert={surfAlert} />
    </div>
  );
}
