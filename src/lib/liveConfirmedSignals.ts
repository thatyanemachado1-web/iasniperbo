import {
  detectLateralPayingNumbersConfirmedCard,
  detectLateralTiePatternsConfirmedCard,
} from "./telegramAutoV2.ts";
import type {
  DashboardData,
  NeuralEntryLastResult,
  NeuralReading,
  Round,
} from "../types/dashboard.ts";
import type { PatternMinerAlert, PatternMinerStrategy } from "../types/patternMiner.ts";

export type LiveSignalModuleKey =
  | "paying_numbers"
  | "surf_alert"
  | "ties_only"
  | "ai_patterns"
  | "lateral_paying_numbers"
  | "lateral_tie_patterns";

export type LiveConfirmedSignal = {
  moduleKey: LiveSignalModuleKey;
  signalKey: string;
  side: "BANKER" | "PLAYER" | "TIE";
  attempt: "SG" | "G1" | "";
};

const PATTERN_MIN_OCCURRENCES = 3;
const PATTERN_MIN_VALIDATED = 2;
const PATTERN_SNAPSHOT_MAX_AGE_MS = 120_000;
const RESOLVED_NEURAL_ENTRY_SUPPRESS_MS = 900;

export function resolveLiveConfirmedSignal(
  data: DashboardData,
  moduleKey: LiveSignalModuleKey,
): LiveConfirmedSignal | null {
  const latestRound = data.rounds.at(-1) ?? null;

  if (moduleKey === "paying_numbers") return resolveNeuralSignal(data, latestRound);
  if (moduleKey === "surf_alert") return resolveSurfSignal(data, latestRound);
  if (moduleKey === "ties_only") return resolveTieSignal(data, latestRound);
  if (moduleKey === "ai_patterns") return resolvePatternSignal(data, latestRound);
  if (moduleKey === "lateral_paying_numbers") {
    return resolveLateralSignal(data, latestRound, moduleKey);
  }
  return resolveLateralSignal(data, latestRound, "lateral_tie_patterns");
}

function resolveNeuralSignal(data: DashboardData, latestRound: Round | null) {
  const reading = data.neuralReading;
  if (!reading || neuralReadingIsBlocked(reading)) return null;

  const displaySide =
    data.displayState === "entry_confirmed" || data.displayState === "waiting_result"
      ? normalizeSide(data.displaySide)
      : null;
  const cycleStatus = normalizeText(reading.cycleStatus);
  const openCycle = cycleStatus === "AGUARDANDO_RESULTADO" || cycleStatus === "AGUARDANDO_G1";
  const cycleSide = openCycle
    ? normalizeSide(reading.targetSide ?? reading.direcao ?? reading.origem)
    : null;
  const activeSide =
    reading.mode === "ACTIVE" ? normalizeSide(reading.direcao ?? reading.origem) : null;
  const side = displaySide ?? cycleSide ?? activeSide;
  if (!side) return null;

  const hasNumber =
    neuralDisplayNumber(reading) !== null &&
    Boolean(reading.origem || reading.triggerSide || reading.oppositeSide);
  const forcedOfficialEntry = Boolean(displaySide || cycleSide);
  if (!hasNumber && !forcedOfficialEntry) return null;
  if (shouldHideResolvedNeuralEntry(side, data.neuralEntryLastResult)) return null;

  const attempt =
    data.neuralEntryState?.status === "awaiting_g1" || cycleStatus === "AGUARDANDO_G1"
      ? "G1"
      : "SG";
  const sourceKey =
    data.neuralEntryState?.key ||
    reading.entryRoundId ||
    reading.triggerRoundId ||
    data.displayRoundId ||
    latestRound?.id ||
    data.revision ||
    data.sequenceId ||
    "current";

  return {
    moduleKey: "paying_numbers" as const,
    signalKey: `live-neural:${sourceKey}:${side}:${attempt}`,
    side,
    attempt,
  };
}

