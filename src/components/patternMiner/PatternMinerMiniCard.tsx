import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { GlassCard } from "@/components/ui-app/GlassCard";
import {
  DASHBOARD_MODULE_CARD_BODY,
  DASHBOARD_MODULE_CARD_FILL,
  DASHBOARD_MODULE_CARD_ROOT,
} from "@/components/dashboard/dashboardModuleCardLayout";
import { PatternSequence } from "@/components/patternMiner/PatternSequence";
import { cn } from "@/lib/utils";
import { sideTextClass } from "@/lib/sideColors";
import { statusLabel } from "@/patternMiner/PatternMinerDisplay";
import type { DashboardPersistentResult, Round, RoundResult } from "@/types/dashboard";
import type { PatternMinerAlert, PatternMinerSnapshot, PatternMinerStrategy } from "@/types/patternMiner";

const PATTERN_IA_CYCLE_STORAGE_KEY = "sniperbo:pattern-ia-hot-center-cycle:v3";
const PATTERN_IA_HISTORY_STORAGE_KEY = "sniperbo:pattern-ia-results-history:v4";
const HOT_PATTERNS_SOURCE = "HOT_PATTERNS_AI_CENTER";
const PATTERN_MINER_MIN_OCCURRENCES = 3;
const PATTERN_MINER_MIN_VALIDATED = 2;
const SNAPSHOT_OLD_MS = 120_000;
const MAX_PATTERN_IA_HISTORY = 500;
const VISIBLE_PATTERN_IA_HISTORY = 500;

type PatternCardStatus = "HOT" | "WAITING" | "BLOCKED";
type TechnicalSide = "BANKER" | "PLAYER" | "TIE";
type PatternCycleStatus = "AGUARDANDO_RESULTADO" | "AGUARDANDO_G1" | "CLOSED" | "CANCELADO" | "EXPIRADO";
type PatternCycleAttempt = "SG" | "G1";
type PatternCycleResult = "GREEN" | "GREEN_G1" | "RED" | "EMPATE" | "EMPATE_G1" | null;
type PatternHistoryResult = Exclude<PatternCycleResult, null> | "AGUARDANDO" | "AGUARDANDO_G1" | "CANCELADO" | "EXPIRADO";

interface HotPatternsAiContract {
  module: "PADROES_IA";
  source: typeof HOT_PATTERNS_SOURCE;
  status: PatternCardStatus;
  technicalSide: TechnicalSide | null;
  sideCode: RoundResult | null;
  accuracy: number;
  strength: number;
  samples: number;
  recentGreens: number;
  recentReds: number;
  patternName: string;
  patternStatus: string;
  blocked: boolean;
  blockReason: string | null;
  updatedAt: string;
  signalId: string;
  eventId: string;
  roundId: number | null;
  strategy?: PatternMinerStrategy;
  alert?: PatternMinerAlert;
  reason?: string | null;
  candidatesAudited: number;
  rankingPreview: Array<{
    patternName: string;
    technicalSide: TechnicalSide;
    accuracy: number;
    strength: number;
    recentReds: number;
    samples: number;
  }>;
}

interface HotPatternCandidate {
  strategy: PatternMinerStrategy;
  alert?: PatternMinerAlert;
  technicalSide: TechnicalSide;
  sideCode: RoundResult;
  accuracy: number;
  strength: number;
  samples: number;
  recentGreens: number;
  recentReds: number;
  patternName: string;
  patternStatus: string;
  signalId: string;
  eventId: string;
  roundId: number | null;
  updatedAt: string;
  riskScore: number;
}

interface PatternIaCycle {
  module: "PADROES_IA";
  cycleStatus: PatternCycleStatus;
  attempt: PatternCycleAttempt;
  patternId: string;
  signalId: string;
  eventId: string;
  patternName: string;
  technicalSide: TechnicalSide;
  sideCode: RoundResult;
  sourceRoundId: number;
  entryRoundId: string | null;
  g1RoundId: string | null;
  result: PatternCycleResult;
  tieMultiplier: string | null;
  openedAt: string;
  closedAt: string | null;
  entryConfirmedVisible: boolean;
  contract: StoredPatternContract;
}

interface PatternIaHistoryItem {
  module: "PADROES_IA";
  cycleId: string;
  patternId: string;
  technicalSide: TechnicalSide;
  result: PatternHistoryResult;
  attempt: PatternCycleAttempt;
  tieMultiplier: string | null;
  entryRoundId: string | null;
  closedRoundId: string | null;
  closedAt: string;
  label: string;
  timeLabel: string;
}

interface StoredPatternContract {
  accuracy: number;
  strength: number;
  samples: number;
  recentGreens: number;
  recentReds: number;
  patternName: string;
  patternStatus: string;
  sequence: string[];
}

interface PatternView {
  badge: string;
  badgeTone: "green" | "amber" | "cyan" | "muted" | "blue" | "red" | "gold";
  pulse: boolean;
  action: string;
  headline: string;
  actionClass: string;
  panelClass: string;
  borderClass: string;
  sourceLine: string;
  reasonLine?: string;
  metricContract: StoredPatternContract;
  statusChip: string;
  statusTone: "green" | "amber" | "cyan" | "muted" | "blue" | "red" | "gold";
  signalLine?: string;
  renderStatus: string;
}

