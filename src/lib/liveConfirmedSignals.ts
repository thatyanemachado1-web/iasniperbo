import {
  analyzeLateralPayingNumbersEntry,
  analyzeLateralTiePatternEntry,
  buildLateralPayingHistory,
  buildLateralTieTimeline,
  type LateralBacBoResult,
} from "../utils/lateralMotors.ts";
import { buildTiePullerStats } from "../tieRadar/TieRadarStatsEngine.ts";
import type {
  DashboardData,
  NeuralEntryLastResult,
  NeuralReading,
  Round,
} from "../types/dashboard.ts";
import type { PatternMinerAlert, PatternMinerStrategy } from "../types/patternMiner.ts";
import { calculateMotorAssertiveness } from "../utils/assertiveness.ts";

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
  headline: string;
  detail: string;
};

export type LiveSignalOutcome = "GREEN" | "RED" | "TIE";

export type LiveConfirmedResult = {
  moduleKey: LiveSignalModuleKey;
  signalKey: string;
  side: "BANKER" | "PLAYER" | "TIE";
  attempt: "SG" | "G1" | "";
  kind: "result";
  outcome: LiveSignalOutcome;
  label: string;
  tieMultiplier?: string | null;
};

export type LiveCardSignal = (LiveConfirmedSignal & { kind: "entry" }) | LiveConfirmedResult;

const PATTERN_MIN_OCCURRENCES = 3;
const PATTERN_MIN_VALIDATED = 2;
const PATTERN_SNAPSHOT_MAX_AGE_MS = 120_000;
const RESOLVED_NEURAL_ENTRY_SUPPRESS_MS = 900;
const OFFICIAL_RESULT_HOLD_MS = 5_000;

export function resolveLiveCardSignal(
  data: DashboardData,
  moduleKey: LiveSignalModuleKey,
  nowMs = Date.now(),
): LiveCardSignal | null {
  return resolveLiveCardSignals(data, moduleKey, nowMs)[0] ?? null;
}

export function resolveLiveCardSignals(
  data: DashboardData,
  moduleKey: LiveSignalModuleKey,
  nowMs = Date.now(),
): LiveCardSignal[] {
  const result = resolveLiveConfirmedResult(data, moduleKey, nowMs);
  const entry = resolveLiveConfirmedSignal(data, moduleKey);
  return [result, entry ? { ...entry, kind: "entry" as const } : null].filter(
    (signal): signal is LiveCardSignal => Boolean(signal),
  );
}

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

function resolveLiveConfirmedResult(
  data: DashboardData,
  moduleKey: LiveSignalModuleKey,
  nowMs: number,
): LiveConfirmedResult | null {
  const latestRound = data.rounds.at(-1) ?? null;
  if (moduleKey === "paying_numbers") return resolveNeuralResult(data, latestRound, nowMs);
  if (moduleKey === "surf_alert") return resolveSurfResult(data, latestRound, nowMs);
  if (moduleKey === "ties_only") return resolveTieResult(data);
  if (moduleKey === "ai_patterns") return resolvePatternResult(data, latestRound, nowMs);
  if (moduleKey === "lateral_paying_numbers") return resolveLateralPayingResult(data);
  return resolveLateralTieResult(data);
}

function resolveNeuralResult(
  data: DashboardData,
  latestRound: Round | null,
  nowMs: number,
): LiveConfirmedResult | null {
  const result = data.neuralEntryLastResult;
  if (
    !result?.id ||
    !isCurrentOfficialResult(result.finishedAt, result.resultRoundKey, latestRound, nowMs)
  ) {
    return null;
  }
  const outcome = normalizeOutcome(result.outcome);
  if (!outcome) return null;
  const attempt = result.kind === "g1" || result.kind === "tie_g1" ? "G1" : "SG";
  const side = normalizeSide(result.expectedSide ?? result.origem) ?? "TIE";
  const tieMultiplier = result.tieMultiplier ? `${result.tieMultiplier}X` : null;
  return {
    moduleKey: "paying_numbers" as const,
    signalKey: `live-neural-result:${result.id}:${result.kind}:${outcome}`,
    side,
    attempt,
    kind: "result" as const,
    outcome,
    label: resultLabel(outcome, attempt, tieMultiplier),
    tieMultiplier,
  };
}

