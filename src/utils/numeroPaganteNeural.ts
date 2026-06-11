import type {
  NeuralReading,
  NeuralScoreboard,
  Round,
  RoundResult,
  SignalSide,
} from "@/types/dashboard";
import { calculateMotorAssertiveness, roundPercent } from "@/utils/assertiveness";

type NeuralSide = SignalSide | "TIE";
type ValidationKind = "sg" | "g1" | "red" | "tie_sg" | "tie_g1" | "pending";

interface PayingEvent {
  numero: number;
  origem: NeuralSide;
  origemTipo: NonNullable<NeuralReading["origemTipo"]>;
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

interface CandidateQualification {
  totalGreens: number;
  total: number;
  accuracy: number;
  expectedSide: NeuralSide;
  origemTipo: NonNullable<NeuralReading["origemTipo"]>;
  isBlockedByRedSequence: boolean;
  isQualifiedNumber: boolean;
}

interface NumeroPaganteNeuralSnapshot {
  reading: NeuralReading;
  scoreboard: NeuralScoreboard;
}

interface GeneralNeuralOutcome {
  kind: "sg" | "g1" | "red";
  result: "green" | "red";
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

const NEURAL_PANEL_ROUND_LIMIT = 156;
const NEURAL_GENERAL_SCORE_ROUND_LIMIT = 300;
const MIN_ACTIVE_VALIDATED = 2;
const MIN_ACTIVE_GREENS = 2;
const MIN_ACTIVE_ACCURACY = 90;
const RED_ALERT_ACCURACY = 45;

export function buildNumeroPaganteNeural(
  rounds: Round[] | undefined,
  _currentCycleRounds?: Round[] | undefined,
): NumeroPaganteNeuralSnapshot | null {
  const allValidRounds = (rounds ?? []).filter(isValidRound);
  const validRounds = allValidRounds.slice(-NEURAL_PANEL_ROUND_LIMIT);
  if (!allValidRounds.length || !validRounds.length) return null;

  const buckets = catalogPayingNumbers(validRounds);
  const activeEventIndex = pickActiveEventIndex(validRounds, buckets);
  const latestEvent = pickRoundEvent(validRounds, activeEventIndex, buckets);
  if (!latestEvent) return null;

  const currentBucket = buckets.get(candidateKey(latestEvent));
  const currentDirection = pickBestDirection(currentBucket, latestEvent.origem);
  const generalRounds = allValidRounds.slice(-NEURAL_GENERAL_SCORE_ROUND_LIMIT);
  const generalBuckets = catalogPayingNumbers(generalRounds);
  const generalScoreboard = buildGeneralScoreboard(generalRounds, generalBuckets);
  const currentStats = currentDirection?.stats ?? cloneStats(EMPTY_DIRECTION_STATS);
  const {
    totalGreens,
    total,
    accuracy,
    expectedSide,
    origemTipo,
    isBlockedByRedSequence,
    isQualifiedNumber,
  } = qualifyCandidate(latestEvent, currentDirection);
  const mode = isQualifiedNumber ? "ACTIVE" : "OBSERVING";
  const isRedAlert =
    isBlockedByRedSequence ||
    (total >= MIN_ACTIVE_VALIDATED && accuracy < RED_ALERT_ACCURACY);
  const isSaturated =
    currentStats.sequenceNegative >= 2 ||
    (total >= MIN_ACTIVE_VALIDATED + 2 && accuracy < RED_ALERT_ACCURACY);
  const paganteStatus = statusFor({ total, accuracy, isBlockedByRedSequence, isRedAlert, isSaturated, mode });

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
      paganteAlert: alertFor(latestEvent, expectedSide, origemTipo, total, accuracy),
      paganteWindow: NEURAL_PANEL_ROUND_LIMIT,
      paganteCycleProgress: validRounds.length,
      paganteCycleLimit: NEURAL_PANEL_ROUND_LIMIT,
      isSaturated,
      isRedAlert,
      postTie: latestEvent.origem === "TIE",
    },
    scoreboard: generalScoreboard,
  };
}

