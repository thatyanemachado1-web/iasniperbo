import type { Round, RoundResult } from "@/types/dashboard";
import type {
  PatternMinerAlert,
  PatternMinerConfig,
  PatternMinerHistoryLimit,
  PatternMinerOperationalStatus,
  PatternMinerScoreboard,
  PatternMinerSnapshot,
  PatternMinerStrategy,
  PatternMinerStrategyStatus,
} from "@/types/patternMiner";

export const PATTERN_MINER_HISTORY_OPTIONS: PatternMinerHistoryLimit[] = [
  1000, 5000, 10000, 15000, 50000,
];
export const PATTERN_MINER_TOP_STRATEGIES_LIMIT = 30;

export const DEFAULT_PATTERN_MINER_CONFIG: PatternMinerConfig = {
  historyLimit: 15000,
  minOccurrences: 3,
  minValidated: 2,
  patternLengths: [3, 4, 5],
};

const DEFAULT_PATTERN_MINER_RULES = {
  minOccurrences: 30,
  minAccuracy: 70,
  hotAccuracy: 90,
  perfectAccuracy: 100,
  maxRecentRedsAllowed: 1,
  maxSignalAgeMs: 120_000,
  allowTieEntry: false,
} as const;

const MIN_PATTERN_SCORE = 0;
const MAX_PATTERN_SCORE = 12;

export interface PatternMinerRuntimeContext {
  feedStatus?: string | null;
  dashboardUpdatedAt?: string | null;
  serverSnapshotUpdatedAt?: string | null;
  nowMs?: number;
}

type ValidationKind = "sg" | "g1" | "red" | "tie" | "pending";

interface ExpectedStats {
  sg: number;
  g1: number;
  red: number;
  tie: number;
  totalValidated: number;
  sequencePositive: number;
  sequenceNegative: number;
  maxSequencePositive: number;
  maxSequenceNegative: number;
  lastOutcome?: "green" | "red";
  lastHit?: string;
  lastRed?: string;
}

interface CandidateBucket {
  sequence: string[];
  occurrences: number;
  firstOccurrence?: string;
  lastOccurrence?: string;
  byExpected: Record<RoundResult, ExpectedStats>;
}

interface PatternEvaluationResult {
  status: PatternMinerOperationalStatus;
  blocked_reason: string;
  confirmed: boolean;
  signal_id?: string;
  title: string;
}

const EMPTY_EXPECTED_STATS: ExpectedStats = {
  sg: 0,
  g1: 0,
  red: 0,
  tie: 0,
  totalValidated: 0,
  sequencePositive: 0,
  sequenceNegative: 0,
  maxSequencePositive: 0,
  maxSequenceNegative: 0,
};

const patternMinerLogDedupe = new Map<string, number>();
const PATTERN_MINER_LOG_TTL_MS = 30_000;

export class PatternMinerEngine {
  private config: PatternMinerConfig;

  constructor(config: Partial<PatternMinerConfig> = {}) {
    this.config = { ...DEFAULT_PATTERN_MINER_CONFIG, ...config };
  }

  analyze(rounds: Round[], context: PatternMinerRuntimeContext = {}): PatternMinerSnapshot {
    const updatedAt = new Date().toISOString();
    const analyzedRounds = rounds.slice(-this.config.historyLimit);
    const catalog = this.catalogStrategies(analyzedRounds, updatedAt);
    const ranked = this.rankStrategies(catalog);
    const ranking = ranked.map((strategy, index) => ({ ...strategy, rank: index + 1 }));
    const strictHotStrategies = ranking.filter(
      (strategy) => strategy.heatStatus === "VERY_HOT" || strategy.heatStatus === "HOT",
    );
    const hotStrategies =
      strictHotStrategies.length >= 20
        ? strictHotStrategies.slice(0, PATTERN_MINER_TOP_STRATEGIES_LIMIT)
        : ranking
            .filter((strategy) => !strategy.insufficientSample)
            .slice(0, PATTERN_MINER_TOP_STRATEGIES_LIMIT);
    const alerts = this.detectRealtimeAlerts(analyzedRounds, ranking, context, updatedAt);
    const scoreboard = this.buildScoreboard(ranking);
    const primaryAlert = alerts.find((alert) => alert.kind === "validated") ?? alerts[0];
    const runtimeStatus = resolveSnapshotRuntimeStatus(primaryAlert, context, updatedAt);

    return {
      strategies: ranking,
      ranking,
      hotStrategies,
      formingAlerts: alerts.filter((alert) => alert.kind === "forming"),
      entryAlerts: alerts.filter((alert) => alert.kind === "validated"),
      scoreboard,
      agent: {
        catalogedStrategies: ranking.length,
        hotStrategies: hotStrategies.length,
        observedStrategies: ranking.filter((strategy) => strategy.heatStatus === "OBSERVATION").length,
        lastDiscovery: ranking.find((strategy) => !strategy.insufficientSample),
        updatedAt,
      },
      analyzedRounds: analyzedRounds.length,
      historyLimit: this.config.historyLimit,
      runtimeStatus: runtimeStatus.status,
      runtimeBlockedReason: runtimeStatus.blocked_reason,
      updatedAt,
    };
  }

