import { LeituraNeuralMiniCard } from "@/components/dashboard/LeituraNeuralMiniCard";
import { PremiumFeature } from "@/components/ui-app/PremiumFeature";
import type { DashboardData, NeuralReading } from "@/types/dashboard";

const SCANNING_READING: NeuralReading = { mode: "SCANNING" };

export function NeuralPayingDashboardCard({ data }: { data: DashboardData }) {
  return (
    <PremiumFeature
      title="Leitura Neural VIP"
      description="Leitura de número pagante liberada no acesso Premium."
      className="h-full min-w-0"
    >
      <LeituraNeuralMiniCard
        {...(data.neuralReading ?? SCANNING_READING)}
        neuralScoreboard={data.neuralScoreboard}
        neuralEntryState={data.neuralEntryState}
        neuralEntryLastResult={data.neuralEntryLastResult}
        rounds={data.rounds}
        greenFlash={false}
        className="h-full min-h-[220px] w-full sm:w-full lg:w-full"
      />
    </PremiumFeature>
  );
}