export function PatternMinerMiniCard({
  snapshot,
  isUsingRealData,
  latestRoundId,
  rounds = [],
  resultRounds = [],
  feedStatus,
  dashboardUpdatedAt,
  aiPatternSignal,
  patternHotSignal,
  patternIaServerCycle,
  persistedResults = [],
  className,
}: {
  snapshot: PatternMinerSnapshot;
  isUsingRealData: boolean;
  latestRoundId?: number;
  rounds?: Round[];
  resultRounds?: Round[];
  feedStatus?: string | null;
  dashboardUpdatedAt?: string | null;
  aiPatternSignal?: unknown;
  patternHotSignal?: unknown;
  patternIaServerCycle?: unknown;
  persistedResults?: DashboardPersistentResult[];
  className?: string;
}) {
  const [storedCycle, setStoredCycle] = useState<PatternIaCycle | null>(null);
  const [resultHistory, setResultHistory] = useState<PatternIaHistoryItem[]>(() => readPatternIaHistory());
  const officialCycle = useMemo(() => normalizeServerPatternIaCycle(patternIaServerCycle), [patternIaServerCycle]);
  const contract = useMemo(
    () =>
      buildHotPatternsContract(
        snapshot,
        isUsingRealData,
        latestRoundId,
        feedStatus,
        dashboardUpdatedAt,
        rounds,
        aiPatternSignal,
        patternHotSignal,
      ),
    [aiPatternSignal, dashboardUpdatedAt, feedStatus, isUsingRealData, latestRoundId, patternHotSignal, rounds, snapshot],
  );
  const cycle = useMemo(
    () => officialCycle ?? selectPatternCycle(contract, storedCycle, resultRounds.length ? resultRounds : rounds, latestRoundId),
    [contract, latestRoundId, officialCycle, resultRounds, rounds, storedCycle],
  );
  const displayCycle = cycle && shouldDisplayCycleInMainCard(cycle) ? cycle : null;
  const displayContract = displayCycle ? contract : releaseClosedCycleFromMainCard(contract, cycle);
  const view = buildPatternView(displayContract, displayCycle);
  const sequence = displayContract.strategy?.sequence ?? displayCycle?.contract.sequence ?? [];
  const visibleResultHistory = useMemo(() => {
    const liveItem = historyItemFromCycle(cycle);
    if (liveItem?.result === "AGUARDANDO" || liveItem?.result === "AGUARDANDO_G1") return resultHistory;
    return liveItem ? upsertPatternIaHistory(resultHistory, liveItem) : resultHistory;
  }, [cycle, resultHistory]);

  useEffect(() => {
    setStoredCycle(readStoredCycle());
  }, []);

  useEffect(() => {
    persistCycle(cycle, latestRoundId);
    if (cycleKey(cycle) !== cycleKey(storedCycle)) {
      setStoredCycle(cycle);
    }
  }, [cycle, latestRoundId, storedCycle]);

  useEffect(() => {
    const item = historyItemFromCycle(cycle);
    if (!item) return;
    if (item.result === "AGUARDANDO" || item.result === "AGUARDANDO_G1") return;

    setResultHistory((history) => upsertPatternIaHistory(history, item));
  }, [cycle]);

  useEffect(() => {
    const officialHistory = persistedResults
      .map(patternIaHistoryFromPersistentResult)
      .filter((item): item is PatternIaHistoryItem => Boolean(item));
    if (!officialHistory.length) return;
    setResultHistory((history) => mergePatternIaHistories(officialHistory, history));
  }, [persistedResults]);

  useEffect(() => {
    persistPatternIaHistory(resultHistory);
  }, [resultHistory]);

  useEffect(() => {
    const refreshDailyHistory = () => {
      setResultHistory((history) => filterCurrentPatternIaDayHistory(history));
    };
    refreshDailyHistory();
    const intervalId = window.setInterval(refreshDailyHistory, 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    logPatternIa("[PATTERN_IA_CENTER_CONTRACT]", publicContract(contract));

    if (contract.status === "BLOCKED") {
      logPatternIa("[PATTERN_IA_CENTER_BLOCKED]", publicContract(contract));
    }

    if (contract.status === "HOT") {
      logPatternIa("[PATTERN_IA_CENTER_SELECTED]", publicContract(contract));
    }

    if (cycle) {
      logPatternIa("[PATTERN_IA_CYCLE_STATE]", publicCycle(cycle));
    }
  }, [contract, cycle]);

  return (
    <GlassCard
      className={cn(
        "digital-risk-card border-white/10 p-2 sm:p-2",
        DASHBOARD_MODULE_CARD_ROOT,
        view.borderClass,
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 scan-grid opacity-[0.03]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

      <div className="mb-2 flex min-w-0 items-start justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Padroes IA
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
        <div className={cn("rounded-xl border px-3 py-2.5 text-center", view.panelClass)}>
          <div className={cn("text-base font-black uppercase leading-tight", view.actionClass)}>{view.action}</div>
          <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {view.headline}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1.5 text-center">
          <PatternStatChip label="Assert." value={`${view.metricContract.accuracy}%`} tone={view.statusTone} />
          <PatternStatChip label="Reds" value={String(view.metricContract.recentReds)} tone={view.metricContract.recentReds >= 3 ? "red" : "green"} />
          <PatternStatChip label="Forca" value={`${view.metricContract.strength}%`} tone="cyan" />
        </div>

        <details className="group rounded-lg border border-white/10 bg-background/20">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2 py-2 text-[8px] font-black uppercase tracking-[0.08em] text-neon-cyan marker:content-none [&::-webkit-details-marker]:hidden">
            <span>Ver mais — resultados e padrão</span>
            <ChevronRight className="size-3 shrink-0 transition-transform group-open:rotate-90" />
          </summary>
          <div className="space-y-2 border-t border-white/10 p-2">
        <div className="grid grid-cols-3 gap-1.5 text-center">
          <PatternStatChip label="Greens" value={String(view.metricContract.recentGreens)} tone="green" />
          <PatternStatChip label="Amostra" value={String(view.metricContract.samples)} tone="muted" />
          <PatternStatChip label="Status" value={view.statusChip} tone={view.statusTone} />
        </div>

        <div className="rounded-lg border border-neon-cyan/10 bg-background/20 px-2 py-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[8px] font-black uppercase tracking-[0.08em] text-neon-cyan/85">
              Padrao detectado
            </div>
            <div className="truncate text-[8px] font-black uppercase tracking-[0.06em] text-muted-foreground">
              {view.metricContract.patternStatus}
            </div>
          </div>

          {sequence.length ? (
            <div className="mt-1 min-w-0 overflow-hidden">
              <PatternSequence sequence={sequence} compact />
            </div>
          ) : (
            <div className="mt-1 text-[9px] text-muted-foreground">Sem padrao quente valido agora.</div>
          )}

          <div className="mt-1 text-[9px] font-semibold text-muted-foreground">{view.sourceLine}</div>
          {view.reasonLine ? (
            <div className="mt-1 text-[9px] font-black uppercase text-warning">{view.reasonLine}</div>
          ) : null}
          {view.signalLine ? (
            <div className="mt-1 truncate text-[8px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              {view.signalLine}
            </div>
          ) : null}
        </div>

        <Link
          to="/app/padroes"
          className="inline-flex items-center gap-1 text-[10px] font-semibold text-neon-cyan hover:text-neon-blue"
        >
          Ver ranking completo <ChevronRight className="size-3" />
        </Link>

        <PatternIaResultsHistoryList history={visibleResultHistory} />
          </div>
        </details>
        <div className={DASHBOARD_MODULE_CARD_FILL} aria-hidden />
      </div>
    </GlassCard>
  );
}

function buildHotPatternsContract(
  snapshot: PatternMinerSnapshot,
  isUsingRealData: boolean,
  latestRoundId?: number,
  feedStatus?: string | null,
  dashboardUpdatedAt?: string | null,
  rounds: Round[] = [],
  aiPatternSignal?: unknown,
  patternHotSignal?: unknown,
): HotPatternsAiContract {
  const updatedAt = snapshot.updatedAt || new Date().toISOString();
  const base: HotPatternsAiContract = {
    module: "PADROES_IA",
    source: HOT_PATTERNS_SOURCE,
    status: "WAITING",
    technicalSide: null,
    sideCode: null,
    accuracy: 0,
    strength: 0,
    samples: 0,
    recentGreens: 0,
    recentReds: 0,
    patternName: "",
    patternStatus: "WAITING",
    blocked: false,
    blockReason: null,
    updatedAt,
    signalId: "",
    eventId: "",
    roundId: null,
    reason: "Nenhum padrao quente valido no momento.",
    candidatesAudited: 0,
    rankingPreview: [],
  };

  if (!isUsingRealData) {
    return { ...base, reason: "Historico real ainda nao disponivel." };
  }

  const feed = String(feedStatus || "").toLowerCase();
  if (feed === "stale" || feed === "paused") {
    return { ...base, reason: "Feed sem atualizacao recente." };
  }

  if (snapshotIsOld(snapshot, dashboardUpdatedAt)) {
    return { ...base, reason: "Padrao antigo ou snapshot sem updatedAt recente." };
  }

  const candidates = collectCurrentCentralCandidates(snapshot, latestRoundId, rounds, aiPatternSignal, patternHotSignal);
  const rankingPreview = rankHotPatternCandidates(candidates).slice(0, 5).map((candidate) => ({
    patternName: candidate.patternName,
    technicalSide: candidate.technicalSide,
    accuracy: candidate.accuracy,
    strength: candidate.strength,
    recentReds: candidate.recentReds,
    samples: candidate.samples,
  }));
  const validSamples = candidates.filter((candidate) => hasValidSample(candidate.strategy));
  const blockedByReds = validSamples.filter((candidate) => candidate.recentReds >= 3);
  const rankedValid = rankHotPatternCandidates(
    validSamples.filter((candidate) => candidate.recentReds <= 2),
  );
  const best = rankedValid[0];

  if (best) {
    return {
      ...base,
      status: "HOT",
      technicalSide: best.technicalSide,
      sideCode: best.sideCode,
      accuracy: best.accuracy,
      strength: best.strength,
      samples: best.samples,
      recentGreens: best.recentGreens,
      recentReds: best.recentReds,
      patternName: best.patternName,
      patternStatus: best.patternStatus,
      updatedAt: best.updatedAt,
      signalId: best.signalId,
      eventId: best.eventId,
      roundId: best.roundId,
      strategy: best.strategy,
      alert: best.alert,
      reason: null,
      candidatesAudited: candidates.length,
      rankingPreview,
    };
  }

  const blocked = rankHotPatternCandidates(blockedByReds)[0];
  if (blocked) {
    return {
      ...base,
      status: "BLOCKED",
      technicalSide: null,
      sideCode: null,
      accuracy: blocked.accuracy,
      strength: blocked.strength,
      samples: blocked.samples,
      recentGreens: blocked.recentGreens,
      recentReds: blocked.recentReds,
      patternName: blocked.patternName,
      patternStatus: "PAUSED",
      blocked: true,
      blockReason: "RECENT_REDS_LIMIT_3",
      updatedAt: blocked.updatedAt,
      signalId: blocked.signalId,
      eventId: blocked.eventId,
      roundId: blocked.roundId,
      strategy: blocked.strategy,
      alert: blocked.alert,
      reason: "Padrao atingiu 3 reds recentes.",
      candidatesAudited: candidates.length,
      rankingPreview,
    };
  }

  if (candidates.length) {
    return {
      ...base,
      reason: "Central encontrou padroes, mas sem amostra valida atual.",
      candidatesAudited: candidates.length,
      rankingPreview,
    };
  }

  return base;
}

function collectCurrentCentralCandidates(
  snapshot: PatternMinerSnapshot,
  latestRoundId?: number,
  rounds: Round[] = [],
  aiPatternSignal?: unknown,
  patternHotSignal?: unknown,
) {
  const alerts = snapshot.entryAlerts.filter((alert) => alert.kind === "validated" && alert.strategy?.expectedResult);
  const byKey = new Map<string, HotPatternCandidate>();

  for (const candidate of alerts
    .filter((alert) => isCurrentAlert(alert, latestRoundId))
    .map((alert) => buildCandidateFromAlert(alert, snapshot))
    .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate))) {
    byKey.set(candidateKey(candidate.strategy, candidate.roundId), candidate);
  }

  for (const strategy of [...snapshot.hotStrategies, ...snapshot.ranking, ...snapshot.strategies]) {
    if (!strategy.expectedResult) continue;
    const tailMatch = matchesCurrentStrategyTail(strategy, rounds);
    if (!tailMatch && !isCurrentStrategy(strategy, latestRoundId)) continue;
    const roundId = tailMatch
      ? latestRoundId ?? numericRoundId(rounds.at(-1)) ?? roundIdFromLastOccurrence(strategy)
      : roundIdFromLastOccurrence(strategy);
    const key = candidateKey(strategy, roundId ?? null);
    if (byKey.has(key)) continue;
    const candidate = buildCandidateFromStrategy(strategy, snapshot, roundId ?? null);
    if (candidate) byKey.set(key, candidate);
  }

  for (const candidate of [
    buildCandidateFromDashboardPatternSignal(aiPatternSignal, snapshot, latestRoundId, rounds, "ai"),
    buildCandidateFromDashboardPatternSignal(patternHotSignal, snapshot, latestRoundId, rounds, "hot"),
  ]) {
    if (!candidate) continue;
    byKey.set(candidateKey(candidate.strategy, candidate.roundId), candidate);
  }

  return [...byKey.values()];
}

function buildCandidateFromDashboardPatternSignal(
  signal: unknown,
  snapshot: PatternMinerSnapshot,
  latestRoundId: number | undefined,
  rounds: Round[],
  source: "ai" | "hot",
): HotPatternCandidate | null {
  if (!isRecord(signal)) return null;
  const sideCode = normalizePatternSide(signal.side ?? signal.entry ?? signal.expectedSide ?? signal.technicalSide);
  if (!sideCode) return null;

  const status = String(signal.status ?? signal.patternStatus ?? "").trim().toUpperCase();
  if (["WAITING", "NONE", "BLOCKED", "PAUSED", "EXPIRED"].includes(status)) return null;

  const accuracy = clamp(Math.round(readNumberish(signal.confidence ?? signal.accuracy ?? signal.assertiveness) ?? 0), 0, 100);
  if (accuracy <= 0) return null;

  const matchingStrategy = bestStrategyForDashboardSignal(snapshot, sideCode, signal);
  const samples = Math.max(
    readNumberish(signal.samples ?? signal.sampleSize ?? signal.occurrences) ?? 0,
    matchingStrategy?.totalValidated ?? 0,
  );
  const recentReds = readNumberish(signal.recentReds ?? signal.reds ?? signal.red) ?? (matchingStrategy ? recentRedsForStrategy(matchingStrategy) : 0);
  const recentGreens =
    readNumberish(signal.recentGreens ?? signal.greens ?? signal.green) ??
    (matchingStrategy ? recentGreensForStrategy(matchingStrategy) : Math.max(0, samples - recentReds));
  const updatedAt = String(signal.updatedAt ?? signal.generatedAt ?? matchingStrategy?.updatedAt ?? snapshot.updatedAt ?? new Date().toISOString());
  const roundId =
    readNumberish(signal.roundId ?? signal.round_id ?? signal.sourceRoundId) ??
    latestRoundId ??
    numericRoundId(rounds.at(-1)) ??
    roundIdFromLastOccurrence(matchingStrategy);
  const patternName = String(
    signal.patternName ??
      signal.pattern ??
      signal.name ??
      matchingStrategy?.sequence.join("-") ??
      `${source === "ai" ? "PADRAO IA" : "PADRAO QUENTE"} ${sideLabel(sideCode)}`,
  );
  const patternStatus = status === "OBSERVING" || status === "OBSERVANDO" ? "CONFIRMADO" : status || "CONFIRMADO";
  const strategy =
    matchingStrategy ??
    syntheticPatternStrategy({
      id: `${source}-pattern-signal:${roundId ?? "current"}:${sideCode}:${patternName}`,
      sideCode,
      patternName,
      accuracy,
      samples,
      recentGreens,
      recentReds,
      updatedAt,
      roundId: roundId ?? null,
    });

  return {
    strategy,
    technicalSide: sideLabel(sideCode),
    sideCode,
    accuracy,
    strength: strengthForStrategy(strategy, recentReds),
    samples: strategy.totalValidated,
    recentGreens,
    recentReds,
    patternName: strategy.sequence.join("-") || patternName,
    patternStatus,
    signalId: String(signal.id ?? signal.signalId ?? signal.signal_id ?? `${source}-pattern:${roundId ?? "current"}:${sideCode}`),
    eventId: String(signal.eventId ?? signal.event_id ?? `${source}-pattern-event:${roundId ?? "current"}:${sideCode}`),
    roundId: roundId ?? null,
    updatedAt,
    riskScore: riskScoreForStrategy(strategy, recentReds),
  };
}

function buildCandidateFromAlert(alert: PatternMinerAlert, snapshot: PatternMinerSnapshot): HotPatternCandidate | null {
  const strategy = alert.strategy;
  if (!strategy.expectedResult) return null;
  const roundId = alertRoundId(alert);
  const recentReds = recentRedsForStrategy(strategy);
  const accuracy = Math.round(strategy.assertiveness ?? 0);
  const samples = strategy.totalValidated ?? 0;
  const recentGreens = recentGreensForStrategy(strategy);
  const strength = strengthForStrategy(strategy, recentReds);
  const signalId = signalIdFromAlert(alert) || `hot-pattern:${strategy.id}:${roundId ?? "live"}`;
  const eventId = eventIdFromAlert(alert) || `hot-pattern-event:${strategy.id}:${roundId ?? "live"}`;

  return {
    strategy,
    alert,
    technicalSide: sideLabel(strategy.expectedResult),
    sideCode: strategy.expectedResult,
    accuracy,
    strength,
    samples,
    recentGreens,
    recentReds,
    patternName: strategy.sequence.join("-"),
    patternStatus: patternStatusForStrategy(strategy, alert),
    signalId,
    eventId,
    roundId: roundId ?? null,
    updatedAt: generatedAtFromAlert(alert) || strategy.updatedAt || snapshot.updatedAt,
    riskScore: riskScoreForStrategy(strategy, recentReds),
  };
}

function buildCandidateFromStrategy(
  strategy: PatternMinerStrategy,
  snapshot: PatternMinerSnapshot,
  roundId: number | null,
): HotPatternCandidate | null {
  if (!strategy.expectedResult) return null;
  const recentReds = recentRedsForStrategy(strategy);
  const accuracy = Math.round(strategy.assertiveness ?? 0);
  const samples = strategy.totalValidated ?? 0;
  const recentGreens = recentGreensForStrategy(strategy);
  const strength = strengthForStrategy(strategy, recentReds);
  const signalId = `hot-pattern:${strategy.id}:${roundId ?? "current"}`;
  const eventId = `hot-pattern-event:${strategy.id}:${roundId ?? "current"}`;

  return {
    strategy,
    technicalSide: sideLabel(strategy.expectedResult),
    sideCode: strategy.expectedResult,
    accuracy,
    strength,
    samples,
    recentGreens,
    recentReds,
    patternName: strategy.sequence.join("-"),
    patternStatus: patternStatusForStrategy(strategy),
    signalId,
    eventId,
    roundId,
    updatedAt: strategy.updatedAt || snapshot.updatedAt,
    riskScore: riskScoreForStrategy(strategy, recentReds),
  };
}

function bestStrategyForDashboardSignal(
  snapshot: PatternMinerSnapshot,
  sideCode: RoundResult,
  signal: Record<string, unknown>,
) {
  const patternText = String(signal.patternName ?? signal.pattern ?? signal.name ?? "").toUpperCase();
  const candidates = [...snapshot.entryAlerts.map((alert) => alert.strategy), ...snapshot.hotStrategies, ...snapshot.ranking, ...snapshot.strategies]
    .filter((strategy) => strategy.expectedResult === sideCode && hasValidSample(strategy));

  return candidates.sort((left, right) => {
    const leftPatternBoost = patternText && sequenceLabel(left.sequence).includes(patternText) ? 1 : 0;
    const rightPatternBoost = patternText && sequenceLabel(right.sequence).includes(patternText) ? 1 : 0;
    if (leftPatternBoost !== rightPatternBoost) return rightPatternBoost - leftPatternBoost;
    if (recentRedsForStrategy(left) !== recentRedsForStrategy(right)) {
      return recentRedsForStrategy(left) - recentRedsForStrategy(right);
    }
    if ((left.assertiveness ?? 0) !== (right.assertiveness ?? 0)) return (right.assertiveness ?? 0) - (left.assertiveness ?? 0);
    if (left.totalValidated !== right.totalValidated) return right.totalValidated - left.totalValidated;
    return statusRank(patternStatusForStrategy(right)) - statusRank(patternStatusForStrategy(left));
  })[0];
}

function syntheticPatternStrategy({
  id,
  sideCode,
  patternName,
  accuracy,
  samples,
  recentGreens,
  recentReds,
  updatedAt,
  roundId,
}: {
  id: string;
  sideCode: RoundResult;
  patternName: string;
  accuracy: number;
  samples: number;
  recentGreens: number;
  recentReds: number;
  updatedAt: string;
  roundId: number | null;
}): PatternMinerStrategy {
  const sequence = parsePatternSequence(patternName, sideCode);
  const totalValidated = Math.max(samples, recentGreens + recentReds);
  return {
    id,
    sequence,
    occurrences: Math.max(totalValidated, samples),
    expectedResult: sideCode,
    sg: recentGreens,
    g1: 0,
    red: recentReds,
    tie: 0,
    totalValidated,
    sequencePositive: recentGreens,
    sequenceNegative: recentReds,
    maxSequencePositive: recentGreens,
    maxSequenceNegative: recentReds,
    assertiveness: accuracy,
    lastOccurrence: roundId ? `#${roundId}` : undefined,
    createdAt: updatedAt,
    status: accuracy >= 70 ? "HOT" : "STABLE",
    insufficientSample: totalValidated < PATTERN_MINER_MIN_VALIDATED || samples < PATTERN_MINER_MIN_OCCURRENCES,
    updatedAt,
    rank: 999,
  };
}

function rankHotPatternCandidates<T extends { strategy: PatternMinerStrategy; recentReds: number; accuracy: number; strength: number; samples: number; patternStatus: string; updatedAt: string; riskScore: number }>(
  candidates: T[],
) {
  return [...candidates].sort((left, right) => {
    if (left.recentReds !== right.recentReds) return left.recentReds - right.recentReds;
    if (left.accuracy !== right.accuracy) return right.accuracy - left.accuracy;
    if (left.strength !== right.strength) return right.strength - left.strength;
    if (left.samples !== right.samples) return right.samples - left.samples;
    const statusDiff = statusRank(right.patternStatus) - statusRank(left.patternStatus);
    if (statusDiff !== 0) return statusDiff;
    const updatedDiff = Date.parse(right.updatedAt || "") - Date.parse(left.updatedAt || "");
    if (Number.isFinite(updatedDiff) && updatedDiff !== 0) return updatedDiff;
    return left.riskScore - right.riskScore;
  });
}

function selectPatternCycle(
  contract: HotPatternsAiContract,
  stored: PatternIaCycle | null,
  rounds: Round[],
  latestRoundId?: number,
): PatternIaCycle | null {
  const resolvedStored = stored ? resolveCycleResult(stored, rounds) : null;
  if (resolvedStored && isCycleOpen(resolvedStored)) return resolvedStored;

  if (contract.status === "HOT" && contract.sideCode && contract.technicalSide && contract.roundId !== null) {
    if (resolvedStored && sameContractCycle(contract, resolvedStored) && shouldKeepClosedCycle(resolvedStored, latestRoundId)) {
      return resolvedStored;
    }
    return openCycleFromContract(contract);
  }

  if (resolvedStored && shouldKeepClosedCycle(resolvedStored, latestRoundId)) return resolvedStored;
  return null;
}

function openCycleFromContract(contract: HotPatternsAiContract): PatternIaCycle {
  return {
    module: "PADROES_IA",
    cycleStatus: "AGUARDANDO_RESULTADO",
    attempt: "SG",
    patternId: contract.strategy?.id ?? contract.signalId,
    signalId: contract.signalId,
    eventId: contract.eventId,
    patternName: contract.patternName,
    technicalSide: contract.technicalSide as TechnicalSide,
    sideCode: contract.sideCode as RoundResult,
    sourceRoundId: contract.roundId ?? 0,
    entryRoundId: null,
    g1RoundId: null,
    result: null,
    tieMultiplier: null,
    openedAt: new Date().toISOString(),
    closedAt: null,
    entryConfirmedVisible: true,
    contract: storedContractFromContract(contract),
  };
}

function releaseClosedCycleFromMainCard(
  contract: HotPatternsAiContract,
  cycle: PatternIaCycle | null,
): HotPatternsAiContract {
  if (!cycle || isCycleOpen(cycle)) return contract;

  return {
    ...contract,
    status: "WAITING",
    technicalSide: null,
    sideCode: null,
    accuracy: 0,
    strength: 0,
    samples: 0,
    recentGreens: 0,
    recentReds: 0,
    patternName: "",
    patternStatus: "WAITING",
    blocked: false,
    blockReason: null,
    signalId: "",
    eventId: "",
    roundId: null,
    strategy: undefined,
    alert: undefined,
    reason: "Aguardando proximo padrao confirmado.",
  };
}

function resolveCycleResult(cycle: PatternIaCycle, rounds: Round[]): PatternIaCycle {
  if (!isCycleOpen(cycle)) return cycle;
  const sourceIndex = rounds.findIndex((round) => numericRoundId(round) === cycle.sourceRoundId);
  if (sourceIndex < 0) return cycle;

  const sgRound = findCycleResultRound(rounds, cycle.sourceRoundId, sourceIndex, 1);
  if (!sgRound) {
    return { ...cycle, cycleStatus: "AGUARDANDO_RESULTADO", attempt: "SG", entryRoundId: null, result: null };
  }

  const sgOutcome = resultForEntry(cycle.sideCode, sgRound);
  if (sgOutcome === "green") {
    return closeCycle(cycle, "SG", "GREEN", sgRound, null);
  }
  if (sgOutcome === "tie") {
    return closeCycle(cycle, "SG", "EMPATE", sgRound, tieMultiplierLabel(sgRound));
  }

  const g1Round = findCycleResultRound(rounds, cycle.sourceRoundId, sourceIndex, 2);
  if (!g1Round) {
    return {
      ...cycle,
      cycleStatus: "AGUARDANDO_G1",
      attempt: "G1",
      entryRoundId: String(sgRound.id),
      result: null,
    };
  }

  const g1Outcome = resultForEntry(cycle.sideCode, g1Round);
  if (g1Outcome === "green") {
    return closeCycle({ ...cycle, entryRoundId: String(sgRound.id) }, "G1", "GREEN_G1", g1Round, null);
  }
  if (g1Outcome === "tie") {
    return closeCycle({ ...cycle, entryRoundId: String(sgRound.id) }, "G1", "EMPATE_G1", g1Round, tieMultiplierLabel(g1Round));
  }

  return closeCycle({ ...cycle, entryRoundId: String(sgRound.id) }, "G1", "RED", g1Round, null);
}

function findCycleResultRound(rounds: Round[], sourceRoundId: number, sourceIndex: number, offset: 1 | 2) {
  const byRoundId = rounds.find((round) => numericRoundId(round) === sourceRoundId + offset);
  if (byRoundId) return byRoundId;

  const previousId = numericRoundId(rounds[sourceIndex - 1]);
  const currentId = numericRoundId(rounds[sourceIndex]);
  const nextId = numericRoundId(rounds[sourceIndex + 1]);
  const futureIsPrevious = previousId !== undefined && currentId !== undefined && previousId > currentId;
  const futureIsNext = nextId !== undefined && currentId !== undefined && nextId > currentId;

  if (futureIsPrevious) return rounds[sourceIndex - offset];
  if (futureIsNext) return rounds[sourceIndex + offset];

  if (currentId !== undefined) return undefined;
  return rounds[sourceIndex + offset] ?? rounds[sourceIndex - offset];
}

function closeCycle(
  cycle: PatternIaCycle,
  attempt: PatternCycleAttempt,
  result: Exclude<PatternCycleResult, null>,
  round: Round,
  tieMultiplier: string | null,
): PatternIaCycle {
  return {
    ...cycle,
    cycleStatus: "CLOSED",
    attempt,
    entryRoundId: cycle.entryRoundId ?? String(round.id),
    g1RoundId: attempt === "G1" ? String(round.id) : cycle.g1RoundId,
    result,
    tieMultiplier,
    closedAt: new Date().toISOString(),
  };
}

function buildPatternView(contract: HotPatternsAiContract, cycle: PatternIaCycle | null): PatternView {
  const metricContract = cycle?.contract ?? storedContractFromContract(contract);
  const signalLine =
    contract.signalId || cycle?.signalId
      ? `signal ${cycle?.signalId ?? contract.signalId} - event ${cycle?.eventId ?? contract.eventId}`
      : undefined;

  if (cycle) {
    const sideClass = sideTextClass[cycle.sideCode];
    if (cycle.cycleStatus === "AGUARDANDO_RESULTADO") {
      return {
        badge: "SG",
        badgeTone: "green",
        pulse: true,
        action: "ENTRADA CONFIRMADA",
        headline: `${cycle.technicalSide} - aguardando resultado`,
        actionClass: sideClass,
        panelClass: panelClassForSide(cycle.sideCode),
        borderClass: borderClassForSide(cycle.sideCode),
        sourceLine: "Fonte: Central de Padroes Quentes / Aprendizado IA",
        metricContract,
        statusChip: "SG",
        statusTone: toneForSide(cycle.sideCode),
        signalLine,
        renderStatus: "AGUARDANDO_RESULTADO",
      };
    }

    if (cycle.cycleStatus === "AGUARDANDO_G1") {
      return {
        badge: "G1",
        badgeTone: "amber",
        pulse: true,
        action: "AGUARDANDO G1",
        headline: `Nao marcou RED ainda - proteger ${cycle.technicalSide}`,
        actionClass: "text-warning",
        panelClass: "border-warning/35 bg-warning/10",
        borderClass: "border-warning/35",
        sourceLine: "Fonte: Central de Padroes Quentes / Aprendizado IA",
        metricContract,
        statusChip: "G1",
        statusTone: "amber",
        signalLine,
        renderStatus: "AGUARDANDO_G1",
      };
    }

    return closedCycleView(cycle, metricContract, signalLine);
  }

  if (contract.status === "BLOCKED") {
    return {
      badge: "Bloqueado",
      badgeTone: "red",
      pulse: false,
      action: "BLOQUEADO POR RISCO",
      headline: "Padrao atingiu 3 reds recentes",
      actionClass: "text-destructive",
      panelClass: "border-destructive/35 bg-destructive/10",
      borderClass: "border-destructive/35",
      sourceLine: "Fonte: Central de Padroes Quentes / Aprendizado IA",
      reasonLine: "BLOQUEADO POR 3 REDS",
      metricContract,
      statusChip: "PAUSADO",
      statusTone: "red",
      signalLine,
      renderStatus: "BLOQUEADO POR 3 REDS",
    };
  }

  if (contract.status === "HOT" && contract.sideCode && contract.technicalSide) {
    return {
      badge: "Quente",
      badgeTone: toneForSide(contract.sideCode),
      pulse: true,
      action: `ENTRADA ${contract.technicalSide}`,
      headline: `Lado tecnico: ${contract.technicalSide}`,
      actionClass: sideTextClass[contract.sideCode],
      panelClass: panelClassForSide(contract.sideCode),
      borderClass: borderClassForSide(contract.sideCode),
      sourceLine: "Fonte: Central de Padroes Quentes / Aprendizado IA",
      metricContract,
      statusChip: contract.patternStatus,
      statusTone: toneForSide(contract.sideCode),
      signalLine,
      renderStatus: "MELHOR PADRAO DO MOMENTO",
    };
  }

  return {
    badge: "Observando",
    badgeTone: "muted",
    pulse: false,
    action: "AGUARDANDO PADRAO FORTE",
    headline: "Nenhum padrao quente valido no momento",
    actionClass: "text-muted-foreground",
    panelClass: "border-border/60 bg-secondary/20",
    borderClass: "border-border/50",
    sourceLine: "Fonte: Central de Padroes Quentes / Aprendizado IA",
    reasonLine: contract.reason ?? undefined,
    metricContract,
    statusChip: "WAIT",
    statusTone: "muted",
    renderStatus: "AGUARDANDO PADRAO FORTE",
  };
}

function closedCycleView(
  cycle: PatternIaCycle,
  metricContract: StoredPatternContract,
  signalLine?: string,
): PatternView {
  if (cycle.result === "GREEN") {
    return {
      badge: "GREEN SG",
      badgeTone: "green",
      pulse: true,
      action: "GREEN SG",
      headline: `${cycle.technicalSide} bateu de primeira`,
      actionClass: "text-success",
      panelClass: "border-success/35 bg-success/10",
      borderClass: "border-success/35",
      sourceLine: "Fonte: Central de Padroes Quentes / Aprendizado IA",
      metricContract,
      statusChip: "SG",
      statusTone: "green",
      signalLine,
      renderStatus: "GREEN SG",
    };
  }

  if (cycle.result === "GREEN_G1") {
    return {
      badge: "GREEN G1",
      badgeTone: "green",
      pulse: true,
      action: "GREEN G1",
      headline: `${cycle.technicalSide} bateu no gale`,
      actionClass: "text-success",
      panelClass: "border-success/35 bg-success/10",
      borderClass: "border-success/35",
      sourceLine: "Fonte: Central de Padroes Quentes / Aprendizado IA",
      metricContract,
      statusChip: "G1",
      statusTone: "green",
      signalLine,
      renderStatus: "GREEN G1",
    };
  }

  if (cycle.result === "EMPATE" || cycle.result === "EMPATE_G1") {
    const stage = cycle.result === "EMPATE_G1" ? "G1" : "SG";
    return {
      badge: "EMPATE",
      badgeTone: "gold",
      pulse: true,
      action: cycle.tieMultiplier ? `EMPATE ${cycle.tieMultiplier}` : "EMPATE",
      headline: `Empate real no ${stage}`,
      actionClass: "text-tie",
      panelClass: "border-tie/35 bg-tie/10",
      borderClass: "border-tie/35",
      sourceLine: "Fonte: Central de Padroes Quentes / Aprendizado IA",
      metricContract,
      statusChip: stage,
      statusTone: "gold",
      signalLine,
      renderStatus: cycle.result === "EMPATE_G1" ? "EMPATE_G1" : "EMPATE",
    };
  }

  return {
    badge: "RED FINAL",
    badgeTone: "red",
    pulse: false,
    action: "RED FINAL",
    headline: `${cycle.technicalSide} perdeu SG e G1`,
    actionClass: "text-destructive",
    panelClass: "border-destructive/35 bg-destructive/10",
    borderClass: "border-destructive/35",
    sourceLine: "Fonte: Central de Padroes Quentes / Aprendizado IA",
    metricContract,
    statusChip: "RED",
    statusTone: "red",
    signalLine,
    renderStatus: "RED FINAL",
  };
}

function PatternStatChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "green" | "amber" | "cyan" | "muted" | "blue" | "red" | "gold";
}) {
  const toneClass = {
    green: "border-success/30 bg-success/8 text-success",
    amber: "border-warning/30 bg-warning/8 text-warning",
    cyan: "border-neon-cyan/30 bg-neon-cyan/8 text-neon-cyan",
    blue: "border-player/35 bg-player/10 text-player",
    red: "border-banker/30 bg-banker/8 text-banker",
    gold: "border-tie/35 bg-tie/10 text-tie",
    muted: "border-border/60 bg-secondary/25 text-foreground",
  }[tone];

  return (
    <div className={cn("rounded-lg border px-1 py-1.5", toneClass)}>
      <div className="text-[8px] font-black uppercase tracking-[0.08em] opacity-75">{label}</div>
      <div className="mt-0.5 truncate text-[11px] font-black leading-none">{value}</div>
    </div>
  );
}

