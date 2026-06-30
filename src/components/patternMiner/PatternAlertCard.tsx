import { BrainCircuit, Flame } from "lucide-react";
import type { PatternMinerAlert } from "@/types/patternMiner";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { GlassCard } from "@/components/ui-app/GlassCard";
import {
  formatPercent,
  formatPulledSide,
  statusLabel,
  statusTone,
} from "@/patternMiner/PatternMinerDisplay";
import { PatternSequence, StrategyConclusion } from "@/components/patternMiner/PatternSequence";

export function PatternAlertCard({ alert }: { alert: PatternMinerAlert }) {
  const strategy = alert.strategy;
  const Icon = alert.kind === "validated" ? BrainCircuit : Flame;

  return (
    <GlassCard className="rounded-xl p-4 border-neon-cyan/35">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="size-10 rounded-xl btn-primary-grad flex items-center justify-center glow-blue">
            <Icon className="size-5" />
          </div>
          <div>
            <div className="text-sm font-black">
              {alert.kind === "validated"
                ? "🧠 ENTRADA CONFIRMADA"
                : alert.progress >= 1
                  ? "🔥 PADRÃO IA FORMADO"
                  : "🔥 PADRÃO EM FORMAÇÃO"}
            </div>
            <div className="text-[11px] text-muted-foreground">
              Progresso {(alert.progress * 100).toFixed(0)}% · Validade SG + G1
            </div>
          </div>
        </div>
        <AppBadge tone={statusTone(strategy.status)}>{statusLabel(strategy.status)}</AppBadge>
      </div>

      <div className="mt-3 space-y-2">
        <StrategyConclusion strategy={strategy} />
        {alert.kind === "forming" && alert.missingTokens.length > 0 && (
          <div className="text-xs text-muted-foreground">
            Falta completar: <PatternSequence sequence={alert.missingTokens} compact />
          </div>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
        <Metric label="Ocorrências" value={strategy.occurrences} />
        <Metric label="SG" value={strategy.sg} tone="text-success" />
        <Metric label="G1" value={strategy.g1} tone="text-neon-cyan" />
        <Metric label="RED" value={strategy.red} tone="text-destructive" />
        <Metric label="🟡 TIE" value={strategy.tie} tone="text-warning" />
        <Metric
          label="Assertividade"
          value={formatPercent(strategy.assertiveness)}
          tone="text-neon-cyan"
        />
      </div>

      <div className="mt-3 rounded-lg bg-secondary/35 px-3 py-2 text-xs">
        <span className="text-muted-foreground">Leitura: </span>
        {strategy.expectedResult ? (
          <span className="font-black">{formatPulledSide(strategy.expectedResult)}</span>
        ) : (
          <span className="text-warning">Amostra insuficiente</span>
        )}
      </div>
    </GlassCard>
  );
}

function Metric({ label, value, tone }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className="rounded-lg bg-secondary/40 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-sm font-black ${tone ?? ""}`}>{value}</div>
    </div>
  );
}
