import type {
  NeuralReading,
  NeuralScoreboard,
  Round,
  RoundResult,
  SignalSide,
} from "@/types/dashboard";
import { calculateMotorAssertiveness, roundPercent } from "@/utils/assertiveness";

type NeuralSide = SignalSide | "TIE";
type ValidationKind = "sg" | "g1" | "red" | "tie" | "pending";

interface PayingEvent {
  numero: number;
  origem: NeuralSide;
  label: string;
}

interface DirectionStats {
  sg: number;
  g1: number;
  red: number;
  tie: number;
  totalValidated: number;
  sequencePositive: number;
  sequenceNegative: number;
  maxSequencePositive: number;
  maxSequenceNegative: number;
  lastOutcome: "green" | "red" | null;
}

interface CandidateBucket {
  event: PayingEvent;
  occurrences: number;
  byExpected: Record<RoundResult, DirectionStats>;
}

interface RankedDirection {
  expected: RoundResult;
  stats: DirectionStats;
  accuracy: number;
}

interface NumeroPaganteNeuralSnapshot {
  reading: NeuralReading;
  scoreboard: NeuralScoreboard;
}

const EMPTY_DIRECTION_STATS: DirectionStats = {
  sg: 0,
  g1: 0,
  red: 0,
  tie: 0,
  totalValidated: 0,
  sequencePositive: 0,
  sequenceNegative: 0,
  maxSequencePositive: 0,
  maxSequenceNegative: 0,
  lastOutcome: null,
};

const MIN_ACTIVE_VALIDATED = 3;
const MIN_ACTIVE_ACCURACY = 99;
const RED_ALERT_ACCURACY = 45;

export function buildNumeroPaganteNeural(
  rounds: Round[] | undefined,
): NumeroPaganteNeuralSnapshot | null {
  const validRounds = (rounds ?? []).filter(isValidRound);
  if (!validRounds.length) return null;

  const latestEvent = payingEventForRound(validRounds[validRounds.length - 1]);
  if (!latestEvent) return null;

  const buckets = catalogPayingNumbers(validRounds);
  const currentBucket = buckets.get(candidateKey(latestEvent));
  const currentDirection = pickBestDirection(currentBucket, latestEvent.origem);
  const currentStats = currentDirection?.stats ?? cloneStats(EMPTY_DIRECTION_STATS);
  const totalGreens = currentStats.sg + currentStats.g1;
  const total = totalGreens + currentStats.red;
  const accuracy = calculateMotorAssertiveness(totalGreens, currentStats.red);
  const expectedSide = resultToNeuralSide(currentDirection?.expected ?? sideToResult(latestEvent.origem));
  const origemTipo = originKindFor(latestEvent.origem, expectedSide);
  const isActivePagante =
    origemTipo === "PAGANTE" &&
    total >= MIN_ACTIVE_VALIDATED &&
    accuracy >= MIN_ACTIVE_ACCURACY;
  const mode = isActivePagante ? "ACTIVE" : "OBSERVING";
  const isRedAlert =
    currentStats.sequenceNegative >= 2 ||
    (total >= MIN_ACTIVE_VALIDATED && accuracy < RED_ALERT_ACCURACY);
  const isSaturated =
    currentStats.sequenceNegative >= 2 ||
    (total >= MIN_ACTIVE_VALIDATED + 2 && accuracy < RED_ALERT_ACCURACY);
  const paganteStatus = statusFor({ total, accuracy, isRedAlert, isSaturated, mode });

  return {
    reading: {
      mode,
      numero: latestEvent.numero,
      origem: latestEvent.origem,
      origemTipo,
      direcao: expectedSide,
      validade: "G1",
      alertas: total,
      acertos: totalGreens,
      greenSemGale: currentStats.sg,
      greenG1: currentStats.g1,
      erros: currentStats.red,
      reds: currentStats.red,
      assertividade: accuracy,
      sequencePositive: currentStats.sequencePositive,
      sequenceNegative: currentStats.sequenceNegative,
      maxSequencePositive: currentStats.maxSequencePositive,
      maxSequenceNegative: currentStats.maxSequenceNegative,
      paganteStatus,
      paganteAlert: alertFor(latestEvent, expectedSide, total, accuracy),
      paganteWindow: 2,
      isSaturated,
      isRedAlert,
      postTie: latestEvent.origem === "TIE",
    },
    scoreboard: {
      totalAlerts: total,
      acertos: totalGreens,
      greens: totalGreens,
      greenSemGale: currentStats.sg,
      greenG1: currentStats.g1,
      erros: currentStats.red,
      reds: currentStats.red,
      assertividade: accuracy,
      sequencePositive: currentStats.sequencePositive,
      sequenceNegative: currentStats.sequenceNegative,
      maxSequencePositive: currentStats.maxSequencePositive,
      maxSequenceNegative: currentStats.maxSequenceNegative,
    },
  };
}

function catalogPayingNumbers(rounds: Round[]) {
  const buckets = new Map<string, CandidateBucket>();

  for (let index = 0; index < rounds.length; index += 1) {
    const event = payingEventForRound(rounds[index]);
    if (!event) continue;

    const key = candidateKey(event);
    const bucket = buckets.get(key) ?? {
      event,
      occurrences: 0,
      byExpected: {
        B: cloneStats(EMPTY_DIRECTION_STATS),
        P: cloneStats(EMPTY_DIRECTION_STATS),
        T: cloneStats(EMPTY_DIRECTION_STATS),
      },
    };

    bucket.occurrences += 1;

    for (const expected of ["B", "P", "T"] as const) {
      applyValidation(bucket.byExpected[expected], rounds, index + 1, expected);
    }

    buckets.set(key, bucket);
  }

  return buckets;
}

