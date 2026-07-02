import type { Round, RoundResult, SurfAlert, SurfPhase, SurfSide } from "@/types/dashboard";

const ANALYSIS_WINDOW = 40;
const TIME_ZONE = "America/Sao_Paulo";

export type SurfAnalyzerSource = "engine" | "publisher" | "merged";

export interface SurfAnalyzerResult extends SurfAlert {
  source: SurfAnalyzerSource;
}

export class SurfAnalyzerEngine {
  static empty(): SurfAnalyzerResult {
    return {
      surf_alert: false,
      surf_phase: "SEM_RISCO",
      surf_side: "NONE",
      surf_status: "SEM_SURF",
      surf_risk: 0,
      surf_break_risk: 0,
      surf_confidence: 0,
      stretched_count: 0,
      correction_count: 0,
      reason: "Aguardando rodadas suficientes para analisar o Surf.",
      panels: emptySurfPanels("Aguardando rodadas."),
      surf_prediction_side: "NONE",
      surf_prediction_status: "EXPIRED",
      surf_prediction_confidence: 0,
      surf_prediction_window: 0,
      source: "engine",
    };
  }

  static analyze(rounds: Round[], cycleDate = surfBrasiliaDateKey()): SurfAnalyzerResult {
    const window = normalizeWindow(filterRoundsForCycleDate(rounds, cycleDate));
    if (window.length < 2) {
      return {
        ...SurfAnalyzerEngine.empty(),
        reason:
          window.length === 0
            ? "Novo ciclo diario iniciado. Aguardando rodadas de hoje para analisar o Surf."
            : "Aguardando rodadas suficientes para analisar o Surf.",
      };
    }

    const streak = readSurfStreak(window);
    const alternation = readAlternationRate(window.slice(-15));
    const tiePressure = readTiePressure(window.slice(-15));
    const correctionCount = readCorrectionCount(window, streak.side);
    const classification = classifySurf(streak, alternation, tiePressure, correctionCount);
    const panels = buildSurfPanels(streak, alternation, tiePressure, correctionCount, classification.phase);

    return {
      surf_alert: classification.alert,
      surf_phase: classification.phase,
      surf_side: classification.side,
      surf_status: classification.status,
      surf_risk: classification.breakRisk,
      surf_break_risk: classification.breakRisk,
      surf_confidence: classification.confidence,
      stretched_count: streak.count,
      correction_count: correctionCount,
      reason: classification.reason,
      panels,
      surf_prediction_side: classification.side,
      surf_prediction_status: classification.alert ? "ACTIVE" : "EXPIRED",
      surf_prediction_confidence: classification.confidence,
      surf_prediction_window: streak.count,
      source: "engine",
    };
  }

  static mergeWithIncoming(
    computed: SurfAnalyzerResult,
    incoming: SurfAlert | undefined,
  ): SurfAnalyzerResult {
    if (!incoming) return computed;

    const incomingSide = resolveSurfSide(incoming);
    const computedSide = computed.surf_side;
    const incomingConfidence = clampPercent(incoming.surf_prediction_confidence ?? incoming.surf_confidence ?? 0);
    const computedConfidence = computed.surf_confidence;
    const incomingHasActionableSurf =
      Boolean(incoming.surf_alert) &&
      incomingSide !== "NONE" &&
      incomingConfidence >= 60 &&
      !["SEM_RISCO", "SEM_SURF"].includes(String(incoming.surf_status || incoming.surf_phase || ""));

    if (!incomingHasActionableSurf) return computed;

    const sideAligned = incomingSide === computedSide;
    const confidence = sideAligned
      ? Math.max(computedConfidence, incomingConfidence)
      : Math.max(computedConfidence, incomingConfidence - 8);

    return {
      ...computed,
      surf_alert: true,
      surf_confidence: confidence,
      surf_prediction_confidence: confidence,
      surf_break_risk: Math.max(
        computed.surf_break_risk,
        clampPercent(incoming.surf_break_risk ?? incoming.surf_risk ?? 0),
      ),
      surf_risk: Math.max(computed.surf_risk, clampPercent(incoming.surf_risk ?? 0)),
      reason: `${computed.reason} Publisher confirmou leitura paralela.`,
      panels: hasUsefulPanels(incoming.panels) ? incoming.panels : computed.panels,
      source: "merged",
    };
  }
}

