import { CircleHelp, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { dashboardSideChipClass, dashboardSideTextClass } from "@/lib/sideColors";
import { DASHBOARD_MODULE_CARD_ROOT } from "@/components/dashboard/dashboardModuleCardLayout";
import { buildNeuralCopy } from "@/lib/operationalCopy";
import { calculateMotorAssertiveness } from "@/utils/assertiveness";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type {
  NeuralEntryLastResult,
  NeuralEntryState,
  NeuralReading,
  NeuralScoreboard,
  Round,
  SignalSide,
} from "@/types/dashboard";

type NeuralSide = SignalSide | "TIE";
type NeuralEntryDisplayKind = "green" | "red" | "tie";

interface NeuralEntryDisplayResult {
  kind: NeuralEntryDisplayKind;
  side: NeuralSide;
  multiplier?: number | null;
  minute: string;
}

interface NeuralEntryHistoryItem extends NeuralEntryDisplayResult {
  id: string;
}

interface NeuralScoreSummary {
  totalAlerts: number | null;
  greens: number | null;
  sg: number | null;
  g1: number | null;
  reds: number | null;
  total: number;
  accuracy: number | null;
  currentGreenSequence: number | null;
  currentRedSequence: number | null;
  maxGreenSequence: number | null;
  maxRedSequence: number | null;
}

type LeituraNeuralClassicCardProps = NeuralReading & {
  className?: string;
  greenFlash?: boolean;
  neuralScoreboard?: NeuralScoreboard;
  rounds?: Round[];
  neuralEntryState?: NeuralEntryState | null;
  neuralEntryLastResult?: NeuralEntryLastResult | null;
};

export type { LeituraNeuralClassicCardProps };

const TIE_MULTIPLIER_LABELS = ["4x", "6x", "10x", "25x", "88x"] as const;
const NEURAL_ENTRY_HISTORY_STORAGE_KEY = "sniper_neural_entry_history_official_v2";
const MAX_NEURAL_ENTRY_HISTORY = 100;

const SCANNING_READING: NeuralReading = {
  mode: "SCANNING",
  numero: null,
  origem: null,
  direcao: null,
  validade: null,
  alertas: null,
  acertos: null,
  greenSemGale: null,
  greenG1: null,
  erros: null,
  assertividade: null,
};

export function LeituraNeuralClassicCard({
  className,
  greenFlash = false,
  neuralScoreboard,
  rounds,
  neuralEntryState,
  neuralEntryLastResult,
  ...reading
}: LeituraNeuralClassicCardProps) {
  const data = { ...SCANNING_READING, ...reading };
  const mode = data.mode ?? "SCANNING";
  const hasNumber = typeof data.numero === "number" && Boolean(data.origem);
  const sg = optionalNumberFrom(data.greenSemGale);
  const g1 = optionalNumberFrom(data.greenG1);
  const red = optionalNumberFrom(data.reds ?? data.erros);
  const totalGreens = totalGreensFrom(data.acertos, data.greenSemGale, data.greenG1);
  const totalAlerts = totalFrom(data.alertas, data.acertos, data.erros);
  const accuracy = accuracyFrom(data.assertividade, data.acertos, data.erros);
  const resolvedTotal = numberFrom(totalGreens) + numberFrom(red);
  const showPayingStats = hasNumber || totalGreens !== null || accuracy !== null || totalAlerts !== null;
  const alertTone = data.isRedAlert ? "red" : data.isSaturated ? "yellow" : "cyan";
  const postTie = Boolean(data.postTie);
  const originKind = neuralOriginKind(data);
  const originBadge = originBadgeFor(originKind);
  const pullingSide = data.direcao ?? data.origem;
  const message = buildNeuralCopy(data);
  const statusKind = neuralStatusKind(data);
  const generalScore = buildGeneralScore(neuralScoreboard, data);
  const tieMultipliers = tieMultiplierStats(rounds);
  const generalScoreState = neuralScoreState(generalScore);
  const sequenceCopy = neuralSequenceCopy(
    numberFrom(generalScore.currentGreenSequence),
    numberFrom(generalScore.currentRedSequence),
    "geral",
  );
  const numberSequenceCopy = neuralSequenceCopy(
    numberFrom(data.sequencePositive),
    numberFrom(data.sequenceNegative),
    "numero",
  );
  const numberStage = numberPaymentStage(sg, g1, red);
  const rawConfirmedEntrySide = mode === "ACTIVE" ? pullingSide : null;
  const confirmedEntrySide = shouldHideResolvedEntry(rawConfirmedEntrySide, neuralEntryLastResult)
    ? null
    : rawConfirmedEntrySide;
  const [entryResult, setEntryResult] = useState<NeuralEntryDisplayResult | null>(null);
  const [entryHistory, setEntryHistory] = useState<NeuralEntryHistoryItem[]>(() => readNeuralEntryHistory());
  const lastOfficialResultRef = useRef<string | null>(null);
  const entryResultTimeoutRef = useRef<number | null>(null);
  const mountedAtRef = useRef(Date.now());

  useEffect(() => {
    const result = displayResultFromOfficialEntry(neuralEntryLastResult);
    if (!result || lastOfficialResultRef.current === result.id) return;

    lastOfficialResultRef.current = result.id;
    if (isOfficialEntryOlderThanSession(neuralEntryLastResult, mountedAtRef.current)) return;

    setEntryResult(result);
    setEntryHistory((items) => {
      if (items.some((item) => item.id === result.id)) return items;
      return [result, ...items].slice(0, MAX_NEURAL_ENTRY_HISTORY);
    });

    if (entryResultTimeoutRef.current) window.clearTimeout(entryResultTimeoutRef.current);
    entryResultTimeoutRef.current = window.setTimeout(
      () => setEntryResult(null),
      result.kind === "red" ? 1100 : 1650,
    );
  }, [neuralEntryLastResult]);

  useEffect(() => {
    writeNeuralEntryHistory(entryHistory);
  }, [entryHistory]);

  useEffect(() => {
    return () => {
      if (entryResultTimeoutRef.current) window.clearTimeout(entryResultTimeoutRef.current);
    };
  }, []);

  return (
    <aside
      className={cn(
        "neural-mini-card relative z-10 flex w-full shrink-0 flex-col overflow-visible rounded-xl border border-neon-cyan/25 bg-[#071020]/78 px-2.5 py-2 text-left shadow-[0_0_24px_-18px_var(--neon-cyan)] backdrop-blur-xl",
        DASHBOARD_MODULE_CARD_ROOT,
        confirmedEntrySide && sideBorderClass(confirmedEntrySide),
        greenFlash && "result-green-flash",
        entryResult?.kind === "red" && "neural-entry-flash-red",
        entryResult?.kind === "tie" && "neural-entry-flash-tie",
        entryResult?.kind === "green" && "neural-entry-flash-green",
        className,
      )}
      aria-label="Leitura neural de números pagantes"
      title={message}
    >
      <div className="absolute inset-0 neural-mini-grid opacity-40" />
      <div className="absolute -right-5 -top-6 size-16 rounded-full bg-neon-purple/15 blur-2xl" />
      <div className="absolute -bottom-6 -left-5 size-16 rounded-full bg-neon-cyan/15 blur-2xl" />
      <NeuralGeneralScorePopover
        score={generalScore}
        scoreState={generalScoreState}
        statusKind={statusKind}
        statusLabel={statusLabel(data)}
        reading={data}
      />
      <span className="absolute inset-x-0 top-0 h-px neural-mini-shimmer" />

      <div className="relative flex items-center gap-1.5">
        <AssistantOrb />
        <div className="min-w-0">
          <div className="truncate text-[8px] font-black uppercase tracking-[0.14em] text-gradient-brand sm:text-[9px]">
            Leitura Neural
          </div>
          <div className="truncate text-[7px] font-bold uppercase tracking-[0.1em] text-neon-cyan/75 sm:text-[8px]">
            {originKind === "OPOSTO" ? "numero oposto" : postTie ? "cor pos-empate" : "numero pagante"}
          </div>
        </div>
      </div>

      {!hasNumber ? (
        <div className="relative mt-2">
          <div className="line-clamp-2 text-[10px] font-semibold leading-snug text-foreground/85 sm:text-[11px]">
            IA procurando números pagantes...
          </div>
          <TypingDots />
          <div
            className={cn(
              "mt-1.5 inline-flex max-w-full rounded-full border px-1.5 py-0.5 text-[6.5px] font-black uppercase leading-tight tracking-[0.08em] sm:text-[7px]",
              sequenceCopy.className,
            )}
            title={sequenceCopy.title}
          >
            <span className="max-w-full whitespace-normal break-words">{sequenceCopy.label}</span>
          </div>
          <TieMultiplierMiniLine multipliers={tieMultipliers} />
          <div className="mt-1.5">
            <NeuralEntryStatusCard
              confirmedSide={null}
              result={entryResult}
              history={entryHistory}
            />
          </div>
        </div>
      ) : (
        <div className="relative mt-2 space-y-1">
          <NeuralEntryStatusCard
            confirmedSide={confirmedEntrySide}
            result={entryResult}
            history={entryHistory}
          />

          <div className="flex flex-wrap items-center gap-1">
            <span className="flex min-w-0 items-baseline gap-1">
              <span className="text-lg font-black leading-none text-foreground sm:text-xl">
                {data.origem === "TIE" ? `${data.numero}x${data.numero}` : data.numero}
              </span>
              <span className={cn("truncate text-[11px] font-extrabold", sideClass(data.origem))}>
                {sideLabel(data.origem)}
              </span>
            </span>
            <span
              className={cn(
                "rounded-full border px-1.5 py-0.5 text-[7px] font-black uppercase leading-none tracking-[0.08em]",
                originBadge.className,
              )}
            >
              {originBadge.label}
            </span>
          </div>

          {pullingSide ? (
            <div className="truncate text-[10px] font-bold text-muted-foreground sm:text-[11px]">
              <span className="text-neon-cyan">
                {originKind === "OPOSTO" ? "Numero oposto puxando" : postTie ? "Cor pos-empate" : "Puxando"}
              </span>{" "}
              <span className={sideClass(pullingSide)}>{sideLabel(pullingSide)}</span>{" "}
              <span className="text-[9px] text-muted-foreground/85">até {data.validade ?? "G1"}</span>
            </div>
          ) : (
            <div className="truncate text-[10px] font-semibold text-muted-foreground">
              Em observação pagante
            </div>
          )}

          {showPayingStats ? (
            <div className="rounded-lg border border-neon-cyan/15 bg-background/35 px-1.5 py-1">
              <div className="truncate text-[7px] font-black uppercase tracking-[0.1em] text-neon-cyan/85">
                Numero atual
              </div>
              <div className="flex items-baseline justify-between gap-1">
                <span className="text-[7px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                  {originKind === "OPOSTO"
                    ? "Oposto"
                    : postTie
                      ? "Pos-empate"
                      : typeof data.numero === "number"
                        ? `Número ${data.numero}`
                        : "Pagando"}
                </span>
                <span className="text-[11px] font-black text-neon-cyan">
                  {formatPercent(accuracy)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-1">
                <span className="truncate text-[8px] font-semibold text-muted-foreground sm:text-[9px]">
                  SG:{formatCount(sg, true)} G1:{formatCount(g1, true)} RD:{formatCount(red, true)}
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-1 py-0.5 text-[6.5px] font-black uppercase leading-none tracking-[0.06em]",
                    numberStage.className,
                  )}
                  title={numberStage.title}
                >
                  {numberStage.label}
                </span>
              </div>
              <div
                className={cn(
                  "mt-1 rounded-full border px-1.5 py-0.5 text-[6.5px] font-black uppercase leading-tight tracking-[0.08em] sm:text-[7px]",
                  numberSequenceCopy.className,
                )}
                title={numberSequenceCopy.title}
              >
                {numberSequenceCopy.label}
              </div>
              <div className="my-1 h-px bg-neon-cyan/10" />
              <div className="truncate text-[7px] font-black uppercase tracking-[0.1em] text-neon-cyan/85">
                Placar geral
              </div>
              <div className="truncate text-[7.5px] font-black uppercase tracking-[0.04em] text-foreground/90 sm:text-[8px]">
                SG:{formatCount(generalScore.sg, true)} G1:{formatCount(generalScore.g1, true)} RD:{formatCount(generalScore.reds, true)}
              </div>
              <div className="truncate text-[7.5px] font-black uppercase tracking-[0.04em] text-muted-foreground sm:text-[8px]">
                SQG:{formatCount(generalScore.maxGreenSequence, true)} SQR:{formatCount(generalScore.maxRedSequence, true)} {formatPercent(generalScore.accuracy)}
              </div>
              <div
                className={cn(
                  "mt-1 rounded-full border px-1.5 py-0.5 text-[6.5px] font-black uppercase leading-tight tracking-[0.08em] sm:text-[7px]",
                  sequenceCopy.className,
                )}
                title={sequenceCopy.title}
              >
                {sequenceCopy.label}
              </div>
              {data.paganteCycleProgress || data.paganteWindow ? (
                <div className="truncate text-[7px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  {data.paganteCycleProgress
                    ? `Ciclo: ${formatCount(numberFrom(data.paganteCycleProgress))}/${formatCount(numberFrom(data.paganteCycleLimit ?? data.paganteWindow))}`
                    : `Janela: ${data.paganteWindow} rodadas`}
                </div>
              ) : null}
              <TieMultiplierMiniLine multipliers={tieMultipliers} />
              {data.paganteStatus && data.paganteStatus !== "VALIDO" ? (
                <div
                  className={cn(
                    "mt-1 truncate rounded-full border px-1.5 py-0.5 text-[7px] font-black uppercase tracking-[0.08em]",
                    alertTone === "red" && "border-destructive/35 bg-destructive/10 text-destructive",
                    alertTone === "yellow" && "border-warning/35 bg-warning/10 text-warning",
                    alertTone === "cyan" && "border-neon-cyan/25 bg-neon-cyan/10 text-neon-cyan",
                  )}
                  title={data.paganteAlert ?? undefined}
                >
                  {data.paganteStatus}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1 text-[9px] font-semibold text-neon-cyan/85">
                <Sparkles className="size-2.5" />
                Observando
              </div>
              <TieMultiplierMiniLine multipliers={tieMultipliers} />
            </div>
          )}
        </div>
      )}
    </aside>
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
    // Local persistence is only a visual convenience; the engine data remains authoritative.
  }
}

