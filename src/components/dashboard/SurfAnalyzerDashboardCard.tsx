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
      <SurfAlertCard
        alert={alert}
        dailySurfMax={dailySurfMax}
        toggles={toggles}
        onModuleTogglesChange={onModuleTogglesChange}
        compact
        showRoadPanels={false}
        className="h-full w-full"
      />
    </PremiumFeature>
  );
}
