import { GlassCard } from "@/components/ui-app/GlassCard";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { PremiumLock } from "@/components/ui-app/PremiumLock";
import { SectionTitle } from "@/components/ui-app/SectionTitle";
import type { EngineDecision } from "@/types/dashboard";
import { Cpu, ChevronRight } from "lucide-react";

const toneByState = {
  AGUARDAR: "muted",
  ATENCAO: "amber",
  ENTRADA: "green",
  BLOQUEADO: "red",
} as const;

export function EngineDecisionCard({ decision, locked }: { decision: EngineDecision; locked?: boolean }) {
  return (
    <GlassCard>
      <SectionTitle
        title="Decisão da engine"
        right={<AppBadge tone={toneByState[decision.state]}>{decision.state}</AppBadge>}
      />
      <div className="flex items-start gap-3">
        <div className="size-10 rounded-xl glass-strong flex items-center justify-center">
          <Cpu className="size-5 text-neon-cyan" />
        </div>
        <div className="flex-1">
          <div className="text-sm text-foreground">{decision.reason}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            Confiança da leitura: <span className="text-neon-cyan">{decision.confidence}%</span>
          </div>
        </div>
      </div>
      <button className="mt-3 inline-flex items-center gap-1 text-xs text-neon-cyan hover:text-neon-blue">
        Ver detalhes <ChevronRight className="size-3" />
      </button>
      {locked && (
        <PremiumLock
          title="Decisão Premium"
          description="Decisão completa da engine bloqueada"
          ctaLabel="Ver Planos"
        />
      )}
    </GlassCard>
  );
}