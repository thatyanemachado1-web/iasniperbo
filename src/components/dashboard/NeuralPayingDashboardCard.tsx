import { LeituraNeuralResponsiveCard } from "@/components/dashboard/LeituraNeuralResponsiveCard";
import { DASHBOARD_MODULE_CARD_ROOT } from "@/components/dashboard/dashboardModuleCardLayout";
import { PremiumFeature } from "@/components/ui-app/PremiumFeature";
import type { DashboardData, NeuralReading } from "@/types/dashboard";
import { useEffect, useRef, useState } from "react";

const SCANNING_READING: NeuralReading = { mode: "SCANNING" };

export function NeuralPayingDashboardCard({
  data,
  mode,
}: {
  data: DashboardData;
  mode: "live" | "mock" | "connecting" | "fallback";
}) {
  const [greenFlash, setGreenFlash] = useState(false);
  const previousResultKeyRef = useRef("");

  useEffect(() => {
    if (mode !== "live" || data.mockMode) return;
    const result = data.neuralEntryLastResult;
    const key = result?.id ? `${result.id}:${result.outcome}:${result.finishedAt ?? ""}` : "";
    if (!key || key === previousResultKeyRef.current) return;
    previousResultKeyRef.current = key;
    if (result?.outcome !== "GREEN" && result?.outcome !== "TIE") return;
    setGreenFlash(false);
    window.requestAnimationFrame(() => {
      setGreenFlash(true);
      window.setTimeout(() => setGreenFlash(false), 900);
    });
  }, [data.mockMode, data.neuralEntryLastResult, mode]);

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
        displayState={data.displayState}
        displaySide={data.displaySide}
        displayRevision={data.revision ?? data.sequenceId}
        persistedResults={data.dailyResultsByModule?.LEITURA_NEURAL_NUMERO_PAGANTE ?? []}
        rounds={data.rounds}
        greenFlash={greenFlash}
        className="h-full w-full"
      />
    </PremiumFeature>
  );
}