function PatternIaResultsHistoryList({ history }: { history: PatternIaHistoryItem[] }) {
  const visible = history.slice(0, VISIBLE_PATTERN_IA_HISTORY);

  return (
    <details
      data-testid="pattern-ia-results-history"
      className="group rounded-lg border border-white/8 bg-background/12 px-2 py-1"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 py-0.5 marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-1 text-[7px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/75">
          <ChevronRight className="size-2.5 shrink-0 transition group-open:rotate-90" />
          <span className="truncate">Entradas / Resultados</span>
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
                key={item.cycleId}
                data-testid="pattern-ia-history-row"
                className="flex items-center justify-between gap-1 rounded-md border border-white/5 bg-secondary/8 px-1.5 py-0.5 text-[7.5px] font-semibold leading-tight"
              >
                <span className="min-w-0 truncate">
                  {!isTieHistoryResult(item.result) ? (
                    <>
                      <span className={historySideClass(item.technicalSide)}>{item.technicalSide}</span>{" "}
                    </>
                  ) : null}
                  <span className={historyResultClass(item.result)}>{historyResultText(item)}</span>
                </span>
                <span className="shrink-0 text-[7px] text-muted-foreground/70">{item.timeLabel}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="pb-0.5 text-[7.5px] font-semibold text-muted-foreground/70">
            Sem resultados do Padroes IA ainda.
          </div>
        )}
      </div>
    </details>
  );
}