function resolveSurfResult(
  data: DashboardData,
  latestRound: Round | null,
  nowMs: number,
): LiveConfirmedResult | null {
  const cycle = data.currentSurfAlert?.surfCycle;
  if (!cycle || cycle.cycleStatus !== "CLOSED") return null;
  const outcome = normalizeOutcome(cycle.result);
  if (
    !outcome ||
    !isCurrentOfficialResult(cycle.closedAt, cycle.resultRoundId, latestRound, nowMs)
  ) {
    return null;
  }
  const side = normalizeSide(cycle.technicalSide) ?? "TIE";
  const tieMultiplier = normalizeMultiplier(cycle.tieMultiplier);
  return {
    moduleKey: "surf_alert" as const,
    signalKey: `live-surf-result:${cycle.cycleId || cycle.resultRoundId || "current"}:${outcome}`,
    side,
    attempt: "SG" as const,
    kind: "result" as const,
    outcome,
    label: resultLabel(outcome, "SG", tieMultiplier),
    tieMultiplier,
  };
}

function resolveTieResult(data: DashboardData): LiveConfirmedResult | null {
  const alert = data.currentTieAlert;
  if (!alert?.id || alert.status !== "green") return null;
  return {
    moduleKey: "ties_only" as const,
    signalKey: `live-tie-result:${alert.id}:green`,
    side: "TIE" as const,
    attempt: "" as const,
    kind: "result" as const,
    outcome: "TIE" as const,
    label: "EMPATE CONFIRMADO",
    tieMultiplier: null,
  };
}

function resolvePatternResult(
  data: DashboardData,
  latestRound: Round | null,
  nowMs: number,
): LiveConfirmedResult | null {
  const cycle = readRecord(data.patternIaServerCycle);
  if (
    normalizeText(cycle.module) !== "PADROES_IA" ||
    normalizeText(cycle.cycleStatus) !== "CLOSED"
  ) {
    return null;
  }
  const outcome = normalizeOutcome(cycle.result);
  if (!outcome) return null;
  const rawResult = normalizeText(cycle.result);
  const attempt = rawResult.endsWith("_G1") || normalizeText(cycle.attempt) === "G1" ? "G1" : "SG";
  const resultRoundId = attempt === "G1" ? cycle.g1RoundId : cycle.entryRoundId;
  if (!isCurrentOfficialResult(cycle.closedAt, resultRoundId, latestRound, nowMs)) return null;
  const side =
    normalizeSide(cycle.technicalSide ?? cycle.technical_side ?? cycle.sideCode) ?? "TIE";
  const tieMultiplier = normalizeMultiplier(cycle.tieMultiplier);
  const sourceKey =
    readString(cycle, "signalId") ||
    readString(cycle, "eventId") ||
    readString(cycle, "patternId") ||
    String(resultRoundId || "current");
  return {
    moduleKey: "ai_patterns" as const,
    signalKey: `live-pattern-result:${sourceKey}:${outcome}:${attempt}`,
    side,
    attempt,
    kind: "result" as const,
    outcome,
    label: resultLabel(outcome, attempt, tieMultiplier),
    tieMultiplier,
  };
}

function resolveLateralPayingResult(data: DashboardData): LiveConfirmedResult | null {
  const results = readDashboardLateralResults(data);
  const latestResult = results.at(-1);
  if (!latestResult) return null;
  const item = buildLateralPayingHistory(results, data.rounds).at(-1);
  if (!item || item.resultId !== String(latestResult.id)) return null;
  const outcome =
    item.isTie || item.outcome === "TIE" ? "TIE" : item.outcome === "RED" ? "RED" : "GREEN";
  const attempt = item.outcome === "G1" || item.outcome === "RED" ? "G1" : "SG";
  const tieMultiplier = item.tieLabel && item.tieLabel !== "EMPATE" ? item.tieLabel : null;
  return {
    moduleKey: "lateral_paying_numbers" as const,
    signalKey: `live-lateral-paying-result:${item.id}:${outcome}`,
    side: item.target,
    attempt,
    kind: "result" as const,
    outcome,
    label: resultLabel(outcome, outcome === "RED" ? "" : attempt, tieMultiplier),
    tieMultiplier,
  };
}