  private catalogStrategies(rounds: Round[], updatedAt: string): PatternMinerStrategy[] {
    const buckets = new Map<string, CandidateBucket>();

    for (const length of this.config.patternLengths) {
      if (length < 2) continue;
      for (let start = 0; start <= rounds.length - length; start += 1) {
        const variants = buildSequenceVariants(rounds, start, length);
        const occurrenceLabel = formatRoundReference(rounds[start + length - 1]);

        for (const sequence of variants) {
          const key = sequence.join(">");
          const bucket = buckets.get(key) ?? {
            sequence,
            occurrences: 0,
            byExpected: {
              B: { ...EMPTY_EXPECTED_STATS },
              P: { ...EMPTY_EXPECTED_STATS },
              T: { ...EMPTY_EXPECTED_STATS },
            },
          };

          bucket.occurrences += 1;
          bucket.firstOccurrence ??= occurrenceLabel;
          bucket.lastOccurrence = occurrenceLabel;

          for (const expected of ["B", "P", "T"] as const) {
            applyValidation(bucket.byExpected[expected], rounds, start + length, expected);
          }

          buckets.set(key, bucket);
        }
      }
    }

    return Array.from(buckets.values())
      .filter((bucket) => bucket.occurrences >= this.config.minOccurrences)
      .map((bucket) => this.toStrategy(bucket, updatedAt));
  }

  private toStrategy(bucket: CandidateBucket, updatedAt: string): PatternMinerStrategy {
    const expectedOptions = (["B", "P", "T"] as const)
      .map((expected) => ({
        expected,
        stats: bucket.byExpected[expected],
        assertiveness: calculateAssertiveness(bucket.byExpected[expected]),
      }))
      .sort((a, b) => {
        const aRate = a.assertiveness ?? -1;
        const bRate = b.assertiveness ?? -1;
        if (aRate !== bRate) return bRate - aRate;
        const aGreens = a.stats.sg + a.stats.g1;
        const bGreens = b.stats.sg + b.stats.g1;
        if (aGreens !== bGreens) return bGreens - aGreens;
        return b.stats.totalValidated - a.stats.totalValidated;
      });

    const best = expectedOptions[0];
    const hasSample =
      bucket.occurrences >= this.config.minOccurrences &&
      best.stats.totalValidated >= this.config.minValidated &&
      best.stats.sg + best.stats.g1 > 0;
    const assertiveness = hasSample ? best.assertiveness : undefined;
    const signature = bucket.sequence.join("-");
    const normalizedSignature = normalizePatternSignature(bucket.sequence);
    const includesTie = bucket.sequence.some((token) => token.startsWith("T"));
    const tieCountInPattern = bucket.sequence.filter((token) => token.startsWith("T")).length;
    const heatStatus = statusFromStats(best.stats, assertiveness, hasSample);
    const operational = baseOperationalStatus(bucket.occurrences, assertiveness, best.stats.red);

    return {
      id: stableStrategyId(bucket.sequence),
      sequence: bucket.sequence,
      module: "PADROES_IA",
      pattern_signature: signature,
      pattern_signature_normalized: normalizedSignature,
      includes_tie: includesTie,
      tie_count_in_pattern: tieCountInPattern,
      next_side: best.expected,
      next_side_probability: best.assertiveness,
      signal_id: "",
      round_id: undefined,
      generated_at: updatedAt,
      occurrences: bucket.occurrences,
      accuracy: assertiveness,
      sg_count: best.stats.sg,
      g1_count: best.stats.g1,
      red_count: best.stats.red,
      tie_after_count: best.stats.tie,
      blocked_reason: operational.blocked_reason,
      expectedResult: best.expected,
      heatStatus,
      sg: best.stats.sg,
      g1: best.stats.g1,
      red: best.stats.red,
      tie: best.stats.tie,
      totalValidated: best.stats.totalValidated,
      sequencePositive: best.stats.sequencePositive,
      sequenceNegative: best.stats.sequenceNegative,
      maxSequencePositive: best.stats.maxSequencePositive,
      maxSequenceNegative: best.stats.maxSequenceNegative,
      assertiveness,
      lastOccurrence: bucket.lastOccurrence,
      lastHit: best.stats.lastHit,
      lastRed: best.stats.lastRed,
      createdAt: updatedAt,
      status: operational.status,
      insufficientSample: !hasSample,
      updatedAt,
      rank: 0,
    };
  }

