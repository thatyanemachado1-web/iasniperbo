import { SurfAlertCard } from "@/components/dashboard/SurfAlertCard";
import { DASHBOARD_MODULE_CARD_ROOT } from "@/components/dashboard/dashboardModuleCardLayout";
import { PremiumFeature } from "@/components/ui-app/PremiumFeature";
import type { ModuleToggles, SurfAlert } from "@/types/dashboard";
import type { DailySurfMaxSnapshot } from "@/surf/DailySurfMaxEngine";

export function SurfAnalyzerDashboardCard({
  alert,
  dailySurfMax,
  toggles,
  onModuleTogglesChange,
}: {
  alert: SurfAlert;
  dailySurfMax: DailySurfMaxSnapshot;
  toggles?: ModuleToggles;
  onModuleTogglesChange?: (toggles: ModuleToggles) => void;
}) {
  return (
    <PremiumFeature
      title="Surf Analyzer VIP"
      description="Leitura completa de surf fica bloqueada no demo."
      className={`${DASHBOARD_MODULE_CARD_ROOT} min-w-0`}
    >
      <div className="flex h-full min-h-0 flex-1 flex-col">
        <div className="flex h-full flex-1 flex-col md:hidden">
          <SurfAlertCard
            alert={alert}
            dailySurfMax={dailySurfMax}
            toggles={toggles}
            onModuleTogglesChange={onModuleTogglesChange}
            compact
            essentialOnly
            showRoadPanels={false}
            className="h-full w-full"
          />
        </div>
        <div className="hidden h-full flex-1 flex-col md:flex">
          <SurfAlertCard
            alert={alert}
            dailySurfMax={dailySurfMax}
            toggles={toggles}
            onModuleTogglesChange={onModuleTogglesChange}
            compact={false}
            showRoadPanels
            className="h-full w-full"
          />
        </div>
      </div>
    </PremiumFeature>
  );
}