function resolveSurfSignal(data: DashboardData, latestRound: Round | null) {
  if (data.moduleToggles?.surfAnalyzer === false) return null;
  const alert = data.currentSurfAlert;
  if (!alert) return null;

  const cycleSide = normalizeSide(alert.surfCycle?.technicalSide);
  if (alert.surfCycle?.cycleStatus === "AGUARDANDO_RESULTADO" && cycleSide) {
    const cycleKey =
      alert.surfCycle.cycleId || alert.surfCycle.entryRoundId || latestRound?.id || "current";
    return {
      moduleKey: "surf_alert" as const,
      signalKey: `live-surf-cycle:${cycleKey}:${cycleSide}`,
      side: cycleSide,
      attempt: "SG" as const,
    };
  }

  const side = normalizeSide(
    alert.surf_prediction_side && alert.surf_prediction_side !== "NONE"
      ? alert.surf_prediction_side
      : alert.surf_side,
  );
  if (!side) return null;

  const memory = alert.dailySurfMemory;
  const memorySide =
    memory?.surfBias ?? memory?.stretchedSide ?? memory?.recoverySide ?? memory?.dominantSide;
  const memoryAligned = Boolean(memorySide && memorySide === side);
  const blockedByMemory =
    memoryAligned &&
    (memory?.surfStatus === "RISCO_QUEBRA" || memory?.surfStatus === "SURF_ESTICADO");
  const confidence = clampPercent(alert.surf_prediction_confidence ?? alert.surf_confidence);
  if (!alert.surf_alert || blockedByMemory || confidence < 60) return null;

  const record = readRecord(alert);
  const sourceKey =
    readString(record, "id") ||
    readString(record, "signalId") ||
    readString(record, "eventId") ||
    latestRound?.id ||
    "current";
  return {
    moduleKey: "surf_alert" as const,
    signalKey: `live-surf:${sourceKey}:${side}`,
    side,
    attempt: "SG" as const,
  };
}

function resolveTieSignal(data: DashboardData, latestRound: Round | null) {
  if (data.moduleToggles?.tieAlert === false) return null;
  const alert = data.currentTieAlert;
  const strongLevel = normalizeText(alert.level).includes("ALTO");
  if (alert.status !== "active" || (!strongLevel && Number(alert.confidence) < 65)) {
    return null;
  }

  return {
    moduleKey: "ties_only" as const,
    signalKey: `live-tie:${alert.id || latestRound?.id || "current"}:${alert.confidence}`,
    side: "TIE" as const,
    attempt: "",
  };
}

function resolvePatternSignal(data: DashboardData, latestRound: Round | null) {
  const officialCycle = readRecord(data.patternIaServerCycle);
  const officialModule = normalizeText(officialCycle.module);
  const officialStatus = normalizeText(officialCycle.cycleStatus ?? officialCycle.cycle_status);
  const officialSide = normalizeSide(
    officialCycle.technicalSide ?? officialCycle.technical_side ?? officialCycle.sideCode,
  );
  if (
    officialModule === "PADROES_IA" &&
    (officialStatus === "AGUARDANDO_RESULTADO" || officialStatus === "AGUARDANDO_G1") &&
    officialSide
  ) {
    const attempt = officialStatus === "AGUARDANDO_G1" ? "G1" : "SG";
    const sourceKey =
      readString(officialCycle, "signalId") ||
      readString(officialCycle, "eventId") ||
      readString(officialCycle, "patternId") ||
      readString(officialCycle, "sourceRoundId") ||
      latestRound?.id ||
      "current";
    return {
      moduleKey: "ai_patterns" as const,
      signalKey: `live-pattern-cycle:${sourceKey}:${officialSide}:${attempt}`,
      side: officialSide,
      attempt,
    };
  }

  const snapshot = data.patternMinerSnapshot;
  if (!snapshot || patternSnapshotIsOld(snapshot.updatedAt, data.updatedAt)) return null;
  const latestRoundId = Number(latestRound?.id);
  const candidates = snapshot.entryAlerts
    .filter((alert) => alert.kind === "validated")
    .filter((alert) => alertRoundId(alert) === latestRoundId)
    .filter((alert) => patternStrategyIsConfirmed(alert.strategy))
    .sort((left, right) => comparePatternStrategies(left.strategy, right.strategy));
  const alert = candidates[0];
  const side = normalizeSide(alert?.strategy.expectedResult);
  if (!alert || !side) return null;

  return {
    moduleKey: "ai_patterns" as const,
    signalKey: `live-pattern:${alert.signalId || alert.signal_id || alert.id}:${latestRoundId}:${side}`,
    side,
    attempt: "SG" as const,
  };
}