  private rankStrategies(strategies: PatternMinerStrategy[]) {
    return [...strategies].sort((a, b) => {
      if (a.insufficientSample !== b.insufficientSample) return a.insufficientSample ? 1 : -1;
      const aRate = a.assertiveness ?? -1;
      const bRate = b.assertiveness ?? -1;
      const rateDiff = bRate - aRate;
      if (Math.abs(rateDiff) > 3) return rateDiff;
      const aSpecificity = numericSpecificityScore(a.sequence);
      const bSpecificity = numericSpecificityScore(b.sequence);
      if (aSpecificity !== bSpecificity) return bSpecificity - aSpecificity;
      if (aRate !== bRate) return rateDiff;
      if (a.totalValidated !== b.totalValidated) return b.totalValidated - a.totalValidated;
      if (a.occurrences !== b.occurrences) return b.occurrences - a.occurrences;
      return b.id.localeCompare(a.id);
    });
  }

  private detectRealtimeAlerts(
    rounds: Round[],
    ranking: PatternMinerStrategy[],
    context: PatternMinerRuntimeContext,
    generatedAt: string,
  ): PatternMinerAlert[] {
    const alerts: PatternMinerAlert[] = [];
    if (!rounds.length) return alerts;
    const latestRound = rounds[rounds.length - 1];

    for (const strategy of ranking.slice(0, 180)) {
      const length = strategy.sequence.length;
      if (rounds.length >= length) {
        const completedRounds = rounds.slice(-length);
        if (matchesSequence(completedRounds, strategy.sequence)) {
          const evaluation = evaluateLivePattern(strategy, context, latestRound, generatedAt);
          const strategyWithStatus: PatternMinerStrategy = {
            ...strategy,
            status: evaluation.status,
            blocked_reason: evaluation.blocked_reason,
            round_id: latestRound.id,
            generated_at: generatedAt,
            signal_id: evaluation.signal_id ?? "",
          };
          logPatternFormed(strategyWithStatus);
          if (evaluation.blocked_reason) {
            logPatternBlocked(strategyWithStatus);
            if (evaluation.status === "BLOQUEADO POR FEED STALE") {
              logPatternStaleGuard(strategyWithStatus, context.feedStatus ?? "");
            }
          }
          if (evaluation.confirmed) logPatternConfirmed(strategyWithStatus);
          alerts.push({
            id: `${evaluation.confirmed ? "validated" : "forming"}-${strategy.id}-${latestRound.id}`,
            kind: evaluation.confirmed ? "validated" : "forming",
            strategy: strategyWithStatus,
            matchedRounds: completedRounds,
            progress: 1,
            missingTokens: [],
            title: evaluation.title,
          });
          continue;
        }
      }

      for (let matched = length - 1; matched >= 1; matched -= 1) {
        if (rounds.length < matched) continue;
        const partialRounds = rounds.slice(-matched);
        const partialSequence = strategy.sequence.slice(0, matched);
        if (matchesSequence(partialRounds, partialSequence)) {
          const formingStrategy: PatternMinerStrategy = {
            ...strategy,
            status: "PADRAO EM FORMACAO",
            blocked_reason: "",
            round_id: latestRound.id,
            generated_at: generatedAt,
            signal_id: "",
          };
          alerts.push({
            id: `forming-${strategy.id}-${matched}`,
            kind: "forming",
            strategy: formingStrategy,
            matchedRounds: partialRounds,
            progress: matched / length,
            missingTokens: strategy.sequence.slice(matched),
            title: "PADRAO EM FORMACAO",
          });
          break;
        }
      }
    }

    return alerts
      .sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === "validated" ? -1 : 1;
        if (a.progress !== b.progress) return b.progress - a.progress;
        return (b.strategy.assertiveness ?? 0) - (a.strategy.assertiveness ?? 0);
      })
      .slice(0, 40);
  }

  private buildScoreboard(strategies: PatternMinerStrategy[]): PatternMinerScoreboard {
    const validStrategies = strategies.filter((strategy) => !strategy.insufficientSample);
    const totals = validStrategies.reduce(
      (acc, strategy) => {
        acc.sg += strategy.sg;
        acc.g1 += strategy.g1;
        acc.red += strategy.red;
        acc.tie += strategy.tie;
        acc.totalValidated += strategy.totalValidated;
        acc.sequencePositive = Math.max(acc.sequencePositive, strategy.sequencePositive);
        acc.sequenceNegative = Math.max(acc.sequenceNegative, strategy.sequenceNegative);
        acc.maxSequencePositive = Math.max(acc.maxSequencePositive, strategy.maxSequencePositive);
        acc.maxSequenceNegative = Math.max(acc.maxSequenceNegative, strategy.maxSequenceNegative);
        return acc;
      },
      {
        sg: 0,
        g1: 0,
        red: 0,
        tie: 0,
        totalValidated: 0,
        sequencePositive: 0,
        sequenceNegative: 0,
        maxSequencePositive: 0,
        maxSequenceNegative: 0,
      },
    );

    return {
      ...totals,
      assertiveness: totals.totalValidated
        ? ((totals.sg + totals.g1) / totals.totalValidated) * 100
        : undefined,
    };
  }
}

