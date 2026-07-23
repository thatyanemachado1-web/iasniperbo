import { ChevronRight } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { GlassCard } from "@/components/ui-app/GlassCard";
import {
  DASHBOARD_MODULE_CARD_BODY,
  DASHBOARD_MODULE_CARD_FILL,
  DASHBOARD_MODULE_CARD_ROOT,
} from "@/components/dashboard/dashboardModuleCardLayout";
import { cn } from "@/lib/utils";
import { dashboardSideTextClass } from "@/lib/sideColors";
import { calculateMotorAssertiveness } from "@/utils/assertiveness";
import type {
  DashboardPersistentResult,
  NeuralEntryLastResult,
  NeuralEntryState,
  NeuralReading,
  NeuralScoreboard,
  Round,
  CurrentSignalSide,
  DashboardDisplayState,
  SignalSide,
} from "@/types/dashboard";

type NeuralSide = SignalSide | "TIE";
type NeuralEntryDisplayKind = "green" | "red" | "tie";

interface NeuralEntryDisplayResult {
  kind: NeuralEntryDisplayKind;
  side: NeuralSide;
  multiplier?: number | null;
  attempt?: "SG" | "G1" | string | null;
}

interface NeuralEntryHistoryItem extends NeuralEntryDisplayResult {
  id: string;
  minute: string;
}

type LeituraNeuralCardProps = NeuralReading & {
  className?: string;
  greenFlash?: boolean;
  neuralScoreboard?: NeuralScoreboard;
  rounds?: Round[];
  neuralEntryState?: NeuralEntryState | null;
  neuralEntryLastResult?: NeuralEntryLastResult | null;
  displayState?: DashboardDisplayState;
  displaySide?: CurrentSignalSide;
  displayRevision?: string | number | null;
  persistedResults?: DashboardPersistentResult[];
};

export type { LeituraNeuralCardProps };

const SCANNING_READING: NeuralReading = { mode: "SCANNING" };
const NEURAL_ENTRY_HISTORY_STORAGE_KEY = "sniper_neural_entry_history_official_v5";
const MAX_NEURAL_ENTRY_HISTORY = 100;
const VISIBLE_ENTRY_HISTORY = 100;
const OFFICIAL_ENTRY_RESULT_HOLD_MS = 5_000;
const RESOLVED_ENTRY_SUPPRESS_MS = 900;

