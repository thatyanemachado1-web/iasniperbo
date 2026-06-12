import { SurfAlertCard } from "@/components/dashboard/SurfAlertCard";
import { PremiumFeature } from "@/components/ui-app/PremiumFeature";
import type { ModuleToggles, SurfAlert } from "@/types/dashboard";

export function SurfAnalyzerDashboardCard({
  alert,
  toggles,
  onModuleTogglesChange,
}: {
  alert: SurfAlert;
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
        toggles={toggles}
        onModuleTogglesChange={onModuleTogglesChange}
        compact
      />
    </PremiumFeature>
  );
}