function applyValidation(
  stats: ExpectedStats,
  rounds: Round[],
  entryIndex: number,
  expected: RoundResult,
) {
  const validation = validateOccurrence(rounds, entryIndex, expected);
  stats.tie += validation.tieCount;

  if (validation.kind === "pending" || validation.kind === "tie") return;

  stats.totalValidated += 1;
  if (validation.kind === "sg") {
    stats.sg += 1;
    stats.lastHit = validation.roundLabel;
    applyPatternResultSequence(stats, "green");
    return;
  }
  if (validation.kind === "g1") {
    stats.g1 += 1;
    stats.lastHit = validation.roundLabel;
    applyPatternResultSequence(stats, "green");
    return;
  }

  stats.red += 1;
  stats.lastRed = validation.roundLabel;
  applyPatternResultSequence(stats, "red");
}

function applyPatternResultSequence(stats: ExpectedStats, result: "green" | "red") {
  if (result === "green") {
    stats.sequencePositive = stats.lastOutcome === "green" ? stats.sequencePositive + 1 : 1;
    stats.sequenceNegative = 0;
    stats.maxSequencePositive = Math.max(stats.maxSequencePositive, stats.sequencePositive);
    stats.lastOutcome = "green";
    return;
  }

  stats.sequenceNegative = stats.lastOutcome === "red" ? stats.sequenceNegative + 1 : 1;
  stats.sequencePositive = 0;
  stats.maxSequenceNegative = Math.max(stats.maxSequenceNegative, stats.sequenceNegative);
  stats.lastOutcome = "red";
}

function validateOccurrence(
  rounds: Round[],
  entryIndex: number,
  expected: RoundResult,
): { kind: ValidationKind; tieCount: number; roundLabel?: string } {
  const sgRound = rounds[entryIndex];
  const g1Round = rounds[entryIndex + 1];
  if (!sgRound) return { kind: "pending", tieCount: 0 };

  if (sgRound.result === expected) {
    return {
      kind: "sg",
      tieCount: expected === "T" ? 1 : 0,
      roundLabel: formatRoundReference(sgRound),
    };
  }

  let tieCount = sgRound.result === "T" ? 1 : 0;
  if (!g1Round) return { kind: "pending", tieCount };

  if (g1Round.result === expected) {
    return {
      kind: "g1",
      tieCount: tieCount + (expected === "T" ? 1 : 0),
      roundLabel: formatRoundReference(g1Round),
    };
  }

  tieCount += g1Round.result === "T" ? 1 : 0;
  if (tieCount > 0 && expected !== "T")
    return { kind: "tie", tieCount, roundLabel: formatRoundReference(g1Round) };

  return { kind: "red", tieCount, roundLabel: formatRoundReference(g1Round) };
}