function resolveLateralTieResult(data: DashboardData): LiveConfirmedResult | null {
  const results = readDashboardLateralResults(data);
  const latestResult = results.at(-1);
  if (!latestResult) return null;
  const latestPosition = Number.isInteger(latestResult.slot)
    ? Number(latestResult.slot)
    : results.length - 1;
  const item = buildLateralTieTimeline(results).history.at(-1);
  if (!item?.formation || item.order !== latestPosition) return null;
  const outcome = item.result === "TIE" ? "TIE" : "RED";
  const attempt = item.attempt ?? "";
  const tieMultiplier = item.multiplier ? `${item.multiplier}X` : null;
  return {
    moduleKey: "lateral_tie_patterns" as const,
    signalKey: `live-lateral-tie-result:${item.id}:${outcome}`,
    side: "TIE" as const,
    attempt,
    kind: "result" as const,
    outcome,
    label: resultLabel(outcome, outcome === "RED" ? "" : attempt, tieMultiplier),
    tieMultiplier,
  };
}

function resolveNeuralSignal(
  data: DashboardData,
  latestRound: Round | null,
): LiveConfirmedSignal | null {
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
    data.displayState === "waiting_result" ||
    data.neuralEntryState?.status === "awaiting_g1" ||
    cycleStatus === "AGUARDANDO_G1"
      ? "G1"
      : "SG";
  const entryStateKey = data.neuralEntryState?.key;
  const triggerRoundKey = data.neuralEntryState?.triggerRoundKey;
  const sourceKey =
    (entryStateKey && triggerRoundKey
      ? `${entryStateKey}:trigger:${triggerRoundKey}`
      : entryStateKey) ||
    reading.entryRoundId ||
    reading.triggerRoundId ||
    data.displayRoundId ||
    latestRound?.id ||
    data.revision ||
    data.sequenceId ||
    "current";
  const presentation = neuralSignalPresentation(data, reading, side, attempt, hasNumber);

  return {
    moduleKey: "paying_numbers" as const,
    signalKey: `live-neural:${sourceKey}:${side}:${attempt}`,
    side,
    attempt,
    ...presentation,
  };
}

function resolveSurfSignal(
  data: DashboardData,
  latestRound: Round | null,
): LiveConfirmedSignal | null {
  if (data.moduleToggles?.surfAnalyzer === false) return null;
  const alert = data.currentSurfAlert;
  if (!alert) return null;
  if (alert.surfCycle?.cycleStatus === "CLOSED") return null;

  const cycleSide = normalizeSide(alert.surfCycle?.technicalSide);
  if (
    alert.surfCycle?.cycleStatus === "AGUARDANDO_RESULTADO" &&
    (cycleSide === "BANKER" || cycleSide === "PLAYER")
  ) {
    const cycleKey =
      alert.surfCycle.cycleId || alert.surfCycle.entryRoundId || latestRound?.id || "current";
    return {
      moduleKey: "surf_alert" as const,
      signalKey: `live-surf-cycle:${cycleKey}:${cycleSide}`,
      side: cycleSide,
      attempt: "SG" as const,
      headline: `Seguir ${cycleSide}`,
      detail: "Aguardando resultado SG",
    };
  }

  const side = normalizeSide(
    alert.surf_prediction_side && alert.surf_prediction_side !== "NONE"
      ? alert.surf_prediction_side
      : alert.surf_side,
  );
  if (side !== "BANKER" && side !== "PLAYER") return null;

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
  const presentation = surfSignalPresentation(alert, side, confidence);
  return {
    moduleKey: "surf_alert" as const,
    signalKey: `live-surf:${sourceKey}:${side}`,
    side,
    attempt: "SG" as const,
    ...presentation,
  };
}

function resolveTieSignal(
  data: DashboardData,
  latestRound: Round | null,
): LiveConfirmedSignal | null {
  if (data.moduleToggles?.tieAlert === false) return null;
  const alert = data.currentTieAlert;
  const strongLevel = normalizeText(alert.level).includes("ALTO");
  if (alert.status !== "active" || (!strongLevel && Number(alert.confidence) < 65)) {
    return null;
  }
  const presentation = tieSignalPresentation(data);

  return {
    moduleKey: "ties_only" as const,
    signalKey: `live-tie:${alert.id || latestRound?.id || "current"}:${alert.confidence}`,
    side: "TIE" as const,
    attempt: "",
    ...presentation,
  };
}