function hasValidSample(strategy: PatternMinerStrategy) {
  return (
    !strategy.insufficientSample &&
    strategy.occurrences >= PATTERN_MINER_MIN_OCCURRENCES &&
    strategy.totalValidated >= PATTERN_MINER_MIN_VALIDATED &&
    typeof strategy.assertiveness === "number" &&
    Boolean(strategy.expectedResult)
  );
}

function isCurrentAlert(alert: PatternMinerAlert, latestRoundId?: number) {
  if (latestRoundId === undefined) return true;
  const roundId = alertRoundId(alert);
  return roundId !== undefined && roundId === latestRoundId;
}

function isCurrentStrategy(strategy: PatternMinerStrategy, latestRoundId?: number) {
  if (latestRoundId === undefined) return false;
  const roundId = roundIdFromLastOccurrence(strategy);
  return roundId !== undefined && roundId === latestRoundId;
}

function roundIdFromLastOccurrence(strategy: PatternMinerStrategy) {
  const match = String(strategy.lastOccurrence || "").match(/#(\d+)/);
  if (!match) return undefined;
  const roundId = Number(match[1]);
  return Number.isFinite(roundId) ? roundId : undefined;
}

function candidateKey(strategy: PatternMinerStrategy, roundId: number | null) {
  return `${strategy.id}:${roundId ?? "none"}`;
}

function recentRedsForStrategy(strategy: PatternMinerStrategy) {
  const explicit = readNumber(strategy, ["recentReds", "recent_reds", "recentRedCount"]);
  if (explicit !== undefined) return explicit;
  if (Number.isFinite(strategy.sequenceNegative)) return strategy.sequenceNegative;
  return strategy.red;
}

function recentGreensForStrategy(strategy: PatternMinerStrategy) {
  const explicit = readNumber(strategy, ["recentGreens", "recent_greens", "recentGreenCount"]);
  if (explicit !== undefined) return explicit;
  if (Number.isFinite(strategy.sequencePositive)) return strategy.sequencePositive;
  return strategy.sg + strategy.g1;
}

function strengthForStrategy(strategy: PatternMinerStrategy, recentReds: number) {
  const explicit = readNumber(strategy, ["strength", "force", "score"]);
  if (explicit !== undefined) return clamp(Math.round(explicit), 0, 100);
  const accuracy = strategy.assertiveness ?? 0;
  const sampleScore = Math.min(18, strategy.totalValidated * 0.75);
  const greenStreakScore = Math.min(18, recentGreensForStrategy(strategy) * 4);
  const statusScore = strategy.status === "VERY_HOT" ? 10 : strategy.status === "HOT" ? 7 : 0;
  return clamp(Math.round(accuracy * 0.64 + sampleScore + greenStreakScore + statusScore - recentReds * 12), 0, 100);
}

function riskScoreForStrategy(strategy: PatternMinerStrategy, recentReds: number) {
  const redRate = strategy.totalValidated ? strategy.red / strategy.totalValidated : 1;
  return recentReds * 100 + redRate * 100 + Math.max(0, 100 - (strategy.assertiveness ?? 0));
}

function patternStatusForStrategy(strategy: PatternMinerStrategy, alert?: PatternMinerAlert) {
  if (alert?.kind === "validated") return "CONFIRMADO";
  if (strategy.status === "VERY_HOT" || strategy.status === "HOT") return "QUENTE";
  return statusLabel(strategy.status).toUpperCase();
}

function statusRank(status: string) {
  if (status === "CONFIRMADO") return 4;
  if (status === "QUENTE" || status === "VERY_HOT" || status === "HOT") return 3;
  if (status === "ESTAVEL" || status === "STABLE") return 2;
  return 1;
}

function storedContractFromContract(contract: HotPatternsAiContract): StoredPatternContract {
  return {
    accuracy: contract.accuracy,
    strength: contract.strength,
    samples: contract.samples,
    recentGreens: contract.recentGreens,
    recentReds: contract.recentReds,
    patternName: contract.patternName,
    patternStatus: contract.patternStatus,
    sequence: contract.strategy?.sequence ?? [],
  };
}

function resultForEntry(entrySide: RoundResult, round: Round): "green" | "red" | "tie" {
  if (round.result === entrySide) return "green";
  if (round.result === "T") return "tie";
  return "red";
}

function tieMultiplierLabel(round: Round) {
  const explicit = normalizeTiePayout(round.tieMultiplier);
  if (explicit) return explicit;

  if (round.bankerScore === round.playerScore) {
    return tiePayoutFromScore(round.bankerScore);
  }

  return null;
}

function normalizeTiePayout(value: unknown) {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.replace(/x/i, ""))
        : 0;
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  if ([4, 6, 10, 25, 88].includes(Math.round(numeric))) return `${Math.round(numeric)}X`;
  return tiePayoutFromScore(Math.round(numeric));
}