function buildSequenceVariants(rounds: Round[], start: number, length: number) {
  const tokenOptions = rounds.slice(start, start + length).map(tokenOptionsForRound);
  return tokenOptions.reduce<string[][]>(
    (sequences, options) =>
      sequences.flatMap((sequence) => options.map((option) => [...sequence, option])),
    [[]],
  );
}

function tokenOptionsForRound(round: Round) {
  const score = scoreForResult(round, round.result);
  const options = [round.result];
  if (score !== null) {
    options.unshift(`${round.result}${score}`);
  }
  return options;
}

function matchesSequence(rounds: Round[], sequence: string[]) {
  if (rounds.length !== sequence.length) return false;
  return rounds.every((round, index) => matchesToken(round, sequence[index]));
}

function matchesToken(round: Round, token: string) {
  const parsed = parsePatternToken(token);
  if (!parsed) return false;
  if (round.result !== parsed.side) return false;
  if (parsed.number === undefined) return true;
  return scoreForResult(round, parsed.side) === parsed.number;
}

function scoreForResult(round: Round, side: RoundResult) {
  if (side === "B") return normalizePatternScore(round.bankerScore);
  if (side === "P") return normalizePatternScore(round.playerScore);
  return normalizePatternScore(round.bankerScore);
}

function normalizePatternScore(score: unknown) {
  const parsedScore = Number(score);
  if (!Number.isFinite(parsedScore)) return null;
  return Math.floor(Math.max(MIN_PATTERN_SCORE, Math.min(MAX_PATTERN_SCORE, parsedScore)));
}

export function parsePatternToken(token: string): { side: RoundResult; number?: number; normalized: string } | null {
  const match = String(token || "")
    .trim()
    .toUpperCase()
    .match(/^([PBT])(\d{1,2})?$/);
  if (!match) return null;
  const side = match[1] as RoundResult;
  const rawNumber = match[2];
  if (!rawNumber) return { side, normalized: side };
  const number = Number(rawNumber);
  if (!Number.isFinite(number) || number < 0 || number > 12) return null;
  return { side, number, normalized: `${side}${number}` };
}

export function parsePatternSequenceText(sequence: string): string[] {
  return String(sequence || "")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => parsePatternToken(token))
    .filter((token): token is { side: RoundResult; number?: number; normalized: string } => Boolean(token))
    .map((token) => token.normalized);
}

function normalizePatternSignature(sequence: string[]) {
  return sequence
    .map((token) => parsePatternToken(token))
    .map((token) => (token ? token.side : ""))
    .filter(Boolean)
    .join("-");
}

function numericSpecificityScore(sequence: string[]) {
  const numericTokens = sequence.filter((token) => /^[BPT]\d+$/.test(token)).length;
  return numericTokens * 4 + sequence.length;
}

function calculateAssertiveness(stats: ExpectedStats) {
  if (!stats.totalValidated) return undefined;
  return ((stats.sg + stats.g1) / stats.totalValidated) * 100;
}

function statusFromStats(
  stats: ExpectedStats,
  assertiveness: number | undefined,
  hasSample: boolean,
): PatternMinerStrategyStatus {
  if (!hasSample || assertiveness === undefined) return "INACTIVE";
  if (assertiveness >= 85 && stats.totalValidated >= 8) return "VERY_HOT";
  if (assertiveness >= 75) return "HOT";
  if (assertiveness >= 62) return "STABLE";
  if (assertiveness >= 50) return "OBSERVATION";
  return "WEAK";
}

function baseOperationalStatus(
  occurrences: number,
  accuracy: number | undefined,
  redCount: number,
): { status: PatternMinerOperationalStatus; blocked_reason: string } {
  return resolvePatternStatusFromMetrics({ occurrences, accuracy, redCount });
}

export function resolvePatternStatusFromMetrics({
  occurrences,
  accuracy,
  redCount,
}: {
  occurrences: number;
  accuracy: number | undefined;
  redCount: number;
}): { status: PatternMinerOperationalStatus; blocked_reason: string } {
  if (occurrences < DEFAULT_PATTERN_MINER_RULES.minOccurrences || accuracy === undefined) {
    return { status: "BLOQUEADO POR AMOSTRA BAIXA", blocked_reason: "amostra_baixa" };
  }
  if (redCount >= 2) return { status: "BLOQUEADO POR 2 REDS", blocked_reason: "two_reds" };
  if (accuracy >= DEFAULT_PATTERN_MINER_RULES.perfectAccuracy) {
    return { status: "PADRAO 100%", blocked_reason: "" };
  }
  if (accuracy >= DEFAULT_PATTERN_MINER_RULES.hotAccuracy) return { status: "PADRAO QUENTE", blocked_reason: "" };
  if (accuracy >= DEFAULT_PATTERN_MINER_RULES.minAccuracy) return { status: "PADRAO EM FORMACAO", blocked_reason: "" };
  return { status: "BLOQUEADO POR AMOSTRA BAIXA", blocked_reason: "accuracy_baixa" };
}