function normalizeNeuralEntryHistoryItem(value: unknown): NeuralEntryHistoryItem | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<NeuralEntryHistoryItem>;
  if (!isNeuralEntryResultKind(record.kind) || !isNeuralSide(record.side)) return null;

  const multiplier =
    typeof record.multiplier === "number" && Number.isFinite(record.multiplier)
      ? record.multiplier
      : null;

  return {
    id: typeof record.id === "string" && record.id ? record.id : `restored:${Date.now()}:${Math.random()}`,
    kind: record.kind,
    side: record.side,
    multiplier,
    minute: typeof record.minute === "string" && record.minute ? record.minute : "--",
  };
}

function displayResultFromOfficialEntry(result: NeuralEntryLastResult | null | undefined): NeuralEntryHistoryItem | null {
  if (!result?.id) return null;

  const side = normalizeEntrySide(result.expectedSide ?? result.origem);
  const kind: NeuralEntryDisplayKind =
    result.outcome === "TIE" || result.kind === "tie_sg" || result.kind === "tie_g1"
      ? "tie"
      : result.outcome === "RED" || result.kind === "red"
        ? "red"
        : "green";

  return {
    id: result.id,
    kind,
    side: kind === "tie" ? "TIE" : side,
    multiplier: kind === "tie" ? result.tieMultiplier ?? null : null,
    minute: minuteLabelFromOfficialResult(result),
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
  return isNeuralSide(side) ? side : "TIE";
}

function minuteLabelFromOfficialResult(result: NeuralEntryLastResult) {
  const roundKeyMinute = minuteLabelFromTimeText(result.resultRoundKey);
  if (roundKeyMinute) return roundKeyMinute;

  const finishedMinute = minuteLabelFromIso(result.finishedAt);
  return finishedMinute ?? "--";
}

function minuteLabelFromTimeText(value: unknown) {
  if (typeof value !== "string") return null;
  const match = value.match(/\b\d{1,2}:(\d{2})(?::\d{2})?\b/);
  return match?.[1] ?? null;
}

function minuteLabelFromIso(value: unknown) {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    minute: "2-digit",
  });
}