function tiePayoutFromScore(score: number) {
  const payouts: Record<number, string> = {
    2: "88X",
    3: "25X",
    4: "10X",
    5: "6X",
    6: "4X",
    7: "4X",
    8: "4X",
    9: "6X",
    10: "10X",
    11: "25X",
    12: "88X",
  };
  return payouts[Math.round(score)] ?? null;
}

function matchesCurrentStrategyTail(strategy: PatternMinerStrategy, rounds: Round[]) {
  if (!rounds.length || !strategy.sequence.length || rounds.length < strategy.sequence.length) return false;
  const tail = rounds.slice(-strategy.sequence.length);
  return tail.every((round, index) => matchesPatternToken(round, strategy.sequence[index]));
}

function matchesPatternToken(round: Round, token: string) {
  const side = token[0] as RoundResult;
  if (round.result !== side) return false;
  if (token.length === 1) return true;

  const score = Number(token.slice(1));
  if (!Number.isFinite(score)) return true;
  return patternScoreForRound(round, side) === score;
}

function patternScoreForRound(round: Round, side: RoundResult) {
  if (side === "B") return round.bankerScore;
  if (side === "P") return round.playerScore;
  return round.bankerScore === round.playerScore
    ? round.bankerScore
    : Math.max(round.bankerScore, round.playerScore);
}

