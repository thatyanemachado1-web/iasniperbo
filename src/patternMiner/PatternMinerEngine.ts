import type { Round, RoundResult } from "@/types/dashboard";
import type {
  PatternMinerAlert,
  PatternMinerConfig,
  PatternMinerHistoryLimit,
  PatternMinerScoreboard,
  PatternMinerSnapshot,
  PatternMinerStrategy,
  PatternMinerStrategyStatus,
} from "@/types/patternMiner";

export const PATTERN_MINER_HISTORY_OPTIONS: PatternMinerHistoryLimit[] = [
  1000, 5000, 10000, 15000, 50000,
];

export const DEFAULT_PATTERN_MINER_CONFIG: PatternMinerConfig = {
  historyLimit: 15000,
  minOccurrences: 3,
  minValidated: 3,
  patternLengths: [2, 3, 4],
};

type ValidationKind = "sg" | "g1" | "red" | "tie" | "pending";

interface ExpectedStats {
  sg: number;
  g1: number;
  red: number;
  tie: number;
  totalValidated: number;
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

const EMPTY_EXPECTED_STATS: ExpectedStats = {
  sg: 0,
  g1: 0,
  red: 0,
  tie: 0,
  totalValidated: 0,
};

export class PatternMinerEngine {
  private config: PatternMinerConfig;

  constructor(config: Partial<PatternMinerConfig> = {}) {
    this.config = { ...DEFAULT_PATTERN_MINER_CONFIG, ...config };
  }

  analyze(rounds: Round[]): PatternMinerSnapshot {
    const updatedAt = new Date().toISOString();
    const analyzedRounds = rounds.slice(-this.config.historyLimit);
    const catalog = this.catalogStrategies(analyzedRounds, updatedAt);
    const ranked = this.rankStrategies(catalog);
    const ranking = ranked.map((strategy, index) => ({ ...strategy, rank: index + 1 }));
    const hotStrategies = ranking.filter(
      (strategy) => strategy.status === "VERY_HOT" || strategy.status === "HOT",
    );
    const alerts = this.detectRealtimeAlerts(analyzedRounds, ranking);
    const scoreboard = this.buildScoreboard(ranking);

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
        observedStrategies: ranking.filter((strategy) => strategy.status === "OBSERVATION").length,
        lastDiscovery: ranking.find((strategy) => !strategy.insufficientSample),
        updatedAt,
      },
      analyzedRounds: analyzedRounds.length,
      historyLimit: this.config.historyLimit,
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

    return {
      id: stableStrategyId(bucket.sequence),
      sequence: bucket.sequence,
      occurrences: bucket.occurrences,
      expectedResult: hasSample ? best.expected : undefined,
      sg: best.stats.sg,
      g1: best.stats.g1,
      red: best.stats.red,
      tie: best.stats.tie,
      totalValidated: best.stats.totalValidated,
      assertiveness,
      lastOccurrence: bucket.lastOccurrence,
      lastHit: best.stats.lastHit,
      lastRed: best.stats.lastRed,
      createdAt: updatedAt,
      status: statusFromStats(best.stats, assertiveness, hasSample),
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
      if (aRate !== bRate) return bRate - aRate;
      if (a.totalValidated !== b.totalValidated) return b.totalValidated - a.totalValidated;
      if (a.occurrences !== b.occurrences) return b.occurrences - a.occurrences;
      return b.id.localeCompare(a.id);
    });
  }

  private detectRealtimeAlerts(
    rounds: Round[],
    ranking: PatternMinerStrategy[],
  ): PatternMinerAlert[] {
    const alerts: PatternMinerAlert[] = [];
    if (!rounds.length) return alerts;

    for (const strategy of ranking.filter((item) => !item.insufficientSample).slice(0, 150)) {
      const length = strategy.sequence.length;
      if (rounds.length >= length) {
        const completedRounds = rounds.slice(-length);
        if (matchesSequence(completedRounds, strategy.sequence)) {
          alerts.push({
            id: `validated-${strategy.id}`,
            kind: "validated",
            strategy,
            matchedRounds: completedRounds,
            progress: 1,
            missingTokens: [],
            title: "PADRAO VALIDADO",
          });
          continue;
        }
      }

      for (let matched = length - 1; matched >= 1; matched -= 1) {
        if (rounds.length < matched) continue;
        const partialRounds = rounds.slice(-matched);
        const partialSequence = strategy.sequence.slice(0, matched);
        if (matchesSequence(partialRounds, partialSequence)) {
          alerts.push({
            id: `forming-${strategy.id}-${matched}`,
            kind: "forming",
            strategy,
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
        return acc;
      },
      { sg: 0, g1: 0, red: 0, tie: 0, totalValidated: 0 },
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
    return;
  }
  if (validation.kind === "g1") {
    stats.g1 += 1;
    stats.lastHit = validation.roundLabel;
    return;
  }

  stats.red += 1;
  stats.lastRed = validation.roundLabel;
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
  if (round.result === "T") return ["T"];
  const score = round.result === "B" ? round.bankerScore : round.playerScore;
  return [`${round.result}${score}`, round.result];
}

function matchesSequence(rounds: Round[], sequence: string[]) {
  if (rounds.length !== sequence.length) return false;
  return rounds.every((round, index) => matchesToken(round, sequence[index]));
}

function matchesToken(round: Round, token: string) {
  const side = token[0] as RoundResult;
  if (round.result !== side) return false;
  if (side === "T") return token === "T";
  if (token.length === 1) return true;

  const score = Number(token.slice(1));
  if (!Number.isFinite(score)) return true;
  return side === "B" ? round.bankerScore === score : round.playerScore === score;
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