function isNeuralEntryResultKind(value: unknown): value is NeuralEntryDisplayKind {
  return value === "green" || value === "red" || value === "tie";
}

function isNeuralSide(value: unknown): value is NeuralSide {
  return value === "BANKER" || value === "PLAYER" || value === "TIE";
}

function neuralSequenceCopy(
  sequencePositive: number,
  sequenceNegative: number,
  scope: "numero" | "geral" = "geral",
) {
  const labelPrefix = scope === "numero" ? "Seq numero" : "Seq geral";

  if (sequenceNegative > 0) {
    return {
      label: `${labelPrefix}: ${sequenceNegative} RED ${sequenceNegative === 1 ? "seguido" : "seguidos"}`,
      title: "Sequência atual de reds da Leitura Neural.",
      className: "border-destructive/35 bg-destructive/10 text-destructive",
    };
  }

  if (sequencePositive > 0) {
    return {
      label: `${labelPrefix}: ${sequencePositive} GREEN ${sequencePositive === 1 ? "seguido" : "seguidos"}`,
      title: "Sequência atual de greens da Leitura Neural.",
      className: "border-success/35 bg-success/10 text-success",
    };
  }

  return {
    label: `${labelPrefix}: aguardando`,
    title: "Aguardando resultado real da Leitura Neural.",
    className: "border-neon-cyan/20 bg-neon-cyan/10 text-neon-cyan",
  };
}