export function surfBrasiliaDateKey(value: string | Date = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const safeDate = Number.isFinite(date.getTime()) ? date : new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(safeDate);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function filterRoundsForCycleDate(rounds: Round[], cycleDate = surfBrasiliaDateKey()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cycleDate)) return rounds;
  return rounds.filter((round) => roundCycleDate(round) === cycleDate);
}

function roundCycleDate(round: Round) {
  const day = (round as Round & { day?: string }).day;
  if (typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day)) return day;
  if (round.time && Number.isFinite(Date.parse(round.time))) return surfBrasiliaDateKey(round.time);
  return "";
}

function normalizeWindow(rounds: Round[]) {
  return rounds
    .filter((round) => round && (round.result === "B" || round.result === "P" || round.result === "T"))
    .slice(-ANALYSIS_WINDOW);
}

function readSurfStreak(rounds: Round[]) {
  let side: RoundResult | null = null;
  let count = 0;

  for (let index = rounds.length - 1; index >= 0; index -= 1) {
    const result = rounds[index].result;
    if (result === "T") continue;
    if (!side) {
      side = result;
      count = 1;
      continue;
    }
    if (result === side) {
      count += 1;
      continue;
    }
    break;
  }

  return { side, count };
}

function readAlternationRate(rounds: Round[]) {
  const sideResults = rounds.filter((round) => round.result !== "T");
  if (sideResults.length < 2) return 0;

  let switches = 0;
  for (let index = 1; index < sideResults.length; index += 1) {
    if (sideResults[index].result !== sideResults[index - 1].result) switches += 1;
  }

  return clampPercent((switches / (sideResults.length - 1)) * 100);
}

function readTiePressure(rounds: Round[]) {
  if (!rounds.length) return 0;
  const ties = rounds.filter((round) => round.result === "T").length;
  return clampPercent((ties / rounds.length) * 100);
}

function readCorrectionCount(rounds: Round[], streakSide: RoundResult | null) {
  if (!streakSide || streakSide === "T") return 0;

  let corrections = 0;
  let previousSide: RoundResult | null = null;
  let run = 0;

  for (const round of rounds) {
    if (round.result === "T") continue;
    if (round.result === previousSide) {
      run += 1;
      continue;
    }
    if (previousSide && run === 1) corrections += 1;
    previousSide = round.result;
    run = 1;
  }

  return corrections;
}

function classifySurf(
  streak: { side: RoundResult | null; count: number },
  alternation: number,
  tiePressure: number,
  correctionCount: number,
) {
  const side = mapRoundSide(streak.side);
  const sideLabel = side === "BANKER" ? "Banker" : side === "PLAYER" ? "Player" : "mesa";
  const noisyRoad = alternation >= 58;
  const heavyTiePressure = tiePressure >= 28;

  if (!side || streak.count < 2) {
    return {
      alert: false,
      phase: "SEM_RISCO" as SurfPhase,
      side: "NONE" as SurfSide,
      status: "SEM_SURF",
      confidence: clampPercent(Math.max(0, 42 - alternation / 4)),
      breakRisk: clampPercent(18 + alternation / 3 + tiePressure / 4),
      reason: "Sem sequencia limpa de Surf no momento.",
    };
  }

  if (streak.count >= 7 || (streak.count >= 6 && (noisyRoad || heavyTiePressure))) {
    return {
      alert: false,
      phase: "RISCO_QUEBRA" as SurfPhase,
      side,
      status: "RISCO_QUEBRA",
      confidence: clampPercent(48 + Math.min(12, streak.count)),
      breakRisk: clampPercent(72 + Math.min(18, streak.count * 2)),
      reason: `${sideLabel} esticou ${streak.count} casas e a mesa mostra sinal de exaustao ou quebra.`,
    };
  }

  if (streak.count >= 6) {
    return {
      alert: true,
      phase: "SURF_EXTREMO" as SurfPhase,
      side,
      status: "SURF_DOMINANTE",
      confidence: clampPercent(86 + Math.min(8, streak.count)),
      breakRisk: clampPercent(38 + alternation / 4 + tiePressure / 5),
      reason: `${sideLabel} em Surf dominante com ${streak.count} casas seguidas.`,
    };
  }

  if (streak.count >= 4) {
    const dominant = streak.count >= 5;
    return {
      alert: true,
      phase: dominant ? ("SURF_EXTREMO" as SurfPhase) : ("SURF_FORTE" as SurfPhase),
      side,
      status: dominant ? "SURF_DOMINANTE" : "SURF_AGRESSIVO",
      confidence: clampPercent(68 + streak.count * 4 - alternation / 6),
      breakRisk: clampPercent(24 + alternation / 5 + tiePressure / 6),
      reason: `${sideLabel} em Surf ${dominant ? "dominante" : "agressivo"} com ${streak.count} casas seguidas.`,
    };
  }

  if (streak.count === 3) {
    return {
      alert: true,
      phase: "CONTINUIDADE" as SurfPhase,
      side,
      status: "SURF_AGRESSIVO",
      confidence: clampPercent(62 + Math.min(8, 12 - alternation / 8)),
      breakRisk: clampPercent(28 + alternation / 4),
      reason: `${sideLabel} formando continuidade com ${streak.count} casas seguidas.`,
    };
  }

  return {
    alert: false,
    phase: "PRE_SURF" as SurfPhase,
    side,
    status: "PRE_SURF",
    confidence: clampPercent(54 + streak.count * 3),
    breakRisk: clampPercent(22 + alternation / 5),
    reason: `${sideLabel} iniciando pre-Surf com ${streak.count} casas seguidas.`,
  };
}