export function LeituraNeuralMiniCard({
  className,
  greenFlash = false,
  neuralScoreboard,
  rounds,
  neuralEntryState,
  neuralEntryLastResult,
  displayState,
  displaySide,
  displayRevision,
  persistedResults = [],
  ...reading
}: LeituraNeuralCardProps) {
  const rawData = { ...SCANNING_READING, ...reading };
  const displayEntrySide = normalizeDisplayEntrySide(displaySide);
  const isDisplayEntry =
    (displayState === "entry_confirmed" || displayState === "waiting_result") && displayEntrySide;
  const data =
    !isDisplayEntry && shouldHideResolvedReading(rawData, neuralEntryLastResult)
      ? scanningReadingAfterClosedEntry(rawData)
      : rawData;
  const mode = data.mode ?? "SCANNING";
  const hasNumber =
    neuralDisplayNumber(data) !== null &&
    Boolean(data.origem || data.triggerSide || data.oppositeSide);
  const pullingSide = data.direcao ?? data.origem;
  const openCycleSide = isOpenNeuralCycle(data)
    ? normalizeDisplayEntrySide(data.targetSide ?? data.direcao ?? data.origem)
    : null;
  const rawConfirmedSide = isDisplayEntry
    ? displayEntrySide
    : (openCycleSide ?? (mode === "ACTIVE" ? pullingSide : null));
  const confirmedSide =
    !isDisplayEntry && shouldHideResolvedEntry(rawConfirmedSide, neuralEntryLastResult)
      ? null
      : rawConfirmedSide;
  const numberTokenSide = hasNumber ? neuralNumberOriginSide(data) : null;
  const generalScore = buildGeneralScore(neuralScoreboard, data);
  const accuracy = accuracyFrom(data.assertividade, data.acertos, data.erros);
  const view = buildNeuralView(
    data,
    hasNumber,
    confirmedSide,
    accuracy,
    generalScore,
    mode,
    Boolean(isDisplayEntry || openCycleSide),
    Boolean(displayState === "waiting_result" || data.cycleStatus === "AGUARDANDO_G1"),
  );

  const [entryResult, setEntryResult] = useState<NeuralEntryDisplayResult | null>(null);
  const [entryHistory, setEntryHistory] = useState<NeuralEntryHistoryItem[]>(() =>
    readNeuralEntryHistory(),
  );
  const lastOfficialResultRef = useRef<string | null>(null);
  const entryResultTimeoutRef = useRef<number | null>(null);
  const mountedAtRef = useRef(Date.now());

  useEffect(() => {
    const result = displayResultFromOfficialEntry(neuralEntryLastResult);
    if (!result || lastOfficialResultRef.current === result.id) return;

    lastOfficialResultRef.current = result.id;
    const historyItem = displayHistoryFromOfficialEntry(neuralEntryLastResult);
    if (historyItem) {
      setEntryHistory((history) => upsertNeuralEntryHistory(history, historyItem));
    }
    if (isOfficialEntryOlderThanSession(neuralEntryLastResult, mountedAtRef.current)) return;

    setEntryResult(result);
    if (entryResultTimeoutRef.current) window.clearTimeout(entryResultTimeoutRef.current);
    entryResultTimeoutRef.current = window.setTimeout(
      () => setEntryResult(null),
      OFFICIAL_ENTRY_RESULT_HOLD_MS,
    );
  }, [neuralEntryLastResult]);

  useEffect(() => {
    return () => {
      if (entryResultTimeoutRef.current) window.clearTimeout(entryResultTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const officialHistory = persistedResults
      .map(neuralEntryHistoryFromPersistentResult)
      .filter((item): item is NeuralEntryHistoryItem => Boolean(item));
    if (!officialHistory.length) return;
    setEntryHistory((history) => mergeNeuralEntryHistories(officialHistory, history));
  }, [persistedResults]);

  useEffect(() => {
    writeNeuralEntryHistory(entryHistory);
  }, [entryHistory]);

  const officialEntryResult = shouldShowOfficialEntryResult(neuralEntryLastResult, neuralEntryState)
    ? displayResultFromOfficialEntry(neuralEntryLastResult)
    : null;
  const visibleEntryResult = officialEntryResult ?? entryResult;
  const resultView = visibleEntryResult
    ? buildEntryResultView(visibleEntryResult)
    : buildDisplayStateResultView(displayState, displaySide);
  const renderLogKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const label = resultView?.action ?? view.action;
    const key = `${displayRevision ?? "-"}:${displayState ?? "-"}:${displaySide ?? "-"}:${label}`;
    if (renderLogKeyRef.current === key) return;
    renderLogKeyRef.current = key;
    console.info("[FRONT_CARD_RENDER]", {
      module: "leitura_neural",
      revision: displayRevision,
      displayState,
      side: displaySide,
      label,
    });
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      console.info("[MOBILE_CARD_RENDER]", {
        revision: displayRevision,
        displayState,
        side: displaySide,
      });
    }
  }, [displayRevision, displayState, displaySide, resultView?.action, view.action]);

  return (
    <GlassCard
      className={cn(
        "digital-risk-card border-white/10 p-2 sm:p-2",
        DASHBOARD_MODULE_CARD_ROOT,
        view.borderClass,
        greenFlash && "result-green-flash",
        visibleEntryResult?.kind === "red" && "neural-entry-flash-red",
        visibleEntryResult?.kind === "tie" && "neural-entry-flash-tie",
        visibleEntryResult?.kind === "green" && "neural-entry-flash-green",
        className,
      )}
      aria-label="Leitura neural de números pagantes"
    >
      <div className="pointer-events-none absolute inset-0 scan-grid opacity-[0.03]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-neon-purple/22 to-transparent" />

      <div className="mb-2 flex min-w-0 items-start justify-between gap-2">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Leitura Neural
          </div>
          <div className="text-[8px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
            {originSubtitle(data)}
          </div>
        </div>
        <AppBadge
          tone={view.badgeTone}
          pulse={view.pulse}
          className="max-w-full truncate px-1.5 py-0 text-[8px] tracking-[0.08em]"
        >
          {view.badge}
        </AppBadge>
      </div>

      <div className={DASHBOARD_MODULE_CARD_BODY}>
        {resultView ? (
          <div className={cn("rounded-xl border px-3 py-2.5 text-center", resultView.panelClass)}>
            <div
              className={cn("text-lg font-black uppercase leading-none", resultView.actionClass)}
            >
              {resultView.action}
            </div>
            <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {resultView.headline}
            </div>
          </div>
        ) : (
          <div className={cn("rounded-xl border px-3 py-2.5 text-center", view.panelClass)}>
            <div className={cn("text-lg font-black uppercase leading-none", view.actionClass)}>
              {view.action}
            </div>
            <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {view.headline}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-1.5 text-center sm:grid-cols-3">
          <NeuralStatChip label="Forca" value={view.strengthLabel} tone={view.strengthTone} />
          <NeuralStatChip
            label="Numero"
            value={hasNumber ? formatNeuralNumber(data) : "--"}
            tone={numberTokenSide ? sideNumberTone(numberTokenSide) : "muted"}
          >
            {hasNumber ? (
              <NeuralNumberToken label={formatNeuralNumber(data)} side={numberTokenSide} />
            ) : null}
          </NeuralStatChip>
          <NeuralStatChip label="Validade" value={data.validade ?? "G1"} tone="muted" />
        </div>

        <details className="group rounded-lg border border-white/10 bg-background/20">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2 py-2 text-[8px] font-black uppercase tracking-[0.08em] text-neon-cyan marker:content-none [&::-webkit-details-marker]:hidden">
            <span>Ver mais — resultados e detalhes</span>
            <ChevronRight className="size-3 shrink-0 transition-transform group-open:rotate-90" />
          </summary>
          <div className="space-y-2 border-t border-white/10 p-2">
        <div className="rounded-lg border border-white/10 bg-background/20 px-2 py-1.5 text-[9px] text-muted-foreground">
          <div className="font-black uppercase tracking-[0.08em] text-muted-foreground">
            Placar geral - reseta 00:00 (BR)
          </div>
          <div className="mt-0.5 font-semibold text-foreground">
            SG {formatCount(generalScore.sg)} - G1 {formatCount(generalScore.g1)} - RD{" "}
            {formatCount(generalScore.reds)} - {formatPercent(generalScore.accuracy)}
          </div>
        </div>

        {hasNumber && pullingSide ? (
          <div className="rounded-lg border border-white/10 bg-background/20 px-2 py-1.5 text-[9px]">
            <div className="font-black uppercase tracking-[0.08em] text-muted-foreground">
              Leitura ativa
            </div>
            <div className="mt-0.5 font-semibold text-foreground">
              <NeuralNumberToken label={formatNeuralNumber(data)} side={numberTokenSide} />
              {" - puxando "}
              <span className={sideClass(pullingSide)}>{sideLabel(pullingSide)}</span>
              {data.origemTipo === "OPOSTO"
                ? " - gatilho oposto"
                : data.postTie
                  ? " - pos-empate"
                  : ""}
            </div>
          </div>
        ) : null}

        {data.strategyType && (hasNumber || hasStrategyOrigin(data)) ? (
          <NeuralStrategyDetails data={data} />
        ) : null}

        {data.formationCandidates?.length ? (
          <NeuralFormationCandidates candidates={data.formationCandidates} />
        ) : null}

        {neuralEntryState?.expectedSide &&
        !visibleEntryResult &&
        !shouldHideResolvedEntry(neuralEntryState.expectedSide, neuralEntryLastResult) ? (
          <div className="rounded-lg border border-white/10 bg-background/20 px-2 py-1 text-[9px] text-muted-foreground">
            Entrada oficial:{" "}
            <span className={sideClass(neuralEntryState.expectedSide)}>
              {sideLabel(neuralEntryState.expectedSide)}
            </span>
          </div>
        ) : null}

        <NeuralEntryHistoryList history={entryHistory} />
          </div>
        </details>
        <div className={DASHBOARD_MODULE_CARD_FILL} aria-hidden />
      </div>
    </GlassCard>
  );
}

function buildNeuralView(
  data: NeuralReading,
  hasNumber: boolean,
  confirmedSide: NeuralSide | null | undefined,
  accuracy: number | null,
  generalScore: ReturnType<typeof buildGeneralScore>,
  mode: NeuralReading["mode"],
  forceOfficialEntryDisplay = false,
  isAwaitingG1 = false,
) {
  const strengthLabel =
    accuracy !== null ? `${Math.round(accuracy)}%` : formatPercent(generalScore.accuracy);
  const validity = data.validade ?? "G1";
  const originKind = neuralOriginKind(data);

  if (data.blocked || data.isRedAlert || (data.isSaturated && neuralStatusKind(data) === "red")) {
    const riskEntrySide = confirmedSide ?? normalizeDisplayEntrySide(data.direcao ?? data.origem);
    return {
      badge: data.blocked ? "Bloqueado" : "Risco alto",
      badgeTone: "red" as const,
      pulse: false,
      action: data.blocked
        ? "Bloqueado"
        : riskEntrySide
          ? `Entrada ${entrySideToken(riskEntrySide)}`
          : "Entrada",
      headline: data.paganteAlert ?? "Estrategia atingiu 3 reds recentes",
      actionClass: riskEntrySide ? sideActionClass(riskEntrySide) : "text-destructive",
      panelClass: "border-destructive/35 bg-destructive/10",
      borderClass: "border-destructive/30",
      strengthLabel,
      strengthTone: "red" as const,
      numberTone: "muted" as const,
    };
  }

  if (confirmedSide && (hasNumber || forceOfficialEntryDisplay)) {
    return {
      badge: originKind === "OPOSTO" ? "Oposto" : data.postTie ? "Pos-empate" : "Pagante",
      badgeTone: sideBadgeTone(confirmedSide),
      pulse: true,
      action: isAwaitingG1
        ? `Aguardando G1 ${entrySideToken(confirmedSide)}`
        : `Entrada ${entrySideToken(confirmedSide)}`,
      headline: hasNumber
        ? `${sideLabel(confirmedSide)} - ate ${validity} - ${data.accuracyLabel ?? strengthLabel}`
        : `${sideLabel(confirmedSide)} - entrada confirmada pela engine`,
      actionClass: sideActionClass(confirmedSide),
      panelClass: sidePanelClass(confirmedSide),
      borderClass: sideBorderClass(confirmedSide),
      strengthLabel,
      strengthTone: sideStatTone(confirmedSide),
      numberTone: sideNumberTone(data.origem),
    };
  }

  if (hasNumber && mode === "OBSERVING") {
    const side = pullingSideLabel(data);
    return {
      badge: "Observando",
      badgeTone: "amber" as const,
      pulse: true,
      action: side ? `Monitorar ${side}` : "Monitorar",
      headline: "Numero apareceu - aguardando confirmacao da engine",
      actionClass: "text-warning",
      panelClass: "border-warning/30 bg-warning/10",
      borderClass: "border-warning/25",
      strengthLabel,
      strengthTone: "amber" as const,
      numberTone: sideNumberTone(data.origem),
    };
  }

  if (hasNumber) {
    const side = pullingSideLabel(data);
    return {
      badge: "Leitura",
      badgeTone: "blue" as const,
      pulse: false,
      action: side ? `Monitorar ${side}` : "Monitorar",
      headline: "Numero detectado - sem entrada confirmada agora",
      actionClass: "text-warning",
      panelClass: "border-warning/25 bg-warning/8",
      borderClass: "border-neon-purple/20",
      strengthLabel,
      strengthTone: "cyan" as const,
      numberTone: sideNumberTone(data.origem),
    };
  }

  return {
    badge: "Procurando",
    badgeTone: "muted" as const,
    pulse: false,
    action: "Aguardar",
    headline: "IA procurando numeros pagantes no ciclo atual",
    actionClass: "text-muted-foreground",
    panelClass: "border-border/60 bg-secondary/20",
    borderClass: "border-border/50",
    strengthLabel,
    strengthTone: "muted" as const,
    numberTone: "muted" as const,
  };
}

function NeuralStrategyDetails({ data }: { data: NeuralReading }) {
  const target = normalizeDisplayEntrySide(data.targetSide ?? data.direcao);
  const originNumber = strategyOriginNumber(data);
  const originSide = neuralNumberOriginSide(data);
  const originKind =
    data.origemTipo === "OPOSTO" || isOppositeStrategy(data) ? "oposto" : "pagante";
  const sample =
    data.sampleLabel ?? (typeof data.samples === "number" ? `${data.samples} amostras` : "--");

  return (
    <div className="rounded-lg border border-white/10 bg-background/20 px-2 py-1.5 text-[8.5px] text-muted-foreground">
      <div className="flex items-center justify-between gap-2">
        <span className="font-black uppercase tracking-[0.08em] text-muted-foreground">
          Origem tecnica
        </span>
        <span className="truncate font-semibold text-neon-cyan">
          {strategyTypeLabel(data.strategyType)}
        </span>
      </div>
      <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5 font-semibold">
        <span className="flex min-w-0 items-center gap-1 text-foreground">
          Numero <NeuralNumberToken label={String(originNumber ?? "--")} side={originSide} />
          <span className={cn("truncate", sideClass(originSide))}>
            {originSide ? sideLabel(originSide).toUpperCase() : ""} {originKind}
          </span>
        </span>
        <span className="truncate text-right">{strategyTypeLabel(data.strategyType)}</span>
        <span className="truncate">
          Puxou:{" "}
          <span className={sideClass(target)}>
            {target ? sideLabel(target).toUpperCase() : "--"}
          </span>
        </span>
        <span className="truncate text-right">
          {data.accuracyLabel ?? formatPercent(optionalNumberFrom(data.accuracy))}
        </span>
        <span className="truncate">Amostra: {sample}</span>
        <span className="truncate text-right">
          Reds: {formatCount(optionalNumberFrom(data.recentReds))}
        </span>
      </div>
    </div>
  );
}

function NeuralFormationCandidates({
  candidates,
}: {
  candidates: NonNullable<NeuralReading["formationCandidates"]>;
}) {
  const visible = candidates.slice(0, 3);
  return (
    <div className="rounded-lg border border-white/8 bg-background/12 px-2 py-1.5 text-[8px]">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="font-black uppercase tracking-[0.08em] text-muted-foreground">
          Em formacao
        </span>
        <span className="text-muted-foreground/70">{candidates.length} no radar</span>
      </div>
      <div className="space-y-0.5">
        {visible.map((candidate, index) => {
          const target = normalizeDisplayEntrySide(candidate.targetSide);
          return (
            <div
              key={candidate.strategyId ?? `${candidate.strategyType}:${index}`}
              className="flex items-center justify-between gap-1 rounded-md border border-white/5 bg-secondary/8 px-1.5 py-0.5 font-semibold"
            >
              <span className="min-w-0 truncate text-muted-foreground">
                {formationOriginLabel(candidate)} puxando{" "}
                <span className={sideClass(target)}>
                  {target ? sideLabel(target).toUpperCase() : "--"}
                </span>
              </span>
              <span className="shrink-0 text-warning">
                {candidate.accuracyLabel ?? formatPercent(optionalNumberFrom(candidate.accuracy))}{" "}
                {candidate.sampleLabel ?? ""}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NeuralEntryHistoryList({ history }: { history: NeuralEntryHistoryItem[] }) {
  const visible = history.slice(0, VISIBLE_ENTRY_HISTORY);

  return (
    <details className="group rounded-lg border border-white/8 bg-background/12 px-2 py-1">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 py-0.5 marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-1 text-[7px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/75">
          <ChevronRight className="size-2.5 shrink-0 transition group-open:rotate-90" />
          <span className="truncate">Entradas</span>
        </span>
        <span className="shrink-0 whitespace-nowrap text-[6.5px] font-black uppercase tracking-[0.02em] text-muted-foreground/65">
          {history.length} no ciclo
        </span>
      </summary>

      <div className="mt-1 border-t border-white/5 pt-1">
        {visible.length ? (
          <div className="max-h-20 space-y-0.5 overflow-y-auto pr-0.5">
            {visible.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-1 rounded-md border border-white/5 bg-secondary/8 px-1.5 py-0.5 text-[7.5px] font-semibold leading-tight"
              >
                <span className="min-w-0 truncate">
                  <span className={item.kind === "tie" ? "text-tie" : sideClass(item.side)}>
                    {entrySideHistoryLabel(item)}
                  </span>
                  {item.kind !== "tie" ? (
                    <>
                      {" "}
                      <span className={entryResultClass(item.kind)}>
                        {entryResultLabel(item.kind, item.attempt)}
                      </span>
                    </>
                  ) : null}
                </span>
                <span className="shrink-0 text-[7px] text-muted-foreground/70">{item.minute}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="pb-0.5 text-[7.5px] font-semibold text-muted-foreground/70">
            Sem greens, reds ou ties recentes.
          </div>
        )}
      </div>
    </details>
  );
}

function readNeuralEntryHistory(): NeuralEntryHistoryItem[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(NEURAL_ENTRY_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map(normalizeNeuralEntryHistoryItem)
      .filter((item): item is NeuralEntryHistoryItem => Boolean(item))
      .slice(0, MAX_NEURAL_ENTRY_HISTORY);
  } catch {
    return [];
  }
}

function writeNeuralEntryHistory(history: NeuralEntryHistoryItem[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      NEURAL_ENTRY_HISTORY_STORAGE_KEY,
      JSON.stringify(history.slice(0, MAX_NEURAL_ENTRY_HISTORY)),
    );
  } catch {
    // Local persistence is only a visual convenience.
  }
}

function mergeNeuralEntryHistories(
  primary: NeuralEntryHistoryItem[],
  secondary: NeuralEntryHistoryItem[],
) {
  let merged = secondary;
  for (const item of primary.slice().reverse()) {
    merged = upsertNeuralEntryHistory(merged, item);
  }
  return merged;
}

function upsertNeuralEntryHistory(history: NeuralEntryHistoryItem[], item: NeuralEntryHistoryItem) {
  const merged = [item, ...history.filter((entry) => entry.id !== item.id)].slice(
    0,
    MAX_NEURAL_ENTRY_HISTORY,
  );
  return neuralEntryHistoryEquals(history, merged) ? history : merged;
}

function neuralEntryHistoryEquals(left: NeuralEntryHistoryItem[], right: NeuralEntryHistoryItem[]) {
  if (left.length !== right.length) return false;
  return left.every((item, index) => JSON.stringify(item) === JSON.stringify(right[index]));
}

function normalizeNeuralEntryHistoryItem(value: unknown): NeuralEntryHistoryItem | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<NeuralEntryHistoryItem>;
  if (!isNeuralEntryResultKind(record.kind) || !isNeuralSide(record.side)) return null;

  return {
    id:
      typeof record.id === "string" && record.id
        ? record.id
        : `restored:${Date.now()}:${Math.random()}`,
    kind: record.kind,
    side: record.side,
    multiplier:
      typeof record.multiplier === "number" && Number.isFinite(record.multiplier)
        ? record.multiplier
        : null,
    attempt: record.attempt === "G1" ? "G1" : record.attempt === "SG" ? "SG" : null,
    minute: typeof record.minute === "string" && record.minute ? record.minute : "--",
  };
}

function neuralEntryHistoryFromPersistentResult(
  value: DashboardPersistentResult,
): NeuralEntryHistoryItem | null {
  if (value.moduleKey !== "LEITURA_NEURAL_NUMERO_PAGANTE") return null;
  const side = normalizeDisplayEntrySide(value.side);
  if (!side) return null;
  const resultType = String(value.resultType || "").toUpperCase();
  const kind: NeuralEntryDisplayKind =
    resultType === "RED"
      ? "red"
      : resultType === "EMPATE" || resultType === "EMPATE_G1"
        ? "tie"
        : "green";
  const multiplier =
    typeof value.tieMultiplier === "number"
      ? value.tieMultiplier
      : Number(String(value.tieMultiplier || "").replace(/\D+/g, "")) || null;
  const semanticId = ["neural", value.signalId ?? value.resultId, value.roundId ?? "", kind].join(
    ":",
  );
  return {
    id: semanticId,
    kind,
    side,
    multiplier,
    attempt: value.attempt === "G1" ? "G1" : "SG",
    minute:
      minuteLabelFromTimeText(value.displayTimeBR) ?? minuteLabelFromIso(value.createdAt) ?? "--",
  };
}

function displayHistoryFromOfficialEntry(result: NeuralEntryLastResult | null | undefined) {
  const base = displayResultFromOfficialEntry(result);
  if (!base) return null;

  return {
    ...base,
    minute: minuteLabelFromOfficialResult(result),
  };
}

function clearNeuralEntryHistoryStorage() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(NEURAL_ENTRY_HISTORY_STORAGE_KEY);
  } catch {
    // The official payload is the source of truth across web and mobile.
  }
}

function shouldShowOfficialEntryResult(
  result: NeuralEntryLastResult | null | undefined,
  _state: NeuralEntryState | null | undefined,
) {
  if (!result?.id) return false;
  if (isOfficialEntryFreshForDisplay(result)) return true;
  return false;
}

function isOfficialEntryFreshForDisplay(result: NeuralEntryLastResult | null | undefined) {
  if (!result?.finishedAt) return false;
  const finishedAt = new Date(result.finishedAt).getTime();
  if (Number.isNaN(finishedAt)) return false;
  const age = Date.now() - finishedAt;
  return age >= -5_000 && age <= OFFICIAL_ENTRY_RESULT_HOLD_MS;
}

function minuteLabelFromOfficialResult(result: NeuralEntryLastResult | null | undefined) {
  const roundKeyMinute = minuteLabelFromTimeText(result?.resultRoundKey);
  if (roundKeyMinute) return roundKeyMinute;

  const finishedMinute = minuteLabelFromIso(result?.finishedAt);
  return finishedMinute ?? "--";
}

function minuteLabelFromTimeText(value: unknown) {
  if (typeof value !== "string") return null;
  const match = value.match(/\b(\d{1,2}:\d{2})(?::\d{2})?\b/);
  return match?.[1]?.padStart(5, "0") ?? null;
}

function minuteLabelFromIso(value: unknown) {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isNeuralEntryResultKind(value: unknown): value is NeuralEntryDisplayKind {
  return value === "green" || value === "red" || value === "tie";
}

function isNeuralSide(value: unknown): value is NeuralSide {
  return value === "BANKER" || value === "PLAYER" || value === "TIE";
}

function entrySideHistoryLabel(item: NeuralEntryHistoryItem) {
  if (item.kind === "tie") {
    return `EMPATE${item.multiplier ? ` ${item.multiplier}X` : ""}`.trim();
  }
  if (item.side === "BANKER") return "BANKER";
  if (item.side === "PLAYER") return "PLAYER";
  return "TIE";
}

function entryHistoryText(item: NeuralEntryHistoryItem) {
  if (item.kind === "tie") return entrySideHistoryLabel(item);
  return `${entrySideHistoryLabel(item)} ${entryResultLabel(item.kind, item.attempt)}`;
}

function entryResultLabel(kind: NeuralEntryDisplayKind, attempt?: string | null) {
  if (kind === "red") return "RED";
  if (kind === "tie") return "EMPATE";
  return attempt === "G1" ? "GREEN G1" : "GREEN SG";
}

function entryResultClass(kind: NeuralEntryDisplayKind) {
  if (kind === "red") return "text-destructive";
  if (kind === "tie") return "text-warning";
  return "text-success";
}

function buildEntryResultView(result: NeuralEntryDisplayResult) {
  if (result.kind === "red") {
    return {
      action: "RED FINAL",
      headline: "Entrada neural fechou no red",
      actionClass: "text-destructive",
      panelClass: "neural-entry-flash-red border-destructive/35 bg-destructive/10",
    };
  }

  if (result.kind === "tie") {
    return {
      action: `EMPATE ${result.multiplier ? `${result.multiplier}X` : ""}`.trim(),
      headline: "Empate confirmado na validade",
      actionClass: "text-warning",
      panelClass: "neural-entry-flash-tie border-warning/35 bg-warning/10",
    };
  }

  return {
    action: result.attempt === "G1" ? "GREEN G1" : "GREEN SG",
    headline: `${sideLabel(result.side)} confirmado pela Leitura Neural`,
    actionClass: sideActionClass(result.side),
    panelClass: "neural-entry-flash-green border-success/35 bg-success/10",
  };
}

function buildDisplayStateResultView(
  displayState: DashboardDisplayState | undefined,
  displaySide: CurrentSignalSide | undefined,
) {
  const side = normalizeDisplayEntrySide(displaySide);
  if (displayState === "result_tie") {
    return buildEntryResultView({ kind: "tie", side: "TIE" });
  }
  if (displayState === "result_red" && side) {
    return buildEntryResultView({ kind: "red", side });
  }
  if (displayState === "result_green" && side) {
    return buildEntryResultView({ kind: "green", side });
  }
  return null;
}

function NeuralStatChip({
  label,
  value,
  tone,
  children,
}: {
  label: string;
  value: string;
  tone: "green" | "amber" | "cyan" | "red" | "muted" | "banker" | "player" | "tie";
  children?: ReactNode;
}) {
  const toneClass = {
    green: "border-success/30 bg-success/8 text-success",
    amber: "border-warning/30 bg-warning/8 text-warning",
    cyan: "border-neon-cyan/30 bg-neon-cyan/8 text-neon-cyan",
    red: "border-destructive/30 bg-destructive/8 text-destructive",
    muted: "border-border/60 bg-secondary/25 text-foreground",
    banker: "border-banker/30 bg-banker/8 text-banker",
    player: "border-player/35 bg-player/10 text-player",
    tie: "border-tie/35 bg-tie/10 text-tie",
  }[tone];

  return (
    <div className={cn("rounded-lg border px-1 py-1.5", toneClass)}>
      <div className="text-[8px] font-black uppercase tracking-[0.08em] opacity-75">{label}</div>
      <div className="mt-0.5 flex min-h-4 items-center justify-center text-[11px] font-black leading-none">
        {children ?? <span className="truncate">{value}</span>}
      </div>
    </div>
  );
}

function NeuralNumberToken({ label, side }: { label: string; side?: NeuralSide | null }) {
  const compactLabel = compactNumberTokenLabel(label);
  return (
    <span
      className={cn(
        "inline-grid size-5 shrink-0 place-items-center rounded-full border font-black leading-none tabular-nums shadow-[0_0_10px_-7px_currentColor] [-webkit-text-stroke:0.2px_currentColor]",
        compactLabel.length > 1 ? "text-[10px]" : "text-[12px]",
        numberTokenClass(side),
      )}
      title={label}
      aria-label={label}
    >
      {compactLabel}
    </span>
  );
}

function compactNumberTokenLabel(label: string) {
  const text = String(label || "--").trim();
  const sideNumber = text.match(/^(\d+)\s*[BP]$/i) || text.match(/^[BP]\s*(\d+)$/i);
  if (sideNumber?.[1]) return sideNumber[1];
  const tieNumber = text.match(/^(\d+)\s*x\s*\d*$/i);
  if (tieNumber?.[1]) return tieNumber[1];
  const onlyNumber = text.match(/\d+/)?.[0];
  return onlyNumber || text || "--";
}

function numberTokenClass(side?: NeuralSide | null) {
  if (side === "BANKER") return "border-banker/70 bg-banker text-white";
  if (side === "PLAYER") return "border-player/70 bg-player text-white";
  if (side === "TIE") return "border-warning/70 bg-warning text-background";
  return "border-white/20 bg-white/10 text-foreground";
}

function buildGeneralScore(
  scoreboard: NeuralScoreboard | undefined,
  fallbackReading: NeuralReading,
) {
  const sg = optionalNumberFrom(scoreboard?.greenSemGale ?? fallbackReading.greenSemGale);
  const g1 = optionalNumberFrom(scoreboard?.greenG1 ?? fallbackReading.greenG1);
  const splitGreens = sg !== null || g1 !== null ? numberFrom(sg) + numberFrom(g1) : null;
  const greens = optionalNumberFrom(
    splitGreens ?? scoreboard?.greens ?? scoreboard?.acertos ?? fallbackReading.acertos,
  );
  const reds = optionalNumberFrom(
    scoreboard?.reds ?? scoreboard?.erros ?? fallbackReading.reds ?? fallbackReading.erros,
  );
  const accuracy =
    accuracyFrom(null, greens, reds) ??
    optionalNumberFrom(scoreboard?.assertividade ?? fallbackReading.assertividade);

  return { sg, g1, reds, accuracy };
}

function displayResultFromOfficialEntry(result: NeuralEntryLastResult | null | undefined) {
  if (!result?.id) return null;

  const side = normalizeEntrySide(result.expectedSide ?? result.origem);
  const kind: NeuralEntryDisplayKind =
    result.outcome === "TIE" || result.kind === "tie_sg" || result.kind === "tie_g1"
      ? "tie"
      : result.outcome === "RED" || result.kind === "red"
        ? "red"
        : "green";
  const attempt =
    result.attempt === "G1" || result.kind === "g1" || result.kind === "tie_g1" ? "G1" : "SG";

  return {
    id: ["neural", result.key || result.id, result.resultRoundKey || "", kind].join(":"),
    kind,
    side: kind === "tie" ? "TIE" : side,
    multiplier: kind === "tie" ? (result.tieMultiplier ?? null) : null,
    attempt,
  };
}

function isOfficialEntryOlderThanSession(
  result: NeuralEntryLastResult | null | undefined,
  mountedAt: number,
) {
  if (!result?.finishedAt) return false;
  const finishedAt = new Date(result.finishedAt).getTime();
  if (Number.isNaN(finishedAt)) return false;
  return finishedAt < mountedAt - 1500;
}

function normalizeEntrySide(side: unknown): NeuralSide {
  if (side === "BANKER" || side === "PLAYER" || side === "TIE") return side;
  return "TIE";
}

function normalizeDisplayEntrySide(side: unknown): NeuralSide | null {
  if (side === "BANKER" || side === "PLAYER" || side === "TIE") return side;
  return null;
}

function originSubtitle(data: NeuralReading) {
  const kind = neuralOriginKind(data);
  if (kind === "OPOSTO") return "numero oposto";
  if (kind === "TIE" || data.postTie) return "pos-empate";
  return "numero pagante";
}

function strategyOriginNumber(data: NeuralReading) {
  if (data.origemTipo === "OPOSTO" || isOppositeStrategy(data)) {
    return data.oppositeNumber ?? data.numero;
  }
  return data.triggerNumber ?? data.numero;
}

function neuralNumberOriginSide(data: NeuralReading) {
  if (data.origemTipo === "OPOSTO" || isOppositeStrategy(data)) {
    return normalizeDisplayEntrySide(data.oppositeSide ?? data.origem);
  }
  return normalizeDisplayEntrySide(data.triggerSide ?? data.origem);
}

function formationOriginLabel(
  candidate: NonNullable<NeuralReading["formationCandidates"]>[number],
) {
  if (candidate.oppositeNumber !== null && candidate.oppositeNumber !== undefined) {
    const side = normalizeDisplayEntrySide(candidate.oppositeSide);
    return `${candidate.oppositeNumber}${side ? ` ${sideLabel(side).toUpperCase()}` : ""} oposto`;
  }
  const side = normalizeDisplayEntrySide(candidate.triggerSide);
  return `${candidate.triggerNumber ?? "--"}${side ? ` ${sideLabel(side).toUpperCase()}` : ""}`;
}

function strategyTypeLabel(value: unknown) {
  const text = String(value || "");
  if (text === "PAGANTE_OPOSTO") return "Pagante oposto";
  if (text === "PAGANTE_DIRETO") return "Pagante direto";
  return "Motor neural";
}

function formatNeuralNumber(data: NeuralReading) {
  const number = neuralDisplayNumber(data);
  if (number === null) return "--";
  if (data.origem === "TIE") return `${number}x`;
  return String(number);
}

function pullingSideLabel(data: NeuralReading) {
  const side = data.direcao ?? data.origem;
  return side ? sideLabel(side).toUpperCase() : null;
}

function neuralOriginKind(data: NeuralReading) {
  if (data.postTie || data.origem === "TIE") return "TIE";
  if (isOppositeStrategy(data)) return "OPOSTO";
  return data.origemTipo ?? "PAGANTE";
}

function neuralDisplayNumber(data: NeuralReading) {
  if (typeof data.numero === "number") return data.numero;
  if (typeof data.oppositeNumber === "number") return data.oppositeNumber;
  if (typeof data.triggerNumber === "number") return data.triggerNumber;
  return null;
}

function hasStrategyOrigin(data: NeuralReading) {
  return (
    typeof data.triggerNumber === "number" ||
    typeof data.oppositeNumber === "number" ||
    Boolean(data.triggerSide || data.oppositeSide || data.targetSide)
  );
}

function isOpenNeuralCycle(data: NeuralReading) {
  const status = String(data.cycleStatus || "").toUpperCase();
  return status === "AGUARDANDO_RESULTADO" || status === "AGUARDANDO_G1";
}

function isOppositeStrategy(data: NeuralReading) {
  const strategyType = String(data.strategyType || "").toUpperCase();
  return strategyType.includes("OPOSTO") || typeof data.oppositeNumber === "number";
}

function neuralStatusKind(reading: NeuralReading): "green" | "amber" | "red" | "muted" {
  if (typeof reading.numero !== "number") return "muted";
  if (reading.isRedAlert || reading.isSaturated) return "red";
  if (reading.mode === "ACTIVE") return "green";
  return "amber";
}

function sideBadgeTone(side: NeuralSide) {
  if (side === "BANKER") return "red" as const;
  if (side === "PLAYER") return "blue" as const;
  return "gold" as const;
}

function sidePanelClass(side: NeuralSide) {
  if (side === "BANKER") return "border-banker/35 bg-banker/10";
  if (side === "PLAYER") return "border-player/35 bg-player/10";
  return "border-tie/35 bg-tie/10";
}

function sideBorderClass(side: NeuralSide) {
  if (side === "BANKER") return "border-banker/35";
  if (side === "PLAYER") return "border-player/35";
  return "border-tie/35";
}

function sideStatTone(side: NeuralSide) {
  if (side === "BANKER") return "banker" as const;
  if (side === "PLAYER") return "player" as const;
  return "tie" as const;
}

function sideActionClass(side: NeuralSide) {
  return dashboardSideTextClass(side);
}

function sideNumberTone(side: NeuralSide | null | undefined) {
  if (side === "BANKER") return "banker" as const;
  if (side === "PLAYER") return "player" as const;
  if (side === "TIE") return "tie" as const;
  return "muted" as const;
}

function accuracyFrom(
  assertividade?: number | null,
  acertos?: number | null,
  erros?: number | null,
) {
  if (typeof acertos === "number" || typeof erros === "number") {
    const total = (acertos ?? 0) + (erros ?? 0);
    return total > 0 ? calculateMotorAssertiveness(acertos ?? 0, erros ?? 0) : null;
  }
  if (typeof assertividade === "number") return assertividade;
  return null;
}

function optionalNumberFrom(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function numberFrom(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function formatPercent(value: number | null) {
  if (value === null) return "--";
  return `${Math.round(value)}%`;
}

function formatCount(value: number | null) {
  return value === null ? "0" : String(value);
}

function sideLabel(side?: NeuralSide | null) {
  if (side === "BANKER") return "Banker";
  if (side === "PLAYER") return "Player";
  if (side === "TIE") return "Empate";
  return "";
}

function entrySideToken(side?: NeuralSide | null) {
  if (side === "BANKER") return "BANKER";
  if (side === "PLAYER") return "PLAYER";
  if (side === "TIE") return "TIE";
  return "";
}

function sideClass(side?: NeuralSide | null) {
  return dashboardSideTextClass(side);
}

function shouldHideResolvedEntry(
  confirmedSide: NeuralSide | null | undefined,
  result: NeuralEntryLastResult | null | undefined,
) {
  if (!confirmedSide || !result?.id) return false;
  const resultSide = normalizeEntrySide(result.expectedSide ?? result.origem);
  if (resultSide !== confirmedSide) return false;
  if (!result.finishedAt) return true;
  const finishedAt = new Date(result.finishedAt).getTime();
  if (Number.isNaN(finishedAt)) return false;
  return Date.now() - finishedAt < RESOLVED_ENTRY_SUPPRESS_MS;
}

function shouldHideResolvedReading(
  reading: NeuralReading,
  result: NeuralEntryLastResult | null | undefined,
) {
  if (!result?.id || !result.finishedAt || reading.mode !== "ACTIVE") return false;
  const finishedAt = new Date(result.finishedAt).getTime();
  if (Number.isNaN(finishedAt) || Date.now() - finishedAt >= RESOLVED_ENTRY_SUPPRESS_MS)
    return false;

  const readingKey = neuralReadingEntryKey(reading);
  if (readingKey && result.key && readingKey === result.key) return true;

  const readingSide = reading.direcao ?? reading.origem;
  const resultSide = normalizeEntrySide(result.expectedSide ?? result.origem);
  return Boolean(
    readingSide &&
    resultSide &&
    readingSide === resultSide &&
    reading.numero === result.numero &&
    reading.origem === result.origem &&
    reading.origemTipo === result.origemTipo,
  );
}

function neuralReadingEntryKey(reading: NeuralReading) {
  if (reading.strategyId) return String(reading.strategyId);
  if (typeof reading.numero !== "number") return "";
  const origem = strictNeuralSide(reading.origem);
  const origemTipo = reading.origemTipo;
  const expectedSide = strictNeuralSide(reading.direcao ?? reading.origem);
  if (!origem || !origemTipo || !expectedSide) return "";
  return `${reading.numero}:${origem}:${origemTipo}:${expectedSide}`;
}

function strictNeuralSide(side: unknown): NeuralSide | null {
  if (side === "BANKER" || side === "PLAYER" || side === "TIE") return side;
  return null;
}

function scanningReadingAfterClosedEntry(reading: NeuralReading): NeuralReading {
  return {
    ...reading,
    mode: "SCANNING",
    numero: null,
    origem: null,
    origemTipo: null,
    direcao: null,
    paganteStatus: "ANALISANDO",
    paganteAlert: "Aguardando nova confirmacao da engine.",
    paganteWindow: null,
    paganteCycleProgress: null,
    paganteCycleLimit: null,
    strategyId: null,
    strategyType: null,
    triggerNumber: null,
    triggerSide: null,
    oppositeNumber: null,
    oppositeSide: null,
    winnerSide: null,
    targetSide: null,
    delayHouses: null,
    samples: null,
    recentGreens: null,
    recentReds: null,
    accuracy: null,
    accuracyLabel: null,
    sampleLabel: null,
    strength: null,
    maxAttempt: null,
    cycleStatus: null,
    attempt: null,
    triggerRoundId: null,
    entryRoundId: null,
    g1RoundId: null,
    result: null,
    tieMultiplier: null,
    formationCandidates: null,
    updatedAt: null,
    blocked: null,
    blockReason: null,
    isSaturated: null,
    isRedAlert: null,
    postTie: null,
  };
}
