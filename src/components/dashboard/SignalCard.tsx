import { GlassCard } from "@/components/ui-app/GlassCard";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { PremiumLock } from "@/components/ui-app/PremiumLock";
import { SectionTitle } from "@/components/ui-app/SectionTitle";
import { LeituraNeuralMiniCard } from "@/components/dashboard/LeituraNeuralMiniCard";
import type { MainSignal, NeuralReading, SurfEntrySummary, TieAlert } from "@/types/dashboard";
import { CheckCircle2, Clock3, Radio, ShieldCheck, Target, Zap } from "lucide-react";

export function SignalCard({
  signal,
  neuralReading,
  surfSummary,
  tieAlert,
  locked,
  priority = false,
}: {
  signal: MainSignal;
  neuralReading?: NeuralReading;
  surfSummary?: SurfEntrySummary;
  tieAlert?: TieAlert;
  locked?: boolean;
  priority?: boolean;
}) {
  const isBanker = signal.side === "BANKER";
  const isPlayer = signal.side === "PLAYER";
  const tieAlertIsActive = tieAlert?.status === "active";
  const isTieWatch = signal.status === "tie_watch" || (signal.status === "waiting" && tieAlertIsActive);
  const isWaiting = signal.status === "waiting";
  const sideColor = isBanker ? "text-banker" : isPlayer ? "text-player" : isTieWatch ? "text-tie" : "text-muted-foreground";
  const beamColor = isBanker ? "from-banker/40" : isPlayer ? "from-player/40" : isTieWatch ? "from-tie/35" : "from-neon-cyan/15";
  const displaySide = isTieWatch ? "POSSÍVEL EMPATE" : isWaiting ? "AGUARDAR ENTRADA" : signal.side;
  const displaySideClass = isWaiting || isTieWatch ? "text-[1.85rem] leading-none sm:text-3xl" : "text-4xl leading-none sm:text-5xl";
  const sideCaption = isTieWatch ? "Sem entrada principal" : isWaiting ? "Sem entrada principal" : "Lado da entrada";
  const visibleProtection = isTieWatch && tieAlert ? `${tieAlert.validityRounds} casas` : signal.protection;
  const visibleStrength = isTieWatch && tieAlert ? tieAlert.confidence : signal.strength;
  const status = signalStatus(signal, tieAlertIsActive, tieAlert?.validityRounds);
  const lastResult = signal.lastResult ? lastSignalResult(signal.lastResult) : null;
  const StatusIcon = status.Icon;
  const tieRisk = tieAlert ? tieRiskBadge(tieAlert) : null;
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
        title={isWaiting ? "Aguardar entrada" : isTieWatch ? "Possível empate" : "Entrada confirmada"}
        right={<AppBadge tone={status.badgeTone} pulse={status.pulse}><StatusIcon className="size-3" /> {status.badge}</AppBadge>}
      />
      <div className="relative grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:gap-4">
        <div className="min-w-0 pt-0.5">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-neon-cyan/25 bg-background/35 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-neon-cyan">
            <Zap className="size-3" />
            {isWaiting ? "Monitorando mesa" : isTieWatch ? "Aviso paralelo" : "Prioridade operacional"}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className={`${displaySideClass} font-extrabold ${sideColor}`}>
              {displaySide}
            </div>
            {tieRisk && (
              <span className={`rounded-full border px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide ${tieRisk.className}`}>
                Risco de empate: {tieRisk.label}
              </span>
            )}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{sideCaption}</div>
        </div>
        <LeituraNeuralMiniCard {...(neuralReading ?? { mode: "SCANNING" })} />
      </div>
      <div className="relative mt-4 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-lg bg-secondary/40 p-2">
          <div className="text-muted-foreground">Proteção</div>
          <div className="font-semibold text-foreground">{visibleProtection}</div>
        </div>
        <div className="rounded-lg bg-secondary/40 p-2">
          <div className="text-muted-foreground">Força</div>
          <div className="font-semibold text-neon-cyan">{visibleStrength}%</div>
        </div>
        <div className="rounded-lg bg-secondary/40 p-2">
          <div className="text-muted-foreground">Status</div>
          <div className={`font-semibold ${status.valueClass}`}>{status.value}</div>
        </div>
      </div>
      {lastResult && (
        <div className="relative mt-3 rounded-lg border border-success/20 bg-secondary/35 p-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 font-semibold text-muted-foreground">
              <CheckCircle2 className="size-3.5" />
              Última entrada
            </div>
            <div className={`font-extrabold ${lastResult.className}`}>{lastResult.label}</div>
          </div>
          <div className="mt-1 text-muted-foreground">
            {lastResult.side} com proteção {lastResult.protection}
          </div>
        </div>
      )}
      {surfSummary && (
        <div className="relative mt-3 rounded-lg border border-neon-cyan/20 bg-secondary/35 p-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 font-semibold text-neon-cyan">
              <ShieldCheck className="size-3.5" />
              Surf
            </div>
            <div className={`font-semibold ${riskTone}`}>
              Risco contrário: {surfSummary.oppositeRiskLevel} ({surfSummary.oppositeRisk}%)
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

function signalStatus(signal: MainSignal, tieAlertIsActive = false, tieAlertRounds = 4) {
  if (signal.status === "waiting" && tieAlertIsActive) {
    return {
      badge: "Tie ativo",
      badgeTone: "purple" as const,
      pulse: true,
      kicker: `${tieAlertRounds} casas`,
      value: "Possível EMPATE",
      valueClass: "text-tie",
      Icon: Radio,
    };
  }
  if (signal.status === "waiting") {
    return {
      badge: "Aguardando",
      badgeTone: "muted" as const,
      pulse: false,
      kicker: "Standby",
      value: "Aguardar entrada",
      valueClass: "text-muted-foreground",
      Icon: Clock3,
    };
  }
  if (signal.status === "tie_watch") {
    return {
      badge: "Tie ativo",
      badgeTone: "purple" as const,
      pulse: true,
      kicker: "4 casas",
      value: "Possível EMPATE",
      valueClass: "text-tie",
      Icon: Radio,
    };
  }
  if (signal.status === "g1") {
    return {
      badge: "G1 ativo",
      badgeTone: "amber" as const,
      pulse: true,
      kicker: "Proteção",
      value: "Aguardando G1",
      valueClass: "text-warning",
      Icon: Radio,
    };
  }
  if (signal.status === "green" || signal.status === "green_g1") {
    return {
      badge: "Green",
      badgeTone: "green" as const,
      pulse: false,
      kicker: "Resultado",
      value: signal.status === "green_g1" ? "GREEN G1" : "GREEN",
      valueClass: "text-success",
      Icon: CheckCircle2,
    };
  }
  if (signal.status === "red") {
    return {
      badge: "Red",
      badgeTone: "red" as const,
      pulse: false,
      kicker: "Resultado",
      value: "RED",
      valueClass: "text-destructive",
      Icon: Radio,
    };
  }
  return {
    badge: "Sinal ativo",
    badgeTone: "amber" as const,
    pulse: true,
    kicker: "Start",
    value: "Sinal liberado",
    valueClass: "text-warning",
    Icon: Radio,
  };
}

function lastSignalResult(result: NonNullable<MainSignal["lastResult"]>) {
  if (result.status === "red") {
    return {
      label: "RED",
      className: "text-destructive",
      side: result.side,
      protection: result.protection,
    };
  }
  return {
    label: result.status === "green_g1" ? "GREEN G1" : "GREEN",
    className: "text-success",
    side: result.side,
    protection: result.protection,
  };
}

function tieRiskBadge(alert: TieAlert) {
  const level = normalizeRisk(alert.level);
  if (level === "ALTO") {
    return {
      label: "ALTO",
      className: "border-destructive/35 bg-destructive/15 text-destructive",
    };
  }
  if (level === "MEDIO") {
    return {
      label: "MEDIO",
      className: "border-warning/35 bg-warning/15 text-warning",
    };
  }
  return {
    label: "BAIXO",
    className: "border-success/35 bg-success/15 text-success",
  };
}

function normalizeRisk(level: TieAlert["level"]) {
  const value = String(level)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

  if (value.includes("ALTO")) return "ALTO";
  if (value.includes("MED")) return "MEDIO";
  return "BAIXO";
}