function evaluateLivePattern(
  strategy: PatternMinerStrategy,
  context: PatternMinerRuntimeContext,
  latestRound: Round,
  generatedAt: string,
): PatternEvaluationResult {
  if (isFeedStale(context, generatedAt)) {
    return {
      status: "BLOQUEADO POR FEED STALE",
      blocked_reason: "feed_stale",
      confirmed: false,
      title: "PADRAO IA FORMADO",
    };
  }

  if (isSnapshotOld(context, generatedAt, latestRound.id)) {
    return {
      status: "BLOQUEADO POR SNAPSHOT ANTIGO",
      blocked_reason: "snapshot_antigo",
      confirmed: false,
      title: "PADRAO IA FORMADO",
    };
  }

  if (strategy.red_count >= 2) {
    return {
      status: "BLOQUEADO POR 2 REDS",
      blocked_reason: "two_reds",
      confirmed: false,
      title: "PADRAO IA FORMADO",
    };
  }

  if (
    strategy.occurrences < DEFAULT_PATTERN_MINER_RULES.minOccurrences ||
    (strategy.accuracy ?? 0) < DEFAULT_PATTERN_MINER_RULES.minAccuracy
  ) {
    return {
      status: "BLOQUEADO POR AMOSTRA BAIXA",
      blocked_reason: "amostra_baixa",
      confirmed: false,
      title: "PADRAO IA FORMADO",
    };
  }

  if (strategy.next_side === "T" && !DEFAULT_PATTERN_MINER_RULES.allowTieEntry) {
    return {
      status: "ALERTA DE EMPATE",
      blocked_reason: "tie_entry_disabled",
      confirmed: false,
      title: "ALERTA DE EMPATE",
    };
  }

  const signalId = buildPatternSignalId(strategy, latestRound, generatedAt);
  if ((strategy.accuracy ?? 0) >= DEFAULT_PATTERN_MINER_RULES.perfectAccuracy) {
    return {
      status: "PADRAO 100%",
      blocked_reason: "",
      confirmed: true,
      signal_id: signalId,
      title: "ENTRADA CONFIRMADA",
    };
  }
  if ((strategy.accuracy ?? 0) >= DEFAULT_PATTERN_MINER_RULES.hotAccuracy) {
    return {
      status: "PADRAO QUENTE",
      blocked_reason: "",
      confirmed: true,
      signal_id: signalId,
      title: "ENTRADA CONFIRMADA",
    };
  }
  return {
    status: "ENTRADA CONFIRMADA",
    blocked_reason: "",
    confirmed: true,
    signal_id: signalId,
    title: "ENTRADA CONFIRMADA",
  };
}

function resolveSnapshotRuntimeStatus(
  primaryAlert: PatternMinerAlert | undefined,
  context: PatternMinerRuntimeContext,
  generatedAt: string,
) {
  if (primaryAlert) {
    return {
      status: primaryAlert.strategy.status,
      blocked_reason: primaryAlert.strategy.blocked_reason ?? "",
    };
  }
  if (isFeedStale(context, generatedAt)) {
    return { status: "BLOQUEADO POR FEED STALE" as const, blocked_reason: "feed_stale" };
  }
  return { status: "AGUARDANDO PADRAO" as const, blocked_reason: "" };
}

function buildPatternSignalId(strategy: PatternMinerStrategy, latestRound: Round, generatedAt: string) {
  return `pattern-ai:${strategy.id}:${latestRound.id}:${strategy.next_side || "NONE"}:${Date.parse(generatedAt) || Date.now()}`;
}

