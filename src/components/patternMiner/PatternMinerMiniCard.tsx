import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { GlassCard } from "@/components/ui-app/GlassCard";
import {
  DASHBOARD_MODULE_CARD_BODY,
  DASHBOARD_MODULE_CARD_FILL,
  DASHBOARD_MODULE_CARD_ROOT,
} from "@/components/dashboard/dashboardModuleCardLayout";
import { PatternSequence } from "@/components/patternMiner/PatternSequence";
import { cn } from "@/lib/utils";
import { dashboardSideTextClass } from "@/lib/sideColors";
import {
  formatPulledSide,
  statusLabel,
  statusTone,
} from "@/patternMiner/PatternMinerDisplay";
import {
  patternIaEntryResultClass,
  patternIaEntrySideClass,
  patternIaEntrySideLabel,
} from "@/patternMiner/PatternMinerEntryHistory";
import type { PatternIaEntryHistoryItem, PatternIaLifecycleView, PatternMinerSnapshot, PatternMinerStrategy } from "@/types/patternMiner";

export function PatternMinerMiniCard({
  snapshot,
  lifecycle,
  isUsingRealData,
  className,
}: {
  snapshot: PatternMinerSnapshot;
  lifecycle: PatternIaLifecycleView;
  isUsingRealData: boolean;
  className?: string;
}) {
  const [flashPulse, setFlashPulse] = useState(false);
  const confirmedAlert = lifecycle.active?.alert ?? snapshot.entryAlerts[0];
  const formingAlert = snapshot.formingAlerts[0];
  const activeStrategy =
    lifecycle.active?.strategy ??
    confirmedAlert?.strategy ??
    formingAlert?.strategy ??
    snapshot.hotStrategies[0] ??
    snapshot.ranking[0];
  const view = buildPatternView(snapshot, lifecycle, isUsingRealData, confirmedAlert, formingAlert, activeStrategy);

  useEffect(() => {
    if (lifecycle.resultFlash === "none") return;
    setFlashPulse(true);
    const timer = window.setTimeout(() => setFlashPulse(false), 2200);
    return () => window.clearTimeout(timer);
  }, [lifecycle.resultFlash, lifecycle.active?.signal_id, lifecycle.status]);

  return (
    <GlassCard
      className={cn(
        "digital-risk-card border-white/10 p-2 sm:p-2 transition-colors duration-300",
        DASHBOARD_MODULE_CARD_ROOT,
        view.borderClass,
        flashPulse && lifecycle.resultFlash === "green" && "border-success/80 bg-success/20 shadow-[0_0_24px_rgba(34,197,94,0.45)]",
        flashPulse && lifecycle.resultFlash === "tie" && "border-warning/80 bg-warning/20 shadow-[0_0_24px_rgba(234,179,8,0.45)]",
        flashPulse && lifecycle.resultFlash === "red" && "border-destructive/80 bg-destructive/20 shadow-[0_0_24px_rgba(239,68,68,0.45)]",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 scan-grid opacity-[0.03]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

      <div className="mb-2 flex min-w-0 items-start justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Padrões IA
        </div>
        <div className="flex max-w-[65%] flex-col items-end gap-0.5">
          <AppBadge
            tone={view.badgeTone}
            pulse={view.pulse}
            className="max-w-full truncate px-1.5 py-0 text-[8px] tracking-[0.08em]"
          >
            {view.badge}
          </AppBadge>
          {lifecycle.queueLength > 0 ? (
            <span className="text-[7px] font-bold text-neon-cyan">+{lifecycle.queueLength} na fila</span>
          ) : null}
        </div>
      </div>

      <div className={DASHBOARD_MODULE_CARD_BODY}>
        <div className={cn("rounded-xl border px-3 py-2.5 text-center", view.panelClass)}>
          <div className={cn("text-lg font-black uppercase leading-none", view.actionClass)}>{view.action}</div>
          <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {view.headline}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5 text-center sm:grid-cols-3">
          <PatternStatChip label="Assert." value={view.strengthLabel} tone={view.strengthTone} />
          <PatternStatChip label="Ocorr." value={view.samplesLabel} tone="muted" />
          <PatternStatChip label="Status" value={view.statusChip} tone={view.statusTone} />
        </div>

        {activeStrategy ? (
          <div className="rounded-lg border border-neon-cyan/10 bg-background/20 px-2 py-1.5">
            <div className="text-[8px] font-black uppercase tracking-[0.08em] text-neon-cyan/85">
              {activeStrategy.pattern_signature || "Sequência"} · banco {formatAnalyzedRounds(snapshot.analyzedRounds)}
            </div>
            <div className="mt-1 min-w-0 overflow-hidden">
              <PatternSequence sequence={activeStrategy.sequence} compact />
            </div>
            <div className="mt-1 grid grid-cols-4 gap-1 text-[7px]">
              <MiniMeta label="SG" value={activeStrategy.sg_count ?? activeStrategy.sg} />
              <MiniMeta label="G1" value={activeStrategy.g1_count ?? activeStrategy.g1} />
              <MiniMeta label="RD" value={activeStrategy.red_count ?? activeStrategy.red} />
              <MiniMeta label="TIE" value={activeStrategy.tie_after_count ?? activeStrategy.tie} />
            </div>
            {(lifecycle.active || confirmedAlert) && (
              <div className="mt-1 rounded border border-white/5 bg-background/30 px-1.5 py-1 text-[8px] leading-snug">
                <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                  <span>
                    <span className="text-muted-foreground">SIG:</span>{" "}
                    <span className="font-black">{lifecycle.active?.signal_id || activeStrategy.signal_id || "-"}</span>
                  </span>
                  <span>
                    <span className="text-muted-foreground">EVT:</span>{" "}
                    <span className="font-black">{lifecycle.active?.event_id || activeStrategy.event_id || "-"}</span>
                  </span>
                  <span>
                    <span className="text-muted-foreground">RID:</span>{" "}
                    <span className="font-black">{activeStrategy.round_id ?? "-"}</span>
                  </span>
                </div>
                {view.blockedReason ? (
                  <div className="mt-0.5 font-semibold text-destructive">{view.blockedReason}</div>
                ) : null}
              </div>
            )}
            {formingAlert && !confirmedAlert && lifecycle.status === "AGUARDANDO PADRAO" ? (
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

        <PatternIaEntryHistoryList history={lifecycle.entryHistory} />

        <Link
          to="/app/padroes"
          className="inline-flex items-center gap-1 text-[10px] font-semibold text-neon-cyan hover:text-neon-blue"
        >
          Ver ranking completo <ChevronRight className="size-3" />
        </Link>
        <div className={DASHBOARD_MODULE_CARD_FILL} aria-hidden />
      </div>
    </GlassCard>
  );
}

function buildPatternView(
  snapshot: PatternMinerSnapshot,
  lifecycle: PatternIaLifecycleView,
  isUsingRealData: boolean,
  confirmedAlert: PatternMinerSnapshot["entryAlerts"][number] | undefined,
  formingAlert: PatternMinerSnapshot["formingAlerts"][number] | undefined,
  activeStrategy: PatternMinerStrategy | undefined,
) {
  if (!isUsingRealData) {
    return idleView("Coletando", "Aguardar", "Histórico real ainda não disponível");
  }

  if (lifecycle.resultFlash === "green" && flashLabel(lifecycle.status)) {
    return {
      badge: lifecycle.status,
      badgeTone: "green" as const,
      pulse: true,
      action: lifecycle.status,
      headline: "Resultado confirmado na mesa",
      actionClass: "text-success",
      panelClass: "border-success/50 bg-success/15",
      borderClass: "border-success/40",
      strengthLabel: "--",
      strengthTone: "green" as const,
      samplesLabel: "0",
      statusChip: "WIN",
      statusTone: "green" as const,
      blockedReason: "",
    };
  }

  if (lifecycle.resultFlash === "tie") {
    return {
      badge: "EMPATE",
      badgeTone: "amber" as const,
      pulse: true,
      action: lifecycle.status,
      headline: "Empate após entrada",
      actionClass: "text-warning",
      panelClass: "border-warning/50 bg-warning/15",
      borderClass: "border-warning/40",
      strengthLabel: "--",
      strengthTone: "amber" as const,
      samplesLabel: "0",
      statusChip: "TIE",
      statusTone: "amber" as const,
      blockedReason: "",
    };
  }

  if (lifecycle.resultFlash === "red") {
    return {
      badge: "RED FINAL",
      badgeTone: "red" as const,
      pulse: true,
      action: "RED FINAL",
      headline: "Perdeu SG e G1",
      actionClass: "text-destructive",
      panelClass: "border-destructive/50 bg-destructive/15",
      borderClass: "border-destructive/40",
      strengthLabel: "--",
      strengthTone: "red" as const,
      samplesLabel: "0",
      statusChip: "RED",
      statusTone: "red" as const,
      blockedReason: "",
    };
  }

  const strategy = lifecycle.active?.strategy ?? confirmedAlert?.strategy ?? formingAlert?.strategy ?? activeStrategy;
  const assertiveness = strategy?.accuracy ?? strategy?.assertiveness;
  const strengthLabel = assertiveness !== undefined ? `${Math.round(assertiveness)}%` : "--";
  const samplesLabel = strategy?.occurrences ? String(strategy.occurrences) : "0";
  const statusChip = strategy ? compactStatus(lifecycle.status || strategy.status) : "OFF";

  if (lifecycle.status === "FAZER GALE 1" && lifecycle.active) {
    const side = lifecycle.active.entry_side;
    return {
      badge: "Fazer Gale 1",
      badgeTone: "amber" as const,
      pulse: true,
      action: `G1 ${sideLabel(side)}`,
      headline: `Perdeu SG · aguardando G1 em ${formatPulledSide(side)}`,
      actionClass: "text-warning",
      panelClass: "border-warning/35 bg-warning/10",
      borderClass: "border-warning/30",
      strengthLabel,
      strengthTone: "amber" as const,
      samplesLabel,
      statusChip,
      statusTone: "amber" as const,
      blockedReason: "",
    };
  }

  if (lifecycle.active && lifecycle.status === "ENTRADA CONFIRMADA") {
    const side = lifecycle.active.entry_side;
    return {
      badge: "Entrada Confirmada",
      badgeTone: "green" as const,
      pulse: true,
      action: `Entrar ${sideLabel(side)}`,
      headline: `${formatPulledSide(side)} · assertividade ${strengthLabel}`,
      actionClass: dashboardSideTextClass(side === "B" ? "BANKER" : side === "P" ? "PLAYER" : "TIE"),
      panelClass: "border-success/35 bg-success/10",
      borderClass: "border-success/30",
      strengthLabel,
      strengthTone: "green" as const,
      samplesLabel,
      statusChip,
      statusTone: "green" as const,
      blockedReason: "",
    };
  }

  if (confirmedAlert?.strategy && !String(confirmedAlert.strategy.status).startsWith("BLOQUEADO")) {
    const side = confirmedAlert.strategy.next_side ?? confirmedAlert.strategy.expectedResult;
    if (side && confirmedAlert.strategy.status === "ENTRADA CONFIRMADA") {
      return {
        badge: "Confirmado",
        badgeTone: "green" as const,
        pulse: true,
        action: `Entrar ${sideLabel(side)}`,
        headline: `${formatPulledSide(side)} · assertividade ${strengthLabel}`,
        actionClass: dashboardSideTextClass(side === "B" ? "BANKER" : side === "P" ? "PLAYER" : "TIE"),
        panelClass: "border-success/35 bg-success/10",
        borderClass: "border-success/30",
        strengthLabel,
        strengthTone: "green" as const,
        samplesLabel,
        statusChip,
        statusTone: "green" as const,
        blockedReason: "",
      };
    }
  }

  if (formingAlert?.strategy || snapshot.runtimeStatus === "PADRAO EM FORMACAO") {
    const side = formingAlert?.strategy?.expectedResult ?? formingAlert?.strategy?.next_side;
    const progress = Math.round((formingAlert?.progress ?? 0) * 100);
    return {
      badge: "Formando",
      badgeTone: "amber" as const,
      pulse: true,
      action: side ? `Monitorar ${sideLabel(side)}` : "Monitorar",
      headline: `Padrão ${progress || 0}% formado · aguardar confirmação`,
      actionClass: "text-warning",
      panelClass: "border-warning/30 bg-warning/10",
      borderClass: "border-warning/25",
      strengthLabel,
      strengthTone: "amber" as const,
      samplesLabel,
      statusChip,
      statusTone: "amber" as const,
      blockedReason: "",
    };
  }

  const blockedStatus = snapshot.runtimeStatus || strategy?.status;
  if (blockedStatus && String(blockedStatus).startsWith("BLOQUEADO")) {
    return {
      badge: statusLabel(blockedStatus),
      badgeTone: "red" as const,
      pulse: false,
      action: "Bloqueado",
      headline: snapshot.runtimeBlockedReason || strategy?.blocked_reason || statusLabel(blockedStatus),
      actionClass: "text-destructive",
      panelClass: "border-destructive/30 bg-destructive/10",
      borderClass: "border-destructive/25",
      strengthLabel,
      strengthTone: "red" as const,
      samplesLabel,
      statusChip,
      statusTone: "red" as const,
      blockedReason: snapshot.runtimeBlockedReason || strategy?.blocked_reason || "",
    };
  }

  if (activeStrategy && !activeStrategy.insufficientSample && activeStrategy.expectedResult) {
    const side = activeStrategy.expectedResult;
    return {
      badge: "Padrão Quente",
      badgeTone: "blue" as const,
      pulse: false,
      action: "Aguardar 100%",
      headline: `${formatPulledSide(side)} · aguardando confirmação`,
      actionClass: "text-muted-foreground",
      panelClass: "border-border/60 bg-secondary/20",
      borderClass: "border-neon-cyan/20",
      strengthLabel,
      strengthTone: "cyan" as const,
      samplesLabel,
      statusChip,
      statusTone: "cyan" as const,
      blockedReason: "",
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
    blockedReason: "",
  };
}

function idleView(badge: string, action: string, headline: string) {
  return {
    badge,
    badgeTone: "muted" as const,
    pulse: false,
    action,
    headline,
    actionClass: "text-muted-foreground",
    panelClass: "border-border/60 bg-secondary/20",
    borderClass: "border-border/50",
    strengthLabel: "--",
    strengthTone: "muted" as const,
    samplesLabel: "0",
    statusChip: "OFF",
    statusTone: "muted" as const,
    blockedReason: "",
  };
}

function flashLabel(status: string) {
  return status === "GREEN SG" || status === "GREEN G1";
}

function PatternStatChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "green" | "amber" | "cyan" | "muted" | "red";
}) {
  const toneClass = {
    green: "border-success/30 bg-success/8 text-success",
    amber: "border-warning/30 bg-warning/8 text-warning",
    cyan: "border-neon-cyan/30 bg-neon-cyan/8 text-neon-cyan",
    red: "border-destructive/30 bg-destructive/8 text-destructive",
    muted: "border-border/60 bg-secondary/25 text-foreground",
  }[tone];

  return (
    <div className={cn("rounded-lg border px-1 py-1.5", toneClass)}>
      <div className="text-[8px] font-black uppercase tracking-[0.08em] opacity-75">{label}</div>
      <div className="mt-0.5 truncate text-[11px] font-black leading-none">{value}</div>
    </div>
  );
}

function MiniMeta({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border border-neon-cyan/10 bg-background/30 px-1 py-0.5 text-center">
      <span className="text-[6px] font-bold uppercase text-muted-foreground">{label} </span>
      <span className="text-[8px] font-black">{value}</span>
    </div>
  );
}

function sideLabel(side: "B" | "P" | "T") {
  if (side === "B") return "BANKER";
  if (side === "P") return "PLAYER";
  return "TIE";
}

function compactStatus(status: string) {
  const label = statusLabel(status as never);
  if (label.length <= 10) return label.toUpperCase();
  if (status === "ENTRADA CONFIRMADA") return "CONFIRM.";
  if (status === "PADRAO EM FORMACAO") return "FORM.";
  if (status === "BLOQUEADO POR MAIS DE 2 REDS") return ">2 REDS";
  return label.slice(0, 10).toUpperCase();
}

function formatAnalyzedRounds(value: number) {
  if (!value) return "0r";
  if (value >= 1000) return `${Math.round(value / 100) / 10}k`;
  return `${value}r`;
}

const VISIBLE_PATTERN_IA_ENTRY_HISTORY = 8;

function PatternIaEntryHistoryList({ history }: { history: PatternIaEntryHistoryItem[] }) {
  const visible = history.slice(0, VISIBLE_PATTERN_IA_ENTRY_HISTORY);

  return (
    <div className="rounded-lg border border-white/8 bg-background/12 px-2 py-1.5">
      <div className="mb-1 text-[8px] font-black uppercase tracking-[0.14em] text-muted-foreground">
        Ultimas entradas
      </div>
      {visible.length ? (
        <div className="max-h-24 space-y-0.5 overflow-y-auto pr-0.5">
          {visible.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-1 rounded-md border border-white/5 bg-secondary/10 px-1.5 py-0.5 text-[7.5px] font-semibold leading-tight"
            >
              <span className="min-w-0 truncate">
                <span className={patternIaEntrySideClass(item.entry_side)}>
                  {patternIaEntrySideLabel(
                    item.entry_side,
                    item.entry_side === "T" ? item.tie_multiplier : undefined,
                  )}
                </span>{" "}
                <span className={patternIaEntryResultClass(item.result_label)}>{item.result_label}</span>
              </span>
              <span className="shrink-0 text-[7px] text-muted-foreground/75">Min {item.minute}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-[7.5px] font-semibold text-muted-foreground/70">Sem entradas recentes.</div>
      )}
    </div>
  );
}
