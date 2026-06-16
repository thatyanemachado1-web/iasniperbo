import { SurfAlertCard } from "@/components/dashboard/SurfAlertCard";
import { PremiumFeature } from "@/components/ui-app/PremiumFeature";
import type { ModuleToggles, Round, SurfAlert } from "@/types/dashboard";

export function SurfAnalyzerDashboardCard({
  alert,
  rounds,
  toggles,
  onModuleTogglesChange,
}: {
  alert: SurfAlert;
  rounds?: Round[];
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
        rounds={rounds}
        toggles={toggles}
        onModuleTogglesChange={onModuleTogglesChange}
        compact
        showRoadPanels={false}
      />
    </PremiumFeature>
  );
}