function resolveLateralSignal(
  data: DashboardData,
  latestRound: Round | null,
  moduleKey: "lateral_paying_numbers" | "lateral_tie_patterns",
) {
  const probe =
    moduleKey === "lateral_paying_numbers"
      ? detectLateralPayingNumbersConfirmedCard(data, latestRound)
      : detectLateralTiePatternsConfirmedCard(data, latestRound);
  if (!probe.confirmed || !probe.signalKey) return null;

  return {
    moduleKey,
    signalKey: probe.signalKey,
    side: normalizeSide(probe.meta?.side) ?? "TIE",
    attempt: normalizeAttempt(probe.meta?.attempt),
  };
}

function neuralReadingIsBlocked(reading: NeuralReading) {
  return Boolean(
    reading.blocked ||
    reading.isRedAlert ||
    (reading.isSaturated && typeof reading.numero === "number"),
  );
}

function neuralDisplayNumber(reading: NeuralReading) {
  if (typeof reading.numero === "number") return reading.numero;
  if (typeof reading.oppositeNumber === "number") return reading.oppositeNumber;
  if (typeof reading.triggerNumber === "number") return reading.triggerNumber;
  return null;
}

function shouldHideResolvedNeuralEntry(
  side: LiveConfirmedSignal["side"],
  result: NeuralEntryLastResult | null | undefined,
) {
  if (!result?.id) return false;
  const resultSide = normalizeSide(result.expectedSide ?? result.origem);
  if (resultSide !== side) return false;
  if (!result.finishedAt) return true;
  const finishedAt = Date.parse(result.finishedAt);
  if (!Number.isFinite(finishedAt)) return false;
  return Date.now() - finishedAt < RESOLVED_NEURAL_ENTRY_SUPPRESS_MS;
}

function patternSnapshotIsOld(snapshotUpdatedAt: string, dashboardUpdatedAt?: string) {
  const snapshotMs = Date.parse(snapshotUpdatedAt || "");
  if (!Number.isFinite(snapshotMs)) return true;
  const dashboardMs = Date.parse(dashboardUpdatedAt || "");
  if (Number.isFinite(dashboardMs)) {
    return snapshotMs + PATTERN_SNAPSHOT_MAX_AGE_MS < dashboardMs;
  }
  return Date.now() - snapshotMs > PATTERN_SNAPSHOT_MAX_AGE_MS;
}

function patternStrategyIsConfirmed(strategy: PatternMinerStrategy) {
  return Boolean(
    strategy.expectedResult &&
    !strategy.insufficientSample &&
    strategy.occurrences >= PATTERN_MIN_OCCURRENCES &&
    strategy.totalValidated >= PATTERN_MIN_VALIDATED &&
    typeof strategy.assertiveness === "number" &&
    recentPatternReds(strategy) <= 2,
  );
}

function comparePatternStrategies(left: PatternMinerStrategy, right: PatternMinerStrategy) {
  const redDiff = recentPatternReds(left) - recentPatternReds(right);
  if (redDiff !== 0) return redDiff;
  const accuracyDiff = Number(right.assertiveness || 0) - Number(left.assertiveness || 0);
  if (accuracyDiff !== 0) return accuracyDiff;
  return right.totalValidated - left.totalValidated;
}

function recentPatternReds(strategy: PatternMinerStrategy) {
  const record = readRecord(strategy);
  const explicit = Number(record.recentReds ?? record.recent_reds ?? record.recentRedCount);
  if (Number.isFinite(explicit)) return explicit;
  if (Number.isFinite(strategy.sequenceNegative)) return strategy.sequenceNegative;
  return Number(strategy.red) || 0;
}

function alertRoundId(alert: PatternMinerAlert) {
  const explicit = Number(alert.roundId ?? alert.round_id);
  if (Number.isFinite(explicit)) return explicit;
  const matched = Number(alert.matchedRounds.at(-1)?.id);
  return Number.isFinite(matched) ? matched : 0;
}

function normalizeSide(value: unknown): LiveConfirmedSignal["side"] | null {
  const side = normalizeText(value);
  if (side === "B" || side === "BANKER" || side === "BANCA") return "BANKER";
  if (side === "P" || side === "PLAYER" || side === "JOGADOR") return "PLAYER";
  if (side === "T" || side === "TIE" || side === "EMPATE") return "TIE";
  return null;
}

function normalizeAttempt(value: unknown): LiveConfirmedSignal["attempt"] {
  const attempt = normalizeText(value);
  return attempt === "SG" || attempt === "G1" ? attempt : "";
}

function normalizeText(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function clampPercent(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, number));
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return value === null || value === undefined ? "" : String(value).trim();
}
