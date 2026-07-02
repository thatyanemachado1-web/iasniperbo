import { ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { GlassCard } from "@/components/ui-app/GlassCard";
import {
  DASHBOARD_MODULE_CARD_BODY,
  DASHBOARD_MODULE_CARD_FILL,
  DASHBOARD_MODULE_CARD_ROOT,
} from "@/components/dashboard/dashboardModuleCardLayout";
import { MobileCardDetailsTrigger } from "@/components/dashboard/MobileCardDetailsTrigger";
import { cn } from "@/lib/utils";
import {
  dashboardSideBorderClass,
  dashboardSidePanelClass,
  dashboardSideTextClass,
} from "@/lib/sideColors";
import { calculateMotorAssertiveness } from "@/utils/assertiveness";
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
}

interface NeuralEntryHistoryItem extends NeuralEntryDisplayResult {
  id: string;
  minute: string;
}

type LeituraNeuralCardProps = NeuralReading & {
  className?: string;
  greenFlash?: boolean;
  tieFlash?: boolean;
  redFlash?: boolean;
  essentialOnly?: boolean;
  neuralScoreboard?: NeuralScoreboard;
  rounds?: Round[];
  neuralEntryState?: NeuralEntryState | null;
  neuralEntryLastResult?: NeuralEntryLastResult | null;
};

export type { LeituraNeuralCardProps };

const SCANNING_READING: NeuralReading = { mode: "SCANNING" };
const NEURAL_ENTRY_HISTORY_STORAGE_KEY = "sniper_neural_entry_history_official_v2";
const MAX_NEURAL_ENTRY_HISTORY = 100;
const VISIBLE_ENTRY_HISTORY = 6;