function resolvePatternSignal(
  data: DashboardData,
  latestRound: Round | null,
): LiveConfirmedSignal | null {
  const officialCycle = readRecord(data.patternIaServerCycle);
  const officialModule = normalizeText(officialCycle.module);
  const officialStatus = normalizeText(officialCycle.cycleStatus ?? officialCycle.cycle_status);
  const officialSide = normalizeSide(
    officialCycle.technicalSide ?? officialCycle.technical_side ?? officialCycle.sideCode,
  );
  if (officialModule === "PADROES_IA" && officialStatus === "CLOSED") return null;
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
      headline: attempt === "G1" ? "AGUARDANDO G1" : "ENTRADA CONFIRMADA",
      detail:
        attempt === "G1"
          ? `Nao marcou RED ainda - proteger ${officialSide}`
          : `${officialSide} - aguardando resultado`,
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
    headline: `ENTRADA ${side}`,
    detail: `Lado tecnico: ${side}`,
  };
}

function resolveLateralSignal(
  data: DashboardData,
  _latestRound: Round | null,
  moduleKey: "lateral_paying_numbers" | "lateral_tie_patterns",
): LiveConfirmedSignal | null {
  const results = readDashboardLateralResults(data);
  if (moduleKey === "lateral_paying_numbers") {
    const analysis = analyzeLateralPayingNumbersEntry(results);
    if (!analysis.confirmed || !analysis.signalKey || !analysis.active) return null;
    const pattern = analysis.active.pattern;
    const greens = pattern.sg + pattern.g1;
    const force =
      greens + pattern.reds > 0 ? Math.round((greens / (greens + pattern.reds)) * 100) : 0;
    const side = pattern.target;
    return {
      moduleKey,
      signalKey: analysis.signalKey,
      side,
      attempt: analysis.active.attempt,
      headline:
        analysis.active.attempt === "G1"
          ? `Aguardando G1 ${liveSideLabel(side)}`
          : `Entrada ${liveSideLabel(side)}`,
      detail: `${liveSideLabel(side)} • até G1 • ${force}% na amostra atual`,
    };
  }

  const analysis = analyzeLateralTiePatternEntry(results);
  if (!analysis.confirmed || !analysis.signalKey || !analysis.active) return null;
  const timeline = buildLateralTieTimeline(results);
  const history = timeline.history.slice(-30);
  const tieCount = history.filter((item) => item.result === "TIE").length;
  const reds = history.filter((item) => item.result === "RED").length;
  const resolved = tieCount + reds;
  const strength = resolved ? Math.round((tieCount / resolved) * 100) : 0;
  const headline = analysis.horizontalTieRisk
    ? analysis.active.attempt === "G1"
      ? "Risco de empate • G1"
      : "Risco de empate"
    : analysis.dryTieRisk
      ? "Risco de empate seco"
      : analysis.active.attempt === "G1"
        ? "Aguardando G1 Empate"
        : "Entrada Empate";
  const detail = analysis.horizontalTieRisk
    ? analysis.active.attempt === "G1"
      ? "SG não pagou • proteção EMPATE no G1"
      : "5ª casa alinhada • entrada EMPATE liberada até G1"
    : analysis.dryTieRisk
      ? "Formação com 2 REDs • entrada EMPATE liberada até G1"
      : `Empate • até G1 • ${strength || 100}% na amostra atual`;

  return {
    moduleKey,
    signalKey: analysis.signalKey,
    side: "TIE",
    attempt: analysis.active.attempt,
    headline,
    detail,
  };
}

