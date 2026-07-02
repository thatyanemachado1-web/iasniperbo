import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { GlassCard } from "@/components/ui-app/GlassCard";
import { PatternSequence } from "@/components/patternMiner/PatternSequence";
import { cn } from "@/lib/utils";
import { formatPulledSide, statusLabel } from "@/patternMiner/PatternMinerDisplay";
import type { PatternMinerSnapshot, PatternMinerStrategy } from "@/types/patternMiner";

export function PatternMinerMiniCard({
  snapshot,
  isUsingRealData,
}: {
  snapshot: PatternMinerSnapshot;
  isUsingRealData: boolean;
}) {
  const confirmedAlert = snapshot.entryAlerts[0];
  const formingAlert = snapshot.formingAlerts[0];
  const activeStrategy =
    confirmedAlert?.strategy ?? formingAlert?.strategy ?? snapshot.hotStrategies[0] ?? snapshot.ranking[0];
  const view = buildPatternView(snapshot, isUsingRealData, confirmedAlert, formingAlert, activeStrategy);

  return (
    <GlassCard
      className={cn(
        "digital-risk-card h-full min-h-[220px] border-neon-cyan/18 p-2 sm:p-2",
        view.borderClass,
      )}
    >
      <div className="pointer-events-none absolute inset-0 scan-grid opacity-[0.03]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-neon-cyan/22 to-transparent" />

      <div className="mb-2 flex min-w-0 items-start justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neon-cyan/80">
          Padrões IA
        </div>
        <AppBadge
          tone={view.badgeTone}
          pulse={view.pulse}
          className="max-w-full truncate px-1.5 py-0 text-[8px] tracking-[0.08em]"
        >
          {view.badge}
        </AppBadge>
      </div>

      <div className="space-y-2">
        <div className={cn("rounded-xl border px-3 py-2.5 text-center", view.panelClass)}>
          <div className={cn("text-lg font-black uppercase leading-none", view.actionClass)}>{view.action}</div>
          <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {view.headline}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5 text-center sm:grid-cols-3">
          <PatternStatChip label="Força" value={view.strengthLabel} tone={view.strengthTone} />
          <PatternStatChip label="Amostras" value={view.samplesLabel} tone="muted" />
          <PatternStatChip label="Status" value={view.statusChip} tone={view.statusTone} />
        </div>

        {activeStrategy ? (
          <div className="rounded-lg border border-neon-cyan/10 bg-background/20 px-2 py-1.5">
            <div className="text-[8px] font-black uppercase tracking-[0.08em] text-neon-cyan/85">
              Sequência · banco {formatAnalyzedRounds(snapshot.analyzedRounds)}
            </div>
            <div className="mt-1 min-w-0 overflow-hidden">
              <PatternSequence sequence={activeStrategy.sequence} compact />
            </div>
            {formingAlert && !confirmedAlert ? (
              <div className="mt-1 text-[9px] font-semibold text-warning">
                Formação {Math.round(formingAlert.progress * 100)}%
                {formingAlert.missingTokens.length
                  ? ` · falta ${formingAlert.missingTokens.join(" → ")}`
                  : ""}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="rounded-lg border border-border/50 bg-secondary/20 px-2 py-1.5 text-[9px] text-muted-foreground">
            Coletando histórico para mineração de padrões.
          </div>
        )}

        <Link
          to="/app/padroes"
          className="inline-flex items-center gap-1 text-[10px] font-semibold text-neon-cyan hover:text-neon-blue"
        >
          Ver ranking completo <ChevronRight className="size-3" />
        </Link>
      </div>
    </GlassCard>
  );
}

function buildPatternView(
  snapshot: PatternMinerSnapshot,
  isUsingRealData: boolean,
  confirmedAlert: PatternMinerSnapshot["entryAlerts"][number] | undefined,
  formingAlert: PatternMinerSnapshot["formingAlerts"][number] | undefined,
  activeStrategy: PatternMinerStrategy | undefined,
) {
  if (!isUsingRealData) {
    return {
      badge: "Coletando",
      badgeTone: "muted" as const,
      pulse: false,
      action: "Aguardar",
      headline: "Histórico real ainda não disponível",
      actionClass: "text-muted-foreground",
      panelClass: "border-border/60 bg-secondary/20",
      borderClass: "border-border/50",
      strengthLabel: "--",
      strengthTone: "muted" as const,
      samplesLabel: "0",
      statusChip: "OFF",
      statusTone: "muted" as const,
    };
  }

  const strategy = confirmedAlert?.strategy ?? formingAlert?.strategy ?? activeStrategy;
  const assertiveness = strategy?.assertiveness;
  const strengthLabel = assertiveness !== undefined ? `${Math.round(assertiveness)}%` : "--";
  const samplesLabel = strategy?.totalValidated ? String(strategy.totalValidated) : "0";
  const statusChip = strategy ? compactStatus(strategy) : "OFF";

  if (confirmedAlert?.strategy?.expectedResult) {
    const side = confirmedAlert.strategy.expectedResult;
    return {
      badge: "Confirmado",
      badgeTone: "green" as const,
      pulse: true,
      action: `Entrar ${sideLabel(side)}`,
      headline: `${formatPulledSide(side)} · assertividade ${strengthLabel}`,
      actionClass: side === "B" ? "text-banker" : side === "P" ? "text-player" : "text-warning",
      panelClass: "border-success/35 bg-success/10",
      borderClass: "border-success/30",
      strengthLabel,
      strengthTone: "green" as const,
      samplesLabel,
      statusChip,
      statusTone: "green" as const,
    };
  }

  if (formingAlert?.strategy) {
    const side = formingAlert.strategy.expectedResult;
    const progress = Math.round(formingAlert.progress * 100);
    return {
      badge: "Formando",
      badgeTone: "amber" as const,
      pulse: true,
      action: side ? `Monitorar ${sideLabel(side)}` : "Monitorar",
      headline: `Padrão ${progress}% formado · aguardar confirmação`,
      actionClass: "text-warning",
      panelClass: "border-warning/30 bg-warning/10",
      borderClass: "border-warning/25",
      strengthLabel,
      strengthTone: "amber" as const,
      samplesLabel,
      statusChip,
      statusTone: "amber" as const,
    };
  }

  if (activeStrategy && !activeStrategy.insufficientSample && activeStrategy.expectedResult) {
    const side = activeStrategy.expectedResult;
    return {
      badge: "Observando",
      badgeTone: "blue" as const,
      pulse: false,
      action: "Aguardar",
      headline: `Hot ${formatPulledSide(side)} · sem sequência ativa agora`,
      actionClass: "text-muted-foreground",
      panelClass: "border-border/60 bg-secondary/20",
      borderClass: "border-neon-cyan/20",
      strengthLabel,
      strengthTone: "cyan" as const,
      samplesLabel,
      statusChip,
      statusTone: "cyan" as const,
    };
  }

  return {
    badge: "Observando",
    badgeTone: "muted" as const,
    pulse: false,
    action: "Aguardar",
    headline:
      snapshot.analyzedRounds > 0
        ? `${snapshot.agent.catalogedStrategies} padrões catalogados · sem entrada agora`
        : "Sem padrão validado no momento",
    actionClass: "text-muted-foreground",
    panelClass: "border-border/60 bg-secondary/20",
    borderClass: "border-border/50",
    strengthLabel: snapshot.scoreboard.assertiveness
      ? `${Math.round(snapshot.scoreboard.assertiveness)}%`
      : "--",
    strengthTone: "muted" as const,
    samplesLabel: snapshot.scoreboard.totalValidated ? String(snapshot.scoreboard.totalValidated) : "0",
    statusChip: "OFF",
    statusTone: "muted" as const,
  };
}

function PatternStatChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "green" | "amber" | "cyan" | "muted";
}) {
  const toneClass = {
    green: "border-success/30 bg-success/8 text-success",
    amber: "border-warning/30 bg-warning/8 text-warning",
    cyan: "border-neon-cyan/30 bg-neon-cyan/8 text-neon-cyan",
    muted: "border-border/60 bg-secondary/25 text-foreground",
  }[tone];

  return (
    <div className={cn("rounded-lg border px-1 py-1.5", toneClass)}>
      <div className="text-[8px] font-black uppercase tracking-[0.08em] opacity-75">{label}</div>
      <div className="mt-0.5 truncate text-[11px] font-black leading-none">{value}</div>
    </div>
  );
}

function sideLabel(side: "B" | "P" | "T") {
  if (side === "B") return "BANKER";
  if (side === "P") return "PLAYER";
  return "TIE";
}

function compactStatus(strategy: PatternMinerStrategy) {
  const label = statusLabel(strategy.status);
  if (label.length <= 8) return label.toUpperCase();
  if (strategy.status === "VERY_HOT") return "M.QUENTE";
  if (strategy.status === "OBSERVATION") return "OBS";
  return label.slice(0, 8).toUpperCase();
}

function formatAnalyzedRounds(value: number) {
  if (!value) return "0r";
  if (value >= 1000) return `${Math.round(value / 100) / 10}k`;
  return `${value}r`;
}