export function LeituraNeuralMiniCard({
  className,
  greenFlash = false,
  tieFlash = false,
  redFlash = false,
  essentialOnly = false,
  neuralScoreboard,
  rounds,
  neuralEntryState,
  neuralEntryLastResult,
  ...reading
}: LeituraNeuralCardProps) {
  const data = { ...SCANNING_READING, ...reading };
  const mode = data.mode ?? "SCANNING";
  const hasNumber = typeof data.numero === "number" && Boolean(data.origem);
  const pullingSide = data.direcao ?? data.origem;
  const confirmedSide = mode === "ACTIVE" ? pullingSide : null;
  const generalScore = buildGeneralScore(neuralScoreboard, data);
  const accuracy = accuracyFrom(data.assertividade, data.acertos, data.erros);
  const view = buildNeuralView(data, hasNumber, confirmedSide, accuracy, generalScore, mode);

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
      const historyItem = displayHistoryFromOfficialEntry(neuralEntryLastResult);
      if (!historyItem || items.some((item) => item.id === historyItem.id)) return items;
      return [historyItem, ...items].slice(0, MAX_NEURAL_ENTRY_HISTORY);
    });
    if (entryResultTimeoutRef.current) window.clearTimeout(entryResultTimeoutRef.current);
    entryResultTimeoutRef.current = window.setTimeout(
      () => setEntryResult(null),
      result.kind === "red" ? 1600 : 3200,
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

  const resultView = entryResult ? buildEntryResultView(entryResult) : null;

  return (
    <GlassCard
      className={cn(
        "digital-risk-card border-white/10 p-2 sm:p-2",
        DASHBOARD_MODULE_CARD_ROOT,
        view.borderClass,
        greenFlash && "result-green-flash",
        tieFlash && "result-tie-flash",
        redFlash && "result-red-flash",
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
            <div className={cn("text-lg font-black uppercase leading-none", resultView.actionClass)}>
              {resultView.action}
            </div>
            <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {resultView.headline}
            </div>
          </div>
        ) : (
          <div className={cn("rounded-xl border px-3 py-2.5 text-center", view.panelClass)}>
            <div className={cn("text-lg font-black uppercase leading-none", view.actionClass)}>{view.action}</div>
            {!essentialOnly && (
              <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {view.headline}
              </div>
            )}
          </div>
        )}

        {essentialOnly ? (
          <MobileCardDetailsTrigger
            title="Leitura Neural"
            description="Placar, histórico e leitura ativa do módulo neural."
          >
            <div className="grid grid-cols-2 gap-1.5 text-center sm:grid-cols-3">
              <NeuralStatChip label="Força" value={view.strengthLabel} tone={view.strengthTone} />
              <NeuralStatChip
                label="Número"
                value={hasNumber ? formatNeuralNumber(data) : "--"}
                tone={hasNumber ? view.numberTone : "muted"}
              />
              <NeuralStatChip label="Validade" value={data.validade ?? "G1"} tone="muted" />
            </div>
            <div className="rounded-lg border border-white/10 bg-background/20 px-2 py-1.5 text-[9px] text-muted-foreground">
              <div className="font-black uppercase tracking-[0.08em] text-muted-foreground">
                Placar geral · reseta 00:00 (BR)
              </div>
              <div className="mt-0.5 font-semibold text-foreground">
                SG {formatCount(generalScore.sg)} · G1 {formatCount(generalScore.g1)} · RD{" "}
                {formatCount(generalScore.reds)} · {formatPercent(generalScore.accuracy)}
              </div>
            </div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {view.headline}
            </div>
            {hasNumber && pullingSide ? (
              <div className="rounded-lg border border-white/10 bg-background/20 px-2 py-1.5 text-[9px]">
                <div className="font-black uppercase tracking-[0.08em] text-muted-foreground">Leitura ativa</div>
                <div className="mt-0.5 font-semibold text-foreground">
                  <span className={sideClass(data.origem)}>{formatNeuralNumber(data)}</span>
                  {" · puxando "}
                  <span className={sideClass(pullingSide)}>{sideLabel(pullingSide)}</span>
                  {data.origemTipo === "OPOSTO" ? " · gatilho oposto" : data.postTie ? " · pós-empate" : ""}
                </div>
              </div>
            ) : null}
            {neuralEntryState?.expectedSide && !entryResult ? (
              <div className="rounded-lg border border-white/10 bg-background/20 px-2 py-1 text-[9px] text-muted-foreground">
                Entrada oficial:{" "}
                <span className={sideClass(neuralEntryState.expectedSide)}>
                  {sideLabel(neuralEntryState.expectedSide)}
                </span>
              </div>
            ) : null}
            <NeuralEntryHistoryList history={entryHistory} expanded />
          </MobileCardDetailsTrigger>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-1.5 text-center sm:grid-cols-3">
              <NeuralStatChip label="Força" value={view.strengthLabel} tone={view.strengthTone} />
              <NeuralStatChip
                label="Número"
                value={hasNumber ? formatNeuralNumber(data) : "--"}
                tone={hasNumber ? view.numberTone : "muted"}
              />
              <NeuralStatChip label="Validade" value={data.validade ?? "G1"} tone="muted" />
            </div>

            <div className="rounded-lg border border-white/10 bg-background/20 px-2 py-1.5 text-[9px] text-muted-foreground">
              <div className="font-black uppercase tracking-[0.08em] text-muted-foreground">
                Placar geral · reseta 00:00 (BR)
              </div>
              <div className="mt-0.5 font-semibold text-foreground">
                SG {formatCount(generalScore.sg)} · G1 {formatCount(generalScore.g1)} · RD{" "}
                {formatCount(generalScore.reds)} · {formatPercent(generalScore.accuracy)}
              </div>
            </div>

            {hasNumber && pullingSide ? (
              <div className="rounded-lg border border-white/10 bg-background/20 px-2 py-1.5 text-[9px]">
                <div className="font-black uppercase tracking-[0.08em] text-muted-foreground">Leitura ativa</div>
                <div className="mt-0.5 font-semibold text-foreground">
                  <span className={sideClass(data.origem)}>{formatNeuralNumber(data)}</span>
                  {" · puxando "}
                  <span className={sideClass(pullingSide)}>{sideLabel(pullingSide)}</span>
                  {data.origemTipo === "OPOSTO" ? " · gatilho oposto" : data.postTie ? " · pós-empate" : ""}
                </div>
              </div>
            ) : null}

            {neuralEntryState?.expectedSide && !entryResult ? (
              <div className="rounded-lg border border-white/10 bg-background/20 px-2 py-1 text-[9px] text-muted-foreground">
                Entrada oficial:{" "}
                <span className={sideClass(neuralEntryState.expectedSide)}>
                  {sideLabel(neuralEntryState.expectedSide)}
                </span>
              </div>
            ) : null}

            <NeuralEntryHistoryList history={entryHistory} />
          </>
        )}
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
) {
  const strengthLabel = accuracy !== null ? `${Math.round(accuracy)}%` : formatPercent(generalScore.accuracy);
  const validity = data.validade ?? "G1";
  const originKind = neuralOriginKind(data);

  if (data.isRedAlert || (data.isSaturated && neuralStatusKind(data) === "red")) {
    return {
      badge: "Risco alto",
      badgeTone: "red" as const,
      pulse: false,
      action: "Não seguir",
      headline: data.paganteAlert ?? "Número esticado ou em risco elevado",
      actionClass: "text-destructive",
      panelClass: "border-destructive/35 bg-destructive/10",
      borderClass: "border-destructive/30",
      strengthLabel,
      strengthTone: "red" as const,
      numberTone: "muted" as const,
    };
  }

  if (confirmedSide && hasNumber) {
    return {
      badge: originKind === "OPOSTO" ? "Oposto" : data.postTie ? "Pós-empate" : "Pagante",
      badgeTone: "green" as const,
      pulse: true,
      action: `Entrar ${sideLabel(confirmedSide).toUpperCase()}`,
      headline: `${formatNeuralNumber(data)} · até ${validity} · ${strengthLabel}`,
      actionClass: sideActionClass(confirmedSide),
      panelClass: dashboardSidePanelClass(confirmedSide),
      borderClass: dashboardSideBorderClass(confirmedSide),
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
      headline: "Número apareceu · aguardando confirmação da engine",
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
      headline: "Número detectado · sem entrada confirmada agora",
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
    headline: "IA procurando números pagantes no ciclo atual",
    actionClass: "text-muted-foreground",
    panelClass: "border-border/60 bg-secondary/20",
    borderClass: "border-border/50",
    strengthLabel,
    strengthTone: "muted" as const,
    numberTone: "muted" as const,
  };
}

function NeuralEntryHistoryList({
  history,
  expanded = false,
}: {
  history: NeuralEntryHistoryItem[];
  expanded?: boolean;
}) {
  const visible = history.slice(0, VISIBLE_ENTRY_HISTORY);
  const latest = history[0];
  const summaryHint = latest
    ? `${entrySideHistoryLabel(latest)} ${entryResultLabel(latest.kind)}`
    : "sem entradas";

  if (expanded) {
    return (
      <div className="rounded-lg border border-white/8 bg-background/12 px-2 py-1.5">
        <div className="text-[8px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/75">
          Entradas recentes
        </div>
        <div className="mt-1">
          {visible.length ? (
            <div className="max-h-32 space-y-0.5 overflow-y-auto pr-0.5">
              {visible.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-1 rounded-md border border-white/5 bg-secondary/8 px-1.5 py-0.5 text-[7.5px] font-semibold leading-tight"
                >
                  <span className="min-w-0 truncate">
                    <span className={sideClass(item.side)}>{entrySideHistoryLabel(item)}</span>{" "}
                    <span className={entryResultClass(item.kind)}>{entryResultLabel(item.kind)}</span>
                  </span>
                  <span className="shrink-0 text-[7px] text-muted-foreground/70">:{item.minute}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[7.5px] font-semibold text-muted-foreground/70">
              Sem greens, reds ou ties recentes.
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <details className="group rounded-lg border border-white/8 bg-background/12 px-2 py-1">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 py-0.5 marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-1 text-[7px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/75">
          <ChevronRight className="size-2.5 shrink-0 transition group-open:rotate-90" />
          <span className="truncate">Entradas</span>
        </span>
        <span className="truncate text-[7px] font-semibold text-muted-foreground/60 group-open:hidden">
          {history.length ? `${history.length} · ${summaryHint}` : summaryHint}
        </span>
        <span className="hidden text-[7px] font-semibold text-muted-foreground/60 group-open:inline">
          {history.length ? `${history.length} no ciclo` : "coletando"}
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
                  <span className={sideClass(item.side)}>{entrySideHistoryLabel(item)}</span>{" "}
                  <span className={entryResultClass(item.kind)}>{entryResultLabel(item.kind)}</span>
                </span>
                <span className="shrink-0 text-[7px] text-muted-foreground/70">:{item.minute}</span>
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

function normalizeNeuralEntryHistoryItem(value: unknown): NeuralEntryHistoryItem | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<NeuralEntryHistoryItem>;
  if (!isNeuralEntryResultKind(record.kind) || !isNeuralSide(record.side)) return null;

  return {
    id: typeof record.id === "string" && record.id ? record.id : `restored:${Date.now()}:${Math.random()}`,
    kind: record.kind,
    side: record.side,
    multiplier:
      typeof record.multiplier === "number" && Number.isFinite(record.multiplier) ? record.multiplier : null,
    minute: typeof record.minute === "string" && record.minute ? record.minute : "--",
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

function minuteLabelFromOfficialResult(result: NeuralEntryLastResult | null | undefined) {
  const roundKeyMinute = minuteLabelFromTimeText(result?.resultRoundKey);
  if (roundKeyMinute) return roundKeyMinute;

  const finishedMinute = minuteLabelFromIso(result?.finishedAt);
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

function entrySideHistoryLabel(item: NeuralEntryHistoryItem) {
  if (item.kind === "tie") {
    return `EMPATE${item.multiplier ? ` ${item.multiplier}X` : ""}`.trim();
  }
  if (item.side === "BANKER") return "BANKER";
  if (item.side === "PLAYER") return "PLAYER";
  return "TIE";
}

function entryResultLabel(kind: NeuralEntryDisplayKind) {
  if (kind === "red") return "RED";
  if (kind === "tie") return "GREEN TIE";
  return "GREEN";
}

function entryResultClass(kind: NeuralEntryDisplayKind) {
  if (kind === "red") return "text-destructive";
  if (kind === "tie") return "text-tie";
  return "text-success";
}

function buildEntryResultView(result: NeuralEntryDisplayResult) {
  if (result.kind === "red") {
    return {
      action: "RED",
      headline: "Entrada neural não bateu",
      actionClass: "text-destructive",
      panelClass: "neural-entry-flash-red border-destructive/35 bg-destructive/10",
    };
  }

  if (result.kind === "tie") {
    return {
      action: `GREEN EMPATE ${result.multiplier ? `${result.multiplier}X` : ""}`.trim(),
      headline: "Empate confirmado na validade",
      actionClass: "text-tie",
      panelClass: "neural-entry-flash-tie border-tie/40 bg-tie/10",
    };
  }

  return {
    action: `GREEN ${sideLabel(result.side).toUpperCase()}`,
    headline: "Entrada neural confirmada",
    actionClass: sideActionClass(result.side),
    panelClass: "neural-entry-flash-green border-success/35 bg-success/10",
  };
}

function NeuralStatChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "green" | "amber" | "cyan" | "red" | "muted" | "banker" | "player" | "tie";
}) {
  const toneClass = {
    green: "border-success/30 bg-success/8 text-success",
    amber: "border-warning/30 bg-warning/8 text-warning",
    cyan: "border-neon-cyan/30 bg-neon-cyan/8 text-neon-cyan",
    red: "border-destructive/30 bg-destructive/8 text-destructive",
    muted: "border-border/60 bg-secondary/25 text-foreground",
    banker: "border-banker/30 bg-banker/8 text-banker",
    player: "border-player/30 bg-player/8 text-player",
    tie: "border-tie/30 bg-tie/8 text-tie",
  }[tone];

  return (
    <div className={cn("rounded-lg border px-1 py-1.5", toneClass)}>
      <div className="text-[8px] font-black uppercase tracking-[0.08em] opacity-75">{label}</div>
      <div className="mt-0.5 truncate text-[11px] font-black leading-none">{value}</div>
    </div>
  );
}

function buildGeneralScore(scoreboard: NeuralScoreboard | undefined, fallbackReading: NeuralReading) {
  const sg = optionalNumberFrom(scoreboard?.greenSemGale ?? fallbackReading.greenSemGale);
  const g1 = optionalNumberFrom(scoreboard?.greenG1 ?? fallbackReading.greenG1);
  const splitGreens = sg !== null || g1 !== null ? numberFrom(sg) + numberFrom(g1) : null;
  const greens = optionalNumberFrom(
    splitGreens ?? scoreboard?.greens ?? scoreboard?.acertos ?? fallbackReading.acertos,
  );
  const reds = optionalNumberFrom(scoreboard?.reds ?? scoreboard?.erros ?? fallbackReading.reds ?? fallbackReading.erros);
  const accuracy = accuracyFrom(null, greens, reds) ?? optionalNumberFrom(scoreboard?.assertividade ?? fallbackReading.assertividade);

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

  return {
    id: result.id,
    kind,
    side: kind === "tie" ? "TIE" : side,
    multiplier: kind === "tie" ? result.tieMultiplier ?? null : null,
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

function originSubtitle(data: NeuralReading) {
  const kind = neuralOriginKind(data);
  if (kind === "OPOSTO") return "número oposto";
  if (kind === "TIE" || data.postTie) return "pós-empate";
  return "número pagante";
}

function formatNeuralNumber(data: NeuralReading) {
  if (typeof data.numero !== "number") return "--";
  if (data.origem === "TIE") return `${data.numero}x`;
  return `${data.numero} ${sideLabel(data.origem).slice(0, 1)}`;
}

function pullingSideLabel(data: NeuralReading) {
  const side = data.direcao ?? data.origem;
  return side ? sideLabel(side).toUpperCase() : null;
}

function neuralOriginKind(data: NeuralReading) {
  if (data.postTie || data.origem === "TIE") return "TIE";
  return data.origemTipo ?? "PAGANTE";
}

function neuralStatusKind(reading: NeuralReading): "green" | "amber" | "red" | "muted" {
  if (typeof reading.numero !== "number") return "muted";
  if (reading.isRedAlert || reading.isSaturated) return "red";
  if (reading.mode === "ACTIVE") return "green";
  return "amber";
}

function sideActionClass(side: NeuralSide) {
  return dashboardSideTextClass(side);
}

function sideNumberTone(side: NeuralReading["origem"]) {
  if (side === "BANKER") return "banker" as const;
  if (side === "PLAYER") return "player" as const;
  if (side === "TIE") return "tie" as const;
  return "muted" as const;
}

function sideStatTone(side: NeuralSide) {
  if (side === "BANKER") return "banker" as const;
  if (side === "PLAYER") return "player" as const;
  if (side === "TIE") return "tie" as const;
  return "muted" as const;
}

function accuracyFrom(assertividade?: number | null, acertos?: number | null, erros?: number | null) {
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

function sideClass(side?: NeuralSide | null) {
  return dashboardSideTextClass(side);
}