function normalizePatternHistoryItem(item: PatternIaHistoryItem): PatternIaHistoryItem {
  const isTie = item.result === "EMPATE" || item.result === "EMPATE_G1";
  const tieMultiplier = isTie ? normalizeTiePayout(item.tieMultiplier) ?? item.tieMultiplier : item.tieMultiplier;
  const resultText = historyResultText({ ...item, tieMultiplier });
  return {
    ...item,
    tieMultiplier,
    label: isTie ? resultText : `${item.technicalSide} ${resultText}`,
    timeLabel: patternIaHistoryTimeLabel(item.closedAt),
  };
}

function normalizeServerPatternIaCycle(value: unknown): PatternIaCycle | null {
  if (!isRecord(value)) return null;
  if (String(value.module || "").toUpperCase() !== "PADROES_IA") return null;

  const sideCode = normalizePatternSide(value.sideCode);
  const technicalSide = normalizeTechnicalSide(value.technicalSide);
  const cycleStatus = normalizePatternCycleStatus(value.cycleStatus);
  const sourceRoundId = Number(value.sourceRoundId);
  if (!sideCode || !technicalSide || !cycleStatus || !Number.isFinite(sourceRoundId)) return null;

  const contract = isRecord(value.contract) ? value.contract : {};
  return {
    module: "PADROES_IA",
    cycleStatus,
    attempt: normalizePatternAttempt(value.attempt) ?? "SG",
    patternId: readPatternString(value.patternId) || readPatternString(value.signalId) || "padroes-ia",
    signalId: readPatternString(value.signalId) || "",
    eventId: readPatternString(value.eventId) || "",
    patternName: readPatternString(value.patternName) || readPatternString(contract.patternName),
    technicalSide,
    sideCode,
    sourceRoundId,
    entryRoundId: readPatternString(value.entryRoundId) || null,
    g1RoundId: readPatternString(value.g1RoundId) || null,
    result: normalizePatternCycleResult(value.result),
    tieMultiplier: normalizeTiePayout(value.tieMultiplier) ?? (readPatternString(value.tieMultiplier) || null),
    openedAt: readPatternString(value.openedAt) || new Date().toISOString(),
    closedAt: readPatternString(value.closedAt) || null,
    entryConfirmedVisible: true,
    contract: {
      accuracy: clamp(Math.round(readNumberish(contract.accuracy) ?? 0), 0, 100),
      strength: clamp(Math.round(readNumberish(contract.strength) ?? 0), 0, 100),
      samples: Math.max(0, Math.round(readNumberish(contract.samples) ?? 0)),
      recentGreens: Math.max(0, Math.round(readNumberish(contract.recentGreens) ?? 0)),
      recentReds: Math.max(0, Math.round(readNumberish(contract.recentReds) ?? 0)),
      patternName: readPatternString(contract.patternName) || readPatternString(value.patternName),
      patternStatus: readPatternString(contract.patternStatus) || "CONFIRMADO",
      sequence: Array.isArray(contract.sequence)
        ? contract.sequence.map((token) => normalizePatternToken(String(token || ""))).filter(Boolean)
        : parsePatternSequence(readPatternString(value.patternName) || readPatternString(contract.patternName), sideCode),
    },
  };
}

function normalizePatternCycleStatus(value: unknown): PatternCycleStatus | null {
  const text = String(value || "").trim().toUpperCase();
  if (text === "AGUARDANDO_RESULTADO" || text === "AGUARDANDO_G1" || text === "CLOSED") return text;
  if (text === "CANCELADO" || text === "EXPIRADO") return text;
  return null;
}

function normalizePatternAttempt(value: unknown): PatternCycleAttempt | null {
  const text = String(value || "").trim().toUpperCase();
  if (text === "SG" || text === "G1") return text;
  return null;
}

function normalizePatternCycleResult(value: unknown): PatternCycleResult {
  const text = String(value || "").trim().toUpperCase();
  if (text === "GREEN" || text === "GREEN_G1" || text === "RED" || text === "EMPATE" || text === "EMPATE_G1") return text;
  return null;
}