function isFeedStale(context: PatternMinerRuntimeContext, generatedAt: string) {
  const feedStatus = String(context.feedStatus || "").trim().toLowerCase();
  if (feedStatus === "stale" || feedStatus === "paused" || feedStatus === "parado") return true;
  const dashboardUpdatedAtMs = Date.parse(String(context.dashboardUpdatedAt || ""));
  const generatedAtMs = Date.parse(generatedAt);
  const referenceMs = Number.isFinite(dashboardUpdatedAtMs) ? dashboardUpdatedAtMs : generatedAtMs;
  const nowMs = context.nowMs ?? Date.now();
  if (!Number.isFinite(referenceMs)) return false;
  return nowMs - referenceMs > DEFAULT_PATTERN_MINER_RULES.maxSignalAgeMs;
}

function isSnapshotOld(context: PatternMinerRuntimeContext, generatedAt: string, latestRoundId: number) {
  const snapshotUpdatedAtMs = Date.parse(String(context.serverSnapshotUpdatedAt || ""));
  if (!Number.isFinite(snapshotUpdatedAtMs)) return false;
  const generatedAtMs = Date.parse(generatedAt);
  if (!Number.isFinite(generatedAtMs)) return false;
  const nowMs = context.nowMs ?? Date.now();
  const staleByTime = nowMs - snapshotUpdatedAtMs > DEFAULT_PATTERN_MINER_RULES.maxSignalAgeMs;
  const staleByOrder = snapshotUpdatedAtMs < generatedAtMs && latestRoundId > 0;
  return staleByTime || staleByOrder;
}

function logPatternEvent(label: string, key: string, payload: Record<string, unknown>) {
  const now = Date.now();
  for (const [cacheKey, cacheAt] of patternMinerLogDedupe.entries()) {
    if (now - cacheAt > PATTERN_MINER_LOG_TTL_MS) patternMinerLogDedupe.delete(cacheKey);
  }
  if (patternMinerLogDedupe.has(key)) return;
  patternMinerLogDedupe.set(key, now);
  console.info(JSON.stringify({ event: label, ...payload }));
}

function logPatternFormed(strategy: PatternMinerStrategy) {
  logPatternEvent("[PADROES_IA_PATTERN_FORMED]", `formed:${strategy.id}:${strategy.round_id}:${strategy.status}`, {
    signature: strategy.pattern_signature,
    normalized_signature: strategy.pattern_signature_normalized,
    includes_tie: strategy.includes_tie,
    tie_count: strategy.tie_count_in_pattern,
    round_id: strategy.round_id ?? 0,
    generated_at: strategy.generated_at,
    next_side: strategy.next_side || "",
    occurrences: strategy.occurrences,
    accuracy: strategy.accuracy ?? 0,
    sg_count: strategy.sg_count,
    g1_count: strategy.g1_count,
    red_count: strategy.red_count,
    tie_after_count: strategy.tie_after_count,
    status: strategy.status,
  });
}

function logPatternBlocked(strategy: PatternMinerStrategy) {
  logPatternEvent("[PADROES_IA_BLOCKED]", `blocked:${strategy.id}:${strategy.round_id}:${strategy.blocked_reason}`, {
    signature: strategy.pattern_signature,
    reason: strategy.blocked_reason || "",
    red_count: strategy.red_count,
    occurrences: strategy.occurrences,
    accuracy: strategy.accuracy ?? 0,
    round_id: strategy.round_id ?? 0,
    generated_at: strategy.generated_at,
  });
}

function logPatternConfirmed(strategy: PatternMinerStrategy) {
  logPatternEvent("[PADROES_IA_CONFIRMED]", `confirmed:${strategy.signal_id}:${strategy.round_id}`, {
    signal_id: strategy.signal_id || "",
    signature: strategy.pattern_signature,
    side: strategy.next_side || "",
    round_id: strategy.round_id ?? 0,
    generated_at: strategy.generated_at,
  });
}

function logPatternStaleGuard(strategy: PatternMinerStrategy, feedStatus: string) {
  logPatternEvent("[PADROES_IA_STALE_GUARD]", `stale:${strategy.id}:${strategy.round_id}`, {
    signature: strategy.pattern_signature,
    round_id: strategy.round_id ?? 0,
    generated_at: strategy.generated_at,
    feedStatus,
    blocked_reason: strategy.blocked_reason || "",
  });
}

function stableStrategyId(sequence: string[]) {
  const value = sequence.join(">");
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return `pm-${hash.toString(16)}`;
}

function formatRoundReference(round: Round | undefined) {
  if (!round) return undefined;
  return `#${round.id}${round.time ? ` ${round.time}` : ""}`;
}