function buildGeneralScoreboard(
  rounds: Round[],
  buckets: Map<string, CandidateBucket>,
): NeuralScoreboard {
  const outcomes: GeneralNeuralOutcome[] = [];

  for (let index = 0; index < rounds.length; index += 1) {
    const event = pickRoundEvent(rounds, index, buckets);
    if (!event) continue;

    const direction = pickBestDirection(buckets.get(candidateKey(event)), event.origem);
    if (!direction) continue;

    const qualification = qualifyCandidate(event, direction);
    if (!shouldCountInGeneralScore(qualification, direction.stats)) continue;

    const validation = validateOccurrence(rounds, index + 1, direction.expected);
    if (validation.kind === "pending") continue;

    if (validation.kind === "sg" || validation.kind === "tie_sg") {
      outcomes.push({ kind: "sg", result: "green" });
      continue;
    }

    if (validation.kind === "g1" || validation.kind === "tie_g1") {
      outcomes.push({ kind: "g1", result: "green" });
      continue;
    }

    outcomes.push({ kind: "red", result: "red" });
  }

  const sg = outcomes.filter((outcome) => outcome.kind === "sg").length;
  const g1 = outcomes.filter((outcome) => outcome.kind === "g1").length;
  const red = outcomes.filter((outcome) => outcome.kind === "red").length;
  const greens = sg + g1;
  const sequence = calculateGeneralSequences(outcomes);

  return {
    totalAlerts: greens + red,
    acertos: greens,
    greens,
    greenSemGale: sg,
    greenG1: g1,
    erros: red,
    reds: red,
    assertividade: calculateMotorAssertiveness(greens, red),
    sequencePositive: sequence.sequencePositive,
    sequenceNegative: sequence.sequenceNegative,
    maxSequencePositive: sequence.maxSequencePositive,
    maxSequenceNegative: sequence.maxSequenceNegative,
  };
}

function shouldCountInGeneralScore(
  qualification: CandidateQualification,
  stats: DirectionStats,
) {
  return (
    (qualification.origemTipo === "PAGANTE" ||
      qualification.origemTipo === "OPOSTO" ||
      qualification.origemTipo === "TIE") &&
    qualification.total >= MIN_ACTIVE_VALIDATED &&
    (qualification.totalGreens >= MIN_ACTIVE_GREENS || stats.red > 0)
  );
}

function calculateGeneralSequences(outcomes: GeneralNeuralOutcome[]) {
  let sequencePositive = 0;
  let sequenceNegative = 0;
  let maxSequencePositive = 0;
  let maxSequenceNegative = 0;
  let lastOutcome: GeneralNeuralOutcome["result"] | null = null;

  for (const outcome of outcomes) {
    if (outcome.result === "green") {
      sequencePositive = lastOutcome === "green" ? sequencePositive + 1 : 1;
      sequenceNegative = 0;
      maxSequencePositive = Math.max(maxSequencePositive, sequencePositive);
      lastOutcome = "green";
      continue;
    }

    sequenceNegative = lastOutcome === "red" ? sequenceNegative + 1 : 1;
    sequencePositive = 0;
    maxSequenceNegative = Math.max(maxSequenceNegative, sequenceNegative);
    lastOutcome = "red";
  }

  return {
    sequencePositive,
    sequenceNegative,
    maxSequencePositive,
    maxSequenceNegative,
  };
}

function pickActiveEventIndex(rounds: Round[], buckets: Map<string, CandidateBucket>) {
  const latestIndex = rounds.length - 1;
  const previousIndex = latestIndex - 1;
  if (previousIndex < 0) return latestIndex;

  if (wasPreviousRoundLockedByOlderG1(rounds, buckets, latestIndex)) return latestIndex;

  const previousEvent = pickRoundEvent(rounds, previousIndex, buckets);
  if (!previousEvent) return latestIndex;

  const previousDirection = pickBestDirection(
    buckets.get(candidateKey(previousEvent)),
    previousEvent.origem,
  );
  const previousQualification = qualifyCandidate(previousEvent, previousDirection);

  if (
    previousQualification.isQualifiedNumber &&
    previousDirection &&
    isWaitingForG1(rounds[latestIndex], previousDirection.expected)
  ) {
    return previousIndex;
  }

  return latestIndex;
}