function readDashboardLateralResults(data: DashboardData): LateralBacBoResult[] {
  const beadPlate = (data as DashboardData & { bacBoBeadPlate?: unknown[] }).bacBoBeadPlate;
  const exactResults = Array.isArray(beadPlate) ? beadPlate : [];
  if (exactResults.length) {
    const results: LateralBacBoResult[] = [];
    exactResults.forEach((value, index) => {
      const record = readRecord(value);
      const side = normalizeSide(record.side);
      const slot = Number.isInteger(Number(record.slot)) ? Number(record.slot) : index;
      const valueNumber = Number(record.value);
      if (!side || !Number.isFinite(valueNumber) || slot < 0 || slot >= 156) return;
      results.push({
        id: readString(record, "id") || `slot-${slot}`,
        side,
        value: valueNumber,
        slot,
        time: readString(record, "time") || null,
        tieMultiplier: readOptionalNumber(record.tieMultiplier),
      });
    });
    return results.sort((left, right) => Number(left.slot) - Number(right.slot)).slice(-200);
  }

  const uniqueRounds = new Map<number, Round>();
  for (const round of data.rounds) {
    const id = Number(round?.id);
    if (Number.isFinite(id)) uniqueRounds.set(id, round);
  }
  return [...uniqueRounds.values()]
    .sort((left, right) => Number(left.id) - Number(right.id))
    .slice(-200)
    .map((round, slot) => ({
      id: String(round.id),
      side: round.result === "P" ? "PLAYER" : round.result === "B" ? "BANKER" : "TIE",
      value: round.result === "P" ? Number(round.playerScore) : Number(round.bankerScore),
      slot,
      time: round.time || null,
      tieMultiplier: readOptionalNumber(round.tieMultiplier),
    }));
}

function neuralSignalPresentation(
  data: DashboardData,
  reading: NeuralReading,
  side: LiveConfirmedSignal["side"],
  attempt: LiveConfirmedSignal["attempt"],
  hasNumber: boolean,
) {
  const strength = neuralSignalStrength(data, reading);
  const strengthLabel =
    reading.accuracyLabel ?? (strength === null ? "--" : `${Math.round(strength)}%`);
  return {
    headline:
      attempt === "G1"
        ? `Aguardando G1 ${entrySideToken(side)}`
        : `Entrada ${entrySideToken(side)}`,
    detail: hasNumber
      ? `${neuralSideLabel(side)} - ate ${reading.validade ?? "G1"} - ${strengthLabel}`
      : `${neuralSideLabel(side)} - entrada confirmada pela engine`,
  };
}

function neuralSignalStrength(data: DashboardData, reading: NeuralReading) {
  const direct = neuralAccuracyFrom(reading.assertividade, reading.acertos, reading.erros);
  if (direct !== null) return direct;

  const scoreboard = data.neuralScoreboard;
  const sg = optionalFiniteNumber(scoreboard?.greenSemGale ?? reading.greenSemGale);
  const g1 = optionalFiniteNumber(scoreboard?.greenG1 ?? reading.greenG1);
  const splitGreens = sg !== null || g1 !== null ? (sg ?? 0) + (g1 ?? 0) : null;
  const greens = optionalFiniteNumber(
    splitGreens ?? scoreboard?.greens ?? scoreboard?.acertos ?? reading.acertos,
  );
  const reds = optionalFiniteNumber(
    scoreboard?.reds ?? scoreboard?.erros ?? reading.reds ?? reading.erros,
  );
  return (
    neuralAccuracyFrom(null, greens, reds) ??
    optionalFiniteNumber(scoreboard?.assertividade ?? reading.assertividade)
  );
}

function neuralAccuracyFrom(
  assertiveness?: number | null,
  greens?: number | null,
  reds?: number | null,
) {
  if (typeof greens === "number" || typeof reds === "number") {
    const total = (greens ?? 0) + (reds ?? 0);
    return total > 0 ? calculateMotorAssertiveness(greens ?? 0, reds ?? 0) : null;
  }
  return optionalFiniteNumber(assertiveness);
}