function NeuralEntryStatusCard({
  confirmedSide,
  result,
  history,
}: {
  confirmedSide?: NeuralSide | null;
  result: NeuralEntryDisplayResult | null;
  history: NeuralEntryHistoryItem[];
}) {
  const state = neuralEntryStatusState(confirmedSide, result);

  return (
    <div
      className={cn(
        "rounded-lg border px-2 py-1.5 text-center shadow-[0_0_18px_-16px_currentColor]",
        state.className,
      )}
    >
      <div className="text-[7px] font-black uppercase tracking-[0.14em] opacity-80">
        {state.kicker}
      </div>
      <div className={cn("mt-0.5 text-base font-black uppercase leading-none", state.sideClass)}>
        {state.label}
      </div>
      {state.description ? (
        <div className="mt-1 text-[8px] font-semibold leading-tight text-muted-foreground">
          {state.description}
        </div>
      ) : null}

      <details className="group mt-1 text-left">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[6.5px] font-black uppercase tracking-[0.08em] text-muted-foreground/80 transition hover:text-neon-cyan">
          <span>Ultimas entradas</span>
          <span className="text-[8px] leading-none transition group-open:rotate-90">&gt;</span>
        </summary>
        <div className="mt-0.5 max-h-28 space-y-0.5 overflow-y-auto pr-1">
          {history.length ? (
            history.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-1 text-[7px] font-semibold leading-tight"
              >
                <span className="min-w-0 truncate">
                  <span className={sideClass(item.side)}>
                    {entrySideSymbol(item.side)} {entrySideHistoryLabel(item)}
                  </span>{" "}
                  <span className={item.kind === "red" ? "text-destructive" : "text-success"}>
                    {entryResultHistoryLabel(item)}
                  </span>
                </span>
                <span className="shrink-0 text-[6.5px] text-muted-foreground/75">Min {item.minute}</span>
              </div>
            ))
          ) : (
            <div className="text-[7px] font-semibold text-muted-foreground/75">
              Sem entradas recentes.
            </div>
          )}
        </div>
      </details>
    </div>
  );
}