function wasPreviousRoundLockedByOlderG1(
  rounds: Round[],
  buckets: Map<string, CandidateBucket>,
  latestIndex: number,
) {
  const priorTriggerIndex = latestIndex - 2;
  const priorSgIndex = latestIndex - 1;
  if (priorTriggerIndex < 0 || priorSgIndex < 0) return false;

  const priorEvent = pickRoundEvent(rounds, priorTriggerIndex, buckets);
  if (!priorEvent) return false;

  const priorDirection = pickBestDirection(
    buckets.get(candidateKey(priorEvent)),
    priorEvent.origem,
  );
  if (!priorDirection) return false;

  const priorQualification = qualifyCandidate(priorEvent, priorDirection);
  return priorQualification.isQualifiedNumber && isWaitingForG1(rounds[priorSgIndex], priorDirection.expected);
}

function qualifyCandidate(
  event: PayingEvent,
  direction: RankedDirection | null,
): CandidateQualification {
  const stats = direction?.stats ?? cloneStats(EMPTY_DIRECTION_STATS);
  const totalGreens = stats.sg + stats.g1;
  const total = totalGreens + stats.red;
  const accuracy = calculateMotorAssertiveness(totalGreens, stats.red);
  const expectedSide = resultToNeuralSide(direction?.expected ?? sideToResult(event.origem));
  const origemTipo = event.origemTipo;
  const isBlockedByRedSequence = stats.sequenceNegative >= 2;
  const isQualifiedNumber =
    !isBlockedByRedSequence &&
    (origemTipo === "PAGANTE" || origemTipo === "OPOSTO" || origemTipo === "TIE") &&
    total >= MIN_ACTIVE_VALIDATED &&
    totalGreens >= MIN_ACTIVE_GREENS &&
    accuracy >= MIN_ACTIVE_ACCURACY;

  return {
    totalGreens,
    total,
    accuracy,
    expectedSide,
    origemTipo,
    isBlockedByRedSequence,
    isQualifiedNumber,
  };
}

function isWaitingForG1(round: Round | undefined, expected: RoundResult) {
  if (!round) return false;
  if (round.result === expected) return false;
  if (round.result === "T") return false;
  return true;
}