function surfSignalPresentation(
  alert: NonNullable<DashboardData["currentSurfAlert"]>,
  side: "BANKER" | "PLAYER",
  confidence: number,
) {
  const memory = alert.dailySurfMemory;
  const memoryStatus = memory?.surfStatus;
  const memorySide =
    memory?.surfBias ?? memory?.stretchedSide ?? memory?.recoverySide ?? memory?.dominantSide;
  const memoryAligned = Boolean(memorySide && memorySide === side);
  const breakRisk = clampPercent(
    memoryAligned && memoryStatus === "RISCO_QUEBRA"
      ? Math.max(alert.surf_break_risk ?? alert.surf_risk, 76)
      : memoryAligned && memoryStatus === "SURF_ESTICADO"
        ? Math.max(alert.surf_break_risk ?? alert.surf_risk, 58)
        : (alert.surf_break_risk ?? alert.surf_risk),
  );
  const statusLabel =
    memoryAligned && memoryStatus && memoryStatus !== "SEM_SURF"
      ? `${formatSurfStatus(memoryStatus)}${memorySide ? ` ${memorySide}` : ""}`
      : formatSurfStatus(alert.surf_status ?? alert.surf_phase);
  return {
    headline: `Seguir ${side}`,
    detail: `${statusLabel} - Forca ${confidence}% - Quebra ${breakRisk}%`,
  };
}

function tieSignalPresentation(data: DashboardData) {
  const alert = data.currentTieAlert;
  const mainTiePuller =
    data.tieAlertScoreboard?.tiePullers?.[0] ?? buildTiePullerStats(data.rounds, 7, 5)[0];
  return {
    headline: "Possivel Tie",
    detail: mainTiePuller
      ? `${tiePullerSideLabel(mainTiePuller.side)} ${mainTiePuller.score} com ${mainTiePuller.ties} Tie - Validade ${alert.validityRounds}r`
      : `Pressao alta - Validade ${alert.validityRounds} rodadas`,
  };
}

function neuralSideLabel(side: LiveConfirmedSignal["side"]) {
  if (side === "BANKER") return "Banker";
  if (side === "PLAYER") return "Player";
  return "Empate";
}

function entrySideToken(side: LiveConfirmedSignal["side"]) {
  return side === "TIE" ? "TIE" : side;
}

function liveSideLabel(side: LiveConfirmedSignal["side"]) {
  return side === "TIE" ? "EMPATE" : side;
}

function tiePullerSideLabel(side: "B" | "P" | "T") {
  if (side === "B") return "Banker";
  if (side === "P") return "Player";
  return "Tie";
}

function formatSurfStatus(status: string | null | undefined) {
  return String(status ?? "ANALISANDO").replaceAll("_", " ");
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

function isCurrentOfficialResult(
  timestamp: unknown,
  resultRoundId: unknown,
  latestRound: Round | null,
  nowMs: number,
) {
  const timestampMs = Date.parse(String(timestamp || ""));
  if (Number.isFinite(timestampMs)) {
    const age = nowMs - timestampMs;
    return age >= -5_000 && age <= OFFICIAL_RESULT_HOLD_MS;
  }
  const resultKey = String(resultRoundId ?? "").trim();
  return Boolean(resultKey && latestRound && resultKey === String(latestRound.id));
}

function normalizeOutcome(value: unknown): LiveSignalOutcome | null {
  const outcome = normalizeText(value);
  if (outcome === "GREEN" || outcome === "GREEN_G1") return "GREEN";
  if (outcome === "RED") return "RED";
  if (outcome === "TIE" || outcome === "EMPATE" || outcome === "EMPATE_G1") return "TIE";
  return null;
}

function normalizeMultiplier(value: unknown) {
  const raw = String(value ?? "")
    .trim()
    .toUpperCase();
  if (!raw) return null;
  return raw.endsWith("X") ? raw : `${raw}X`;
}

function resultLabel(
  outcome: LiveSignalOutcome,
  attempt: LiveConfirmedSignal["attempt"],
  tieMultiplier?: string | null,
) {
  if (outcome === "RED") return "RED";
  if (outcome === "TIE") return `EMPATE${tieMultiplier ? ` ${tieMultiplier}` : ""}`;
  return `GREEN${attempt ? ` ${attempt}` : ""}`;
}

function normalizeSide(value: unknown): LiveConfirmedSignal["side"] | null {
  const side = normalizeText(value);
  if (side === "B" || side === "BANKER" || side === "BANCA") return "BANKER";
  if (side === "P" || side === "PLAYER" || side === "JOGADOR") return "PLAYER";
  if (side === "T" || side === "TIE" || side === "EMPATE") return "TIE";
  return null;
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
  return Math.max(0, Math.min(100, Math.round(number)));
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

function readOptionalNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function optionalFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
