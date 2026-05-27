import { GlassCard } from "@/components/ui-app/GlassCard";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { PremiumLock } from "@/components/ui-app/PremiumLock";
import { SectionTitle } from "@/components/ui-app/SectionTitle";
import type { MainSignal, SurfEntrySummary } from "@/types/dashboard";
import { Radio, ShieldCheck, Target, Zap } from "lucide-react";

export function SignalCard({
  signal,
  surfSummary,
  locked,
  priority = false,
}: {
  signal: MainSignal;
  surfSummary?: SurfEntrySummary;
  locked?: boolean;
  priority?: boolean;
}) {
  const sideColor = signal.side === "BANKER" ? "text-banker" : "text-player";
  const beamColor = signal.side === "BANKER" ? "from-banker/40" : "from-player/40";
  const riskTone = surfSummary?.oppositeRiskLevel === "ALTO"
    ? "text-destructive"
    : surfSummary?.oppositeRiskLevel === "MEDIO"
      ? "text-warning"
      : "text-success";

  return (
    <GlassCard className={priority ? "min-h-[260px] border-neon-cyan/40" : "min-h-[180px]"}>
      <div className={`absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${beamColor} to-transparent opacity-45`} />
      <div className="absolute inset-0 scan-grid opacity-10" />
      <div className="absolute -left-12 -top-16 size-44 rounded-full bg-neon-blue/10 blur-3xl" />
      <SectionTitle
        title="Entrada confirmada"
        right={<AppBadge tone="amber" pulse><Radio className="size-3" /> Sinal ativo</AppBadge>}
      />
      <div className="relative flex items-center justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-neon-cyan/25 bg-background/35 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-neon-cyan">
            <Zap className="size-3" />
            Prioridade operacional
          </div>
          <div className={`text-5xl sm:text-6xl font-extrabold tracking-tight ${sideColor}`}>
            {signal.side}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">Lado da entrada</div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-widest text-neon-cyan/80">Start</div>
          <div className="text-lg font-semibold">Sinal liberado</div>
        </div>
      </div>
      <div className="relative mt-4 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-lg bg-secondary/40 p-2">
          <div className="text-muted-foreground">Protecao</div>
          <div className="font-semibold text-foreground">{signal.protection}</div>
        </div>
        <div className="rounded-lg bg-secondary/40 p-2">
          <div className="text-muted-foreground">Forca</div>
          <div className="font-semibold text-neon-cyan">{signal.strength}%</div>
        </div>
        <div className="rounded-lg bg-secondary/40 p-2">
          <div className="text-muted-foreground">Status</div>
          <div className="font-semibold text-warning">Pendente</div>
        </div>
      </div>
      {surfSummary && (
        <div className="relative mt-3 rounded-lg border border-neon-cyan/20 bg-secondary/35 p-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 font-semibold text-neon-cyan">
              <ShieldCheck className="size-3.5" />
              Surf
            </div>
            <div className={`font-semibold ${riskTone}`}>
              Risco contrario: {surfSummary.oppositeRiskLevel} ({surfSummary.oppositeRisk}%)
            </div>
          </div>
          <div className="mt-1 text-muted-foreground">{surfSummary.status}</div>
        </div>
      )}
      <Target className="absolute -right-4 -bottom-4 size-32 text-neon-blue/5" />
      {locked && (
        <PremiumLock
          title="Entrada Premium"
          description="Entrada principal em tempo real bloqueada"
        />
      )}
    </GlassCard>
  );
}
