import { LeituraNeuralResponsiveCard } from "@/components/dashboard/LeituraNeuralResponsiveCard";
import { DASHBOARD_MODULE_CARD_ROOT } from "@/components/dashboard/dashboardModuleCardLayout";
import { PremiumFeature } from "@/components/ui-app/PremiumFeature";
import { useDashboardData } from "@/hooks/useDashboardData";
import type { DashboardData, NeuralReading } from "@/types/dashboard";
import { useEffect, useRef, useState } from "react";

const SCANNING_READING: NeuralReading = { mode: "SCANNING" };

export function NeuralPayingDashboardCard({ data }: { data: DashboardData }) {
  const { mode } = useDashboardData();
  const [greenFlash, setGreenFlash] = useState(false);
  const [tieFlash, setTieFlash] = useState(false);
  const [redFlash, setRedFlash] = useState(false);
  const previousResultKeyRef = useRef("");

  useEffect(() => {
    if (mode !== "live" || data.mockMode) return;
    const result = data.neuralEntryLastResult;
    const key = result?.id ? `${result.id}:${result.outcome}:${result.finishedAt ?? ""}` : "";
    if (!key || key === previousResultKeyRef.current) return;
    previousResultKeyRef.current = key;

    setGreenFlash(false);
    setTieFlash(false);
    setRedFlash(false);

    if (result?.outcome === "GREEN") {
      window.requestAnimationFrame(() => {
        setGreenFlash(true);
        window.setTimeout(() => setGreenFlash(false), 2100);
      });
      return;
    }

    if (result?.outcome === "TIE") {
      window.requestAnimationFrame(() => {
        setTieFlash(true);
        window.setTimeout(() => setTieFlash(false), 2100);
      });
      return;
    }

    if (result?.outcome === "RED") {
      window.requestAnimationFrame(() => {
        setRedFlash(true);
        window.setTimeout(() => setRedFlash(false), 1500);
      });
    }
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
        rounds={data.rounds}
        greenFlash={greenFlash}
        tieFlash={tieFlash}
        redFlash={redFlash}
        className="h-full w-full"
      />
    </PremiumFeature>
  );
}
