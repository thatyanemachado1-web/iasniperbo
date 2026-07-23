import { TieAlertCard } from "@/components/dashboard/TieAlertCard";
import { PremiumFeature } from "@/components/ui-app/PremiumFeature";
import type { ModuleToggles, Round, TieAlert, TieAlertScoreboard, TieRadarHistoryAnalysis } from "@/types/dashboard";
import type { PatternMinerSnapshot } from "@/types/patternMiner";

export function TieRadarDashboardCard({
  alert,
  scoreboard,
  history,
  rounds,
  patternMinerSnapshot,
  toggles,
  onModuleTogglesChange,
}: {
  alert: TieAlert;
  scoreboard?: TieAlertScoreboard;
  history?: TieRadarHistoryAnalysis;
  rounds?: Round[];
  patternMinerSnapshot?: PatternMinerSnapshot;
  toggles?: ModuleToggles;
  onModuleTogglesChange?: (toggles: ModuleToggles) => void;
}) {
  return (
    <PremiumFeature
      title="Tie Alert VIP"
      description="Alerta de pressão e risco de empate fica completo apenas no acesso liberado."
      className="h-full min-w-0"
    >
      <TieAlertCard
        alert={alert}
        scoreboard={scoreboard}
        history={history}
        rounds={rounds}
        patternMinerSnapshot={patternMinerSnapshot}
        toggles={toggles}
        onModuleTogglesChange={onModuleTogglesChange}
        compact
      />
    </PremiumFeature>
  );
}