function readPatternString(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizePatternSide(value: unknown): RoundResult | null {
  const text = String(value ?? "").trim().toUpperCase();
  if (!text || text === "NONE" || text === "WAITING") return null;
  if (text === "B" || text.includes("BANKER") || text.includes("BANCA")) return "B";
  if (text === "P" || text.includes("PLAYER") || text.includes("JOGADOR")) return "P";
  if (text === "T" || text.includes("TIE") || text.includes("EMPATE")) return "T";
  return null;
}

function readNumberish(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const normalized = value.replace("%", "").replace(",", ".").trim();
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function parsePatternSequence(patternName: string, fallbackSide: RoundResult) {
  const tokens = String(patternName || "")
    .split(/[^A-Za-z0-9]+/)
    .map((token) => normalizePatternToken(token))
    .filter((token): token is string => Boolean(token));
  return tokens.length ? tokens : [fallbackSide];
}

function normalizePatternToken(token: string) {
  const text = token.trim().toUpperCase();
  if (!text) return "";
  const compact = text
    .replace(/^BANKER/, "B")
    .replace(/^PLAYER/, "P")
    .replace(/^JOGADOR/, "P")
    .replace(/^EMPATE/, "T")
    .replace(/^TIE/, "T");
  return /^[BPT]\d*$/.test(compact) ? compact : "";
}

function sequenceLabel(sequence: string[]) {
  return sequence.join("-").toUpperCase();
}

function sideLabel(side: RoundResult): TechnicalSide {
  if (side === "B") return "BANKER";
  if (side === "P") return "PLAYER";
  return "TIE";
}

function toneForSide(side: RoundResult) {
  if (side === "B") return "red" as const;
  if (side === "P") return "blue" as const;
  return "gold" as const;
}

function panelClassForSide(side: RoundResult) {
  if (side === "B") return "border-banker/35 bg-banker/10";
  if (side === "P") return "border-player/35 bg-player/10";
  return "border-tie/40 bg-tie/10";
}

function borderClassForSide(side: RoundResult) {
  if (side === "B") return "border-banker/35";
  if (side === "P") return "border-player/35";
  return "border-tie/35";
}

function snapshotIsOld(snapshot: PatternMinerSnapshot, dashboardUpdatedAt?: string | null) {
  const snapshotMs = Date.parse(snapshot.updatedAt || "");
  if (!Number.isFinite(snapshotMs)) return true;
  const dashboardMs = Date.parse(String(dashboardUpdatedAt || ""));
  if (Number.isFinite(dashboardMs)) return snapshotMs + SNAPSHOT_OLD_MS < dashboardMs;
  return Date.now() - snapshotMs > SNAPSHOT_OLD_MS;
}

function signalIdFromAlert(alert: PatternMinerAlert | undefined) {
  if (!alert) return "";
  return String(alert.signal_id || alert.signalId || alert.id || "");
}

function eventIdFromAlert(alert: PatternMinerAlert | undefined) {
  if (!alert) return "";
  return String(alert.event_id || alert.eventId || alert.id || "");
}

function generatedAtFromAlert(alert: PatternMinerAlert | undefined) {
  if (!alert) return "";
  return String(alert.generated_at || alert.generatedAt || "");
}

function alertRoundId(alert: PatternMinerAlert | undefined) {
  if (!alert) return undefined;
  const explicit = Number(alert.round_id ?? alert.roundId);
  if (Number.isFinite(explicit)) return explicit;
  return numericRoundId(alert.matchedRounds.at(-1));
}

function numericRoundId(round: Round | undefined) {
  const value = Number(round?.id);
  return Number.isFinite(value) ? value : undefined;
}

function isCycleOpen(cycle: PatternIaCycle) {
  return cycle.cycleStatus === "AGUARDANDO_RESULTADO" || cycle.cycleStatus === "AGUARDANDO_G1";
}

const PATTERN_RESULT_HOLD_MS = 5_000;

function shouldDisplayCycleInMainCard(cycle: PatternIaCycle) {
  if (isCycleOpen(cycle)) return true;
  if (!cycle.closedAt) return false;
  const closedAt = Date.parse(cycle.closedAt);
  if (!Number.isFinite(closedAt)) return false;
  const age = Date.now() - closedAt;
  return age >= -5_000 && age <= PATTERN_RESULT_HOLD_MS;
}

function sameContractCycle(contract: HotPatternsAiContract, cycle: PatternIaCycle) {
  return contract.signalId === cycle.signalId && contract.eventId === cycle.eventId;
}

function shouldKeepClosedCycle(cycle: PatternIaCycle, latestRoundId?: number) {
  if (isCycleOpen(cycle)) return true;
  if (latestRoundId === undefined) return true;
  return latestRoundId - cycle.sourceRoundId <= 3;
}

function cycleKey(cycle: PatternIaCycle | null) {
  if (!cycle) return "";
  return `${cycle.signalId}:${cycle.eventId}:${cycle.cycleStatus}:${cycle.attempt}:${cycle.result ?? "pending"}`;
}

function historyItemFromCycle(cycle: PatternIaCycle | null): PatternIaHistoryItem | null {
  if (!cycle) return null;
  if (!cycle.entryConfirmedVisible) return null;
  const isClosed = cycle.cycleStatus === "CLOSED" && cycle.result && cycle.closedAt;
  const closedRoundId = cycle.attempt === "G1" ? cycle.g1RoundId : cycle.entryRoundId;
  const result: PatternHistoryResult = isClosed
    ? cycle.result as Exclude<PatternCycleResult, null>
    : cycle.cycleStatus === "AGUARDANDO_G1"
      ? "AGUARDANDO_G1"
      : "AGUARDANDO";
  const closedAt = isClosed ? cycle.closedAt as string : cycle.openedAt;
  return normalizePatternHistoryItem({
    module: "PADROES_IA",
    cycleId: patternIaHistoryCycleId(cycle),
    patternId: cycle.patternId,
    technicalSide: cycle.technicalSide,
    result,
    attempt: cycle.attempt,
    tieMultiplier: cycle.tieMultiplier,
    entryRoundId: cycle.entryRoundId,
    closedRoundId,
    closedAt,
    label: patternIaHistoryLabel({ ...cycle, result }),
    timeLabel: patternIaHistoryTimeLabel(closedAt),
  });
}

function patternIaHistoryCycleId(cycle: {
  module: PatternIaCycle["module"];
  patternId: string;
  signalId: string;
  eventId: string;
  entryRoundId: string | number | null;
  sourceRoundId: string | number | null;
}) {
  return [
    cycle.module,
    cycle.patternId,
    cycle.signalId,
    cycle.eventId,
    cycle.entryRoundId ?? cycle.sourceRoundId ?? "entry",
  ].join(":");
}

function patternIaHistoryLabel(cycle: Pick<PatternIaCycle, "technicalSide" | "attempt" | "tieMultiplier"> & { result: PatternHistoryResult | PatternCycleResult }) {
  return `${cycle.technicalSide} ${historyResultText({
    result: cycle.result ?? "RED",
    attempt: cycle.attempt,
    tieMultiplier: cycle.tieMultiplier,
  })}`;
}

function historyResultText(item: Pick<PatternIaHistoryItem, "result" | "attempt" | "tieMultiplier">) {
  if (item.result === "AGUARDANDO") return "AGUARDANDO SG";
  if (item.result === "AGUARDANDO_G1") return "AGUARDANDO G1";
  if (item.result === "GREEN") return "GREEN SG";
  if (item.result === "GREEN_G1") return "GREEN G1";
  if (item.result === "RED") return "RED";
  if (item.result === "EMPATE" || item.result === "EMPATE_G1") {
    return item.tieMultiplier ? `EMPATE ${item.tieMultiplier}` : `EMPATE ${item.attempt}`;
  }
  return item.result;
}

function patternIaHistoryTimeLabel(closedAt: string) {
  const timestamp = Date.parse(closedAt);
  if (!Number.isFinite(timestamp)) return "--";
  return new Date(timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function upsertPatternIaHistory(history: PatternIaHistoryItem[], item: PatternIaHistoryItem) {
  const existingIndex = history.findIndex((entry) => entry.cycleId === item.cycleId);
  const next = existingIndex >= 0 ? history.map((entry, index) => (index === existingIndex ? item : entry)) : [item, ...history];
  const byCycle = new Map<string, PatternIaHistoryItem>();

  for (const entry of next) {
    if (entry.module !== "PADROES_IA" || !entry.cycleId) continue;
    byCycle.set(entry.cycleId, entry);
  }

  const deduped = [...byCycle.values()]
    .filter(isTerminalPatternIaHistoryItem)
    .filter(isCurrentPatternIaDayHistoryItem)
    .sort((left, right) => Date.parse(right.closedAt || "") - Date.parse(left.closedAt || ""))
    .slice(0, MAX_PATTERN_IA_HISTORY);

  return patternIaHistoryEquals(history, deduped) ? history : deduped;
}

function mergePatternIaHistories(primary: PatternIaHistoryItem[], secondary: PatternIaHistoryItem[]) {
  let merged = secondary;
  for (const item of primary.slice().reverse()) {
    merged = upsertPatternIaHistory(merged, item);
  }
  return merged;
}

function patternIaHistoryEquals(left: PatternIaHistoryItem[], right: PatternIaHistoryItem[]) {
  if (left.length !== right.length) return false;
  return left.every((item, index) => JSON.stringify(item) === JSON.stringify(right[index]));
}

function patternIaHistoryFromPersistentResult(value: DashboardPersistentResult): PatternIaHistoryItem | null {
  if (value.moduleKey !== "PADROES_IA") return null;
  const technicalSide = technicalSideFromPersistentResult(value);
  if (!technicalSide) return null;
  const result = normalizePatternHistoryResult(value.resultType, value.attempt);
  if (!result) return null;
  const tieMultiplier =
    typeof value.tieMultiplier === "string" && value.tieMultiplier
      ? value.tieMultiplier.toUpperCase()
      : typeof value.tieMultiplier === "number"
        ? `${value.tieMultiplier}X`
        : null;
  const payload = value.payload ?? {};
  const patternId = String(payload.patternId ?? value.signalId ?? value.resultId);
  const signalId = String(value.signalId ?? patternId);
  const eventId = String(payload.eventId ?? value.resultId);
  const entryRoundId = payload.entryRoundId ? String(payload.entryRoundId) : null;
  const sourceRoundId = payload.sourceRoundId ? String(payload.sourceRoundId) : null;

  return normalizePatternHistoryItem({
    module: "PADROES_IA",
    cycleId: patternIaHistoryCycleId({
      module: "PADROES_IA",
      patternId,
      signalId,
      eventId,
      entryRoundId,
      sourceRoundId,
    }),
    patternId,
    technicalSide,
    result,
    attempt: value.attempt === "G1" ? "G1" : "SG",
    tieMultiplier,
    entryRoundId,
    closedRoundId: value.roundId === undefined || value.roundId === null ? null : String(value.roundId),
    closedAt: value.createdAt,
    label: value.label,
    timeLabel: patternIaHistoryTimeLabel(value.createdAt),
  });
}

function normalizeTechnicalSide(value: unknown): TechnicalSide | null {
  const text = String(value || "")
    .trim()
    .toUpperCase();
  if (text === "BANKER" || text === "B") return "BANKER";
  if (text === "PLAYER" || text === "P") return "PLAYER";
  if (text === "TIE" || text === "T" || text === "EMPATE") return "TIE";
  return null;
}

function technicalSideFromPersistentResult(value: DashboardPersistentResult): TechnicalSide | null {
  const payload = value.payload ?? {};
  return (
    normalizeTechnicalSide(payload.technicalSide) ??
    normalizeTechnicalSide(payload.entrySide) ??
    normalizeTechnicalSide(payload.expectedSide) ??
    normalizeTechnicalSide(payload.side) ??
    normalizeTechnicalSide(value.side)
  );
}

function normalizePatternHistoryResult(value: unknown, attempt?: unknown): PatternHistoryResult | null {
  const text = String(value || "")
    .trim()
    .toUpperCase();
  if (text === "GREEN_G1") return "GREEN_G1";
  if (text === "GREEN") return attempt === "G1" ? "GREEN_G1" : "GREEN";
  if (text === "RED") return "RED";
  if (text === "EMPATE_G1") return "EMPATE_G1";
  if (text === "EMPATE" || text === "TIE") return attempt === "G1" ? "EMPATE_G1" : "EMPATE";
  if (text === "AGUARDANDO" || text === "PENDING") return "AGUARDANDO";
  if (text === "AGUARDANDO_G1" || text === "PENDING_G1") return "AGUARDANDO_G1";
  if (text === "CANCELADO" || text === "EXPIRADO") return text;
  return null;
}

function readPatternIaHistory() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PATTERN_IA_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PatternIaHistoryItem[];
    if (!Array.isArray(parsed)) return [];
    const cleaned = parsed
      .filter((item) => item?.module === "PADROES_IA" && item.cycleId && item.closedAt)
      .map(normalizePatternHistoryItem)
      .filter(isTerminalPatternIaHistoryItem)
      .filter(isCurrentPatternIaDayHistoryItem)
      .slice(0, MAX_PATTERN_IA_HISTORY);
    if (cleaned.length !== parsed.length) {
      window.localStorage.setItem(PATTERN_IA_HISTORY_STORAGE_KEY, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch {
    return [];
  }
}

function persistPatternIaHistory(history: PatternIaHistoryItem[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      PATTERN_IA_HISTORY_STORAGE_KEY,
      JSON.stringify(filterCurrentPatternIaDayHistory(history).slice(0, MAX_PATTERN_IA_HISTORY)),
    );
  } catch {
    // Local history is best-effort; the official feed remains the source of truth for live signals.
  }
}

function filterCurrentPatternIaDayHistory(history: PatternIaHistoryItem[]) {
  return history
    .filter(isTerminalPatternIaHistoryItem)
    .filter(isCurrentPatternIaDayHistoryItem)
    .sort((left, right) => Date.parse(right.closedAt || "") - Date.parse(left.closedAt || ""))
    .slice(0, MAX_PATTERN_IA_HISTORY);
}

function isTerminalPatternIaHistoryItem(item: PatternIaHistoryItem) {
  return item.result !== "AGUARDANDO" && item.result !== "AGUARDANDO_G1";
}

function isCurrentPatternIaDayHistoryItem(item: PatternIaHistoryItem) {
  return patternIaLocalDayKey(item.closedAt) === patternIaLocalDayKey(new Date());
}

function patternIaLocalDayKey(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function clearPatternIaHistoryStorage() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PATTERN_IA_HISTORY_STORAGE_KEY);
  } catch {
    // The official dashboard feed must render the same state on web and mobile.
  }
}

function historySideClass(side: TechnicalSide) {
  if (side === "BANKER") return sideTextClass.B;
  if (side === "PLAYER") return sideTextClass.P;
  return sideTextClass.T;
}

function historyResultClass(result: PatternHistoryResult) {
  if (result === "GREEN" || result === "GREEN_G1") return "text-success";
  if (result === "RED") return "text-destructive";
  if (result === "EMPATE" || result === "EMPATE_G1") return "text-tie";
  if (result === "AGUARDANDO" || result === "AGUARDANDO_G1") return "text-warning";
  return "text-muted-foreground";
}

function isTieHistoryResult(result: PatternHistoryResult) {
  return result === "EMPATE" || result === "EMPATE_G1";
}

function readStoredCycle() {
  if (typeof window === "undefined") return null;
  try {
    window.sessionStorage.removeItem(PATTERN_IA_CYCLE_STORAGE_KEY);
  } catch {
    // The official dashboard payload is the source of truth for active cycles.
  }
  return null;
}

function persistCycle(cycle: PatternIaCycle | null, latestRoundId?: number) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(PATTERN_IA_CYCLE_STORAGE_KEY);
  } catch {
    // Session storage is not used for live Pattern IA cycles; web/mobile must render the same official payload.
  }
}

