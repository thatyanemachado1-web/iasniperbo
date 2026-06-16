import { SurfAlertCard } from "@/components/dashboard/SurfAlertCard";
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
      className="h-full min-w-0"
    >
      <SurfAlertCard
        alert={alert}
        dailySurfMax={dailySurfMax}
        toggles={toggles}
        onModuleTogglesChange={onModuleTogglesChange}
        compact
        showRoadPanels={false}
      />
    </PremiumFeature>
  );
}