function neuralEntryStatusState(
  confirmedSide?: NeuralSide | null,
  result?: NeuralEntryDisplayResult | null,
) {
  if (result?.kind === "red") {
    return {
      kicker: "Resultado",
      label: "RED",
      description: null,
      sideClass: "text-destructive",
      className: "neural-entry-flash-red border-destructive/35 bg-destructive/10 text-destructive",
    };
  }

  if (result?.kind === "tie") {
    return {
      kicker: "Resultado",
      label: `GREEN EMPATE ${result.multiplier ? `${result.multiplier}X` : ""}`.trim(),
      description: null,
      sideClass: "text-tie",
      className: "neural-entry-flash-tie border-tie/40 bg-tie/10 text-tie",
    };
  }

  if (result?.kind === "green") {
    return {
      kicker: "Resultado",
      label: `GREEN ${sideLabel(result.side)}`,
      description: null,
      sideClass: sideClass(result.side),
      className: "neural-entry-flash-green border-success/35 bg-success/10 text-success",
    };
  }

  if (confirmedSide) {
    return {
      kicker: "Entrada confirmada",
      label: confirmedSide === "TIE" ? "POSSIVEL TIE" : `ENTRAR ${sideLabel(confirmedSide).toUpperCase()}`,
      description: null,
      sideClass: sideClass(confirmedSide),
      className: dashboardSideChipClass(confirmedSide),
    };
  }

  return {
    kicker: "Aguardando entrada",
    label: "Sem entrada",
    description: "Sem entrada confirmada agora.",
    sideClass: "text-muted-foreground",
    className: "border-white/10 bg-background/35 text-muted-foreground",
  };
}

function entrySideSymbol(side: NeuralSide) {
  if (side === "BANKER") return "B";
  if (side === "PLAYER") return "P";
  return "T";
}

function entrySideHistoryLabel(item: NeuralEntryHistoryItem) {
  if (item.kind === "tie") return `EMPATE ${item.multiplier ? `${item.multiplier}X` : ""}`.trim();
  return sideLabel(item.side).toUpperCase();
}

function entryResultHistoryLabel(item: NeuralEntryHistoryItem) {
  if (item.kind === "red") return "RED";
  return "GREEN";
}

