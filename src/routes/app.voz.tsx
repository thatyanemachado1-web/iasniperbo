import { createFileRoute } from "@tanstack/react-router";
import { BrainAssistantCard } from "@/components/dashboard/BrainAssistantCard";
import { useAdaptiveStrategyLearning } from "@/adaptiveStrategy/useAdaptiveStrategyLearning";
import { GlassCard } from "@/components/ui-app/GlassCard";
import { PremiumLock } from "@/components/ui-app/PremiumLock";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { SectionTitle } from "@/components/ui-app/SectionTitle";
import { useDashboardData } from "@/hooks/useDashboardData";
import { hasFullAccess, readUserSession } from "@/lib/userSession";
import { Radio, ShieldCheck, TimerReset, Volume2 } from "lucide-react";

export const Route = createFileRoute("/app/voz")({
  component: VozPage,
  head: () => ({
    meta: [
      { title: "Assistente de Voz IA — SNIPER BO IA" },
      { name: "description", content: "Narração automática IA do SNIPER BO IA com leitura ao vivo da mesa BAC BO: entradas, Tie, Green, Red e contexto operacional." },
      { property: "og:title", content: "Assistente de Voz IA — SNIPER BO IA" },
      { property: "og:description", content: "Narração IA da mesa BAC BO em tempo real." },
      { property: "og:url", content: "https://sniperbo.com/app/voz" },
      { name: "robots", content: "noindex,nofollow" },
    ],
    links: [{ rel: "canonical", href: "https://sniperbo.com/app/voz" }],
  }),
});

function VozPage() {
  const { data, mode } = useDashboardData();
  const { snapshot: adaptiveSnapshot } = useAdaptiveStrategyLearning(
    data,
    mode === "live" && !data.mockMode,
  );
  const fullAccess = hasFullAccess(readUserSession());
  const liveReady = mode === "live" && data.mockMode === false;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-4">
      <h1 className="sr-only">Assistente de Voz IA SNIPER BO</h1>
      <div className="relative overflow-hidden rounded-2xl">
        <BrainAssistantCard
          data={data}
          mode={mode}
          adaptiveSnapshot={adaptiveSnapshot}
          locked={!fullAccess}
        />
        {!fullAccess && (
          <PremiumLock
            title="Narrador IA Premium"
            description="Assistente de Voz IA disponível no plano Premium"
            intensity="light"
          />
        )}
      </div>

      <GlassCard>
        <SectionTitle
          title="Assistente de Voz IA"
          subtitle="Narração automática baseada nos dados ao vivo da mesa."
          right={
            <AppBadge tone={liveReady ? "green" : "amber"}>
              {liveReady ? "Ao vivo" : "Standby"}
            </AppBadge>
          }
        />
        <div className="space-y-3">
          <StatusRow
            icon={<Volume2 className="size-4" />}
            label="Prioridade máxima"
            value="Entrada, Tie, Green e Red"
          />
          <StatusRow
            icon={<TimerReset className="size-4" />}
            label="Cooldown comum"
            value="30 segundos"
          />
          <StatusRow
            icon={<ShieldCheck className="size-4" />}
            label="Fonte"
            value="Módulos internos + Ollama local"
          />
          <StatusRow
            icon={<Radio className="size-4" />}
            label="Fila"
            value="Análises comuns aguardam a vez"
          />
        </div>
      </GlassCard>
    </div>
  );
}

function StatusRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-secondary/25 px-3 py-2">
      <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
        <span className="text-neon-cyan">{icon}</span>
        <span>{label}</span>
      </div>
      <div className="text-right text-xs font-semibold text-foreground">{value}</div>
    </div>
  );
}