function buildSurfPanels(
  streak: { side: RoundResult | null; count: number },
  alternation: number,
  tiePressure: number,
  correctionCount: number,
  phase: SurfPhase,
) {
  const sideLabel = streak.side === "B" ? "Banker" : streak.side === "P" ? "Player" : "mesa";

  if (!streak.side || streak.count < 2) {
    return emptySurfPanels("Sem continuidade relevante no Big Road.");
  }

  const continuity =
    streak.count >= 4
      ? `${sideLabel} sustenta coluna com ${streak.count} casas seguidas.`
      : `${sideLabel} abre coluna curta com ${streak.count} casas.`;

  const bigEye =
    alternation >= 58
      ? "Big Eye Boy mostra alternancia alta. Cautela antes de seguir."
      : alternation <= 35
        ? "Big Eye Boy confirma tendencia saudavel, sem divergencia forte."
        : "Big Eye Boy neutro, sem divergencia forte.";

  const smallRoad =
    tiePressure >= 28
      ? "Small Road com pressao de empate recente."
      : correctionCount <= 2 && alternation <= 45
        ? "Small Road organizado e alternancia controlada."
        : "Small Road pede confirmacao extra antes de seguir.";

  const cockroach =
    phase === "RISCO_QUEBRA" || phase === "EXAUSTAO"
      ? "Cockroach Pig aponta risco de reversao tardia."
      : streak.count >= 4
        ? "Cockroach Pig confirma continuidade do lado dominante."
        : "Cockroach Pig aguardando confirmacao da coluna.";

  return {
    big_road: continuity,
    big_eye_boy: bigEye,
    small_road: smallRoad,
    cockroach_pig: cockroach,
  };
}

function emptySurfPanels(message: string) {
  return {
    big_road: message,
    big_eye_boy: message,
    small_road: message,
    cockroach_pig: message,
  };
}

function mapRoundSide(result: RoundResult | null): SurfSide {
  if (result === "B") return "BANKER";
  if (result === "P") return "PLAYER";
  return "NONE";
}

function resolveSurfSide(alert: SurfAlert): SurfSide {
  if (alert.surf_prediction_side && alert.surf_prediction_side !== "NONE") {
    return alert.surf_prediction_side;
  }
  return alert.surf_side ?? "NONE";
}

function hasUsefulPanels(panels: SurfAlert["panels"] | undefined) {
  if (!panels) return false;
  const values = [panels.big_road, panels.big_eye_boy, panels.small_road, panels.cockroach_pig];
  return values.some((value) => {
    const text = String(value || "").trim().toLowerCase();
    return text.length > 0 && !text.includes("aguardando");
  });
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}
