import { GlassCard } from "@/components/ui-app/GlassCard";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { PremiumLock } from "@/components/ui-app/PremiumLock";
import { SectionTitle } from "@/components/ui-app/SectionTitle";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { buildDecisionFallbackCopy, buildEngineDecisionCopy } from "@/lib/operationalCopy";
import { dashboardSideChipClass } from "@/lib/sideColors";
import type { DashboardData, EngineDecision } from "@/types/dashboard";
import { Cpu, ChevronRight } from "lucide-react";

const toneByState = {
  AGUARDAR: "muted",
  ATENCAO: "amber",
  ENTRADA: "green",
  BLOQUEADO: "red",
} as const;

export function EngineDecisionCard({
  decision,
  data,
  locked,
}: {
  decision: EngineDecision;
  data?: DashboardData;
  locked?: boolean;
}) {
  const message = data ? buildEngineDecisionCopy(data) : buildDecisionFallbackCopy(decision);
  const stateCopy = engineStateCopy(decision.state);
  const details = engineDetailsCopy(decision, data);

  return (
    <GlassCard className="border-neon-cyan/20">
      <SectionTitle
        title="Decisão da engine"
        subtitle="Resumo técnico sem alterar a entrada principal."
        right={<AppBadge tone={toneByState[decision.state]}>{stateCopy.badge}</AppBadge>}
      />
      <div className="flex items-start gap-3 rounded-2xl border border-white/5 bg-background/25 p-3">
        <div className="size-10 rounded-xl glass-strong flex shrink-0 items-center justify-center">
          <Cpu className="size-5 text-neon-cyan" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">{stateCopy.title}</div>
          <div className="mt-1 text-sm leading-relaxed text-foreground">{message}</div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded-xl border border-white/5 bg-secondary/30 px-2.5 py-2">
              <div className="text-muted-foreground">Confiança</div>
              <div className="font-black text-neon-cyan">{decision.confidence}%</div>
            </div>
            <div className="rounded-xl border border-white/5 bg-secondary/30 px-2.5 py-2">
              <div className="text-muted-foreground">Ação</div>
              <div className={stateCopy.className}>{stateCopy.action}</div>
            </div>
          </div>
        </div>
      </div>
      <Dialog>
        <DialogTrigger asChild>
          <button className="mt-3 inline-flex items-center gap-1 text-xs text-neon-cyan hover:text-neon-blue">
            Ver detalhes <ChevronRight className="size-3" />
          </button>
        </DialogTrigger>
        <DialogContent className="border-neon-cyan/20 bg-background/95 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm uppercase tracking-[0.16em]">Decisão da engine</DialogTitle>
            <DialogDescription>Explicação simples, usando somente dados do painel.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 rounded-xl border border-neon-cyan/15 bg-neon-cyan/5 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            <EngineInfoLine label="Para que serve" value="mostra se pode entrar, esperar ou bloquear." />
            <EngineInfoLine label="Como funciona" value="junta os módulos, confiança e risco antes de liberar sinal." />
            <div className={`rounded-lg border px-2.5 py-2 font-black uppercase tracking-[0.08em] ${details.className}`}>
              {details.entry}
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-muted-foreground">
            {decision.reason || message}
          </div>
        </DialogContent>
      </Dialog>
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

function EngineInfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="font-black uppercase tracking-[0.1em] text-neon-cyan">{label}: </span>
      {value}
    </div>
  );
}

function engineDetailsCopy(decision: EngineDecision, data?: DashboardData) {
  const side = data?.currentSignal?.side;

  if (decision.state === "ENTRADA" && (side === "BANKER" || side === "PLAYER" || side === "TIE")) {
    return {
      entry: `Agora pela engine: ${side}.`,
      className: dashboardSideChipClass(side === "TIE" ? "TIE" : side),
    };
  }

  if (decision.state === "BLOQUEADO") {
    return {
      entry: "Agora pela engine: não entrar. Risco alto.",
      className: "border-destructive/30 bg-destructive/10 text-destructive",
    };
  }

  if (decision.state === "ATENCAO") {
    return {
      entry: "Agora pela engine: observar. Falta confirmação.",
      className: "border-warning/30 bg-warning/10 text-warning",
    };
  }

  return {
    entry: "Agora pela engine: aguardar.",
    className: "border-neon-cyan/20 bg-neon-cyan/10 text-neon-cyan",
  };
}

function engineStateCopy(state: EngineDecision["state"]) {
  if (state === "ENTRADA") {
    return {
      badge: "Entrada",
      title: "Confluência encontrada",
      action: "Ver entrada",
      className: "font-black text-success",
    };
  }
  if (state === "ATENCAO") {
    return {
      badge: "Atenção",
      title: "Mercado em validação",
      action: "Observar",
      className: "font-black text-warning",
    };
  }
  if (state === "BLOQUEADO") {
    return {
      badge: "Bloqueado",
      title: "Risco segurando entrada",
      action: "Não forçar",
      className: "font-black text-destructive",
    };
  }
  return {
    badge: "Aguardar",
    title: "Sem gatilho limpo",
    action: "Aguardar",
    className: "font-black text-muted-foreground",
  };
}
