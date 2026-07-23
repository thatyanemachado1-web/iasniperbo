import { SurfAlertCard } from "@/components/dashboard/SurfAlertCard";
import { PremiumFeature } from "@/components/ui-app/PremiumFeature";
import type { DashboardPersistentResult, ModuleToggles, SurfAlert } from "@/types/dashboard";
import type { DailySurfMaxSnapshot } from "@/surf/DailySurfMaxEngine";

export function SurfAnalyzerDashboardCard({
  alert,
  dailySurfMax,
  toggles,
  onModuleTogglesChange,
  persistedResults = [],
}: {
  alert: SurfAlert;
  dailySurfMax: DailySurfMaxSnapshot;
  toggles?: ModuleToggles;
  onModuleTogglesChange?: (toggles: ModuleToggles) => void;
  persistedResults?: DashboardPersistentResult[];
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
        persistedResults={persistedResults}
        compact
        showRoadPanels={false}
      />
    </PremiumFeature>
  );
}
