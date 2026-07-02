import { LeituraNeuralResponsiveCard } from "@/components/dashboard/LeituraNeuralResponsiveCard";
import { DASHBOARD_MODULE_CARD_ROOT } from "@/components/dashboard/dashboardModuleCardLayout";
import { PremiumFeature } from "@/components/ui-app/PremiumFeature";
import type { DashboardData, NeuralReading } from "@/types/dashboard";

const SCANNING_READING: NeuralReading = { mode: "SCANNING" };

export function NeuralPayingDashboardCard({ data }: { data: DashboardData }) {
  return (
    <PremiumFeature
      title="Leitura Neural VIP"
      description="Leitura de número pagante liberada no acesso Premium."
      className={`${DASHBOARD_MODULE_CARD_ROOT} min-w-0`}
    >
      <LeituraNeuralResponsiveCard
        {...(data.neuralReading ?? SCANNING_READING)}
        neuralScoreboard={data.neuralScoreboard}
        neuralEntryState={data.neuralEntryState}
        neuralEntryLastResult={data.neuralEntryLastResult}
        rounds={data.rounds}
        greenFlash={false}
        className="h-full w-full"
      />
    </PremiumFeature>
  );
}
