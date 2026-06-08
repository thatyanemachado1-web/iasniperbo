import type { Round, RoundResult } from "@/types/dashboard";
import type {
  PatternSuggestion,
  ValidatorConfig,
  ValidatorDetail,
  ValidatorEntryType,
  ValidatorGaleLimit,
  ValidatorPatternStatus,
  ValidatorPatternToken,
  ValidatorResult,
  ValidatorRisk,
} from "@/types/neuralValidator";

export const VALIDATOR_HISTORY_OPTIONS = [1000, 2000, 5000, 10000, 15000, 20000] as const;
export const DEFAULT_VALIDATOR_CONFIG: ValidatorConfig = {
  name: "Estrategia Neural",
  tableId: "bac-bo",
  entryType: "AI",
  galeLimit: 1,
  tieProtection: true,
  validityMode: "immediate",
  validityRounds: 1,
  historySize: 15000,
};

export interface PatternMiningFilters {
  historySize: number;
  patternLength: number;
  entryType: ValidatorEntryType;
  galeLimit: ValidatorGaleLimit;
  minAccuracy: number;
  minOccurrences: number;
  includeTie: boolean;
  includeNumbers: boolean;
  includeOpposite: boolean;
  hotOnly: boolean;
  lowRedOnly: boolean;
}

export class NeuralValidatorEngine {
  validatePattern(
    rounds: Round[],
    pattern: ValidatorPatternToken[],
    config: Partial<ValidatorConfig> = {},
  ): ValidatorResult {
    const mergedConfig = { ...DEFAULT_VALIDATOR_CONFIG, ...config };
    const analyzedRounds = rounds.slice(-Math.max(1, mergedConfig.historySize));
    const entry = resolvePatternEntry(analyzedRounds, pattern, mergedConfig.entryType, mergedConfig.galeLimit, mergedConfig.tieProtection);
    if (!pattern.length || !entry) return emptyResult(analyzedRounds.length, entry);

    const details: ValidatorDetail[] = [];
    let totalSignals = 0;
    let sgWins = 0;
    let g1Wins = 0;
    let g2Wins = 0;
    let losses = 0;
    let ties = 0;
    let tieWins = 0;
    let currentGreenStreak = 0;
    let currentLossStreak = 0;
    let bestGreenStreak = 0;
    let bestLossStreak = 0;
    let lastPatternResult = "Sem validacao";

    for (let start = 0; start <= analyzedRounds.length - pattern.length; start += 1) {
      const matchedRounds = analyzedRounds.slice(start, start + pattern.length);
      if (!matchesPattern(matchedRounds, pattern)) continue;

      const entryIndex = start + pattern.length;
      const validation = validateEntryAt(analyzedRounds, entryIndex, entry, mergedConfig.galeLimit, mergedConfig.tieProtection);
      if (validation.status === "PENDING") continue;

      totalSignals += 1;
      ties += validation.tieCount;
      if (validation.status === "TIE") {
        lastPatternResult = "TIE";
        details.push(buildDetail(analyzedRounds, entryIndex, entry, validation.status, validation.galeUsed, pattern));
        continue;
      }

      if (validation.status === "GREEN_SG") sgWins += 1;
      if (validation.status === "GREEN_G1") g1Wins += 1;
      if (validation.status === "GREEN_G2") g2Wins += 1;
      if (entry === "T" && validation.status.startsWith("GREEN")) tieWins += 1;
      if (validation.status === "RED") losses += 1;

      if (validation.status.startsWith("GREEN")) {
        currentGreenStreak += 1;
        currentLossStreak = 0;
        bestGreenStreak = Math.max(bestGreenStreak, currentGreenStreak);
      } else {
        currentLossStreak += 1;
        currentGreenStreak = 0;
        bestLossStreak = Math.max(bestLossStreak, currentLossStreak);
      }

      lastPatternResult = validation.status;
      details.push(buildDetail(analyzedRounds, entryIndex, entry, validation.status, validation.galeUsed, pattern));
    }

    const totalValidated = sgWins + g1Wins + g2Wins + losses;
    const accuracy = totalValidated ? ((sgWins + g1Wins + g2Wins) / totalValidated) * 100 : undefined;
    const sgAccuracy = totalValidated ? (sgWins / totalValidated) * 100 : undefined;
    const galeAccuracy = totalValidated ? ((sgWins + g1Wins + g2Wins) / totalValidated) * 100 : undefined;

    return {
      totalSignals,
      totalValidated,
      sgWins,
      g1Wins,
      g2Wins,
      losses,
      ties,
      tieWins,
      accuracy,
      sgAccuracy,
      galeAccuracy,
      currentGreenStreak,
      bestGreenStreak,
      bestLossStreak,
      lastPatternResult,
      details,
      entry,
      pulledSide: totalValidated ? entry : null,
      risk: riskFromStats(totalValidated, losses, accuracy),
      status: statusFromStats(totalValidated, accuracy),
      analyzedRounds: analyzedRounds.length,
    };
  }