function publicContract(contract: HotPatternsAiContract) {
  return {
    module: contract.module,
    source: contract.source,
    status: contract.status,
    technicalSide: contract.technicalSide,
    accuracy: contract.accuracy,
    strength: contract.strength,
    samples: contract.samples,
    recentGreens: contract.recentGreens,
    recentReds: contract.recentReds,
    patternName: contract.patternName,
    patternStatus: contract.patternStatus,
    blocked: contract.blocked,
    blockReason: contract.blockReason,
    updatedAt: contract.updatedAt,
    signal_id: contract.signalId,
    event_id: contract.eventId,
    round_id: contract.roundId,
    reason: contract.reason ?? null,
    candidatesAudited: contract.candidatesAudited,
    rankingPreview: contract.rankingPreview,
  };
}

function publicCycle(cycle: PatternIaCycle) {
  return {
    module: cycle.module,
    cycleStatus: cycle.cycleStatus,
    attempt: cycle.attempt,
    patternId: cycle.patternId,
    technicalSide: cycle.technicalSide,
    entryRoundId: cycle.entryRoundId,
    g1RoundId: cycle.g1RoundId,
    result: cycle.result,
    tieMultiplier: cycle.tieMultiplier,
    openedAt: cycle.openedAt,
    closedAt: cycle.closedAt,
    signal_id: cycle.signalId,
    event_id: cycle.eventId,
  };
}

function readNumber(source: PatternMinerStrategy, keys: string[]) {
  const record = source as unknown as Record<string, unknown>;
  for (const key of keys) {
    const value = Number(record[key]);
    if (Number.isFinite(value)) return value;
  }
  return undefined;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function logPatternIa(tag: string, payload: Record<string, unknown>) {
  console.info(tag, JSON.stringify(payload));
}