function applyValidation(
  stats: DirectionStats,
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
    applySequence(stats, "green");
    return;
  }
  if (validation.kind === "g1") {
    stats.g1 += 1;
    applySequence(stats, "green");
    return;
  }

  stats.red += 1;
  applySequence(stats, "red");
}

function validateOccurrence(
  rounds: Round[],
  entryIndex: number,
  expected: RoundResult,
): { kind: ValidationKind; tieCount: number } {
  const sgRound = rounds[entryIndex];
  const g1Round = rounds[entryIndex + 1];
  if (!sgRound) return { kind: "pending", tieCount: 0 };

  if (sgRound.result === expected) {
    return { kind: "sg", tieCount: expected === "T" ? 1 : 0 };
  }

  let tieCount = sgRound.result === "T" ? 1 : 0;
  if (!g1Round) return { kind: "pending", tieCount };

  if (g1Round.result === expected) {
    return { kind: "g1", tieCount: tieCount + (expected === "T" ? 1 : 0) };
  }

  tieCount += g1Round.result === "T" ? 1 : 0;
  if (tieCount > 0 && expected !== "T") return { kind: "tie", tieCount };

  return { kind: "red", tieCount };
}

function applySequence(stats: DirectionStats, result: "green" | "red") {
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

function pickBestDirection(
  bucket: CandidateBucket | undefined,
  origem: NeuralSide,
): RankedDirection | null {
  if (!bucket) return null;

  return (["B", "P", "T"] as const)
    .map((expected) => {
      const stats = bucket.byExpected[expected];
      const greens = stats.sg + stats.g1;
      const accuracy = calculateMotorAssertiveness(greens, stats.red);
      const expectedSide = resultToNeuralSide(expected);
      const originMatchBonus = expectedSide === origem ? 1 : 0;
      const nonTieBonus = expected !== "T" ? 0.5 : 0;

      return {
        expected,
        stats,
        accuracy: roundPercent(accuracy),
        rankScore:
          accuracy +
          greens * 2 +
          stats.totalValidated +
          originMatchBonus +
          nonTieBonus -
          stats.red,
      };
    })
    .sort((a, b) => {
      if (a.rankScore !== b.rankScore) return b.rankScore - a.rankScore;
      if (a.stats.totalValidated !== b.stats.totalValidated)
        return b.stats.totalValidated - a.stats.totalValidated;
      return a.expected.localeCompare(b.expected);
    })[0];
}

function payingEventForRound(round: Round | undefined): PayingEvent | null {
  if (!round || !isValidRound(round)) return null;

  if (round.result === "B") {
    return {
      numero: normalizeScore(round.bankerScore),
      origem: "BANKER",
      label: `${normalizeScore(round.bankerScore)} Banker`,
    };
  }
  if (round.result === "P") {
    return {
      numero: normalizeScore(round.playerScore),
      origem: "PLAYER",
      label: `${normalizeScore(round.playerScore)} Player`,
    };
  }

  const tieScore =
    round.bankerScore === round.playerScore
      ? round.bankerScore
      : Math.max(round.bankerScore, round.playerScore);
  return {
    numero: normalizeScore(tieScore),
    origem: "TIE",
    label: `${normalizeScore(tieScore)} Tie`,
  };
}

function isValidRound(round: Round) {
  return (
    ["B", "P", "T"].includes(round.result) &&
    Number.isFinite(round.bankerScore) &&
    Number.isFinite(round.playerScore)
  );
}

function normalizeScore(value: number) {
  return Math.max(0, Math.floor(value));
}

function candidateKey(event: PayingEvent) {
  return `${event.numero}:${event.origem}`;
}

function resultToNeuralSide(result: RoundResult): NeuralSide {
  if (result === "B") return "BANKER";
  if (result === "P") return "PLAYER";
  return "TIE";
}

function sideToResult(side: NeuralSide): RoundResult {
  if (side === "BANKER") return "B";
  if (side === "PLAYER") return "P";
  return "T";
}

function originKindFor(
  origem: NeuralSide,
  expectedSide: NeuralSide,
): NonNullable<NeuralReading["origemTipo"]> {
  if (origem === "TIE" || expectedSide === "TIE") return "TIE";
  return origem === expectedSide ? "PAGANTE" : "OPOSTO";
}

function statusFor({
  total,
  accuracy,
  isRedAlert,
  isSaturated,
  mode,
}: {
  total: number;
  accuracy: number;
  isRedAlert: boolean;
  isSaturated: boolean;
  mode: NeuralReading["mode"];
}) {
  if (total < MIN_ACTIVE_VALIDATED) return "AMOSTRA_BAIXA";
  if (isRedAlert) return "RISCO_RED";
  if (isSaturated) return "SATURADO";
  if (mode === "ACTIVE" && accuracy >= 70) return "VALIDO_FORTE";
  if (mode === "ACTIVE") return "VALIDO";
  return "OBSERVACAO";
}

function alertFor(event: PayingEvent, expectedSide: NeuralSide, total: number, accuracy: number) {
  const direction = expectedSide === "BANKER" ? "Banker" : expectedSide === "PLAYER" ? "Player" : "Tie";
  if (total < MIN_ACTIVE_VALIDATED) {
    return `${event.label}: coletando amostra para ${direction}.`;
  }
  return `${event.label}: ${direction} ate G1 com ${accuracy.toFixed(1)}%.`;
}

function cloneStats(stats: DirectionStats): DirectionStats {
  return { ...stats };
}
