import { Activity, Clock, Fingerprint } from "lucide-react";
import type { PatternMinerStrategy } from "@/types/patternMiner";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { GlassCard } from "@/components/ui-app/GlassCard";
import { formatPercent, statusLabel, statusTone } from "@/patternMiner/PatternMinerDisplay";
import { StrategyConclusion } from "@/components/patternMiner/PatternSequence";

export function PatternStrategyCard({
  strategy,
  compact = false,
}: {
  strategy: PatternMinerStrategy;
  compact?: boolean;
}) {
  return (
    <GlassCard className={compact ? "p-3 rounded-xl" : "p-4 rounded-xl"}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <AppBadge tone={statusTone(strategy.status)}>{statusLabel(strategy.status)}</AppBadge>
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <Fingerprint className="size-3" /> {strategy.id}
            </span>
          </div>
          <StrategyConclusion strategy={strategy} compact={compact} />
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Assertividade
          </div>
          <div className="text-lg font-black text-neon-cyan">
            {formatPercent(strategy.assertiveness)}
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
        <Metric label="Ocorrências" value={strategy.occurrences} />
        <Metric label="SG" value={strategy.sg} tone="text-success" />
        <Metric label="G1" value={strategy.g1} tone="text-neon-cyan" />
        <Metric label="RED" value={strategy.red} tone="text-destructive" />
        <Metric label="🟡 TIE" value={strategy.tie} tone="text-warning" />
      </div>

      {!compact && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-4 gap-2 text-[11px] text-muted-foreground">
          <Info label="Última ocorrência" value={strategy.lastOccurrence ?? "-"} />
          <Info label="Último acerto" value={strategy.lastHit ?? "-"} />
          <Info label="Último red" value={strategy.lastRed ?? "-"} />
          <Info label="Data de criação" value={strategy.createdAt} />
        </div>
      )}

      {!compact && (
        <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
          <Activity className="size-3.5 text-neon-cyan" />
          <span>Validade: SG + G1</span>
          <Clock className="size-3.5 text-warning" />
          <span>Total validado: {strategy.totalValidated}</span>
        </div>
      )}
    </GlassCard>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg bg-secondary/40 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-sm font-black ${tone ?? ""}`}>{value}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/25 px-2 py-1.5">
      <div className="uppercase tracking-wider text-[9px]">{label}</div>
      <div className="mt-0.5 truncate text-foreground">{value}</div>
    </div>
  );
}
