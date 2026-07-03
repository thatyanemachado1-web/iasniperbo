import { GlassCard } from "@/components/ui-app/GlassCard";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { PremiumLock } from "@/components/ui-app/PremiumLock";
import { SectionTitle } from "@/components/ui-app/SectionTitle";
import { LeituraNeuralMiniCard } from "@/components/dashboard/LeituraNeuralMiniCard";
import { cn } from "@/lib/utils";
import type {
  MainSignal,
  NeuralReading,
  NeuralScoreboard,
  Round,
  SignalSide,
  SurfEntrySummary,
  TieAlert,
} from "@/types/dashboard";
import { CheckCircle2, Clock3, Radio, ShieldCheck, Target } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function SignalCard({
  signal,
  neuralReading,
  neuralScoreboard,
  rounds,
  mainSequencePositive = 0,
  mainSequenceNegative = 0,
  surfSummary,
  tieAlert,
  operationalMessage,
  locked,
  priority = false,
  enableResultFlash = false,
  showNeuralReading = true,
}: {
  signal: MainSignal;
  neuralReading?: NeuralReading;
  neuralScoreboard?: NeuralScoreboard;
  rounds?: Round[];
  mainSequencePositive?: number;
  mainSequenceNegative?: number;
  surfSummary?: SurfEntrySummary;
  tieAlert?: TieAlert;
  operationalMessage?: string;
  locked?: boolean;
  priority?: boolean;
  enableResultFlash?: boolean;
  showNeuralReading?: boolean;
}) {
  const [mainGreenFlash, setMainGreenFlash] = useState(false);
  const mainResultSeen = useRef(false);
  const previousMainResultKey = useRef<string | null>(null);
  const isBanker = signal.side === "BANKER";
  const isPlayer = signal.side === "PLAYER";
  const tieAlertIsActive = tieAlert?.status === "active";
  const isResultStatus =
    signal.status === "green" ||
    signal.status === "green_g1" ||
    signal.status === "red" ||
    signal.status === "tie";
  const isTieWatch =
    !isResultStatus &&
    (signal.status === "tie_watch" || (signal.status === "waiting" && tieAlertIsActive));
  const isWaiting = signal.status === "waiting" || isResultStatus;
  const sideColor = isBanker
    ? "text-banker"
    : isPlayer
      ? "text-player"
      : isTieWatch
        ? "text-tie"
        : "text-muted-foreground";
  const beamColor = isBanker
    ? "from-banker/40"
    : isPlayer
      ? "from-player/40"
      : isTieWatch
        ? "from-tie/35"
        : "from-neon-cyan/15";
  const displaySide = isResultStatus
    ? "AGUARDAR ANÁLISE"
    : isTieWatch
      ? "POSSÍVEL EMPATE"
      : isWaiting
        ? "AGUARDAR ENTRADA"
        : signal.side;
  const displaySideClass =
    isWaiting || isTieWatch
      ? "text-[1.85rem] leading-none sm:text-3xl"
      : "text-4xl leading-none sm:text-5xl";
  const sideCaption = isResultStatus
    ? "Última entrada finalizada"
    : isTieWatch || isWaiting
      ? "Sem entrada principal"
      : "Lado da entrada";
  const visibleProtection =
    isTieWatch && tieAlert ? `${tieAlert.validityRounds} casas` : signal.protection;
  const visibleStrength = isTieWatch && tieAlert ? tieAlert.confidence : signal.strength;
  const status = signalStatus(signal, tieAlertIsActive, tieAlert?.validityRounds);
  const lastResult = signal.lastResult ? lastSignalResult(signal.lastResult) : null;
  const lastResultKey = signal.lastResult ? signalResultKey(signal.lastResult) : null;
  const shouldShowLastResult = Boolean(lastResult);
  const mainSequence = buildMotorSequence(
    mainSequencePositive,
    mainSequenceNegative,
    "Motor principal",
  );
  const StatusIcon = status.Icon;
  const tieRisk = !isResultStatus && tieAlert ? tieRiskBadge(tieAlert) : null;
  const focus = buildOperationalFocus(signal, neuralReading, tieAlert, surfSummary);
  const riskTone =
    surfSummary?.oppositeRiskLevel === "ALTO"
      ? "text-destructive"
      : surfSummary?.oppositeRiskLevel === "MEDIO"
        ? "text-warning"
        : "text-success";

  useEffect(() => {
    if (!enableResultFlash) {
      mainResultSeen.current = false;
      previousMainResultKey.current = lastResultKey;
      return;
    }

    if (!mainResultSeen.current) {
      mainResultSeen.current = true;
      previousMainResultKey.current = lastResultKey;
      return;
    }

    if (
      lastResultKey &&
      lastResultKey !== previousMainResultKey.current &&
      signal.lastResult &&
      isGreenSignalResult(signal.lastResult)
    ) {
      pulseGreen(setMainGreenFlash);
    }

    previousMainResultKey.current = lastResultKey;
  }, [enableResultFlash, lastResultKey, signal.lastResult]);

  return (
    <GlassCard
      className={cn(
        priority ? "min-h-[260px] border-neon-cyan/30" : "min-h-[180px]",
        mainGreenFlash && "result-green-flash",
      )}
    >
      <div
        className={`absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${beamColor} to-transparent opacity-28`}
      />
      <div className="absolute inset-0 scan-grid opacity-[0.045]" />
      <div className="absolute -left-12 -top-16 size-44 rounded-full bg-neon-blue/5 blur-3xl" />
      <SectionTitle
        title={
          isResultStatus
            ? "Aguardar análise"
            : isWaiting
              ? "Aguardar entrada"
              : isTieWatch
                ? "Possível empate"
                : "Entrada confirmada"
        }
        right={
          <AppBadge tone={status.badgeTone} pulse={status.pulse}>
            <StatusIcon className="size-3" /> {status.badge}
          </AppBadge>
        }
      />
      <div className="relative grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-4">
        <div className="min-w-0 pt-0.5">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-neon-cyan/25 bg-background/35 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-neon-cyan">
            {isWaiting
              ? "Monitorando mesa"
              : isTieWatch
                ? "Aviso paralelo"
                : "Prioridade operacional"}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className={`${displaySideClass} font-extrabold ${sideColor}`}>{displaySide}</div>
            {tieRisk && (
              <span
                className={`rounded-full border px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide ${tieRisk.className}`}
              >
                Risco de empate: {tieRisk.label}
              </span>
            )}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{sideCaption}</div>
          <div
            className={cn(
              "mt-2 inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.1em]",
              mainSequence.className,
            )}
            title={mainSequence.title}
          >
            <span className="truncate">{mainSequence.label}</span>
          </div>
          <OperationalFocus focus={focus} fallback={operationalMessage} />
        </div>
        {showNeuralReading && (
          <div className="justify-self-stretch lg:justify-self-end">
            <LeituraNeuralMiniCard
              {...(neuralReading ?? { mode: "SCANNING" })}
              neuralScoreboard={neuralScoreboard}
              rounds={rounds}
              greenFlash={false}
            />
          </div>
        )}
      </div>
      <div className="relative mt-4 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
        <div className="rounded-xl border border-white/5 bg-secondary/32 p-2.5">
          <div className="text-muted-foreground">Proteção</div>
          <div className="font-semibold text-foreground">{visibleProtection}</div>
        </div>
        <div className="rounded-xl border border-white/5 bg-secondary/32 p-2.5">
          <div className="text-muted-foreground">Confiança</div>
          <div className="font-semibold text-neon-cyan">{visibleStrength}%</div>
        </div>
        <div className="rounded-xl border border-white/5 bg-secondary/32 p-2.5">
          <div className="text-muted-foreground">Estado</div>
          <div className={`font-semibold ${status.valueClass}`}>{status.value}</div>
        </div>
      </div>
      {shouldShowLastResult && lastResult && (
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

function buildMotorSequence(
  positive: number | null | undefined,
  negative: number | null | undefined,
  label: string,
) {
  const greens = safeSequenceNumber(positive);
  const reds = safeSequenceNumber(negative);

  if (reds > 0) {
    return {
      label: `${label}: ${reds} RED ${reds === 1 ? "atual" : "seguidos"}`,
      title: "Sequência atual desse motor depois da última quebra.",
      className: "border-destructive/30 bg-destructive/10 text-destructive",
    };
  }

  if (greens > 0) {
    return {
      label: `${label}: ${greens} GREEN ${greens === 1 ? "atual" : "seguidos"}`,
      title: "Sequência atual de greens desse motor.",
      className: "border-success/30 bg-success/10 text-success",
    };
  }

  return {
    label: `${label}: sem sequência ainda`,
    title: "Aguardando o primeiro resultado real desse motor.",
    className: "border-neon-cyan/20 bg-neon-cyan/10 text-neon-cyan",
  };
}

function safeSequenceNumber(value: number | null | undefined) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 0;
}

interface OperationalFocusSummary {
  sideLabel: string;
  sideClassName: string;
  strength: string;
  badgeClassName: string;
  reason: string;
}

function OperationalFocus({
  focus,
  fallback,
}: {
  focus: OperationalFocusSummary;
  fallback?: string;
}) {
  return (
    <div className="mt-2 grid max-w-[42rem] gap-2 rounded-xl border border-neon-cyan/12 bg-background/28 p-2.5 text-xs sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div>
        <div className="text-[9px] font-black uppercase tracking-[0.14em] text-muted-foreground">
          Melhor leitura agora
        </div>
        <div className={cn("mt-1 text-base font-black leading-tight", focus.sideClassName)}>
          {focus.sideLabel}
        </div>
        <div
          className={cn(
            "mt-1 inline-flex rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.1em]",
            focus.badgeClassName,
          )}
        >
          {focus.strength}
        </div>
      </div>
      <div className="min-w-0">
        <div className="text-[9px] font-black uppercase tracking-[0.14em] text-muted-foreground">
          Base
        </div>
        <div className="mt-1 font-semibold leading-snug text-foreground/88">{focus.reason}</div>
        {fallback ? (
          <div className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
            {fallback}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function buildOperationalFocus(
  signal: MainSignal,
  neuralReading?: NeuralReading,
  tieAlert?: TieAlert,
  surfSummary?: SurfEntrySummary,
): OperationalFocusSummary {
  const mainSide = activeMainSide(signal);
  const neural = neuralFocus(neuralReading);
  const tie = tieFocus(tieAlert);
  const surfAligned = Boolean(mainSide && surfSummary && surfSummary.oppositeRiskLevel !== "ALTO");

  if (mainSide && neural.side && neural.side !== mainSide) {
    return focusSummary(
      "NONE",
      "Sem consenso",
      "Aguardar",
      "Entrada Principal e Leitura Neural estao em lados diferentes.",
      "border-warning/30 bg-warning/10 text-warning",
    );
  }

  if (mainSide) {
    const parts = ["Entrada Principal"];
    if (neural.side === mainSide) parts.push("Leitura Neural alinhada");
    if (surfAligned) parts.push("Surf sem risco alto");
    if (tie.active) parts.push("Tie em observacao");
    return focusSummary(
      mainSide,
      sideDisplay(mainSide),
      tie.high ? "Atencao" : parts.length >= 2 ? "Alta" : "Confirmada",
      parts.join(" + "),
      tie.high
        ? "border-warning/30 bg-warning/10 text-warning"
        : "border-success/30 bg-success/10 text-success",
    );
  }

  if (neural.side) {
    return focusSummary(
      neural.side,
      sideDisplay(neural.side),
      neural.watch ? "Observacao" : "Forte",
      neural.reason,
      neural.watch
        ? "border-warning/30 bg-warning/10 text-warning"
        : "border-neon-cyan/25 bg-neon-cyan/10 text-neon-cyan",
    );
  }

  if (tie.active) {
    return focusSummary(
      "TIE",
      "🟡 Tie",
      tie.high ? "Possivel Tie" : "Observacao",
      tie.high
        ? "Radar de Empate com forca alta. Aguardar validade aberta."
        : "Empate em observacao, sem entrada confirmada.",
      "border-warning/30 bg-warning/10 text-warning",
    );
  }

  return focusSummary(
    "NONE",
    "Aguardando",
    "Sem entrada",
    "Nenhuma ferramenta confirmou entrada com forca suficiente.",
    "border-white/10 bg-white/5 text-muted-foreground",
  );
}

type FocusSide = SignalSide | "TIE" | "NONE";

function focusSummary(
  side: FocusSide,
  sideLabel: string,
  strength: string,
  reason: string,
  badgeClassName: string,
): OperationalFocusSummary {
  return {
    sideLabel,
    sideClassName: focusSideClass(side),
    strength,
    reason,
    badgeClassName,
  };
}

function activeMainSide(signal: MainSignal): SignalSide | null {
  if (
    (signal.status === "pending" || signal.status === "g1") &&
    (signal.side === "BANKER" || signal.side === "PLAYER")
  ) {
    return signal.side;
  }
  return null;
}

function neuralFocus(reading?: NeuralReading): {
  side: SignalSide | "TIE" | null;
  watch: boolean;
  reason: string;
} {
  if (!reading || typeof reading.numero !== "number") {
    return { side: null, watch: false, reason: "Leitura Neural procurando numero pagante." };
  }

  const side = reading.direcao ?? reading.origem ?? null;
  if (!side) return { side: null, watch: true, reason: "Leitura Neural ainda sem lado claro." };

  const watch = reading.mode === "OBSERVING" || Boolean(reading.isRedAlert || reading.isSaturated);
  const numberLabel =
    reading.origem === "TIE" ? `${reading.numero}x${reading.numero}` : String(reading.numero);
  return {
    side,
    watch,
    reason: `Leitura Neural: ${numberLabel} puxando ${sideDisplay(side)} ate ${reading.validade ?? "G1"}.`,
  };
}

function tieFocus(alert?: TieAlert): { active: boolean; high: boolean } {
  if (!alert || alert.status !== "active") return { active: false, high: false };
  const high = normalizeRisk(alert.level) === "ALTO" || alert.confidence >= 75;
  return { active: true, high };
}

function sideDisplay(side: FocusSide) {
  if (side === "BANKER") return "🔴 Banker";
  if (side === "PLAYER") return "🔵 Player";
  if (side === "TIE") return "🟡 Tie";
  return "Aguardando";
}

function focusSideClass(side: FocusSide) {
  if (side === "BANKER") return "text-banker";
  if (side === "PLAYER") return "text-player";
  if (side === "TIE") return "text-tie";
  return "text-muted-foreground";
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
  if (signal.status === "tie") {
    return {
      badge: "Tie",
      badgeTone: "amber" as const,
      pulse: false,
      kicker: "Resultado",
      value: "TIE",
      valueClass: "text-tie",
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
  if (result.status === "tie") {
    return {
      label: "TIE",
      className: "text-tie",
      side: result.side,
      protection: result.protection,
    };
  }
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

function signalResultKey(result: NonNullable<MainSignal["lastResult"]>) {
  return `${result.id}:${result.status}:${result.side}:${result.protection}:${result.finishedAt ?? ""}`;
}

function isGreenSignalResult(result: NonNullable<MainSignal["lastResult"]>) {
  return result.status === "green" || result.status === "green_g1";
}

function neuralResultTotals(reading?: NeuralReading) {
  return {
    greens: neuralGreens(reading),
    reds: safeNumber(reading?.reds ?? reading?.erros),
  };
}

function neuralGreens(reading?: NeuralReading) {
  const splitGreens = safeNumber(reading?.greenSemGale) + safeNumber(reading?.greenG1);
  return splitGreens || safeNumber(reading?.acertos);
}

function safeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function pulseGreen(setter: (value: boolean) => void) {
  setter(false);
  window.requestAnimationFrame(() => {
    setter(true);
    window.setTimeout(() => setter(false), 2100);
  });
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
