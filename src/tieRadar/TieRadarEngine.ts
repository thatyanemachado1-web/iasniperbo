import { filterRoundsForCycleDate, surfBrasiliaDateKey } from "../surf/SurfAnalyzerEngine.ts";
import type { Round, TieAlert, TiePullerStat } from "../types/dashboard.ts";
import { buildTiePullerStats } from "./TieRadarStatsEngine.ts";

const ANALYSIS_WINDOW = 80;
const VALIDITY_ROUNDS = 4;

export type TieRadarSource = "engine" | "publisher" | "merged";

export interface TieRadarResult {
  alert: TieAlert;
  tiePullers: TiePullerStat[];
  source: TieRadarSource;
}

export class TieRadarEngine {
  static empty(cycleDate = surfBrasiliaDateKey()): TieRadarResult {
    return {
      alert: {
        id: `tie-radar-${cycleDate}`,
        level: "Baixo",
        confidence: 0,
        validityRounds: VALIDITY_ROUNDS,
        status: "expired",
        source: "engine",
      },
      tiePullers: [],
      source: "engine",
    };
  }

  static analyze(rounds: Round[], cycleDate = surfBrasiliaDateKey()): TieRadarResult {
    const window = filterRoundsForCycleDate(rounds, cycleDate).slice(-ANALYSIS_WINDOW);
    if (window.length < 3) {
      return {
        ...TieRadarEngine.empty(cycleDate),
        alert: {
          ...TieRadarEngine.empty(cycleDate).alert,
          confidence: window.length ? clampPercent(window.filter((round) => round.result === "T").length * 20) : 0,
        },
      };
    }

    const pullers = buildTiePullerStats(window, 7, 5);
    const pressure = tiePressureFromRounds(window);
    const recent = window.slice(-15);
    const recentTies = recent.filter((round) => round.result === "T").length;
    const lastRound = window[window.length - 1];
    const roundsSinceLastTie = countRoundsSinceLastTie(window);
    const bestPuller = pullers[0];
    const classification = classifyTieRadar({
      pressure,
      recentTies,
      roundsSinceLastTie,
      bestPuller,
      lastWasTie: lastRound?.result === "T",
    });

    return {
      alert: {
        id: `tie-radar-${cycleDate}-${window.length}`,
        level: classification.level,
        confidence: classification.confidence,
        validityRounds: VALIDITY_ROUNDS,
        status: classification.status,
        source: "engine",
      },
      tiePullers: pullers,
      source: "engine",
    };
  }

  static mergeWithIncoming(computed: TieRadarResult, incoming: TieAlert | undefined): TieRadarResult {
    if (!incoming) return computed;

    const incomingActive =
      incoming.status === "active" &&
      (normalizeRisk(incoming.level) !== "BAIXO" || incoming.confidence >= 55);
    if (!incomingActive) return computed;

    return {
      ...computed,
      alert: {
        ...computed.alert,
        level: rankLevel(incoming.level) >= rankLevel(computed.alert.level) ? incoming.level : computed.alert.level,
        confidence: Math.max(computed.alert.confidence, clampPercent(incoming.confidence)),
        validityRounds: incoming.validityRounds || computed.alert.validityRounds,
        status: incoming.status === "green" ? "green" : computed.alert.status,
        source: "merged",
      },
      source: "merged",
    };
  }
}

function tiePressureFromRounds(rounds: Round[]) {
  const recent = rounds.slice(-15);
  return (recent.filter((round) => round.result === "T").length / Math.max(recent.length, 1)) * 100;
}

function classifyTieRadar(input: {
  pressure: number;
  recentTies: number;
  roundsSinceLastTie: number;
  bestPuller?: TiePullerStat;
  lastWasTie: boolean;
}) {
  const { pressure, recentTies, roundsSinceLastTie, bestPuller, lastWasTie } = input;
  const pullerStrong = Boolean(bestPuller && bestPuller.ties >= 2 && bestPuller.hitRate >= 45);
  const pullerWatch = Boolean(bestPuller && bestPuller.ties >= 1 && bestPuller.hitRate >= 30);

  if (lastWasTie && (pressure >= 12 || pullerWatch)) {
    return {
      level: "Alto" as const,
      confidence: clampPercent(72 + recentTies * 6 + (bestPuller?.hitRate ?? 0) / 5),
      status: "green" as const,
    };
  }

  if (roundsSinceLastTie > VALIDITY_ROUNDS + 2 && pressure < 10 && !pullerWatch) {
    return {
      level: "Baixo" as const,
      confidence: clampPercent(Math.max(pressure, 8)),
      status: "expired" as const,
    };
  }

  if (pressure >= 20 || recentTies >= 2 || pullerStrong) {
    return {
      level: "Alto" as const,
      confidence: clampPercent(68 + pressure * 0.8 + (bestPuller?.hitRate ?? 0) / 4),
      status: "active" as const,
    };
  }

  if (pressure >= 12 || pullerWatch || recentTies >= 1) {
    return {
      level: "Medio" as const,
      confidence: clampPercent(54 + pressure * 0.9 + (bestPuller?.hitRate ?? 0) / 6),
      status: "active" as const,
    };
  }

  return {
    level: "Baixo" as const,
    confidence: clampPercent(28 + pressure),
    status: "expired" as const,
  };
}

function countRoundsSinceLastTie(rounds: Round[]) {
  for (let index = rounds.length - 1; index >= 0; index -= 1) {
    if (rounds[index]?.result === "T") return rounds.length - 1 - index;
  }
  return rounds.length;
}

function normalizeRisk(level: TieAlert["level"]) {
  const text = String(level)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  if (text.includes("ALTO")) return "ALTO";
  if (text.includes("MED")) return "MEDIO";
  return "BAIXO";
}

function rankLevel(level: TieAlert["level"]) {
  const risk = normalizeRisk(level);
  if (risk === "ALTO") return 3;
  if (risk === "MEDIO") return 2;
  return 1;
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}