function catalogPayingNumbers(rounds: Round[]) {
  const buckets = new Map<string, CandidateBucket>();

  for (let index = 0; index < rounds.length; index += 1) {
    for (const event of payingEventsForRound(rounds[index])) {
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

  if (validation.kind === "pending") return;

  stats.totalValidated += 1;
  if (validation.kind === "sg" || validation.kind === "tie_sg") {
    stats.sg += 1;
    applySequence(stats, "green");
    return;
  }
  if (validation.kind === "g1" || validation.kind === "tie_g1") {
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

  if (sgRound.result === "T") {
    return { kind: expected === "T" ? "sg" : "tie_sg", tieCount: 1 };
  }

  if (sgRound.result === expected) {
    return { kind: "sg", tieCount: 0 };
  }

  if (!g1Round) return { kind: "pending", tieCount: 0 };

  if (g1Round.result === "T") {
    return { kind: expected === "T" ? "g1" : "tie_g1", tieCount: 1 };
  }

  if (g1Round.result === expected) {
    return { kind: "g1", tieCount: 0 };
  }

  return { kind: "red", tieCount: 0 };
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

function pickRoundEvent(
  rounds: Round[],
  index: number,
  buckets: Map<string, CandidateBucket>,
): PayingEvent | null {
  const events = payingEventsForRound(rounds[index]);
  if (!events.length) return null;

  return events
    .map((event) => {
      const direction = pickBestDirection(buckets.get(candidateKey(event)), event.origem);
      const qualification = qualifyCandidate(event, direction);
      const stats = direction?.stats ?? cloneStats(EMPTY_DIRECTION_STATS);
      const kindPriority =
        event.origemTipo === "PAGANTE" ? 3 : event.origemTipo === "TIE" ? 2 : 1;
      const matureScore =
        qualification.total >= MIN_ACTIVE_VALIDATED
          ? qualification.accuracy * 100 +
            qualification.totalGreens * 25 +
            qualification.total * 5 -
            stats.red * 80
          : qualification.total * 10;

      return {
        event,
        qualification,
        // O tipo do gatilho e so desempate: se o oposto estiver pagando melhor, ele aparece.
        score:
          (qualification.isQualifiedNumber ? 100000 : 0) +
          matureScore +
          kindPriority * 3,
      };
    })
    .sort((a, b) => b.score - a.score)[0]?.event ?? null;
}

function payingEventsForRound(round: Round | undefined): PayingEvent[] {
  if (!round || !isValidRound(round)) return [];

  if (round.result === "B") {
    const bankerScore = normalizeScore(round.bankerScore);
    const playerScore = normalizeScore(round.playerScore);
    return [
      {
        numero: bankerScore,
        origem: "BANKER",
        origemTipo: "PAGANTE",
        label: `${bankerScore} Banker`,
      },
      {
        numero: playerScore,
        origem: "PLAYER",
        origemTipo: "OPOSTO",
        label: `${playerScore} Player`,
      },
    ];
  }
  if (round.result === "P") {
    const bankerScore = normalizeScore(round.bankerScore);
    const playerScore = normalizeScore(round.playerScore);
    return [
      {
        numero: playerScore,
        origem: "PLAYER",
        origemTipo: "PAGANTE",
        label: `${playerScore} Player`,
      },
      {
        numero: bankerScore,
        origem: "BANKER",
        origemTipo: "OPOSTO",
        label: `${bankerScore} Banker`,
      },
    ];
  }

  const tieScore =
    round.bankerScore === round.playerScore
      ? round.bankerScore
      : Math.max(round.bankerScore, round.playerScore);
  const normalizedTieScore = normalizeScore(tieScore);
  return [
    {
      numero: normalizedTieScore,
      origem: "TIE",
      origemTipo: "TIE",
      label: `${normalizedTieScore} Tie`,
    },
  ];
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
  return `${event.numero}:${event.origem}:${event.origemTipo}`;
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

function statusFor({
  total,
  accuracy,
  isBlockedByRedSequence,
  isRedAlert,
  isSaturated,
  mode,
}: {
  total: number;
  accuracy: number;
  isBlockedByRedSequence: boolean;
  isRedAlert: boolean;
  isSaturated: boolean;
  mode: NeuralReading["mode"];
}) {
  if (total < MIN_ACTIVE_VALIDATED) return "AMOSTRA_BAIXA";
  if (isBlockedByRedSequence) return "BLOQUEADO_2_REDS";
  if (isRedAlert) return "RISCO_RED";
  if (isSaturated) return "SATURADO";
  if (mode === "ACTIVE" && accuracy >= 70) return "VALIDO_FORTE";
  if (mode === "ACTIVE") return "VALIDO";
  return "OBSERVACAO";
}

function alertFor(
  event: PayingEvent,
  expectedSide: NeuralSide,
  origemTipo: NonNullable<NeuralReading["origemTipo"]>,
  total: number,
  accuracy: number,
) {
  const direction = expectedSide === "BANKER" ? "Banker" : expectedSide === "PLAYER" ? "Player" : "Tie";
  const trigger =
    origemTipo === "OPOSTO"
      ? "gatilho oposto"
      : origemTipo === "TIE"
        ? "empate puxador"
        : "numero pagante";
  if (total < MIN_ACTIVE_VALIDATED) {
    return `${event.label}: coletando amostra de ${trigger} para ${direction}.`;
  }
  return `${event.label}: ${trigger} puxando ${direction} ate G1 com ${accuracy.toFixed(1)}%.`;
}

function cloneStats(stats: DirectionStats): DirectionStats {
  return { ...stats };
}