function NeuralGeneralScorePopover({
  score,
  scoreState,
  statusKind,
  statusLabel,
  reading,
}: {
  score: NeuralScoreSummary;
  scoreState: ReturnType<typeof neuralScoreState>;
  statusKind: "green" | "amber" | "red" | "muted";
  statusLabel: string;
  reading: NeuralReading;
}) {
  const insight = neuralToolInsight(reading);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "absolute right-1.5 top-1.5 z-10 grid size-6 place-items-center rounded-full border bg-background/75 text-muted-foreground shadow-sm backdrop-blur transition hover:border-neon-cyan/45 hover:text-neon-cyan",
            statusButtonClass(statusKind),
          )}
          aria-label="Abrir placar geral da Leitura Neural"
          title="Placar geral da Leitura Neural"
        >
          <span
            className={cn(
              "absolute right-0.5 top-0.5 size-1.5 rounded-full",
              statusDotClass(statusKind),
            )}
          />
          <CircleHelp className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="left"
        align="start"
        className="w-[268px] rounded-xl border-neon-purple/25 bg-background/95 p-3 shadow-[0_0_30px_-18px_var(--neon-purple)]"
      >
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[9px] font-black uppercase tracking-[0.16em] text-gradient-brand">
                Placar Geral
              </div>
              <div className="mt-0.5 text-[10px] font-semibold text-muted-foreground">
                {statusLabel}
              </div>
              <div className={cn("mt-1 inline-flex rounded-full border px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.1em]", scoreState.className)}>
                {scoreState.label}
              </div>
            </div>
            <div className={cn("rounded-full border px-2 py-0.5 text-[9px] font-black", statusPillClass(statusKind))}>
              {formatPercent(score.accuracy)}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <ScoreBox label="Green geral" value={score.greens} tone="green" />
            <ScoreBox label="RED geral" value={score.reds} tone="red" />
            <ScoreBox label="SG geral" value={score.sg} tone="green" />
            <ScoreBox label="G1 geral" value={score.g1} tone="cyan" />
            <ScoreBox label="Alertas" value={score.totalAlerts} tone="neutral" />
            <ScoreBox label="Total" value={score.total} tone="neutral" />
            <ScoreBox label="Seq Green" value={score.currentGreenSequence ?? "coletando"} tone="green" />
            <ScoreBox label="Seq RED" value={score.currentRedSequence ?? "coletando"} tone="red" />
            <ScoreBox label="SQG max" value={score.maxGreenSequence ?? "coletando"} tone="green" />
            <ScoreBox label="SQR max" value={score.maxRedSequence ?? "coletando"} tone="red" />
          </div>
          <div className="space-y-2 rounded-lg border border-neon-cyan/15 bg-neon-cyan/5 px-2 py-2 text-[10px] leading-relaxed text-muted-foreground">
            <div>
              <span className="font-black uppercase tracking-[0.1em] text-neon-cyan">Para que serve: </span>
              mostra se o número pagante está puxando Banker, Player ou Tie.
            </div>
            <div>
              <span className="font-black uppercase tracking-[0.1em] text-neon-cyan">Como funciona: </span>
              conta SG, G1 e RED reais da Neural. Não é entrada oficial sozinha.
            </div>
            <div className={cn("rounded-md border px-2 py-1.5 font-black uppercase tracking-[0.08em]", insight.className)}>
              {insight.text}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function TieMultiplierMiniLine({
  multipliers,
}: {
  multipliers: Array<{ label: (typeof TIE_MULTIPLIER_LABELS)[number]; value: number }>;
}) {
  return (
    <div
      className="mt-1 rounded-lg border border-warning/15 bg-warning/5 px-1.5 py-1"
      title="Empates pegos no historico real carregado hoje"
    >
      <div className="mb-0.5 truncate text-[6.5px] font-black uppercase tracking-[0.1em] text-warning/90">
        Empates do dia
      </div>
      <div className="flex flex-wrap items-end gap-x-1.5 gap-y-1">
        {multipliers.map((item) => (
          <span key={item.label} className="inline-flex items-end gap-0.5 leading-none">
            <span className="grid place-items-center">
              <span className="text-[6px] font-black text-warning">{item.label}</span>
              <span className="size-2 rounded-full border border-warning/45 bg-warning shadow-[0_0_8px_-3px_var(--warning)]" />
            </span>
            <span className="text-[7.5px] font-black text-foreground">{item.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function neuralToolInsight(reading: NeuralReading) {
  const side = reading.direcao ?? reading.origem;
  const validity = reading.validade ?? "G1";
  const hasNumber = typeof reading.numero === "number" && Boolean(reading.origem);
  const originKind = neuralOriginKind(reading);
  const trigger =
    hasNumber && reading.origem === "TIE"
      ? `${reading.numero}x${reading.numero} Tie`
      : hasNumber
        ? `${reading.numero} ${sideLabel(reading.origem)}`
        : "";

  if (!hasNumber || !side) {
    return {
      text: "Pela Neural agora: observar. Sem número pagante ativo.",
      className: "border-neon-cyan/20 bg-neon-cyan/10 text-neon-cyan",
    };
  }


  const prefix =
    originKind === "OPOSTO"
      ? `${trigger} em numero oposto.`
      : reading.postTie
        ? `${trigger} pós-empate.`
        : `${trigger} pagante.`;

  return {
    text: `${prefix} Pela Neural agora: ${sideLabel(side)} até ${validity}.`,
    className: dashboardSideChipClass(side),
  };
}

function neuralScoreState(score: NeuralScoreSummary) {
  const hasData = numberFrom(score.totalAlerts) > 0 || score.total > 0;
  if (!hasData) {
    return {
      label: "Coletando",
      className: "border-warning/25 bg-warning/10 text-warning",
    };
  }
  return {
    label: "Dados reais",
    className: "border-success/25 bg-success/10 text-success",
  };
}

function ScoreBox({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string | null;
  tone: "green" | "red" | "cyan" | "neutral";
}) {
  return (
    <div className={cn("rounded-lg border px-2 py-1.5", scoreBoxClass(tone))}>
      <div className="text-[8px] font-bold uppercase tracking-[0.1em] opacity-75">{label}</div>
      <div className="text-sm font-black leading-tight">{typeof value === "string" ? value : formatCount(value)}</div>
    </div>
  );
}

function AssistantOrb() {
  return (
    <div className="relative grid size-6 shrink-0 place-items-center overflow-hidden rounded-full border border-neon-cyan/35 bg-[#020817] shadow-[0_0_18px_-6px_var(--neon-cyan)]">
      <span className="absolute inset-0 rounded-full bg-[conic-gradient(from_180deg,var(--neon-cyan),var(--neon-purple),var(--neon-blue),var(--neon-cyan))] opacity-85 animate-spin [animation-duration:5.5s]" />
      <span className="absolute inset-[3px] rounded-full bg-background/90" />
      <span className="absolute size-3.5 rounded-full bg-[radial-gradient(circle_at_35%_25%,white_0%,var(--neon-cyan)_34%,var(--neon-purple)_70%,transparent_100%)] shadow-[0_0_14px_var(--neon-cyan)] animate-neural-brain" />
      <span className="absolute left-1 top-1 size-1 rounded-full bg-white/90 blur-[1px]" />
    </div>
  );
}

function TypingDots() {
  return (
    <div className="mt-2 flex gap-1" aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="size-1.5 rounded-full bg-neon-cyan animate-neural-dot"
          style={{ animationDelay: `${index * 0.18}s` }}
        />
      ))}
    </div>
  );
}

function totalFrom(
  alertas?: number | null,
  acertos?: number | null,
  erros?: number | null,
) {
  if (typeof acertos === "number" || typeof erros === "number") {
    return (acertos ?? 0) + (erros ?? 0);
  }
  return typeof alertas === "number" ? alertas : null;
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

function totalGreensFrom(
  acertos?: number | null,
  greenSemGale?: number | null,
  greenG1?: number | null,
) {
  if (typeof acertos === "number" && Number.isFinite(acertos)) return acertos;
  const sg = optionalNumberFrom(greenSemGale);
  const g1 = optionalNumberFrom(greenG1);
  if (sg === null && g1 === null) return null;
  return numberFrom(sg) + numberFrom(g1);
}

function buildGeneralScore(
  scoreboard: NeuralScoreboard | undefined,
  fallbackReading: NeuralReading,
): NeuralScoreSummary {
  const sg = optionalNumberFrom(scoreboard?.greenSemGale ?? fallbackReading.greenSemGale);
  const g1 = optionalNumberFrom(scoreboard?.greenG1 ?? fallbackReading.greenG1);
  const hasSplitGreens = sg !== null || g1 !== null;
  const splitGreens = hasSplitGreens ? numberFrom(sg) + numberFrom(g1) : null;
  const greens = optionalNumberFrom(
    splitGreens ??
      scoreboard?.greens ??
      scoreboard?.acertos ??
      fallbackReading.acertos ??
      fallbackReading.greenSemGale,
  );
  const reds = optionalNumberFrom(scoreboard?.reds ?? scoreboard?.erros ?? fallbackReading.reds ?? fallbackReading.erros);
  const total = numberFrom(greens) + numberFrom(reds);
  const totalAlerts = optionalNumberFrom(scoreboard?.totalAlerts ?? fallbackReading.alertas ?? total) ?? total;
  const accuracy = accuracyFrom(null, greens, reds) ?? optionalNumberFrom(scoreboard?.assertividade ?? fallbackReading.assertividade);
  const currentGreenSequence = optionalPositiveNumberFrom(scoreboard?.sequencePositive ?? fallbackReading.sequencePositive);
  const currentRedSequence = optionalPositiveNumberFrom(scoreboard?.sequenceNegative ?? fallbackReading.sequenceNegative);
  const maxGreenSequence = optionalPositiveNumberFrom(scoreboard?.maxSequencePositive ?? fallbackReading.maxSequencePositive);
  const maxRedSequence = optionalPositiveNumberFrom(scoreboard?.maxSequenceNegative ?? fallbackReading.maxSequenceNegative);

  return {
    totalAlerts,
    greens,
    sg,
    g1,
    reds,
    total,
    accuracy,
    currentGreenSequence,
    currentRedSequence,
    maxGreenSequence,
    maxRedSequence,
  };
}

function tieMultiplierStats(rounds: Round[] | undefined) {
  const counts = new Map<(typeof TIE_MULTIPLIER_LABELS)[number], number>(
    TIE_MULTIPLIER_LABELS.map((label) => [label, 0]),
  );

  for (const round of rounds ?? []) {
    if (round.result !== "T") continue;
    const multiplier = multiplierForTieRound(round);
    if (!multiplier) continue;
    const label = `${multiplier}x` as (typeof TIE_MULTIPLIER_LABELS)[number];
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return TIE_MULTIPLIER_LABELS.map((label) => ({
    label,
    value: counts.get(label) ?? 0,
  }));
}

function multiplierForTieRound(round: Round) {
  const explicit = normalizeTieMultiplier(round.tieMultiplier);
  if (explicit) return explicit;
  if (round.bankerScore !== round.playerScore) return null;

  const score = Math.round(Number(round.bankerScore));
  if (!Number.isFinite(score)) return null;
  if (score === 2 || score === 12) return 88;
  if (score === 3 || score === 11) return 25;
  if (score === 4 || score === 10) return 10;
  if (score === 5 || score === 9) return 6;
  if (score === 6 || score === 7 || score === 8) return 4;
  return null;
}

function normalizeTieMultiplier(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const rounded = Math.round(numeric);
  return [4, 6, 10, 25, 88].includes(rounded) ? rounded : null;
}

function numberPaymentStage(sg: number | null, g1: number | null, red: number | null) {
  const greens = numberFrom(sg) + numberFrom(g1);
  const losses = numberFrom(red);

  if (losses >= 2) {
    return {
      label: "Bloqueado",
      title: "Esse numero tomou 2 reds e saiu da linha.",
      className: "border-destructive/35 bg-destructive/10 text-destructive",
    };
  }

  if (greens <= 3 && losses === 0) {
    return {
      label: "Novo",
      title: "Comecou a pagar agora.",
      className: "border-neon-cyan/25 bg-neon-cyan/10 text-neon-cyan",
    };
  }

  if (greens >= 8 && losses === 0) {
    return {
      label: "Esticado",
      title: "Ja pagou bastante sem red. Entrar com mais cautela.",
      className: "border-warning/35 bg-warning/10 text-warning",
    };
  }

  if (greens >= 8) {
    return {
      label: "Maduro",
      title: "Ja tem bastante leitura validada.",
      className: "border-warning/30 bg-warning/10 text-warning",
    };
  }

  return {
    label: "Pagando",
    title: "Numero pagante com validacao ativa.",
    className: "border-success/30 bg-success/10 text-success",
  };
}

function optionalNumberFrom(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function optionalPositiveNumberFrom(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function numberFrom(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function neuralOriginKind(reading: NeuralReading) {
  if (reading.postTie || reading.origem === "TIE") return "TIE";
  return reading.origemTipo ?? "PAGANTE";
}

function originBadgeFor(kind: NonNullable<NeuralReading["origemTipo"]>) {
  if (kind === "OPOSTO") {
    return {
      label: "Oposto",
      className: "border-warning/35 bg-warning/10 text-warning",
    };
  }
  if (kind === "TIE") {
    return {
      label: "Tie",
      className: "border-tie/35 bg-tie/10 text-tie",
    };
  }
  return {
    label: "Pagante",
    className: "border-success/35 bg-success/10 text-success",
  };
}

function formatPercent(value: number | null) {
  if (value === null) return "--";
  return `${value.toFixed(1).replace(".", ",")}%`;
}

function formatCount(value: number | null, pad = false) {
  if (value === null) return "--";
  return pad && value >= 0 && value < 10 ? `0${value}` : String(value);
}

function neuralStatusKind(reading: NeuralReading): "green" | "amber" | "red" | "muted" {
  if (typeof reading.numero !== "number") return "muted";

  const status = normalizeStatus(reading.paganteStatus);
  if (
    reading.isRedAlert ||
    reading.isSaturated ||
    status.includes("RISCO") ||
    status.includes("ESTICADO") ||
    status.includes("RED") ||
    status.includes("FALH")
  ) {
    return "red";
  }

  if (
    reading.mode === "OBSERVING" ||
    status.includes("INICIANTE") ||
    status.includes("OBSERV") ||
    status.includes("AGUARD") ||
    status.includes("POS-EMPATE") ||
    status.includes("POS EMPATE")
  ) {
    return "amber";
  }

  if (
    reading.mode === "ACTIVE" &&
    (status === "" ||
      status.includes("VALID") ||
      status.includes("GREEN") ||
      status.includes("CONFIRM") ||
      status.includes("FAVOR"))
  ) {
    return "green";
  }

  return "amber";
}

function statusLabel(reading: NeuralReading) {
  if (typeof reading.numero !== "number") return "Procurando pagante";
  const status = reading.paganteStatus?.trim();
  if (status) return status.toLocaleLowerCase("pt-BR").replace(/_/g, " ");
  if (neuralStatusKind(reading) === "green") return "leitura batendo";
  return "em observação";
}

function normalizeStatus(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/_/g, " ");
}

function statusButtonClass(status: "green" | "amber" | "red" | "muted") {
  if (status === "green") return "border-success/30 text-success";
  if (status === "red") return "border-destructive/35 text-destructive";
  if (status === "amber") return "border-warning/35 text-warning";
  return "border-white/10 text-muted-foreground";
}

function statusDotClass(status: "green" | "amber" | "red" | "muted") {
  if (status === "green") return "bg-success shadow-[0_0_10px_var(--success)]";
  if (status === "red") return "bg-destructive shadow-[0_0_10px_var(--destructive)]";
  if (status === "amber") return "bg-warning shadow-[0_0_10px_var(--warning)]";
  return "bg-muted-foreground/55";
}

function statusPillClass(status: "green" | "amber" | "red" | "muted") {
  if (status === "green") return "border-success/25 bg-success/10 text-success";
  if (status === "red") return "border-destructive/30 bg-destructive/10 text-destructive";
  if (status === "amber") return "border-warning/25 bg-warning/10 text-warning";
  return "border-white/10 bg-white/5 text-muted-foreground";
}

function scoreBoxClass(tone: "green" | "red" | "cyan" | "neutral") {
  if (tone === "green") return "border-success/25 bg-success/10 text-success";
  if (tone === "red") return "border-destructive/30 bg-destructive/10 text-destructive";
  if (tone === "cyan") return "border-neon-cyan/25 bg-neon-cyan/10 text-neon-cyan";
  return "border-white/10 bg-white/5 text-muted-foreground";
}

function sideLabel(side?: NeuralSide | null) {
  if (side === "BANKER") return "Banker";
  if (side === "PLAYER") return "Player";
  if (side === "TIE") return "Empate";
  return "";
}

function sideClass(side?: NeuralSide | null) {
  return dashboardSideTextClass(side);
}

function sideBorderClass(side: NeuralSide) {
  if (side === "BANKER") return "border-banker/35 shadow-[0_0_28px_-18px_var(--banker)]";
  if (side === "PLAYER") return "border-player/35 shadow-[0_0_28px_-18px_var(--player)]";
  return "border-tie/35 shadow-[0_0_28px_-18px_var(--tie)]";
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
  return Date.now() - finishedAt < 90000;
}