  minePatterns(rounds: Round[], filters: Partial<PatternMiningFilters> = {}): PatternSuggestion[] {
    const mergedFilters: PatternMiningFilters = {
      historySize: 15000,
      patternLength: 3,
      entryType: "AI",
      galeLimit: 1,
      minAccuracy: 70,
      minOccurrences: 5,
      includeTie: true,
      includeNumbers: true,
      includeOpposite: true,
      hotOnly: false,
      lowRedOnly: false,
      ...filters,
    };
    const analyzedRounds = rounds.slice(-Math.max(1, mergedFilters.historySize));
    const patternLength = Math.max(2, mergedFilters.patternLength);
    const buckets = new Map<string, { pattern: ValidatorPatternToken[]; occurrences: number }>();

    for (let start = 0; start <= analyzedRounds.length - patternLength - 1; start += 1) {
      const source = analyzedRounds.slice(start, start + patternLength);
      if (!mergedFilters.includeTie && source.some((round) => round.result === "T")) continue;

      const variants = buildPatternVariants(source, mergedFilters.includeNumbers);
      for (const pattern of variants) {
        const key = patternKey(pattern);
        const bucket = buckets.get(key) ?? { pattern, occurrences: 0 };
        bucket.occurrences += 1;
        buckets.set(key, bucket);
      }
    }

    return Array.from(buckets.values())
      .filter((bucket) => bucket.occurrences >= mergedFilters.minOccurrences)
      .map((bucket) => {
        const validation = this.validatePattern(analyzedRounds, bucket.pattern, {
          entryType: mergedFilters.entryType,
          galeLimit: mergedFilters.galeLimit,
          tieProtection: true,
          historySize: mergedFilters.historySize,
        });
        const score = suggestionScore(validation, bucket.occurrences);
        return {
          id: stableId(patternKey(bucket.pattern)),
          pattern: bucket.pattern,
          pulledSide: validation.pulledSide,
          validation,
          occurrences: bucket.occurrences,
          score,
          risk: validation.risk,
          status: validation.status,
        };
      })
      .filter((suggestion) => {
        if (!suggestion.validation.totalValidated) return false;
        if ((suggestion.validation.accuracy ?? 0) < mergedFilters.minAccuracy) return false;
        if (mergedFilters.hotOnly && !["quente", "estavel"].includes(suggestion.status)) return false;
        if (mergedFilters.lowRedOnly && suggestion.validation.bestLossStreak > 1) return false;
        return true;
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 30);
  }
}

function resolvePatternEntry(
  rounds: Round[],
  pattern: ValidatorPatternToken[],
  entryType: ValidatorEntryType,
  galeLimit: ValidatorGaleLimit,
  tieProtection: boolean,
): RoundResult | null {
  if (entryType === "BANKER") return "B";
  if (entryType === "PLAYER") return "P";
  if (entryType === "TIE") return "T";

  const last = pattern.at(-1)?.side;
  if (!last) return null;
  if (entryType === "SAME_LAST") return last;
  if (entryType === "OPPOSITE") {
    if (last === "B") return "P";
    if (last === "P") return "B";
    return "T";
  }

  const candidates = (["B", "P", "T"] as const)
    .map((side) => ({
      side,
      result: validateFixedEntry(rounds, pattern, side, galeLimit, tieProtection),
    }))
    .sort((a, b) => {
      const aAccuracy = a.result.accuracy ?? -1;
      const bAccuracy = b.result.accuracy ?? -1;
      if (aAccuracy !== bAccuracy) return bAccuracy - aAccuracy;
      return b.result.totalValidated - a.result.totalValidated;
    });

  return candidates[0]?.result.totalValidated ? candidates[0].side : null;
}

function validateFixedEntry(
  rounds: Round[],
  pattern: ValidatorPatternToken[],
  entry: RoundResult,
  galeLimit: ValidatorGaleLimit,
  tieProtection: boolean,
) {
  let sgWins = 0;
  let g1Wins = 0;
  let g2Wins = 0;
  let losses = 0;

  for (let start = 0; start <= rounds.length - pattern.length; start += 1) {
    if (!matchesPattern(rounds.slice(start, start + pattern.length), pattern)) continue;
    const validation = validateEntryAt(rounds, start + pattern.length, entry, galeLimit, tieProtection);
    if (validation.status === "GREEN_SG") sgWins += 1;
    if (validation.status === "GREEN_G1") g1Wins += 1;
    if (validation.status === "GREEN_G2") g2Wins += 1;
    if (validation.status === "RED") losses += 1;
  }

  const totalValidated = sgWins + g1Wins + g2Wins + losses;
  return {
    totalValidated,
    accuracy: totalValidated ? ((sgWins + g1Wins + g2Wins) / totalValidated) * 100 : undefined,
  };
}

function validateEntryAt(
  rounds: Round[],
  entryIndex: number,
  entry: RoundResult,
  galeLimit: ValidatorGaleLimit,
  tieProtection: boolean,
): { status: ValidatorDetail["status"]; galeUsed: number; tieCount: number } {
  const maxGale = Math.max(0, Number(galeLimit) || 0);
  let galeUsed = 0;
  let tieCount = 0;
  let attempts = 0;
  let cursor = entryIndex;

  while (cursor < rounds.length && attempts <= maxGale + tieCount && cursor < entryIndex + maxGale + 4) {
    const round = rounds[cursor];
    if (!round) return { status: "PENDING", galeUsed, tieCount };

    if (round.result === entry) {
      if (entry === "T") tieCount += 1;
      return {
        status: galeUsed === 0 ? "GREEN_SG" : galeUsed === 1 ? "GREEN_G1" : "GREEN_G2",
        galeUsed,
        tieCount,
      };
    }

    if (round.result === "T") {
      tieCount += 1;
      if (tieProtection && entry !== "T") {
        cursor += 1;
        continue;
      }
      return { status: "TIE", galeUsed, tieCount };
    }

    attempts += 1;
    galeUsed = attempts;
    if (attempts > maxGale) return { status: "RED", galeUsed: maxGale, tieCount };
    cursor += 1;
  }

  return tieCount ? { status: "TIE", galeUsed, tieCount } : { status: "PENDING", galeUsed, tieCount };
}

function buildDetail(
  rounds: Round[],
  entryIndex: number,
  entry: RoundResult,
  status: ValidatorDetail["status"],
  galeUsed: number,
  sequence: ValidatorPatternToken[],
): ValidatorDetail {
  const round = rounds[entryIndex + galeUsed] ?? rounds[entryIndex] ?? rounds.at(-1);
  return {
    roundId: round?.id ?? 0,
    roundLabel: round ? `Rodada ${round.id}${round.time ? ` - ${round.time}` : ""}` : "Rodada pendente",
    entry,
    status,
    galeUsed,
    result: round?.result,
    sequence,
  };
}

function emptyResult(analyzedRounds: number, entry: RoundResult | null): ValidatorResult {
  return {
    totalSignals: 0,
    totalValidated: 0,
    sgWins: 0,
    g1Wins: 0,
    g2Wins: 0,
    losses: 0,
    ties: 0,
    tieWins: 0,
    currentGreenStreak: 0,
    bestGreenStreak: 0,
    bestLossStreak: 0,
    lastPatternResult: "Sem amostra suficiente",
    details: [],
    entry,
    pulledSide: null,
    risk: "alto",
    status: "sem_amostra",
    analyzedRounds,
  };
}

export function matchesPattern(rounds: Round[], pattern: ValidatorPatternToken[]) {
  if (rounds.length !== pattern.length) return false;
  return rounds.every((round, index) => matchesToken(round, pattern[index]));
}

export function matchesToken(round: Round, token: ValidatorPatternToken) {
  if (round.result !== token.side) return false;
  if (!token.score) return true;
  return scoreForRound(round, token.side) === token.score;
}

export function scoreForRound(round: Round, side: RoundResult) {
  if (side === "B") return round.bankerScore;
  if (side === "P") return round.playerScore;
  return round.bankerScore === round.playerScore
    ? round.bankerScore
    : Math.max(round.bankerScore, round.playerScore);
}

function buildPatternVariants(rounds: Round[], includeNumbers: boolean) {
  const options = rounds.map((round) => {
    const plain = { side: round.result } satisfies ValidatorPatternToken;
    if (!includeNumbers) return [plain];
    return [plain, { side: round.result, score: scoreForRound(round, round.result) }];
  });

  return options.reduce<ValidatorPatternToken[][]>(
    (patterns, tokenOptions) =>
      patterns.flatMap((pattern) => tokenOptions.map((token) => [...pattern, token])),
    [[]],
  );
}

function suggestionScore(result: ValidatorResult, occurrences: number) {
  const accuracy = result.accuracy ?? 0;
  const greenWeight = result.sgWins * 2.2 + result.g1Wins * 1.4 + result.g2Wins;
  const redPenalty = result.losses * 3 + result.bestLossStreak * 5;
  return accuracy * 2 + occurrences + greenWeight - redPenalty;
}

function statusFromStats(totalValidated: number, accuracy?: number): ValidatorPatternStatus {
  if (!totalValidated || accuracy === undefined) return "sem_amostra";
  if (accuracy >= 82 && totalValidated >= 8) return "quente";
  if (accuracy >= 70) return "estavel";
  if (accuracy >= 58) return "observacao";
  return "fraco";
}

function riskFromStats(totalValidated: number, losses: number, accuracy?: number): ValidatorRisk {
  if (!totalValidated || accuracy === undefined) return "alto";
  if (accuracy >= 80 && losses <= 2) return "baixo";
  if (accuracy >= 65) return "medio";
  return "alto";
}

export function patternKey(pattern: ValidatorPatternToken[]) {
  return pattern.map((token) => `${token.side}${token.score ?? ""}`).join(">");
}

function stableId(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return `nv-${hash.toString(16)}`;
}

export function formatPercent(value?: number) {
  if (value === undefined || Number.isNaN(value)) return "sem amostra";
  return `${value.toFixed(2).replace(".", ",")}%`;
}

export function sideName(side: RoundResult | null | undefined) {
  if (side === "B") return "BANKER";
  if (side === "P") return "PLAYER";
  if (side === "T") return "TIE";
  return "SEM LEITURA";
}

export function sideTone(side: RoundResult | null | undefined) {
  if (side === "B") return "text-banker";
  if (side === "P") return "text-player";
  if (side === "T") return "text-warning";
  return "text-muted-foreground";
}

export function formatToken(token: ValidatorPatternToken) {
  const prefix = token.side === "B" ? "B" : token.side === "P" ? "P" : "T";
  return `${prefix}${token.score ?? ""}`;
}
